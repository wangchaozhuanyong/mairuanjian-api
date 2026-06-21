# Telegram 上线门禁操作手册

本文档用于后补完成 `telegram_test`。半自动首发允许先把 Telegram 留空上线，后台通知中心会保留 Bot Token 和 Chat ID 的填写位置；后续你填入真实配置后，再按本文档做测试、验收和排错。本文档不保存任何真实 Bot Token 或 Chat ID。

## 1. 门禁目标

`telegram_test` 只有同时满足以下条件，才允许标记通过：

- 后台通知中心存在至少一个启用的 Telegram 配置。
- 该配置已保存真实 Bot Token，系统只展示尾号。
- 该配置已填写真实 Chat ID / 群组 ID。
- 点击测试发送后，Telegram 实际收到测试消息。
- `npm run launch:gates` 显示 Telegram real test 为 `passed`。
- 上线检查清单的 `telegram_test` 已记录不含敏感信息的证据。

## 2. 权限要求

执行人需要具备：

- `notification.telegram.view`
- `notification.telegram.manage`
- `notification.telegram.test`
- `notification.logs.view`
- `audit_logs.view`

如果缺少权限，先由管理员在角色权限中补齐，不要临时借用他人账号。

## 3. 系统入口

后台页面：

```text
/system/notifications
```

进入后选择：

```text
通知中心 -> Telegram 配置
```

相关接口：

```text
GET    /api/notifications/telegram
POST   /api/notifications/telegram
PATCH  /api/notifications/telegram/:id
DELETE /api/notifications/telegram/:id
POST   /api/notifications/telegram/test
```

## 4. 配置字段

| 字段         | 要求                                           |
| ------------ | ---------------------------------------------- |
| 通知名称     | 建议写清楚用途，例如 `生产告警群`              |
| Bot Token    | 必填，保存后加密存储，列表只显示尾号           |
| Chat ID      | 必填，可以是个人、群组或频道对应的 ID          |
| 通知级别     | 建议首版使用 `warning`，避免低价值消息过多     |
| 静默时间     | 可选，首版建议先留空，确保测试消息可立即收到   |
| 失败重试次数 | 建议 `3`                                       |
| 启用         | 必须开启，否则 `launch:gates` 不会视为可用配置 |

安全要求：

- 不要把 Bot Token 写入 `.env`、文档、聊天记录、Git commit message 或上线检查清单证据。
- 不要截图展示完整 Bot Token。
- 修改 Bot Token 后必须重新测试发送。

## 5. 测试发送流程

1. 打开 `/system/notifications`。
2. 进入 `Telegram 配置`。
3. 新增或编辑配置。
4. 填写真实 Bot Token 和 Chat ID。
5. 开启 `启用`。
6. 保存配置。
7. 点击该配置行的 `测试发送`。
8. 确认 Telegram 客户端实际收到测试消息。
9. 回到终端运行：

```bash
npm run launch:gates
```

期望看到：

```text
Telegram real test: passed
Successful config: <通知名称>
```

## 6. 记录上线证据

真实测试通过后，记录上线检查清单：

```bash
npm run launch:checklist -- \
  --id=telegram_test \
  --status=passed \
  --evidence="Telegram test send passed in notification center; npm run launch:gates shows Telegram passed"
```

再次复核：

```bash
npm run launch:gates
npm run release:review
```

要求：

- `telegram_test` 显示 `passed`。
- 证据中不得包含 Bot Token。
- 如果 Chat ID 需要写证据，只能写尾号或群名称，不写完整 ID。

## 7. 常见失败和处理

| 现象                                           | 处理方式                                             |
| ---------------------------------------------- | ---------------------------------------------------- |
| `No enabled Telegram config`                   | 确认配置已保存并开启 `启用`                          |
| `Telegram Bot Token is not configured`         | 重新编辑配置并填写 Bot Token                         |
| `Telegram Chat ID is not configured`           | 重新填写 Chat ID / 群组 ID                           |
| `Telegram send failed: 400 ... chat not found` | 确认 Chat ID 正确，群组内已加入机器人                |
| `Telegram send failed: 403 ...`                | 确认机器人没有被移除、禁言或阻止                     |
| 测试发送按钮提示失败                           | 查看通知日志中的 `telegram.test` 失败记录            |
| `launch:gates` 仍失败                          | 确认 `lastTestStatus=success` 的配置仍处于启用状态   |
| 测试消息没收到但接口成功                       | 检查静默时间、客户端消息设置、群组消息权限和网络状态 |

## 8. 审计和日志检查

测试完成后检查：

- 通知日志中存在 `telegram.test` 记录。
- 成功记录状态为 `sent`。
- 失败记录必须有错误原因。
- 审计日志中有 Telegram 配置创建或更新记录。
- 审计日志和通知日志不出现完整 Bot Token。

## 9. 不允许的做法

- 不允许直接修改数据库把 `last_test_status` 改成 `success`。
- 不允许在未收到 Telegram 实际消息时标记 `telegram_test=passed`。
- 不允许把 Bot Token 写入 `launch:checklist` 的 `--evidence`。
- 不允许为了通过门禁而关闭 `launch:gates` 或删除检查项。

## 10. 与首版上线的关系

当前首版策略是 `FIRST_RELEASE_MODE=semi_auto`，Telegram 真实测试可以后置。正式启用 Telegram 通知前，不能直接改数据库伪造 `last_test_status`，也不能在未实际收到 Telegram 消息时标记 `telegram_test=passed`。
