const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const { WebSocketServer } = require(root + "/node_modules/ws");
const { chromium } = require("playwright-core");
const actions = [];
const interactionChecks = process.argv.includes('--interactions');
const assistantRequests = [];
let assistantHosted = false;
let assistantDraftStatus = 'pending';
const assistantStreams = new Map();
function assistantSnapshot(accountId) {
  const context = { accountId, type: 'private', peerId: '20001' };
  const key = `${accountId}:private:20001`;
  const draft = { ...context, sessionKey: key, id: `draft-${accountId}`, text: '可以为您介绍购买方案。', status: assistantDraftStatus };
  return {
    sessions: [{ ...context, key, title: '客户小林', mode: 'ask', messages: [{ id: 'thinking-1', role: 'thinking', text: '正在整理回复', steps: [{ title: '已读取客户问题' }] }] }],
    drafts: assistantDraftStatus === 'pending' ? [draft] : [], recentDrafts: [draft],
  };
}
function runtimeState() {
  return { accounts: { activeId: 'qq:10001', accounts: [
    { id: 'qq:10001', label: '测试账号 A', online: true, botSessions: { 'private:20001': assistantHosted } },
    { id: 'qq:10002', label: '测试账号 B', online: true },
  ] } };
}
let qaBrowser;
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/runtime/agent/stream')) {
    const accountId = new URL(req.url, 'http://localhost').searchParams.get('accountId');
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify(assistantSnapshot(accountId))}\n\n`);
    assistantStreams.set(res, accountId);
    res.on('close', () => assistantStreams.delete(res));
    return;
  }
  if (req.method === 'POST' && (req.url.startsWith('/api/runtime/agent/') || req.url === '/api/runtime/bot/session')) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      assistantRequests.push({ url: req.url, body });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/runtime/bot/session') {
        assistantHosted = body.enabled;
        res.end(JSON.stringify(runtimeState()));
      } else if (req.url.includes('/draft/')) {
        assistantDraftStatus = req.url.endsWith('approve') ? 'sent' : 'discarded';
        res.end(JSON.stringify({ draft: assistantSnapshot(body.accountId).recentDrafts[0] }));
      } else res.end(JSON.stringify(assistantSnapshot(body.accountId)));
      for (const [stream, accountId] of assistantStreams) stream.write(`data: ${JSON.stringify(assistantSnapshot(accountId))}\n\n`);
    });
    return;
  }
  if (req.url.startsWith("/api/runtime/bot/ensure")) {
    res.setHeader("Content-Type", "application/json");
    res.end("{}");
    return;
  }
  if (req.url.startsWith("/astrbot") || req.url.startsWith("/api/chatui")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", data: [] }));
    return;
  }
  if (req.url.startsWith("/api/runtime/state")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(runtimeState()));
    return;
  }
  const name = req.url.split("?")[0].replace(/^\/next\//, "");
  const file = path.join(
    root,
    "frontend/dist",
    name.includes(".") ? name : "index.html",
  );
  if (!file.startsWith(root + "/frontend/dist/") || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const mime = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };
  res.setHeader(
    "Content-Type",
    mime[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
const wss = new WebSocketServer({ server });
wss.on("connection", (socket, req) => {
  const id = decodeURIComponent(req.url.split("/")[2]).slice(3);
  socket.on("message", (raw) => {
    const f = JSON.parse(raw);
    actions.push({ id, action: f.action, params: f.params });
    let data = {};
    const friend = {
      user_id: 20001,
      nickname: "客户小林 " + id,
      remark: "客户小林 " + id,
      sex: "unknown",
      age: 25,
    };
    const message = {
      self_id: Number(id),
      user_id: 20001,
      message_id: 701,
      message_type: "private",
      sub_type: "friend",
      post_type: "message",
      time: Math.floor(Date.now() / 1000),
      sender: friend,
      raw_message: "请问这款产品如何购买？",
      message: [
        { type: "text", data: { text: "请问这款产品如何购买？" } },
        ...(interactionChecks ? [{ type: 'image', data: { url: 'https://example.test/fixture.svg' } }] : []),
      ],
    };
    switch (f.action) {
      case "get_version_info":
        data = {
          app_name: "NapCat",
          app_version: "4.0.0",
          protocol_version: "v11",
        };
        break;
      case "get_login_info":
        data = { user_id: Number(id), nickname: "测试账号 " + id };
        break;
      case "get_friend_list":
        data = [friend];
        break;
      case "get_group_list":
        data = [
          {
            group_id: 30001,
            group_name: "运营交流群",
            member_count: 4,
            max_member_count: 200,
          },
        ];
        break;
      case "get_recent_contact":
        data = [
          { ...message, peerUin: 20001, chatType: 1, lastestMsg: message },
        ];
        break;
      case "get_friends_with_category":
        data = [{ categoryId: 0, categoryName: "默认", buddyList: [friend] }];
        break;
      case "get_friend_msg_history":
      case "get_group_msg_history":
        data = { messages: [message] };
        break;
      case "get_stranger_info":
        data = friend;
        break;
      case "get_cookies":
        data = { cookies: "" };
        break;
    }
    if (f.action === "send_msg") data = { message_id: 702 };
    if (f.action === "get_msg")
      data = {
        ...message,
        message_id: 702,
        sender: { user_id: Number(id), nickname: "测试账号" },
        message: [{ type: "text", data: { text: "本地模拟消息" } }],
        raw_message: "本地模拟消息",
      };
    socket.send(
      JSON.stringify({ status: "ok", retcode: 0, data, echo: f.echo }),
    );
  });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHIHIRO_BROWSER ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  qaBrowser = browser;
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#aaa"/></svg>',
        }),
  );
  await page.goto(`http://127.0.0.1:${port}/next/im`);
  if (interactionChecks) {
    const assert = require('node:assert/strict');
    await page.getByText('客户小林 10001', { exact: true }).first().click();
    const input = page.locator('#main-input-ex');
    await input.waitFor();
    const height = () => input.evaluate(el => el.clientHeight);
    const compactHeight = await height();
    await input.fill('待删除文字');
    await input.press('ControlOrMeta+a');
    await input.press('Backspace');
    await page.waitForTimeout(150);
    assert.equal(await height(), compactHeight, 'Deleting all text must restore compact height');
    await input.press('Backspace');
    await input.press('Enter');
    await page.waitForTimeout(150);
    assert.equal(await height(), compactHeight, 'Empty Backspace/Enter must not grow the composer');
    assert.equal(actions.filter(a => /^(send_msg|send_private_msg)$/.test(a.action)).length, 0);
    await input.fill('第一行');
    await input.press('End');
    await input.press('Shift+Enter');
    await input.press('a');
    await page.waitForTimeout(150);
    assert.ok(await height() > compactHeight, 'Explicit newlines must still expand the composer');
    assert.equal(await input.evaluate(el => el.innerText.replace(/\u200B/g, '')), '第一行\na');
    await input.fill('');

    await page.locator('#chat-701 img.msg-img').first().click();
    const viewer = page.locator('#chihiro-im-overlays .mask-background');
    await viewer.waitFor();
    const box = await viewer.boundingBox();
    assert.deepEqual(box, { x: 0, y: 0, width: 1440, height: 960 }, 'Viewer must cover the viewport');
    const toolbar = page.locator('.chihiro-viewer-bar');
    const toolbarBox = await toolbar.boundingBox();
    assert.ok(toolbarBox && toolbarBox.y >= 0 && toolbarBox.y + toolbarBox.height <= 960);
    const viewerImage = viewer.locator('.viewer-img > img');
    await page.waitForFunction(() => {
      const img = document.querySelector('#chihiro-im-overlays .viewer-img > img');
      return img?.complete && img.naturalWidth > 0;
    });
    const beforeZoom = await viewerImage.getAttribute('style');
    await toolbar.locator('[data-icon="magnifying-glass-plus"]').click();
    assert.notEqual(await viewerImage.getAttribute('style'), beforeZoom, 'Zoom control must operate');
    async function checkToolbarBounds(width) {
      const avatar = toolbar.locator('.chihiro-viewer-sender img');
      const avatarBox = await avatar.boundingBox();
      const railBox = await page.locator('.account-rail').boundingBox();
      const actionsBox = await toolbar.locator('.chihiro-viewer-actions').boundingBox();
      assert.ok(avatarBox && railBox && avatarBox.x >= railBox.x + railBox.width + 16,
        'Sender avatar must clear the account rail');
      assert.ok(await avatar.evaluate(img => img.complete && img.naturalWidth > 0), 'Sender avatar must load');
      assert.ok(actionsBox && actionsBox.x + actionsBox.width <= width - 16,
        'Viewer controls must retain a right gutter');
      const senderBox = await toolbar.locator('.chihiro-viewer-sender').boundingBox();
      assert.ok(senderBox.x + senderBox.width <= actionsBox.x, 'Sender must not overlap viewer controls');
    }
    await checkToolbarBounds(1440);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.deepEqual(await viewer.boundingBox(), { x: 0, y: 0, width: 390, height: 844 });
    await checkToolbarBounds(390);
    await page.setViewportSize({ width: 320, height: 844 });
    await checkToolbarBounds(320);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'detached' });

    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.remove('bp-dark', 'bp-light');
        document.documentElement.classList.add(`bp-${theme}`);
      }, theme);
      await page.locator('#chat-701').click({ button: 'right' });
      await page.locator('#msgMenu').getByText('转发', { exact: true }).click();
      const card = page.locator('.forward-pan > .card');
      await card.waitFor();
      assert.equal(await card.evaluate(el => getComputedStyle(el).backgroundColor),
        theme === 'dark' ? 'rgb(44, 44, 46)' : 'rgb(255, 255, 255)', 'Forward card must have a solid themed background');
      await card.locator('header [data-icon="xmark"]').click();
      await card.waitFor({ state: 'detached' });
    }
    assert.equal(actions.filter(a => /^(send_msg|send_private_msg)$/.test(a.action)).length, 0);
    assert.deepEqual(errors, [], 'Interaction checks must not produce browser errors');
    console.log(JSON.stringify({ status: 'passed', checks: ['empty composer', 'explicit newline', 'image viewer bounds', 'zoom and close', 'forward card in both themes'], errors }));
    await browser.close();
    for (const client of wss.clients) client.terminate();
    wss.close();
    server.close();
    return;
  }
  await page.waitForTimeout(1800);
  console.log(
    JSON.stringify({
      phase: "initial",
      text: (await page.locator("body").innerText()).slice(0, 3500),
      errors,
      actions,
    }),
  );
  await page.screenshot({ path: "/tmp/chihiro-im-host-initial.png" });
  if (await page.getByRole("button", { name: "联系人", exact: true }).count())
    await page.getByRole("button", { name: "联系人", exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/tmp/chihiro-im-host-contacts.png" });
  console.log(
    JSON.stringify({
      phase: "contacts",
      text: (await page.locator("body").innerText()).slice(0, 2500),
      errors,
      actions,
    }),
  );
  await page.getByText("我的好友", { exact: true }).click();
  const target = page.getByText("客户小林 10001", { exact: true }).first();
  if (await target.count()) {
    await target.click();
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: "/tmp/chihiro-im-host-chat.png" });
  if (
    !(await page.locator(".native-chat").innerText()).includes(
      "请问这款产品如何购买？",
    )
  )
    throw new Error("Native history did not render");
  await page.getByRole('button', { name: '会话助手', exact: true }).click();
  const assistant = page.locator('.assistant-panel');
  await assistant.getByText('可以为您介绍购买方案。', { exact: true }).waitFor();
  await assistant.getByRole('textbox', { name: '询问助手', exact: true }).fill('请提供两个购买建议');
  await assistant.getByRole('button', { name: '询问助手', exact: true }).click();
  await page.waitForTimeout(100);
  if (!assistantRequests.some(r => r.url === '/api/runtime/agent/ask' && r.body.accountId === 'qq:10001' && r.body.peerId === '20001' && r.body.text === '请提供两个购买建议')) throw new Error('Assistant ask target mismatch');
  await assistant.getByRole('button', { name: '确认发送', exact: true }).click();
  await assistant.getByText('已发送', { exact: true }).waitFor();
  if (assistantRequests.filter(r => r.url.endsWith('/draft/approve')).length !== 1) throw new Error('Assistant duplicate approval');
  await assistant.getByLabel('会话托管', { exact: true }).check();
  await assistant.getByText('托管中', { exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/chihiro-im-assistant-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/chihiro-im-assistant-mobile.png' });
  const assistantBox = await assistant.boundingBox();
  const inputBox = await page.locator('#main-input-ex').boundingBox();
  if (!assistantBox || !inputBox || assistantBox.x < 0 || assistantBox.x + assistantBox.width > 391 || assistantBox.y + assistantBox.height > inputBox.y + 1 || inputBox.y + inputBox.height > 844) throw new Error('Assistant overlaps composer or viewport');
  await assistant.getByRole('button', { name: '收起助手', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator("#main-input-ex").fill("本地模拟消息");
  await page.getByTitle("发送", { exact: true }).click();
  await page.waitForTimeout(250);
  console.log(JSON.stringify({ phase: "send", actions, errors }));
  if (
    !actions.some(
      (a) =>
        a.id === "10001" && ["send_private_msg", "send_msg"].includes(a.action),
    )
  )
    throw new Error("Native composer did not dispatch account-scoped message");
  console.log(
    JSON.stringify({
      phase: "chat",
      text: (await page.locator("body").innerText()).slice(0, 2500),
      errors,
      actions,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/chihiro-im-host-mobile.png" });
  console.log(
    JSON.stringify({
      phase: "mobile",
      width: await page.evaluate(() => document.documentElement.scrollWidth),
      composer: await page.locator("#main-input-ex").boundingBox(),
    }),
  );
  const composerBox = await page.locator("#main-input-ex").boundingBox();
  if (
    (await page.evaluate(() => document.documentElement.scrollWidth)) > 390 ||
    !composerBox ||
    composerBox.height <= 0 ||
    composerBox.y + composerBox.height > 844
  )
    throw new Error("Mobile composer framing failed");
  await page.selectOption("#account-select", "qq:10002");
  await page.waitForTimeout(800);
  console.log(
    JSON.stringify({
      phase: "switch",
      text: (await page.locator("body").innerText()).slice(0, 1800),
      errors,
    }),
  );
  const switchedList = await page.locator(".native-list").innerText();
  if (switchedList.includes("10001") || !switchedList.includes("10002"))
    throw new Error("Account switch retained wrong contacts");
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "工作台", exact: true }).click();
  await page.waitForTimeout(1400);
  console.log(
    JSON.stringify({
      phase: "agent",
      text: (await page.locator("body").innerText()).slice(0, 2200),
      errors,
    }),
  );
  await page.screenshot({ path: "/tmp/chihiro-im-host-agent.png" });
  await page
    .locator(".workspace-list-tabs")
    .getByRole("link", { name: "消息", exact: true })
    .click();
  await page.waitForTimeout(700);
  await page.getByText("客户小林 10002", { exact: true }).first().click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "/tmp/chihiro-im-host-return.png" });
  console.log(
    JSON.stringify({ phase: "return", errors, frames: page.frames().length }),
  );
  if (errors.length || page.frames().length !== 1)
    throw new Error("Native IM browser validation failed");
  await browser.close();
  wss.close();
  server.close();
})().catch(async (e) => {
  console.error(e);
  await qaBrowser?.close();
  for (const client of wss.clients) client.terminate();
  wss.close();
  server.close();
  process.exitCode = 1;
});
