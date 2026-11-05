const migrationScope=require('./migration-scope')
const entries=[
  {
    "key": "门店业务配置:business-settings",
    "title": "经营设置",
    "permission": "system:service-config:query",
    "url": "/pages/boss/business-settings/index",
    "group": "门店业务配置"
  },
  {
    "key": "门店业务配置:departments",
    "title": "门店管理",
    "permission": "system:dept:query",
    "url": "/pages/admin-business/manage/index?type=departments",
    "group": "门店业务配置"
  },
  {
    "key": "门店业务配置:shifts",
    "title": "班次配置",
    "permission": "sport:staff-schedule-config:query",
    "url": "/pages/admin-business/manage/index?type=shifts",
    "group": "门店业务配置"
  },
  {
    "key": "门店业务配置:activities",
    "title": "促销活动",
    "permission": "sport:sales-activity:query",
    "url": "/pages/admin-business/manage/index?type=activities",
    "group": "门店业务配置"
  },
  {
    "key": "门店业务配置:games",
    "title": "返佣玩法",
    "permission": "sport:game-sales-config:query",
    "url": "/pages/admin-business/manage/index?type=games",
    "group": "门店业务配置"
  },
  {
    "key": "门店业务配置:targets",
    "title": "门店月目标",
    "permission": "sport:dept-sales-check:query",
    "url": "/pages/admin-business/manage/index?type=targets",
    "group": "门店业务配置"
  },
  {
    "key": "库存与单据:inventory",
    "title": "即开库存",
    "permission": "sport:inventory-ggl:query",
    "url": "/pages/admin-ledger/index?key=inventory",
    "group": "库存与单据"
  },
  {
    "key": "库存与单据:funds",
    "title": "五账户余额",
    "permission": "sport:inventory-fund:query",
    "url": "/pages/admin-ledger/index?key=funds",
    "group": "库存与单据"
  },
  {
    "key": "库存与单据:purchases",
    "title": "采购单据",
    "permission": "sport:purchasing-order:query",
    "url": "/pages/admin-ledger/index?key=purchases",
    "group": "库存与单据"
  },
  {
    "key": "库存与单据:transfers",
    "title": "票据调拨",
    "permission": "sport:allot-bill-join:query",
    "url": "/pages/admin-ledger/index?key=transfers",
    "group": "库存与单据"
  },
  {
    "key": "库存与单据:cash",
    "title": "资金调拨",
    "permission": "sport:allot-fund-join:query",
    "url": "/pages/admin-ledger/index?key=cash",
    "group": "库存与单据"
  },
  {
    "key": "库存与单据:activity",
    "title": "活动核销流水",
    "permission": "sport:check-sales-activity:query",
    "url": "/pages/admin-ledger/index?key=activity",
    "group": "库存与单据"
  },
  {
    "key": "系统管理:admin-system-posts",
    "title": "岗位管理",
    "permission": "system:post:query",
    "url": "/pages/admin-system/posts/index",
    "group": "系统管理"
  },
  {
    "key": "系统管理:admin-system-notices",
    "title": "公告管理",
    "permission": "system:notice:query",
    "url": "/pages/admin-system/notices/index",
    "group": "系统管理"
  },
  {
    "key": "系统管理:admin-system-menus",
    "title": "菜单管理",
    "permission": "system:menu:query",
    "url": "/pages/admin-system/global/index?type=menus",
    "group": "系统管理",
    "platformOnly": true
  },
  {
    "key": "系统管理:admin-system-dict-types",
    "title": "字典类型",
    "permission": "system:dict:query",
    "url": "/pages/admin-system/global/index?type=dict-types",
    "group": "系统管理",
    "platformOnly": true
  },
  {
    "key": "系统管理:admin-system-dict-data",
    "title": "字典数据",
    "permission": "system:dict:query",
    "url": "/pages/admin-system/global/index?type=dict-data",
    "group": "系统管理",
    "platformOnly": true
  },
  {
    "key": "系统管理:admin-system-tenants",
    "title": "租户管理",
    "permission": "system:tenant:query",
    "url": "/pages/admin-system/platform/index?type=tenants",
    "group": "系统管理",
    "platformOnly": true
  },
  {
    "key": "系统管理:admin-system-packages",
    "title": "租户套餐",
    "permission": "system:tenant-package:query",
    "url": "/pages/admin-system/platform/index?type=packages",
    "group": "系统管理",
    "platformOnly": true
  },
  {
    "key": "系统管理:admin-system-login-logs",
    "title": "登录日志",
    "permission": "system:login-log:query",
    "url": "/pages/admin-system/logs/index?type=login",
    "group": "系统管理"
  },
  {
    "key": "系统管理:admin-system-operate-logs",
    "title": "操作日志",
    "permission": "system:operate-log:query",
    "url": "/pages/admin-system/logs/index?type=operate",
    "group": "系统管理"
  },
  {
    "key": "messages:sms-channels",
    "title": "短信渠道",
    "permission": "system:sms-channel:query",
    "url": "/pages/admin-messaging/manage/index?type=sms-channels",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:sms-templates",
    "title": "短信模板",
    "permission": "system:sms-template:query",
    "url": "/pages/admin-messaging/manage/index?type=sms-templates",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:mail-accounts",
    "title": "邮件账号",
    "permission": "system:mail-account:query",
    "url": "/pages/admin-messaging/manage/index?type=mail-accounts",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:mail-templates",
    "title": "邮件模板",
    "permission": "system:mail-template:query",
    "url": "/pages/admin-messaging/manage/index?type=mail-templates",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:notify-templates",
    "title": "站内信模板",
    "permission": "system:notify-template:query",
    "url": "/pages/admin-messaging/manage/index?type=notify-templates",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:social-clients",
    "title": "社交客户端",
    "permission": "system:social-client:query",
    "url": "/pages/admin-messaging/manage/index?type=social-clients",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:sms-logs",
    "title": "短信发送记录",
    "permission": "system:sms-log:query",
    "url": "/pages/admin-messaging/manage/index?type=sms-logs",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:mail-logs",
    "title": "邮件发送记录",
    "permission": "system:mail-log:query",
    "url": "/pages/admin-messaging/manage/index?type=mail-logs",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:notify-messages",
    "title": "站内信记录",
    "permission": "system:notify-message:query",
    "url": "/pages/admin-messaging/manage/index?type=notify-messages",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "messages:social-users",
    "title": "社交用户",
    "permission": "system:social-user:query",
    "url": "/pages/admin-messaging/manage/index?type=social-users",
    "group": "消息与授权",
    "platformOnly": true
  },
  {
    "key": "inbox",
    "title": "我的消息",
    "url": "/pages/admin-messaging/inbox/index",
    "group": "消息与地区",
    "authOnly": true
  },
  {
    "key": "pay-app",
    "title": "支付应用",
    "url": "/pages/admin-pay/app/index",
    "permission": "pay:app:query",
    "group": "支付中心"
  },
  {
    "key": "pay-order",
    "title": "支付订单",
    "url": "/pages/admin-pay/transactions/index?kind=order",
    "permission": "pay:order:query",
    "group": "支付中心"
  },
  {
    "key": "pay-refund",
    "title": "退款订单",
    "url": "/pages/admin-pay/transactions/index?kind=refund",
    "permission": "pay:refund:query",
    "group": "支付中心"
  },
  {
    "key": "pay-transfer",
    "title": "转账订单",
    "url": "/pages/admin-pay/transactions/index?kind=transfer",
    "permission": "pay:transfer:query",
    "group": "支付中心"
  },
  {
    "key": "pay-notify",
    "title": "通知任务",
    "url": "/pages/admin-pay/notify/index",
    "permission": "pay:notify:query",
    "group": "支付中心"
  },
  {
    "key": "pay-wallet",
    "title": "钱包与流水",
    "url": "/pages/admin-pay/wallet/index",
    "permission": "pay:wallet:query",
    "group": "支付中心"
  },
  {
    "key": "pay-package",
    "title": "充值套餐",
    "url": "/pages/admin-pay/package/index",
    "permission": "pay:wallet-recharge-package:query",
    "group": "支付中心"
  },
  {
    "key": "user-import",
    "title": "账号导入",
    "url": "/pages/admin-system/user-import/index",
    "permission": "system:user:import",
    "group": "系统管理"
  }
]
function visible(info){const ps=info&&info.permissions||[],roles=info&&info.roles||[];return entries.filter(e=>!migrationScope.deferredEntry(e)&&(e.authOnly?!!(info&&info.user):(ps.includes("*:*:*")||ps.includes(e.permission)))&&(!e.platformOnly||roles.includes("super_admin")))}
module.exports={entries,visible}
