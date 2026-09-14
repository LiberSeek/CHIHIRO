import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import {
  type ChatRecord,
  type MessagePart,
  useMessages,
} from "./useMessages";
import { chatApi } from "@/modules/agent/native/src/api/v1";
import { fetchWithAuth } from "@/modules/agent/native/src/api/http";

vi.mock("@/modules/agent/native/src/api/v1", () => ({
  chatApi: {
    sendStreamUrl: vi.fn(() => "/astrbot/api/v1/chat"),
    stopSession: vi.fn(),
  },
  fileApi: {
    contentUrl: vi.fn(),
    getByName: vi.fn(),
  },
}));

vi.mock("@/modules/agent/native/src/api/http", () => ({
  fetchWithAuth: vi.fn(),
}));

const mockedChatApi = vi.mocked(chatApi);
const mockedFetchWithAuth = vi.mocked(fetchWithAuth);

function sseStream(events: unknown[], options: { close?: boolean } = {}) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
      for (const event of events) {
        nextController.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }
      if (options.close !== false) nextController.close();
    },
    cancel: vi.fn(),
  });
  return { stream, controller };
}

function response(
  body: ReadableStream<Uint8Array>,
  contentType = "text/event-stream",
) {
  return {
    ok: true,
    status: 200,
    body,
    headers: new Headers({ "content-type": contentType }),
  } as Response;
}

function createSubject(currentSessionId = "session-a") {
  const sessionRef = ref(currentSessionId);
  const streamUpdates: string[] = [];
  const sessionsChanged = vi.fn();
  const messages = useMessages({
    currentSessionId: sessionRef,
    onStreamUpdate: (sessionId) => streamUpdates.push(sessionId),
    onSessionsChanged: sessionsChanged,
  });

  return { sessionRef, streamUpdates, sessionsChanged, messages };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForCondition(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation((message?: unknown) => {
    if (
      typeof message === "string" &&
      message.includes(
        "onBeforeUnmount is called when there is no active component instance",
      )
    ) {
      return;
    }
    process.stderr.write(`${String(message)}\n`);
  });
  mockedChatApi.sendStreamUrl.mockReturnValue("/astrbot/api/v1/chat");
  mockedChatApi.stopSession.mockResolvedValue({
    data: { status: "ok", data: {} },
  } as Awaited<ReturnType<typeof chatApi.stopSession>>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("native AstrBot useMessages SSE behavior", () => {
  it("posts the hosted AstrBot chat payload and appends incremental content", async () => {
    const { stream } = sseStream([
      { type: "run_started", data: { run_id: "run-1" } },
      { type: "user_message_saved", data: { id: 101 } },
      { type: "plain", data: "你" },
      { type: "plain", data: "好" },
      { type: "message_saved", data: { id: 202, llm_checkpoint_id: "ck-1" } },
      { type: "end" },
    ]);
    mockedFetchWithAuth.mockResolvedValueOnce(response(stream));
    const { messages, streamUpdates, sessionsChanged } = createSubject();
    const { userRecord, botRecord } = messages.createLocalExchange({
      sessionId: "session-a",
      messageId: "msg-1",
      parts: [{ type: "plain", text: "hello" }],
    });

    messages.sendMessageStream({
      sessionId: "session-a",
      messageId: "msg-1",
      parts: [
        { type: "plain", text: "hello" },
        { type: "reply", message_id: 7, selected_text: "quoted text" },
        { type: "image", attachment_id: "att-1", filename: "photo.png" },
      ],
      transport: "sse",
      selectedProvider: "openai",
      selectedModel: "gpt-test",
      enableStreaming: true,
      userRecord,
      botRecord,
    });

    await waitForCondition(() => {
      expect(botRecord.id).toBe(202);
      expect(messages.isSessionRunning("session-a")).toBe(false);
    });

    expect(mockedFetchWithAuth).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetchWithAuth.mock.calls[0];
    expect(url).toBe("/astrbot/api/v1/chat");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      session_id: "session-a",
      message: [
        { type: "plain", text: "hello" },
        { type: "reply", message_id: 7, selected_text: "quoted text" },
        { type: "image", attachment_id: "att-1", filename: "photo.png" },
      ],
      flags: {
        enable_inline_genui: true,
        enable_default_system_prompt: true,
        enable_streaming: true,
      },
      selected_provider: "openai",
      selected_model: "gpt-test",
      _skip_user_history: false,
    });
    expect(userRecord.id).toBe(101);
    expect(botRecord.llm_checkpoint_id).toBe("ck-1");
    expect(botRecord.content.isLoading).toBe(false);
    expect(botRecord.content.message).toEqual([{ type: "plain", text: "你好" }]);
    expect(streamUpdates).toEqual([
      "session-a",
      "session-a",
      "session-a",
      "session-a",
      "session-a",
      "session-a",
    ]);
    expect(sessionsChanged).toHaveBeenCalledTimes(1);
    expect(messages.isSessionRunning("session-a")).toBe(false);
  });

  it("flushes the final SSE event when AstrBot closes without a blank-line terminator", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "plain", data: "tail" })}`),
        );
        controller.close();
      },
    });
    mockedFetchWithAuth.mockResolvedValueOnce(response(stream));
    const { messages } = createSubject();
    const exchange = messages.createLocalExchange({
      sessionId: "session-a",
      messageId: "msg-eof",
      parts: [{ type: "plain", text: "tail" }],
    });

    messages.sendMessageStream({
      sessionId: "session-a",
      messageId: "msg-eof",
      parts: [{ type: "plain", text: "tail" }],
      transport: "sse",
      ...exchange,
    });

    await waitForCondition(() => {
      expect(exchange.botRecord.content.message).toEqual([
        { type: "plain", text: "tail" },
      ]);
      expect(messages.isSessionRunning("session-a")).toBe(false);
    });
  });

  it("aborts the in-flight stream locally and tells AstrBot to stop the session", async () => {
    const { stream } = sseStream([], { close: false });
    mockedFetchWithAuth.mockResolvedValueOnce(response(stream));
    const { messages, sessionsChanged } = createSubject();
    const exchange = messages.createLocalExchange({
      sessionId: "session-a",
      messageId: "msg-stop",
      parts: [{ type: "plain", text: "stop me" }],
    });

    messages.sendMessageStream({
      sessionId: "session-a",
      messageId: "msg-stop",
      parts: [{ type: "plain", text: "stop me" }],
      transport: "sse",
      ...exchange,
    });
    await flushPromises();

    const init = mockedFetchWithAuth.mock.calls[0][1];
    expect(messages.isSessionRunning("session-a")).toBe(true);

    await messages.stopSession("session-a");
    await flushPromises();

    expect(mockedChatApi.stopSession).toHaveBeenCalledWith("session-a");
    expect(init?.signal?.aborted).toBe(true);
    expect(messages.isSessionRunning("session-a")).toBe(false);
    expect(sessionsChanged).not.toHaveBeenCalled();
  });

  it("keeps active messages isolated when sessions switch during streaming", async () => {
    const { stream } = sseStream([
      { type: "plain", data: "first" },
      { type: "end" },
    ]);
    mockedFetchWithAuth.mockResolvedValueOnce(response(stream));
    const { messages, sessionRef } = createSubject("session-a");
    const exchange = messages.createLocalExchange({
      sessionId: "session-a",
      messageId: "msg-a",
      parts: [{ type: "plain", text: "from a" }],
    });

    messages.messagesBySession["session-b"] = [
      {
        id: "b-1",
        content: { type: "bot", message: [{ type: "plain", text: "stored b" }] },
      },
    ];
    messages.sendMessageStream({
      sessionId: "session-a",
      messageId: "msg-a",
      parts: [{ type: "plain", text: "from a" }],
      transport: "sse",
      ...exchange,
    });
    sessionRef.value = "session-b";

    await flushPromises();

    expect(messages.activeMessages.value).toEqual(
      messages.messagesBySession["session-b"],
    );
    expect(messages.messagesBySession["session-a"]).toHaveLength(2);
    expect(messages.messagesBySession["session-a"][1].content.message).toEqual([
      { type: "plain", text: "first" },
    ]);
    expect(messages.messagesBySession["session-b"][0].content.message).toEqual([
      { type: "plain", text: "stored b" },
    ]);
    expect(messages.isMessageStreaming(exchange.botRecord, 0)).toBe(false);
  });

  it("serializes continuation requests without duplicating user history", async () => {
    const { stream } = sseStream([{ type: "plain", data: "continued" }]);
    mockedFetchWithAuth.mockResolvedValueOnce(response(stream));
    const { messages } = createSubject();
    const sourceRecord: ChatRecord = {
      id: "user-1",
      llm_checkpoint_id: "ck-user-1",
      content: {
        type: "user",
        message: [
          { type: "plain", text: "edited text" },
          {
            type: "image",
            filename: "local.png",
            path: "/tmp/local.png",
          } as MessagePart,
        ],
      },
    };

    messages.continueEditedMessage({
      sessionId: "session-a",
      sourceRecord,
      selectedProvider: "provider-a",
      selectedModel: "model-a",
      enableStreaming: false,
    });
    await flushPromises();

    expect(JSON.parse(String(mockedFetchWithAuth.mock.calls[0][1]?.body))).toEqual({
      session_id: "session-a",
      message: [
        { type: "plain", text: "edited text" },
        { type: "image", filename: "local.png" },
      ],
      flags: {
        enable_inline_genui: true,
        enable_default_system_prompt: true,
        enable_streaming: false,
      },
      selected_provider: "provider-a",
      selected_model: "model-a",
      _skip_user_history: true,
      _llm_checkpoint_id: "ck-user-1",
    });
  });
});
