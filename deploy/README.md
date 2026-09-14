# Docker 部署骨架

P1 把当前 `frontend/` 统一前端、`backend/src/gateway`、`backend/src/runtime` 和 `backend/src/mcp` 打包成一个 `chihiro` 镜像。浏览器只访问 `chihiro:3100`，AstrBot 作为内部服务由 Gateway 代理。Compose 的端口、卷和服务名保持不变。

## 快速启动

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
docker compose --env-file deploy/.env --file deploy/docker-compose.yml up -d --build
curl http://127.0.0.1:3100/api/status
```

`/api/status` 是产品存活检查。NapCat 离线时，千寻仍应能打开工作台；QQ 通道状态会单独显示为不可用。

默认组合启动 `chihiro` 和 `astrbot`。`napcat` 使用 `linux-napcat` profile，但 Linux QQ/NapCat 镜像、登录方式、附件和多账号隔离尚未在千寻中完成验证。不要把 `NAPCAT_IMAGE` 的占位值当成可发布镜像。

```sh
# 只有在 NAPCAT_IMAGE 已替换为已验证镜像后才启用
docker compose --env-file deploy/.env --file deploy/docker-compose.yml \
  --profile linux-napcat up -d
```

## 外部 NapCat

macOS 的 QQ.app 不能放进 Linux 容器。宿主机或远程机器运行 NapCat 时，使用外部覆盖文件：

```sh
docker compose --env-file deploy/.env \
  --file deploy/docker-compose.yml \
  --file deploy/docker-compose.external-napcat.yml up -d --build
```

默认地址是 `host.docker.internal` 的 `6099`、`5800` 和 `5801`。远程 NapCat 则在 `deploy/.env` 中填写 `CHIHIRO_NAPCAT_WEBUI_URL`、`CHIHIRO_ONEBOT_HTTP_URL` 和 `CHIHIRO_ONEBOT_WS_URL`。这些地址只在容器内部使用，浏览器仍然只访问 `3100`。

## 数据与配置

- `chihiro-data` 保存账号映射、运行日志和生成的本地配置。
- `astrbot-data` 保存 AstrBot 配置、会话、插件和知识库。
- `napcat-data` 预留给经过验证的 Linux NapCat 实例。
- `deploy/.env` 只保存部署参数，不提交到 Git。

入口脚本每次启动时从 `chihiro.local.json.template` 更新连接地址，并把它链接到持久化数据卷。已有的 AstrBot 反向连接令牌和其他运行时字段会被保留，因此修改外部服务地址后重启即可生效。当前 Gateway 对配置的读取仍来自 JSON；后续 backend 配置服务落地时，这个脚本可以退役。

P1 的外部 NapCat 配置只解决 Gateway 代理地址。现有 `backend/src/runtime` 的账号探测和本机 QQ 生命周期仍使用宿主端口与 macOS 进程路径，因此外部模式暂不宣称支持扫码登录、动态多账号和 Bot 反向连接；这些能力属于 P2 的 Runtime 连接器迁移。

## 运维命令

```sh
docker compose --env-file deploy/.env --file deploy/docker-compose.yml ps
docker compose --env-file deploy/.env --file deploy/docker-compose.yml logs -f chihiro
docker compose --env-file deploy/.env --file deploy/docker-compose.yml down
```

`release-manifest.json` 记录可发布的镜像组合和已验证范围。当前默认前端为 `frontend/` 构建出的统一入口 `/`；旧 `apps/web` 壳只作为迁移参考，不再是发布默认前端。当前 AstrBot 仍使用浮动开发镜像、Linux NapCat 尚未验证，因此该 manifest 只代表开发组合；正式版本必须先固定镜像 digest 并将对应能力验收完成。

备份会以只读方式打包 `chihiro-data` 和 `astrbot-data`，不包含 `deploy/.env` 中的密钥：

```sh
make manifest-check
make backup BACKUP="$PWD/chihiro-backup.tar.gz"
docker compose --env-file deploy/.env --file deploy/docker-compose.yml down
make restore BACKUP="$PWD/chihiro-backup.tar.gz"
docker compose --env-file deploy/.env --file deploy/docker-compose.yml up -d
```

恢复会先清空目标数据卷，必须在 Compose 服务停止后运行。备份归档中包含生成时的 release manifest，便于选择同一镜像组合回滚；环境密钥需要从独立的安全备份恢复。

部署前可以检查两个 Compose 文件的展开结果：

```sh
make compose-config
make compose-config-external
```

根目录 `docker-compose.yml` 是早期只启动 AstrBot 的兼容文件。新部署使用本目录的 Compose 文件；它不会自动启动 macOS QQ，也不会把 Docker socket 暴露给业务容器。

## 外部 AstrBot 生命周期

Compose 配置明确使用 `astrbot.mode = external`：千寻检查配置的服务 URL，不在 Node 容器内启动 Python、不接管宿主进程，也不修改远端 AstrBot 的配置。外部 AstrBot 由其部署环境负责启动/停止；本机开发仍保留按需启动模式。

ChatUI 代理需要 `CHIHIRO_ASTRBOT_DASHBOARD_TOKEN`，应填写对应 AstrBot 的有效 Dashboard 访问令牌。令牌只由 Gateway 注入上游 HTTP/WS 请求，不进入浏览器存储；到期后需更新部署环境并重启千寻。未配置令牌时 ChatUI API 会返回不可用，单纯健康检查通过不代表鉴权已完成。目前尚无自动签发/刷新外部令牌流程。

外部 OneBot 适配器必须在 AstrBot 中预先配置，并在持久化千寻配置的 `astrbot.accounts.<uin>.reverse` 指定 `url`、`token`、可选 `id`。例如 `url` 为 `ws://astrbot:6199/ws`。没有账号映射时返回明确错误，不会写入一个无效的本机适配器。外部 QQ 登录与连接验收仍未完成。
