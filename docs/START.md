# 千寻 CHIHIRO-EE · 初步功能验证启动

当前 QQ 启动入口已切到 NapCat loader。所有服务默认停着，请按下面顺序自己开。

工作目录：

```bash
cd /Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Chihiro/CHIHIRO-EE
export PATH="$HOME/.local/bin:$PATH"
```

本地 token 已在 `config/chihiro.local.json`（不要提交 git）。

---

## 第 1 步：启动 NapCat Shell（必须）

新开一个终端：

```bash
'/Applications/QQ.app/Contents/MacOS/QQ' --no-sandbox
```

1. 终端会出现二维码；也可打开：  
   `~/Library/Containers/com.tencent.qq/Data/Library/Application Support/QQ/NapCat/cache/qrcode.png`
2. 手机 QQ 扫码登录（账号 Tower `3967167443` 上次已用过）
3. 浏览器打开 WebUI：  
   http://127.0.0.1:6099/webui/?token=2e646026da42  
   或看启动日志里的 `WebUi Token`
4. **插件管理**里确认 **Stapxs QQ Lite / 千寻** 为 **已启用**

自检：

| 端口 | 应出现 |
|---|---|
| `6099` | WebUI |
| `5800` | OneBot HTTP |
| `5801` | OneBot WS |

---

## 第 2 步：启动 CHIHIRO-EE Gateway

在产品目录另开终端：

```bash
cd /Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Chihiro/CHIHIRO-EE
npm install          # 只需第一次
npm run gateway
```

打开：http://127.0.0.1:3100/

再开一个终端可跑：

```bash
npm run status       # 应看到 webui / onebot / gateway OK
npm run open:im      # 打开 Stapxs IM
```

IM 直链（启用插件后）：

http://127.0.0.1:6099/webui/plugin/napcat-plugin-ssqq/page/dashboard

Stapxs 若还要手填连接：

- 地址：`127.0.0.1:5801`
- 密钥：`chihiro-local-5801`

**这一步通过标准：** 能看到会话列表，能发一条消息。

---

## 第 3 步（可选）：AstrBot

```bash
cd /Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Chihiro/CHIHIRO-EE
mkdir -p ../runtime-astrbot    # 或任意本机数据目录
cd ../runtime-astrbot
printf 'Y\n' | astrbot init    # 仅首次
astrbot run
```

或 Docker：

```bash
cd /Users/raven/iWorking/RavenStudio/Products/PRODUCTION/LiberSeekAI/Chihiro/CHIHIRO-EE
npm run compose:up
```

Dashboard：http://127.0.0.1:6185  
接 QQ 时填 OneBot WS：`127.0.0.1:5801` / token `chihiro-local-5801`

初步验证可以先不做这一步。

---

## 第 4 步（先别做）：Pake

等第 2 步 IM 在浏览器里完全顺了，再：

```bash
npm run pake:im
```

---

## 常见卡点

| 现象 | 处理 |
|---|---|
| 二维码过期 | 停掉 QQ 再执行第 1 步 |
| WebUI 401 | 用日志里的 Token，或 `2e646026da42` |
| 插件页空白 | 插件管理里启用 Stapxs，硬刷新 |
| Stapxs 连不上 | 确认 `5801` 在听；地址不要填 `6099` |
| `npm run status` gateway DOWN | 先 `npm run gateway` |
| 普通双击 QQ 进了原生界面 | 必须带 `--no-sandbox` 才是 Shell |

停服务：终端里 `Ctrl+C`；QQ 用退出应用即可。
