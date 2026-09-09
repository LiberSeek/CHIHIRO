# 千寻 · 启动

打开千寻即可扫码登录 QQ，不必自己先跑 `QQ --no-sandbox`。

```bash
git clone https://github.com/LiberSeek/CHIHIRO.git
cd CHIHIRO
git checkout develop
git submodule update --init vendor/napcat vendor/astrbot
npm install
npm run dev
```

浏览器：http://127.0.0.1:3100/

1. 点左侧 **+**
2. 下拉选择 **QQ**（其它客户端为即将支持）
3. 点「开始登录」——后台拉起 NTQQ
4. 页内扫码
5. 左栏出现账号，中间进入 IM

停服务：运行 `npm run dev` 的终端里 `Ctrl+C`。QQ 进程若仍在，用「退出 QQ」。

## 备用

若工作台拉不起 QQ，可手动：

```bash
'/Applications/QQ.app/Contents/MacOS/QQ' --no-sandbox
```

然后刷新 http://127.0.0.1:3100/ ，Runtime 会探测已有登录态。
