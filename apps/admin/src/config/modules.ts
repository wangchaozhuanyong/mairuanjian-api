import { buildRouteHelpText } from '@/utils/helpText';

export type ModuleStatus = 'ready' | 'design-ready' | 'planned' | 'later';
export type MenuSectionIcon =
  | 'workspace'
  | 'common'
  | 'id'
  | 'codes'
  | 'security'
  | 'data'
  | 'ops'
  | 'system';

export interface AppModuleItem {
  key: string;
  title: string;
  route: string;
  mark: string;
  group: string;
  phase: string;
  status: ModuleStatus;
  permission?: string;
  description: string;
  help?: string[];
  metrics?: Array<{
    label: string;
    value: string;
    hint: string;
    tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  }>;
  features: string[];
  primaryAction?: string;
  secondaryAction?: string;
  tableColumns?: string[];
}

export interface MenuSection {
  key: string;
  title: string;
  icon: MenuSectionIcon;
  items: AppModuleItem[];
  defaultOpen?: boolean;
}

const modulePermissionByKey: Record<string, string> = {
  renewal: 'apple.renewal_task.view',
  'renewal-cancel': 'apple.renewal_task.view',
  'renewal-topup': 'apple.renewal_task.view',
  'renewal-waiting-auto': 'apple.renewal_task.view',
  'action-plans': 'apple.action_plan.view',
  'launch-audit': 'maintenance.system_parameter.manage',
  'apple-list': 'apple.account.view',
  'apple-detail': 'apple.account.view',
  'apple-source-channels': 'apple.account.update',
  'apple-settings': 'apple.service.manage',
  'apple-orders': 'apple.order.view',
  'order-entry': 'apple.order.view',
  'apple-activations': 'apple.activation.view',
  'balance-reconciliation': 'apple.balance.view',
  'finance-center': 'apple.report.view',
  'apple-automation': 'apple.automation_task.manage',
  'apple-reports': 'apple.report.view',
  'code-inventory': 'code.inventory.view',
  'code-settings': 'code.service.manage',
  'code-orders': 'code.order.view',
  'delivery-exceptions': 'code.delivery.view',
  'after-sales': 'code.after_sale.manage',
  'taobao-orders': 'code.order.view',
  'xianyu-orders': 'code.order.view',
  'code-reports': 'code.report.view',
  'delivery-templates': 'code.delivery_template.manage',
  customers: 'customer.view',
  'source-platforms': 'source_platform.view',
  attachments: 'attachment.view',
  notifications: 'notification.view',
  security: 'security.overview.view',
  'login-logs': 'security.login_log.view',
  sessions: 'security.session.view',
  mfa: 'security.mfa.manage',
  'ip-whitelist': 'security.ip_whitelist.manage',
  'sensitive-approvals': 'security.sensitive_access_approval.manage',
  'data-center': 'data.overview.view',
  'data-imports': 'data.import.view',
  'data-exports': 'data.export.view',
  'data-dictionaries': 'data.dictionary.manage',
  'recycle-bin': 'data.recycle_bin.view',
  'ops-monitor': 'ops.overview.view',
  maintenance: 'maintenance.announcement.view',
  'feature-flags': 'maintenance.feature_flag.view',
  versions: 'maintenance.version.view',
  changelog: 'maintenance.version.view',
  'system-parameters': 'maintenance.system_parameter.manage',
  'audit-log': 'audit_log.view',
  'platform-status': 'ops.api_status.view',
  'platform-interface-logs': 'audit_log.view',
  'automation-logs': 'audit_log.view'
};

const workspaceModules: AppModuleItem[] = [
  {
    key: 'dashboard',
    title: '首页仪表盘',
    route: '/dashboard',
    mark: 'DB',
    group: '工作台',
    phase: 'Design',
    status: 'ready',
    description: '展示今日关键指标、任务、风险、平台状态和常用入口。',
    metrics: [
      { label: '今日订单', value: '126', hint: '较昨日增加 19 单', tone: 'green' },
      { label: '待处理任务', value: '42', hint: '紧急 7 · 待充值 9', tone: 'orange' },
      { label: '自动发货成功率', value: '98.7%', hint: '失败转人工 3 单', tone: 'blue' }
    ],
    features: ['全局指标卡片', '今日关键任务', '风险提醒', '快速入口']
  },
  {
    key: 'renewal',
    title: '续费工作台',
    route: '/workspace/renewal',
    mark: 'RN',
    group: '工作台',
    phase: 'Phase 5',
    status: 'ready',
    description: '集中处理到期联系、客户续费确认、待取消、待充值和等待扣费任务。',
    features: ['到期任务生成', '任务优先级', '客户决定流转', '任务处理抽屉'],
    primaryAction: '生成到期任务',
    tableColumns: ['任务', '客户', '业务', '到期时间', '优先级', '状态']
  },
  {
    key: 'renewal-cancel',
    title: '待取消订阅',
    route: '/workspace/renewal/cancel-subscriptions',
    mark: 'CS',
    group: '工作台',
    phase: 'Phase 5',
    status: 'ready',
    description: '处理客户确认不续费、需要取消 Apple 自动订阅的任务。',
    features: ['取消订阅清单', '截止时间', '客户决定', '处理备注'],
    primaryAction: '生成到期任务',
    tableColumns: ['任务', '客户', '业务', 'Apple ID', '最晚取消', '状态']
  },
  {
    key: 'renewal-topup',
    title: '待充值续费',
    route: '/workspace/renewal/topups',
    mark: 'TR',
    group: '工作台',
    phase: 'Phase 5',
    status: 'ready',
    description: '处理余额不足、需要充值后才能完成续费扣费的任务。',
    features: ['余额快照', '预计扣费', '建议充值', '处理备注'],
    primaryAction: '生成到期任务',
    tableColumns: ['任务', '客户', 'Apple ID', '当前余额', '建议充值', '状态']
  },
  {
    key: 'renewal-waiting-auto',
    title: '等待自动续费',
    route: '/workspace/renewal/waiting-auto-renewal',
    mark: 'WA',
    group: '工作台',
    phase: 'Phase 5',
    status: 'ready',
    description: '跟踪余额足够、等待 Apple 自动扣费并检查续期结果的任务。',
    features: ['自动扣费等待', '扣费时间', '续费结果检查', '异常转人工'],
    primaryAction: '生成到期任务',
    tableColumns: ['任务', '客户', '业务', '预计扣费', '扣费时间', '状态']
  },
  {
    key: 'action-plans',
    title: 'Apple ID 操作计划',
    route: '/workspace/action-plans',
    mark: 'AP',
    group: '工作台',
    phase: 'Phase 5',
    status: 'ready',
    description: '按 Apple ID 聚合同周期多业务续费、取消、充值和风险动作。',
    features: ['同账号任务聚合', '误扣费风险提示', '操作清单', '计划完成'],
    primaryAction: '重新生成计划',
    tableColumns: ['Apple ID', '余额', '续费项', '取消项', '风险', '动作']
  },
  {
    key: 'launch-audit',
    title: '上线检查清单',
    route: '/workspace/launch-audit',
    mark: 'LA',
    group: '工作台',
    phase: 'Phase 16',
    status: 'ready',
    description: '上线前检查接口联调、权限、安全、发货兜底、数据备份和生产配置等质量项。',
    features: ['上线阻塞项', '验收负责人', '检查证据', '状态保存', '发布前风险判断'],
    primaryAction: '保存清单',
    tableColumns: ['检查项', '优先级', '状态', '负责人', '证据', '备注']
  }
];

const appleModules: AppModuleItem[] = [
  {
    key: 'apple-list',
    title: 'Apple ID 管理',
    route: '/apple/accounts',
    mark: 'ID',
    group: 'Apple ID 业务',
    phase: 'Phase 3',
    status: 'ready',
    description:
      '这里放所有 Apple ID。你可以看它还剩多少钱、有没有被锁、资料齐不齐，也可以做充值、消费和查流水。',
    features: ['账号列表', '批量导入', '敏感字段脱敏', '余额流水', '状态检测'],
    primaryAction: '新增 Apple ID',
    tableColumns: ['Apple ID', '地区/币种', '余额', '平均成本', '状态', '业务数', '操作']
  },
  {
    key: 'apple-detail',
    title: 'Apple ID 详情',
    route: '/apple/accounts/detail',
    mark: 'DT',
    group: 'Apple ID 业务',
    phase: 'Phase 3',
    status: 'ready',
    description: '展示单个 Apple ID 的余额、成本、订单、开通记录、续费任务和操作计划。',
    features: ['余额摘要', '订单记录', '开通中业务', '充值记录', '消费记录', '续费任务'],
    primaryAction: '录入充值',
    tableColumns: ['类型', '金额', '成本', '操作人', '时间']
  },
  {
    key: 'apple-source-channels',
    title: 'Apple ID 来源渠道',
    route: '/apple/source-channels',
    mark: 'CH',
    group: 'Apple ID 业务',
    phase: 'Phase 3',
    status: 'ready',
    description: '单独维护 Apple ID 从哪里获得，不和客户来源平台、订单销售平台混用。',
    features: ['来源渠道列表', '新增编辑', '启停状态', '备注说明', '账号下拉引用'],
    primaryAction: '新增来源渠道',
    tableColumns: ['来源渠道', '状态', '备注', '更新时间']
  },
  {
    key: 'apple-settings',
    title: 'Apple ID 业务设置',
    route: '/apple/settings',
    mark: 'AS',
    group: 'Apple ID 业务',
    phase: 'Phase 4',
    status: 'ready',
    description: '配置业务价格、消耗金额、账期、锁定规则和提醒策略。',
    features: ['业务配置', '账期规则', '锁定规则', '自动匹配', '提醒策略'],
    primaryAction: '新增业务',
    tableColumns: ['业务', '币种', '消耗', '售价', '锁定规则', '状态']
  },
  {
    key: 'apple-orders',
    title: '订单管理',
    route: '/apple/orders',
    mark: 'OM',
    group: '客户与来源',
    phase: 'Phase 4',
    status: 'ready',
    description:
      '这里看 Apple ID 订单。重点看客户付了多少钱、这个单花掉多少余额、最后赚了还是亏了。',
    features: ['订单列表', '订单详情抽屉', '利润预估', '开通记录', '续费任务关联'],
    primaryAction: '新建订单',
    tableColumns: [
      '订单号',
      '客户',
      '业务',
      'Apple ID',
      '实收',
      '成本',
      '平台手续费',
      '退款/补发损耗',
      '利润',
      '状态'
    ]
  },
  {
    key: 'order-entry',
    title: 'Apple ID 订单录入',
    route: '/apple/order-entry',
    mark: 'OE',
    group: 'Apple ID 业务',
    phase: 'Phase 4',
    status: 'ready',
    description: '按客户、来源平台、业务和自动匹配结果录入开通订单。',
    features: ['分步表单', '自动匹配', '成本预估', '提交前校验', '草稿保存'],
    primaryAction: '提交订单',
    tableColumns: ['客户', '业务', '推荐账号', '实收', '预计利润', '校验']
  },
  {
    key: 'apple-activations',
    title: 'Apple ID 开通记录',
    route: '/apple/activations',
    mark: 'AC',
    group: '客户与来源',
    phase: 'Phase 4',
    status: 'ready',
    description: '查看 Apple ID 业务开通记录、到期时间、成本利润和续费状态。',
    features: ['开通记录列表', '详情抽屉', '到期筛选', '成本利润', '续费状态'],
    primaryAction: '查看到期记录',
    tableColumns: ['订单号', '客户', '业务', 'Apple ID', '到期时间', '状态']
  },
  {
    key: 'balance-reconciliation',
    title: 'Apple ID 余额对账',
    route: '/apple/balance-reconciliation',
    mark: 'BR',
    group: 'Apple ID 业务',
    phase: 'Phase 3',
    status: 'ready',
    description:
      '系统里记的余额和你实际查到的不一样时，在这里修正。每次修正都会留下记录，方便以后对账。',
    features: ['余额差异列表', '成本影响预览', '修正原因', '通知财务', '审计日志'],
    primaryAction: '处理差异',
    tableColumns: ['Apple ID', '系统余额', '查询余额', '差异', '影响', '状态']
  },
  {
    key: 'finance-center',
    title: 'Apple ID 财务对账',
    route: '/apple/finance',
    mark: 'FC',
    group: 'Apple ID 业务',
    phase: 'Phase 4',
    status: 'ready',
    description: '独立统计 Apple ID 销售额、余额成本、利润、手续费和异常成本。',
    features: ['销售对账', '成本对账', '利润对账', '余额修正', '导出报表'],
    primaryAction: '导出财务报表',
    tableColumns: ['日期', '订单数', '销售额', '余额成本', '手续费', '利润']
  },
  {
    key: 'apple-automation',
    title: 'Apple ID 自动化任务',
    route: '/apple/automation',
    mark: 'AT',
    group: 'Apple ID 业务',
    phase: 'Phase 8',
    status: 'design-ready',
    description: '管理查询余额、检测状态、取消订阅、自动充值等自动化任务，高风险任务转人工验证。',
    features: ['任务队列', '失败转人工', '截图凭证', '结果回写', '执行状态'],
    primaryAction: '创建自动化任务',
    tableColumns: ['任务', 'Apple ID', '关联业务', '状态', '结果', '创建时间']
  },
  {
    key: 'apple-reports',
    title: 'Apple ID 报表',
    route: '/apple/reports',
    mark: 'AR',
    group: 'Apple ID 业务',
    phase: 'Phase 4',
    status: 'ready',
    description: '查看 Apple ID 销售、成本、利润、到期分布和异常账号报表。',
    features: ['利润排行', '到期分布', '异常账号', '余额成本分布', '导出'],
    primaryAction: '导出 Apple ID 报表',
    tableColumns: ['业务', '订单数', '销售额', '成本', '利润', '毛利率']
  }
];

const codeModules: AppModuleItem[] = [
  {
    key: 'code-inventory',
    title: '兑换码库存',
    route: '/codes/inventory',
    mark: 'CI',
    group: '兑换码自动发货',
    phase: 'Phase 6',
    status: 'ready',
    description:
      '这里放所有还没卖、已锁定或已发出的兑换码。平时只看尾号，完整码需要权限和原因才能查看。',
    features: ['批量导入', '重复检测', '库存状态', '锁定超时', '敏感查看日志'],
    primaryAction: '批量导入兑换码',
    tableColumns: ['兑换码尾号', '面值', '成本', '批次', '状态', '绑定订单']
  },
  {
    key: 'code-settings',
    title: '兑换码业务设置',
    route: '/codes/settings',
    mark: 'CS',
    group: '兑换码自动发货',
    phase: 'Phase 6',
    status: 'ready',
    description: '配置面值、成本、售价、平台映射、发货模板和缺货处理策略。',
    features: ['面值配置', '平台商品映射', '发货模板', '缺货策略', '组合发货规则'],
    primaryAction: '新增兑换码业务',
    tableColumns: ['业务', '面值', '成本', '售价', '发货方式', '状态']
  },
  {
    key: 'code-orders',
    title: '兑换码订单',
    route: '/codes/orders',
    mark: 'CO',
    group: '兑换码自动发货',
    phase: 'Phase 6',
    status: 'ready',
    description:
      '这里处理兑换码订单。系统会尽量帮你匹配业务、锁住可用兑换码，再生成可以发给买家的内容。',
    features: ['手工订单导入', '自动匹配面值', '锁定库存', '生成发货内容', '成本利润预估'],
    primaryAction: '手工导入订单',
    tableColumns: ['订单号', '平台', '商品/SKU', '业务', '锁码', '发货状态']
  },
  {
    key: 'delivery-templates',
    title: '发货模板',
    route: '/codes/delivery-templates',
    mark: 'DT',
    group: '兑换码自动发货',
    phase: 'Phase 6',
    status: 'ready',
    description: '设置淘宝、闲鱼客户付款后收到的回复内容，只用于兑换码自动发货。',
    features: ['淘宝/闲鱼话术', '模板变量', '自动发货引用', '售后补发话术', '启用状态'],
    primaryAction: '新增发货模板',
    tableColumns: ['模板', '内容预览', '变量', '状态', '更新时间']
  },
  {
    key: 'delivery-exceptions',
    title: '发货异常',
    route: '/codes/delivery-exceptions',
    mark: 'DE',
    group: '兑换码自动发货',
    phase: 'Phase 7',
    status: 'design-ready',
    description: '集中处理缺货、接口失败、锁定超时和退款后异常订单。',
    features: ['异常分类', '转人工', '重试发货', '释放锁定', '通知发货员'],
    primaryAction: '批量转人工',
    tableColumns: ['异常类型', '订单号', '平台', '面值', '原因', '状态']
  },
  {
    key: 'after-sales',
    title: '售后补发',
    route: '/codes/after-sales',
    mark: 'AS',
    group: '兑换码自动发货',
    phase: 'Phase 6',
    status: 'ready',
    description: '处理兑换码售后补发，关联原订单、原码、新码和损耗成本。',
    features: ['售后单', '补发流程', '损耗成本', '凭证上传', '处理记录'],
    primaryAction: '新增售后单',
    tableColumns: ['售后单', '原订单', '面值', '损耗', '负责人', '状态']
  },
  {
    key: 'taobao-orders',
    title: '淘宝订单',
    route: '/codes/taobao-orders',
    mark: 'TB',
    group: '兑换码自动发货',
    phase: 'Phase 7',
    status: 'design-ready',
    description: '同步淘宝订单，识别 SKU，锁定兑换码并自动或半自动发货。',
    features: ['订单同步', 'SKU 识别', '自动发货', '退款同步', '失败转人工'],
    primaryAction: '同步淘宝订单',
    tableColumns: ['订单号', '买家', 'SKU', '面值', '实付', '发货状态']
  },
  {
    key: 'xianyu-orders',
    title: '闲鱼订单',
    route: '/codes/xianyu-orders',
    mark: 'XY',
    group: '兑换码自动发货',
    phase: 'Phase 7',
    status: 'planned',
    description: '处理闲鱼电子凭证、无需物流和半自动复制发货兜底。',
    features: ['订单同步', '电子凭证', '无需物流', '半自动兜底', '售后同步'],
    primaryAction: '同步闲鱼订单',
    tableColumns: ['订单号', '商品', '面值', '实付', '发货方式', '状态']
  },
  {
    key: 'code-reports',
    title: '兑换码报表',
    route: '/codes/reports',
    mark: 'CR',
    group: '兑换码自动发货',
    phase: 'Phase 6',
    status: 'ready',
    description: '独立统计兑换码销售、成本、退款、利润和平台成功率。',
    features: ['平台利润', '库存周转', '售后损耗', '自动发货成功率', '导出'],
    primaryAction: '导出兑换码报表',
    tableColumns: ['平台', '订单数', '销售额', '成本', '退款', '利润']
  }
];

const systemModules: AppModuleItem[] = [
  {
    key: 'customers',
    title: '客户管理',
    route: '/system/customers',
    mark: 'CU',
    group: '客户与来源',
    phase: 'Phase 2',
    status: 'ready',
    description: '这里管客户资料。客户是谁、从哪个平台来、联系方式和相关订单任务，都从这里查。',
    features: ['客户列表', '客户详情', '订单关联', '任务关联', '手机号脱敏'],
    primaryAction: '新增客户',
    tableColumns: ['客户', '来源', '开通中业务', '累计消费', '标签', '最近订单']
  },
  {
    key: 'source-platforms',
    title: '选项设置',
    route: '/system/source-platforms',
    mark: 'QS',
    group: '系统配置',
    phase: 'Phase 2',
    status: 'ready',
    description:
      '这里维护日常会改的选项内容，比如来源平台、客户标签、Apple ID 分类和兑换码发货方式。',
    features: ['来源平台', '客户标签', 'Apple ID 分类', '地区币种', '发货方式'],
    primaryAction: '新增选项',
    tableColumns: ['名称', '用途', '状态', '排序', '备注']
  },
  {
    key: 'attachments',
    title: '附件中心',
    route: '/system/attachments',
    mark: 'FM',
    group: '数据与记录',
    phase: 'Phase 1',
    status: 'ready',
    description: '查看上传凭证、截图、售后材料和导入导出附件元数据。',
    features: ['附件元数据', '上传人', '文件类型', '业务关联', '访问控制'],
    primaryAction: '上传附件',
    tableColumns: ['文件名', '类型', '大小', '上传人', '业务来源', '时间']
  },
  {
    key: 'notifications',
    title: '通知设置',
    route: '/system/notifications',
    mark: 'NS',
    group: '系统配置',
    phase: 'Phase 9',
    status: 'ready',
    description: '配置后台提醒规则、Telegram、通知模板和发送日志。',
    features: ['Telegram 配置', '通知规则', '通知模板', '发送日志', '失败重试'],
    primaryAction: '新增通知规则',
    tableColumns: ['事件', '模块', '级别', '渠道', '启用', '最后触发']
  },
  {
    key: 'security',
    title: '安全中心',
    route: '/system/security',
    mark: 'SC',
    group: '安全与风控',
    phase: 'Phase 10',
    status: 'ready',
    description: '管理登录安全、MFA、会话、IP 白名单、敏感字段审批和异常登录。',
    features: ['登录日志', '在线会话', 'MFA', 'IP 白名单', '敏感审批'],
    primaryAction: '配置安全策略',
    tableColumns: ['安全项', '状态', '风险', '最近事件', '操作']
  },
  {
    key: 'login-logs',
    title: '登录日志',
    route: '/system/login-logs',
    mark: 'LL',
    group: '安全与风控',
    phase: 'Phase 10',
    status: 'ready',
    description: '查看登录成功、失败、异常 IP、设备和地区记录。',
    features: ['登录筛选', '异常标记', 'IP 归属', '设备信息', '导出'],
    tableColumns: ['用户', 'IP', '设备', '结果', '风险', '时间']
  },
  {
    key: 'sessions',
    title: '在线会话',
    route: '/system/sessions',
    mark: 'SE',
    group: '安全与风控',
    phase: 'Phase 10',
    status: 'ready',
    description: '查看当前在线用户、设备、IP，并支持强制下线。',
    features: ['会话列表', '强制下线', '设备信息', '最后活跃', '风险会话'],
    primaryAction: '批量下线',
    tableColumns: ['用户', '设备', 'IP', '最后活跃', '状态']
  },
  {
    key: 'mfa',
    title: 'MFA 设置',
    route: '/system/mfa',
    mark: 'MF',
    group: '安全与风控',
    phase: 'Phase 10',
    status: 'ready',
    description: '配置管理员和高风险角色的多因素认证策略。',
    features: ['强制 MFA', '角色策略', '恢复码', '启用记录', '异常提醒'],
    primaryAction: '启用 MFA 策略',
    tableColumns: ['角色', '是否强制', '启用人数', '异常数', '更新时间']
  },
  {
    key: 'ip-whitelist',
    title: 'IP 白名单',
    route: '/system/ip-whitelist',
    mark: 'IP',
    group: '安全与风控',
    phase: 'Phase 10',
    status: 'ready',
    description: '配置后台访问 IP 白名单和例外规则。',
    features: ['白名单规则', '角色范围', '例外时间', '启用状态', '审计日志'],
    primaryAction: '新增 IP 规则',
    tableColumns: ['规则', 'IP/CIDR', '范围', '启用', '更新时间']
  },
  {
    key: 'sensitive-approvals',
    title: '敏感字段访问审批',
    route: '/system/sensitive-approvals',
    mark: 'SA',
    group: '安全与风控',
    phase: 'Phase 10',
    status: 'ready',
    description: '审批查看密码、密保、礼品卡完整代码和完整兑换码。',
    features: ['审批申请', '查看原因', '批准/拒绝', '有效期', '审计日志'],
    primaryAction: '查看待审批',
    tableColumns: ['申请人', '字段', '原因', '状态', '审批人', '时间']
  },
  {
    key: 'data-center',
    title: '数据备份',
    route: '/system/data-center',
    mark: 'DC',
    group: '数据与记录',
    phase: 'Phase 11',
    status: 'ready',
    description: '管理备份、恢复、导入、导出、回收站和数据清理。',
    features: ['数据备份', '数据恢复', '导入任务', '导出任务', '回收站'],
    primaryAction: '创建备份',
    tableColumns: ['任务', '范围', '状态', '发起人', '时间']
  },
  {
    key: 'data-imports',
    title: '数据导入任务',
    route: '/system/data-imports',
    mark: 'DI',
    group: '数据与记录',
    phase: 'Phase 11',
    status: 'ready',
    description: '管理客户、Apple ID、兑换码等导入任务和错误行报告。',
    features: ['导入队列', '错误行下载', '预检查', '回滚标记', '导入日志'],
    primaryAction: '新建导入',
    tableColumns: ['任务', '模块', '总行数', '成功', '失败', '状态']
  },
  {
    key: 'data-exports',
    title: '数据导出任务',
    route: '/system/data-exports',
    mark: 'EX',
    group: '数据与记录',
    phase: 'Phase 11',
    status: 'ready',
    description: '管理导出任务、敏感字段标记、下载有效期和导出审计。',
    features: ['导出队列', '敏感字段提示', '下载过期', '导出日志', '权限控制'],
    primaryAction: '新建导出',
    tableColumns: ['任务', '模块', '字段范围', '状态', '下载过期', '发起人']
  },
  {
    key: 'data-dictionaries',
    title: '数据字典',
    route: '/system/data-dictionaries',
    mark: 'DD',
    group: '内部维护',
    phase: 'Phase 11',
    status: 'ready',
    description: '维护状态枚举、业务分类、任务类型等字典数据。',
    features: ['字典分组', '枚举值', '排序', '启用状态', '引用说明'],
    primaryAction: '新增字典',
    tableColumns: ['分组', '编码', '名称', '排序', '启用']
  },
  {
    key: 'recycle-bin',
    title: '回收站',
    route: '/system/recycle-bin',
    mark: 'RB',
    group: '数据与记录',
    phase: 'Phase 11',
    status: 'ready',
    description: '查看软删除数据，并支持恢复或永久清理。',
    features: ['软删除记录', '恢复', '永久删除确认', '保留策略', '审计日志'],
    primaryAction: '批量恢复',
    tableColumns: ['对象', '模块', '删除人', '删除时间', '保留至']
  },
  {
    key: 'ops-monitor',
    title: '运维监控',
    route: '/system/ops-monitor',
    mark: 'OM',
    group: '内部维护',
    phase: 'Phase 12',
    status: 'ready',
    description: '监控 API、数据库、Redis、队列、定时任务、自动化服务、文件存储和磁盘。',
    features: ['健康状态', '队列积压', '定时任务', '自动化服务状态', '最近错误'],
    primaryAction: '刷新监控',
    tableColumns: ['服务', '状态', '延迟', '错误率', '最近检查']
  },
  {
    key: 'maintenance',
    title: '系统配置',
    route: '/system/maintenance',
    mark: 'SC',
    group: '系统配置',
    phase: 'Phase 13',
    status: 'ready',
    description: '集中管理系统公告、维护模式、功能开关、版本信息、更新日志和系统参数。',
    features: ['维护总览', '系统公告', '维护模式', '功能开关', '版本信息', '更新日志', '系统参数'],
    primaryAction: '发布公告',
    tableColumns: ['配置项', '状态', '影响范围', '更新时间', '操作']
  },
  {
    key: 'feature-flags',
    title: '功能开关',
    route: '/system/feature-flags',
    mark: 'FF',
    group: '系统配置',
    phase: 'Phase 13',
    status: 'ready',
    description: '按角色或模块控制新功能开关，支持灰度和快速回滚。',
    features: ['开关列表', '角色范围', '灰度比例', '风险提示', '操作记录'],
    primaryAction: '新增功能开关',
    tableColumns: ['开关', '模块', '范围', '状态', '更新时间']
  },
  {
    key: 'versions',
    title: '版本信息',
    route: '/system/versions',
    mark: 'VI',
    group: '系统配置',
    phase: 'Phase 13',
    status: 'ready',
    description: '展示系统版本、构建信息、发布时间和兼容性说明。',
    features: ['版本列表', '构建号', '发布时间', '回滚说明', '负责人'],
    primaryAction: '登记版本',
    tableColumns: ['版本', '构建号', '发布时间', '状态', '说明']
  },
  {
    key: 'changelog',
    title: '更新日志',
    route: '/system/changelog',
    mark: 'CL',
    group: '系统配置',
    phase: 'Phase 13',
    status: 'ready',
    description: '维护面向内部用户的版本更新内容和注意事项。',
    features: ['发布记录', '影响模块', '风险说明', '回滚说明', '阅读确认'],
    primaryAction: '新增更新日志',
    tableColumns: ['标题', '版本', '模块', '发布时间', '状态']
  },
  {
    key: 'system-parameters',
    title: '系统参数',
    route: '/system/parameters',
    mark: 'PA',
    group: '系统配置',
    phase: 'Phase 13',
    status: 'ready',
    description: '维护系统级参数，如默认分页、导出有效期、任务阈值等。',
    features: ['参数分组', '默认值', '修改原因', '生效范围', '审计日志'],
    primaryAction: '新增参数',
    tableColumns: ['参数', '分组', '值', '生效范围', '更新时间']
  },
  {
    key: 'audit-log',
    title: '审计日志中心',
    route: '/system/audit-logs',
    mark: 'AL',
    group: '数据与记录',
    phase: 'Phase 14',
    status: 'ready',
    description: '统一查看操作日志、敏感查看、导出、权限变更、自动化和平台接口日志。',
    features: ['操作日志', '敏感查看日志', '导出日志', '权限变更', '平台接口日志'],
    primaryAction: '导出日志',
    tableColumns: ['时间', '用户', '模块', '动作', '对象', '备注']
  },
  {
    key: 'platform-status',
    title: '平台连接状态',
    route: '/system/platform-status',
    mark: 'PS',
    group: '平台连接',
    phase: 'Phase 14',
    status: 'ready',
    description: '查看淘宝、闲鱼、Telegram 等外部平台有没有连上、有没有报错。',
    features: ['连接状态', '授权状态', '最近同步', '失败原因', '测试连接'],
    primaryAction: '测试连接',
    tableColumns: ['平台', '授权', 'Token 有效期', '最近同步', '错误率']
  },
  {
    key: 'platform-interface-logs',
    title: '平台请求记录',
    route: '/system/platform-interface-logs',
    mark: 'PL',
    group: '平台连接',
    phase: 'Phase 14',
    status: 'ready',
    description: '查看系统和淘宝、闲鱼、Telegram 等平台沟通时留下的成功和失败记录。',
    features: ['请求记录', '返回结果', '失败原因', '重试记录', '关联对象'],
    tableColumns: ['平台', '接口', '状态', '耗时', '错误', '时间']
  },
  {
    key: 'automation-logs',
    title: '自动化任务日志',
    route: '/system/automation-logs',
    mark: 'AU',
    group: '内部维护',
    phase: 'Phase 14',
    status: 'ready',
    description: '查看自动化服务执行日志、截图凭证和失败原因。',
    features: ['任务日志', '截图凭证', '失败原因', '转人工记录', '重试'],
    tableColumns: ['任务', '执行器', '状态', '结果', '耗时', '时间']
  },
  {
    key: 'risk-control',
    title: '风控中心',
    route: '/system/risk-control',
    mark: 'RC',
    group: '安全与风控',
    phase: 'Phase 14',
    status: 'later',
    description: '集中看异常登录、敏感查看、余额误扣费、发货失败等需要盯住的风险。',
    features: ['风险规则', '风险事件', '处置动作', '通知联动', '任务置顶'],
    primaryAction: '新增风控规则',
    tableColumns: ['规则', '模块', '级别', '触发次数', '启用', '动作']
  },
  {
    key: 'work-orders',
    title: '客服工单',
    route: '/workspace/work-orders',
    mark: 'WO',
    group: '工作台',
    phase: 'Phase 14',
    status: 'later',
    description: '聚合客户问题、订单、续费、发货、退款和售后处理记录。',
    features: ['工单看板', 'SLA', '关联客户', '关联订单', '处理记录'],
    primaryAction: '新建工单',
    tableColumns: ['工单', '客户', '类型', '负责人', 'SLA', '状态']
  },
  {
    key: 'users',
    title: '用户管理',
    route: '/system/users',
    mark: 'US',
    group: '安全与风控',
    phase: 'Phase 1',
    status: 'ready',
    permission: 'system.user_manage',
    description: '管理员工账号、状态和角色分配。',
    features: ['用户列表', '新增用户', '编辑用户', '角色分配', '状态管理'],
    primaryAction: '新增用户',
    tableColumns: ['账号', '姓名', '角色', '状态', '最后登录']
  },
  {
    key: 'roles',
    title: '权限管理',
    route: '/system/roles',
    mark: 'PM',
    group: '安全与风控',
    phase: 'Phase 1',
    status: 'ready',
    permission: 'system.role_manage',
    description: '管理角色权限和字段级权限矩阵。',
    features: ['角色列表', '权限树', '字段级权限', '权限变更审计', '角色人数'],
    primaryAction: '保存权限',
    tableColumns: ['角色', '编码', '用户数', '权限数', '更新时间']
  }
];

export const hiddenModules: AppModuleItem[] = [
  {
    key: 'forbidden',
    title: '403 无权限',
    route: '/403',
    mark: '403',
    group: '异常页面',
    phase: 'Design',
    status: 'design-ready',
    description: '用户没有权限访问页面时的提示页。',
    features: ['权限提示', '返回工作台', '联系管理员']
  },
  {
    key: 'not-found',
    title: '404 页面',
    route: '/404',
    mark: '404',
    group: '异常页面',
    phase: 'Design',
    status: 'design-ready',
    description: '访问不存在路由时的提示页。',
    features: ['返回首页', '菜单搜索', '错误说明']
  },
  {
    key: 'maintenance-mode',
    title: '系统维护模式页',
    route: '/system/maintenance-mode',
    mark: 'MM',
    group: '系统管理',
    phase: 'Phase 13',
    status: 'planned',
    description: '系统维护期间展示维护范围、预计恢复时间和公告。',
    features: ['维护公告', '恢复时间', '影响范围', '值班联系人'],
    tableColumns: ['维护窗口', '范围', '开始', '结束', '状态']
  }
];

function selectModules(source: AppModuleItem[], keys: string[]) {
  const moduleByKey = new Map(source.map((item) => [item.key, item]));
  return keys
    .map((key) => moduleByKey.get(key))
    .filter((item): item is AppModuleItem => Boolean(item));
}

export function getModuleDisplayTitle(item: AppModuleItem) {
  return item.title.replaceAll('Apple ID', 'ID');
}

export function getModuleDisplayGroup(item: AppModuleItem) {
  return item.group.replaceAll('Apple ID', 'ID');
}

export function getModuleDisplayDescription(item: AppModuleItem) {
  return item.description.replaceAll('Apple ID', 'ID').replaceAll('Apple ', 'ID ');
}

export function getModuleDisplayHelp(item: AppModuleItem) {
  return (
    item.help ??
    buildRouteHelpText(
      getModuleDisplayTitle(item),
      getModuleDisplayDescription(item),
      getModuleDisplayGroup(item)
    )
  );
}

export function getModulePermission(item: AppModuleItem) {
  return item.permission ?? modulePermissionByKey[item.key];
}

export function getModuleSearchText(item: AppModuleItem) {
  return [
    item.title,
    getModuleDisplayTitle(item),
    item.group,
    getModuleDisplayGroup(item),
    item.phase,
    item.description,
    item.features.join(' '),
    item.primaryAction ?? '',
    item.secondaryAction ?? '',
    item.tableColumns?.join(' ') ?? ''
  ].join(' ');
}

export const menuSections: MenuSection[] = [
  {
    key: 'workspace',
    title: '工作台',
    icon: 'workspace',
    defaultOpen: true,
    items: selectModules(
      [...workspaceModules, ...systemModules],
      ['dashboard', 'renewal', 'action-plans', 'work-orders', 'launch-audit']
    )
  },
  {
    key: 'common',
    title: '客户与来源',
    icon: 'common',
    items: selectModules(
      [...systemModules, ...appleModules],
      ['customers', 'apple-orders', 'apple-activations']
    )
  },
  {
    key: 'id-business',
    title: 'ID 业务',
    icon: 'id',
    items: selectModules(appleModules, [
      'order-entry',
      'apple-list',
      'apple-settings',
      'balance-reconciliation',
      'finance-center',
      'apple-automation',
      'apple-reports'
    ])
  },
  {
    key: 'codes',
    title: '兑换码业务',
    icon: 'codes',
    items: selectModules(codeModules, [
      'code-settings',
      'delivery-templates',
      'code-inventory',
      'code-orders',
      'delivery-exceptions',
      'taobao-orders',
      'xianyu-orders',
      'after-sales',
      'code-reports'
    ])
  },
  {
    key: 'security',
    title: '安全与风控',
    icon: 'security',
    items: selectModules(systemModules, ['security', 'risk-control', 'users', 'roles'])
  },
  {
    key: 'data-audit',
    title: '数据与记录',
    icon: 'data',
    items: selectModules(systemModules, [
      'data-center',
      'data-imports',
      'data-exports',
      'recycle-bin',
      'attachments',
      'audit-log'
    ])
  },
  {
    key: 'ops-platform',
    title: '平台连接',
    icon: 'ops',
    items: selectModules(systemModules, [
      'ops-monitor',
      'platform-status',
      'platform-interface-logs'
    ])
  },
  {
    key: 'system-config',
    title: '系统配置',
    icon: 'system',
    items: selectModules(systemModules, [
      'maintenance',
      'source-platforms',
      'notifications',
      'feature-flags',
      'versions',
      'changelog',
      'system-parameters'
    ])
  }
];

export const allModules = [
  ...workspaceModules,
  ...appleModules,
  ...codeModules,
  ...systemModules,
  ...hiddenModules
];

export const moduleMap = Object.fromEntries(allModules.map((item) => [item.key, item]));

export function getModuleByKey(key: string) {
  return moduleMap[key];
}

export function getStatusText(status: ModuleStatus) {
  const statusMap: Record<ModuleStatus, string> = {
    ready: '已接入',
    'design-ready': '设计完成',
    planned: '规划中',
    later: '后期增强'
  };

  return statusMap[status];
}

export function getStatusType(status: ModuleStatus) {
  const typeMap: Record<ModuleStatus, 'success' | 'primary' | 'warning' | 'info'> = {
    ready: 'success',
    'design-ready': 'primary',
    planned: 'warning',
    later: 'info'
  };

  return typeMap[status];
}
