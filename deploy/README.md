# Docker 部署骨架

P1 把当前 `backend/src/gateway`、`backend/src/runtime`、`backend/src/mcp` 和 `apps/web` 打包成一个 `chihiro` 镜像。浏览器只访问 `chihiro:3100`，AstrBot 作为内部服务由 Gateway 代理。Compose 的端口、卷和服务名保持不变。

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

部署前可以检查两个 Compose 文件的展开结果：

```sh
make compose-config
make compose-config-external
```

根目录 `docker-compose.yml` 是早期只启动 AstrBot 的兼容文件。新部署使用本目录的 Compose 文件；它不会自动启动 macOS QQ，也不会把 Docker socket 暴露给业务容器。
