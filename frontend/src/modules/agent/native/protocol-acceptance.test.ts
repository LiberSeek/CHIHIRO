import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { ref } from "vue";

import { configureApiBase } from "./source/api/v1";
import { httpClient, setupHttpClient } from "./source/api/http";
import { useMediaHandling } from "./source/composables/useMediaHandling";
import { useMessages } from "./source/composables/useMessages";
import { useProjects } from "./source/composables/useProjects";

interface FixtureRequest {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: Buffer;
}

const nativeFetch = globalThis.fetch;
const fixtureRequests: FixtureRequest[] = [];
let fixtureOrigin = "";
let previousAdapter: typeof httpClient.defaults.adapter;
let server: ReturnType<typeof createServer>;

function sendJson(response: ServerResponse, data: unknown) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function fixtureAxiosAdapter(config: InternalAxiosRequestConfig) {
  const nodeHttpAdapter = axios.getAdapter("http");
  return nodeHttpAdapter({
    ...config,
    baseURL: `${fixtureOrigin}/astrbot`,
  });
}

beforeEach(async () => {
  fixtureRequests.length = 0;
  previousAdapter = httpClient.defaults.adapter;
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
  const projects = [
    { project_id: "project-1", title: "Workbench", emoji: "📁" },
  ];

  server = createServer(async (request, response) => {
    const body = await readBody(request);
    const fixtureRequest = {
      method: request.method || "GET",
      url: request.url || "/",
      headers: request.headers,
      body,
    };
    fixtureRequests.push(fixtureRequest);

    if (fixtureRequest.url === "/astrbot/api/v1/chat/projects") {
      if (fixtureRequest.method === "POST") {
        const project = {
          project_id: "project-2",
          ...JSON.parse(body.toString("utf8")),
        };
        projects.push(project);
        sendJson(response, { status: "ok", data: project });
        return;
      }
      sendJson(response, { status: "ok", data: projects });
      return;
    }
    if (
      fixtureRequest.url ===
        "/astrbot/api/v1/chat/projects/project-2/sessions/session-1" &&
      fixtureRequest.method === "POST"
    ) {
      sendJson(response, { status: "ok", data: {} });
      return;
    }
    if (
      fixtureRequest.url === "/astrbot/api/v1/chat/projects/project-2/sessions"
    ) {
      sendJson(response, {
        status: "ok",
        data: [{ session_id: "session-1", display_name: "Research chat" }],
      });
      return;
    }
    if (fixtureRequest.url === "/astrbot/api/v1/files") {
      sendJson(response, {
        status: "ok",
        data: {
          attachment_id: "attachment-1",
          filename: "brief.txt",
          type: "file",
        },
      });
      return;
    }
    if (
      fixtureRequest.url === "/astrbot/api/v1/chat" &&
      JSON.parse(body.toString("utf8")).message[0]?.text === "stop me"
    ) {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write('data: {"type":"run_started","data":{"run_id":"run-stop"}}\n\n');
      return;
    }
    if (fixtureRequest.url === "/astrbot/api/v1/chat") {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write('data: {"type":"plain","data":"received"}\n\n');
      response.end('data: {"type":"end"}');
      return;
    }
    if (
      fixtureRequest.url ===
        "/astrbot/api/v1/chat/sessions/session-stop/stop" &&
      fixtureRequest.method === "POST"
    ) {
      sendJson(response, { status: "ok", data: {} });
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  fixtureOrigin = `http://127.0.0.1:${address.port}`;

  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("window", {
    location: { origin: fixtureOrigin, hash: "#/next/agent" },
    fetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      nativeFetch(new URL(String(input), fixtureOrigin), init),
    ),
  });
  configureApiBase(true);
  setupHttpClient();
  httpClient.defaults.adapter = fixtureAxiosAdapter satisfies AxiosAdapter;
});

afterEach(async () => {
  httpClient.defaults.adapter = previousAdapter;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("native Agent protocol acceptance fixtures", () => {
  it("creates and selects a project, then adds and lists its session", async () => {
    const projects = useProjects();
    await projects.getProjects();
    expect(projects.projects.value).toHaveLength(1);

    const created = await projects.createProject(
      "Research",
      "🔬",
      "Notes",
      "custom",
      "/tmp/research",
    );
    expect(created).toMatchObject({ project_id: "project-2" });
    expect(projects.projects.value).toHaveLength(2);

    projects.selectedProjectId.value = "project-2";
    expect(await projects.addSessionToProject("session-1", "project-2")).toBe(
      true,
    );
    expect(await projects.getProjectSessions("project-2")).toEqual([
      { session_id: "session-1", display_name: "Research chat" },
    ]);

    const createRequest = fixtureRequests[1];
    expect(JSON.parse(createRequest.body.toString("utf8"))).toMatchObject({
      title: "Research",
      emoji: "🔬",
      workspace_type: "custom",
      workspace_path: "/tmp/research",
    });
    expect(fixtureRequests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      "GET /astrbot/api/v1/chat/projects",
      "POST /astrbot/api/v1/chat/projects",
      "GET /astrbot/api/v1/chat/projects",
      "POST /astrbot/api/v1/chat/projects/project-2/sessions/session-1",
      "GET /astrbot/api/v1/chat/projects/project-2/sessions",
    ]);
  });

  it("uploads multipart media and sends the returned attachment ID in chat SSE", async () => {
    const media = useMediaHandling();
    const file = new File(["brief"], "brief.txt", { type: "text/plain" });
    const staged = await media.processAndUploadFile(file);
    expect(staged).toMatchObject({
      attachment_id: "attachment-1",
      filename: "brief.txt",
      type: "file",
    });

    const uploadRequest = fixtureRequests[0];
    expect(uploadRequest.headers["content-type"]).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    const multipartBody = uploadRequest.body.toString("utf8");
    expect(multipartBody).toContain('name="file"; filename="brief.txt"');
    expect(multipartBody).toContain("brief");

    const messages = useMessages({ currentSessionId: ref("session-1") });
    const exchange = messages.createLocalExchange({
      sessionId: "session-1",
      messageId: "message-1",
      parts: [{ type: "plain", text: "attach this" }],
    });
    messages.sendMessageStream({
      sessionId: "session-1",
      messageId: "message-1",
      parts: [
        { type: "plain", text: "attach this" },
        {
          type: staged!.type,
          attachment_id: staged!.attachment_id,
          filename: staged!.filename,
        },
      ],
      transport: "sse",
      ...exchange,
    });

    for (
      let attempt = 0;
      attempt < 20 && messages.isSessionRunning("session-1");
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const chatRequest = fixtureRequests[1];
    expect(JSON.parse(chatRequest.body.toString("utf8")).message).toEqual([
      { type: "plain", text: "attach this" },
      {
        type: "file",
        attachment_id: "attachment-1",
        filename: "brief.txt",
      },
    ]);
    expect(exchange.botRecord.content.message).toEqual([
      { type: "plain", text: "received" },
    ]);
  });

  it("aborts the local stream and calls the hosted stop endpoint", async () => {
    const messages = useMessages({ currentSessionId: ref("session-stop") });
    const exchange = messages.createLocalExchange({
      sessionId: "session-stop",
      messageId: "message-stop",
      parts: [{ type: "plain", text: "stop me" }],
    });
    messages.sendMessageStream({
      sessionId: "session-stop",
      messageId: "message-stop",
      parts: [{ type: "plain", text: "stop me" }],
      transport: "sse",
      ...exchange,
    });

    for (let attempt = 0; attempt < 20 && fixtureRequests.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const streamSignal = vi.mocked(window.fetch).mock.calls[0][1]?.signal;
    expect(messages.isSessionRunning("session-stop")).toBe(true);

    await messages.stopSession("session-stop");

    expect(streamSignal?.aborted).toBe(true);
    expect(messages.isSessionRunning("session-stop")).toBe(false);
    expect(fixtureRequests.map(({ method, url }) => `${method} ${url}`)).toContain(
      "POST /astrbot/api/v1/chat/sessions/session-stop/stop",
    );
  });
});
