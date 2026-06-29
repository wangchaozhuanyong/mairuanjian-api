# Apple ID 官网状态检查 Worker 方案

## 目标

后台勾选多个 Apple ID 后，一键生成 Apple 官网状态检查任务。第一版 Worker 使用 Playwright 控制独立浏览器访问 Apple 官方页面，检查账号是否正常、是否需要验证、是否冻结、是否密码错误或进入风控。

本方案只服务 Apple ID 业务区，不和兑换码库存、兑换码订单、发货模板混用。

## 技术路线

第一阶段已经落地任务底座：

- 前端在 Apple ID 自动化任务页提供“批量检查状态”入口。
- 后端 `POST /api/apple/automation-tasks/batch-status-check` 批量生成 `check_status` 任务。
- 每条任务写入加密输入参数、执行计划、任务日志和操作审计。
- 任务结果统一回写到自动化任务中心，后续可同步更新 Apple ID 状态检测记录。

第二阶段已接入默认关闭的第一版真实 Worker：

- `AppleWebCheckWorker` 按固定间隔消费 `automation_tasks` 中的 `check_status` 队列任务。
- 生产建议单独跑一个 Worker API 实例，或只在指定 Worker 节点开启 `APPLE_WEB_CHECK_WORKER_ENABLED=true`，避免多个 API 实例重复消费。
- 使用 Playwright 启动独立浏览器上下文。
- 按任务执行计划设置出口 IP、语言、时区和 Apple 官网入口。
- 调用 sing-box Clash API 切换节点，并在访问 Apple 前先做出口 IP 国家检测。
- 能自动判断结果时直接回写任务。
- 遇到 2FA、短信验证码、设备验证码、人工确认或页面无法稳定判断时，任务转为 `waiting_manual_verify`。

第一版还没有实现“保持同一浏览器会话等待后台输入验证码后继续”的接力流程；验证码分支先停到人工处理，避免绕过 Apple 安全验证。

## 账号地区和出口 IP 规则

系统必须区分两个概念：

- `accountRegion`：Apple ID 在系统里标记的账号或业务地区。
- `exitCountry`：Worker 实际访问 Apple 官网时使用的出口 IP 国家。

如果一个 Apple ID 在马来西亚业务环境使用，但长期通过美国 IP 登录，那么批量检查时应选择 `exitCountry=US`。Apple 更关心近期稳定登录环境，不能简单把账号地区和出口 IP 国家强行绑定。

前置门禁检查的是 `exitCountry` 是否有可用出口网关：

- `exitCountry=US` 时必须配置美国出口 IP。
- `exitCountry=MY` 时必须配置马来西亚出口 IP。
- `exitCountry=CN` 时必须配置中国出口 IP。
- 未配置对应出口 IP 时，不允许强行自动登录，任务直接进入人工验证。
- 账号地区和出口 IP 国家不一致时，会在执行计划里记录 `regionMatched=false`，用于审计和风控判断。

当前通过后台节点池优先判断出口国家是否可用：

- 运维监控新增“Apple 节点”页。
- 后台可保存节点订阅 URL，订阅 URL 使用字段加密服务保存到 `system_parameters`。
- 同步订阅后，系统只展示节点名称、国家、协议、状态、延迟和失败原因。
- 原始节点配置会加密保存，接口、审计日志和平台同步日志不返回订阅 URL、节点密码或 token。
- 批量检查任务选择 `gatewayRegion=US` 时，只会从同步出的美国节点里选择候选节点。
- 同国家下没有可用或未知节点时，才退回环境变量兜底；兜底也没有时，任务转人工验证。

环境变量只作为临时兜底：

```env
APPLE_WEB_CHECK_GATEWAY_REGIONS=US,MY,CN
APPLE_WEB_CHECK_ADAPTER_VERSION=apple-web-v1
APPLE_WEB_CHECK_WORKER_ENABLED=false
APPLE_WEB_CHECK_WORKER_INTERVAL_MS=60000
APPLE_WEB_CHECK_WORKER_RUN_ON_STARTUP=false
APPLE_WEB_CHECK_WORKER_MAX_BATCH=3
APPLE_WEB_CHECK_TIMEOUT_MS=45000
APPLE_WEB_CHECK_HEADLESS=true
APPLE_WEB_CHECK_PROXY_SERVER=socks5://127.0.0.1:2080
APPLE_WEB_CHECK_SING_BOX_API_URL=http://127.0.0.1:9090
APPLE_WEB_CHECK_SING_BOX_SELECTOR=apple-web
APPLE_WEB_CHECK_SING_BOX_API_SECRET=
APPLE_WEB_CHECK_IP_CHECK_URL=https://ipapi.co/json/
```

`APPLE_WEB_CHECK_GATEWAY_REGIONS` 只表示“这个国家的出口 IP 网关已由外部方式配置”。真实代理地址、用户名、密码、token 不能写进代码、文档或普通日志，应进入后台加密配置或生产密钥系统。

## 节点 Sidecar 规则

系统不自研代理协议、节点连接、加密转发。推荐在 Worker 服务器部署 `sing-box` sidecar：

- API 后台负责保存订阅、同步节点、按国家给任务分配节点候选。
- `sing-box` 负责真实代理连接和出口 IP。
- 后台网站、API、数据库不走代理。
- Playwright Worker 执行 Apple 官网任务时，按执行计划里的 `gatewayNodeId` / `gatewayNodeCandidates` 选择代理。
- Worker 访问 Apple 前必须做出口 IP 检测，确认国家符合 `exitCountry`。
- 节点不可用时先换同国家下一个节点；同国家全部失败后任务转 `waiting_manual_verify`。
- 后端提供 `npm run apple-web:sing-box-config` 生成 sing-box 配置文件，默认写入 `.runtime/apple-web-sing-box.json`。
- 配置生成脚本只从加密保存的 `apple_web_gateway_nodes` 读取节点，解密后写入本机受控配置文件；控制台只输出节点数量和不支持数量，不输出节点密钥。

## 本地和服务器联调命令

本机先安装 Chromium runtime：

```bash
npm exec playwright -- install chromium
```

验证 Playwright 能启动并完成出口 IP 检测：

```bash
npm run apple-web:runtime-check
```

如果要带代理检测：

```bash
APPLE_WEB_CHECK_PROXY_SERVER=socks5://127.0.0.1:2080 \
APPLE_WEB_CHECK_EXPECTED_COUNTRY=US \
npm run apple-web:runtime-check
```

服务器上同步节点后生成 sing-box 配置：

```bash
npm run apple-web:sing-box-config
```

生产 Compose 不默认启动 Apple Worker。确认 `.runtime/apple-web-sing-box.json` 已生成后，使用可选 overlay 启动：

```bash
docker compose --env-file .env.production \
  -f docker-compose.prod.yml \
  -f docker-compose.apple-worker.yml \
  up -d sing-box apple-web-worker
```

`apps/api/Dockerfile.worker` 使用 Debian slim 镜像并安装 Playwright Chromium；普通 API 镜像也使用 Debian slim，并安装 Playwright Chromium 与 Tesseract，供 Apple 礼品卡余额查询和图片 OCR 使用。

## 礼品卡余额查询执行器

Apple 礼品卡余额查询在“ID 自动化工作台 -> 礼品卡余额查询”里操作，不跳转到单独排队页：

- 操作员先保存 5 个以内长期登录查询账号，账号和密码加密写入 `system_parameters`。
- 上传礼品卡图片后，后端先从文件名/OCR 尝试识别礼品卡代码。
- OCR 默认启用；API Docker 镜像内置 Tesseract，非 Docker 部署需要确保 `APPLE_GIFT_CARD_OCR_TESSERACT_PATH` 指向可执行的 `tesseract`。
- 能识别到代码时，结果表只显示脱敏尾号；完整代码只保存加密值和 hash。
- 识别不到时，结果表提供“补录代码”按钮。
- 代码齐全后，后端会直接调用 `APPLE_GIFT_CARD_BALANCE_QUERY_COMMAND` 指定的执行器；执行器通过 stdin 接收 JSON，通过 stdout 返回 `{ "rows": [...] }`。
- 如果 OCR 失败，操作员在本页补录代码；补录后同样会继续执行当前批次。
- “重试当前批次”只用于执行器未配置、执行器失败或后续调整配置后的本页重试，不是单独队列入口。
- 内置执行器脚本为 `scripts/apple-gift-card-balance-query.mjs`，默认访问 Apple 官方礼品卡余额页面；每个查询账号使用独立浏览器资料目录，登录态保存在 `APPLE_GIFT_CARD_BALANCE_QUERY_SESSION_DIR`。
- 同一个批次会按查询账号分组执行：同一个查询 ID 只打开一次浏览器资料目录，批次内复用登录态连续查多张礼品卡。
- 执行器会给每个查询账号的浏览器资料目录加锁；如果另一个批次正在使用同一个查询 ID，本批次会等待，超时后在结果行提示稍后重试。
- 遇到验证码、设备确认、CAPTCHA 或页面无法稳定识别时，行状态回到“需人工”，表格行显示“重试查询”；操作员完成 Apple 侧验证后在本页本行重试，不绕过 Apple 安全验证。

## ID 余额查询边界

“ID 自动化工作台 -> ID 余额查询”当前只回写系统内已有余额快照，`resultPayload.source` 为 `system_snapshot`。它用于批量核对系统记录，不代表已经登录 Apple 官网读取实时余额。官网实时余额查询需要后续单独接入 Worker adapter 后才能把来源切换为实时页面结果。

示例配置：

```env
APPLE_GIFT_CARD_OCR_ENABLED=true
APPLE_GIFT_CARD_OCR_TESSERACT_PATH=tesseract
APPLE_GIFT_CARD_OCR_LANG=eng
APPLE_GIFT_CARD_OCR_TIMEOUT_MS=15000
APPLE_GIFT_CARD_BALANCE_QUERY_COMMAND=node
APPLE_GIFT_CARD_BALANCE_QUERY_ARGS=["scripts/apple-gift-card-balance-query.mjs"]
APPLE_GIFT_CARD_BALANCE_QUERY_TIMEOUT_MS=180000
APPLE_GIFT_CARD_BALANCE_QUERY_URL=https://secure.store.apple.com/shop/giftcard/balance
APPLE_GIFT_CARD_BALANCE_QUERY_HEADLESS=true
APPLE_GIFT_CARD_BALANCE_QUERY_PROXY_SERVER=
APPLE_GIFT_CARD_BALANCE_QUERY_SESSION_DIR=.runtime/apple-gift-card-balance-sessions
APPLE_GIFT_CARD_BALANCE_QUERY_CODE_SELECTOR=
APPLE_GIFT_CARD_BALANCE_QUERY_SUBMIT_SELECTOR=
```

轻量检查执行器协议：

```bash
printf '{"rows":[],"accounts":[]}' | node scripts/apple-gift-card-balance-query.mjs
```

该检查只验证脚本输入输出协议，不登录 Apple，也不启动浏览器。

## Worker 节点联调接口

Worker 使用这两个脱敏接口做节点联调：

```text
GET  /api/apple/automation-tasks/:id/web-check-gateways
POST /api/apple/automation-tasks/:id/web-check-gateway-attempt
```

- `GET /web-check-gateways` 返回任务期望出口国家、节点候选、节点当前状态和是否存在加密节点配置，不返回原始节点串。
- Worker 从候选节点中选择同国家节点，交给 sing-box / Playwright 上下文使用。
- Worker 访问 Apple 前先做出口 IP 国家检测。
- 检测通过后调用 `POST /web-check-gateway-attempt` 写入 `status=success`、`nodeId`、`exitCountry`、`latencyMs`。
- 检测失败或出口国家不匹配时调用同一接口写入 `status=failed` 或实际 `exitCountry`，系统会把节点标记为不可用；如果还有同国家候选节点，任务保持运行；如果同国家候选都失败，任务转人工验证。
- 该接口不保存出口 IP 原文，只保存是否提供 IP、检测国家、期望国家、节点 ID 和失败原因。

## 执行计划字段

批量创建任务时，系统会按账号地区和所选出口 IP 国家生成执行计划：

- `accountRegion`：账号标记地区。
- `exitCountry`：Worker 实际应使用的出口 IP 国家。
- `countryCode`：同 `exitCountry`，用于后续网关匹配。
- `locale`：浏览器语言。
- `timezone`：浏览器时区。
- `appleCountryUrl`：对应国家 Apple 官网入口。
- `appleAccountSignInUrl`：Apple Account 登录入口。
- `gatewayProfileCode`：后续 Worker 使用的出口网关配置编号。
- `gatewayNodeId`：后台节点池选中的第一候选节点 ID。
- `gatewayNodeName`：后台节点池选中的第一候选节点名称。
- `gatewayNodeCandidates`：同国家可尝试的节点候选列表，Worker 失败时按顺序切换。
- `regionMatched`：账号地区和出口 IP 国家是否一致。
- `manualChallengeMode`：固定为 `operator_prompt`，表示遇到验证码必须人工输入。
- `adapterVersion`：官网流程适配版本。

## 人工验证接力

不允许绕过 Apple 安全验证。Worker 发现以下情况时必须停下：

- 2FA 动态码。
- 短信验证码。
- 设备确认。
- CAPTCHA。
- Apple 要求重新验证手机号、密保或恢复邮箱。
- 页面结果无法稳定判断。

停下后任务状态变为 `waiting_manual_verify`，后台提示操作员输入验证码或补充人工结果。验证码只用于继续当前浏览器会话，不能落库保存，日志只能记录“已提交人工验证码”这类脱敏事件。

## 官网更新维护

Apple 官网没有普通 Apple ID 状态查询官方 API，所以 Playwright Worker 依赖页面流程。只要 Apple 更新了登录页、按钮文案、DOM 结构、风控提示或跳转流程，Worker 就可能需要更新。

为了降低影响，真实 Worker 必须这样做：

- 把页面选择器和流程判断集中在 Worker adapter，不散落在业务 service。
- 每次执行记录 `adapterVersion`。
- 增加每日健康检查账号，验证登录入口、验证码分支和结果识别是否还有效。
- 连续失败或未知结果超过阈值时自动暂停该国家 Worker，并转人工。
- 官网更新后只升级 Worker adapter，不改业务任务表和前端任务中心。

## 已知边界

- 这不是 Apple 官方 API。
- 这不是绕过验证码或风控。
- 第一版可作为半自动运营闭环，真实全自动能力取决于 Playwright Worker、出口 IP 质量、账号风控状态和人工验证响应速度。
- 如果 `FIRST_RELEASE_MODE=semi_auto`，真实 Apple ID Worker 可作为上线后增强；如果切到 `full_auto`，必须完成真实 Worker 联调后才能上线。
- 生产启用前需要在 Worker 机器安装 Playwright Chromium 浏览器、部署 sing-box sidecar，并用测试账号完成一次真实 Apple 页面联调。
