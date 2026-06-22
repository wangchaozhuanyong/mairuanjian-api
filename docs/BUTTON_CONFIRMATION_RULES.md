# 全局按钮确认规则

## 规则目标

后台所有会写数据库、改状态、触发外部任务、影响价格、订单、库存、客户资料或敏感数据的按钮，都必须先走统一确认。搜索、筛选、排序、分页、刷新、打开弹窗、切换 tab、查看详情、输入即查询等只读动作不加确认。

## 风险分级

### 无需确认

- 搜索、筛选、排序、分页、刷新。
- 打开弹窗、切换 tab、查看详情、展开详情。
- 输入即查询、列显示、密度切换、保存表格视图名称。

### 普通确认

- 新增、保存、编辑提交。
- 启用、停用、删除、忽略、确认、审批。
- 重试、同步、单项采集、生成任务、执行任务。

### 强确认

- 批量删除、批量采集、批量导入。
- 覆盖数据、清空、恢复、发布。
- 导出敏感数据、复制或查看敏感字段。
- 任何会影响线上、客户、订单、库存、价格的操作。
- 更高风险操作可以要求输入“确认”两个字。

## 统一封装

前端统一使用 `apps/admin/src/utils/confirmAction.ts`。

确认弹窗必须尽量说明：

- 操作名称。
- 影响范围。
- 是否可撤销。
- 预计数量。
- 失败风险。

危险按钮不能直接在 `@click` 中调用写入接口，必须先调用 `confirmAction()` 或接入统一的确认按钮组件。

## 按钮文案

- 文案必须说清楚动作对象，避免只写“采集全部”“确认”“保存”。
- 推荐：`开始批量采集`、`确认保存规则`、`停用该来源`、`删除客户`、`确认同步价格`。
- 高风险按钮使用 `danger` 或警告色，不能和普通只读按钮混在一起。

## 防重复点击

- 用户确认后立即设置对应 loading key。
- 执行期间按钮显示执行中或 loading，不能再次点击。
- 长耗时任务需要后端返回任务 ID 或任务状态；刷新页面后再根据任务状态恢复“执行中”。

## 本次已接入

`apps/admin/src/views/apple/AppleServicesView.vue`

- `保存规则`：强确认，影响 Apple 余额价全局规则。
- `开始采集`：强确认，显示供应商数、地区数和任务数，确认后创建后台采集批次。
- `采集 ChatGPT/Gemini/Claude`：按任务数量确认，多个地区时走强确认，确认后创建后台采集批次。
- `采集该来源`：普通确认，单来源采集。
- `生成价格对比`：普通确认；如果同时检查疑似下架套餐则强确认。
- `确认同步价格`：强确认，会同步官网价、币种、周期并重算 Apple 余额价。
- `删除官方来源`：强确认。

官方价格批量采集已经改成后台批次：

- 后端新增 `apple_official_price_check_batches` 和 `apple_official_price_check_batch_items`。
- 前端确认后调用批次接口，接口立即返回 `batchId`。
- 后台继续执行每个供应商/地区采集，前端轮询批次进度。
- 页面只刷新进度条和结果计数，不再让整个官方价格面板反复 loading。
- 刷新页面后通过最新批次接口恢复当前进度或最近结果。

## 扫描清单

扫描命令：

```bash
rg -n '@click="[^"\n]+\(|ElMessageBox\.confirm|ElMessageBox\.prompt' apps/admin/src/views apps/admin/src/components
```

优先继续整改：

- 客户与来源：`CustomersView.vue` 的保存客户、查看手机号；`SourcePlatformsView.vue` 的启用/停用、删除、快捷配置状态切换。
- ID 业务：`AppleOrderEntryView.vue` 的提交订单；`AppleAutomationTasksView.vue` 的执行/重试任务；`AppleActionPlansView.vue` 的生成计划、完成计划；Apple ID 敏感字段查看。
- 兑换码业务：`CodeInventoryView.vue` 的批量导入、查看完整兑换码；`CodeOrdersView.vue` 的匹配锁码、生成发货、确认发货；`PlatformCodeOrdersView.vue` 的同步订单、同步退款、转人工。
- 安全与风控：`SecurityView.vue` 的密码策略、MFA 设置、恢复码重置、审批敏感访问。
- 数据与审计：`DataCenterView.vue` 的备份、恢复、导入、导出、回收站恢复/清理、状态标记。
- 系统配置：`MaintenanceView.vue` 的公告删除、功能开关、系统参数保存；`NotificationsView.vue` 的重试通知、全部已读、规则保存。
- 公共组件：`TableToolbar.vue` 的批量操作和导出动作需要由调用页面标注风险等级。
