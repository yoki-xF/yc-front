# H5 重建进度

2026-11-06：用户确认废止小程序，原仓库重建移动 H5；后端单体沿用，第三方支付、短信及外部邮件/社交继续暂缓。现有小程序代码已提交并推送，基线 a25e538。

## 当前实施范围

登录、会话与权限路由、工作台、九类经营记录只读查询及详情、门店经营报表。其余写入流程与平台管理尚待重建；小程序功能完成记录不等于 H5 已完成。

## 需求核对清单

- [ ] `pages/index/index`
- [ ] `pages/login/index`
- [ ] `pages/manual/index`
- [ ] `pages/profile/index`
- [ ] `pages/activity/index`
- [ ] `pages/morning/index`
- [ ] `pages/evening/index`
- [ ] `pages/fund/index`
- [ ] `pages/business/index`
- [ ] `pages/report/index`
- [ ] `pages/cash-transfer/index`
- [ ] `pages/order-ledger/index`
- [ ] `pages/transfer-create/index`
- [ ] `pages/order-detail/index`
- [ ] `pages/purchase-create/index`
- [ ] `pages/check-status/index`
- [ ] `pages/boss/home/index`
- [ ] `pages/boss/records/index`
- [ ] `pages/boss/detail/index`
- [ ] `pages/boss/form/index`
- [ ] `pages/boss/correction/index`
- [ ] `pages/boss/reports/index`
- [ ] `pages/boss/profile/index`
- [ ] `pages/boss/schedule/index`
- [ ] `pages/boss/user-actions/index`
- [ ] `pages/boss/role-actions/index`
- [ ] `pages/boss/vouchers/index`
- [ ] `pages/boss/opening/index`
- [ ] `pages/boss/operating-day/index`
- [ ] `pages/admin/home/index`
- [ ] `pages/admin-business/manage/index`
- [ ] `pages/admin-ledger/index`
- [ ] `pages/admin-system/posts/index`
- [ ] `pages/admin-system/notices/index`
- [ ] `pages/admin-system/global/index`
- [ ] `pages/admin-system/platform/index`
- [ ] `pages/admin-system/logs/index`
- [ ] `pages/admin-messaging/manage/index`
- [ ] `pages/admin-messaging/inbox/index`
- [ ] `pages/admin-pay/app/index`
- [ ] `pages/admin-pay/channel/index`
- [ ] `pages/admin-pay/notify/index`
- [ ] `pages/admin-pay/package/index`
- [ ] `pages/admin-pay/transactions/index`
- [ ] `pages/admin-pay/wallet/index`
- [ ] `pages/admin-system/user-import/index`
- [ ] `pages/admin-pay/wallet-adjustment/index`
- [ ] `pages/boss/commission-create/index`
- [ ] `pages/boss/business-settings/index`
- [ ] `pages/workspace/ledger/index`
- [ ] `pages/workspace/reports/index`
- [ ] `pages/workspace/mine/index`

## 2026-11-06 首批实际验证

- 新 Vitest 测试涵盖请求租户头、长ID、账号切换、并发刷新、写入不重放、公共登录隔离，以及保留的报表/业务模型/周期/资料规则；精确数量见执行输出。
- TypeScript 检查及 Vite production build 通过。
- 浏览器实际检查：未登录跳转登录页；390px宽空字段提交显示提示；不输入凭据，不提交业务数据。
- 后端本批未修改、未部署；H5尚未连通隔离后端，真实登录及复杂页面需下一批联调。
- 微信运行源码已移除。用户已确认旧 tests/ 暂留为需求核对依据，随 H5 开发逐项替换，不在H5测试范围。旧文档均加历史标记。

## H5 当前页面状态

| 页面 | 源码 | 当前验证 |
| --- | --- | --- |
| 登录 | LoginView.vue | 手机宽度布局、空字段提示；真实登录待联调 |
| 工作台 | WorkspaceView.vue | 权限模块及门店接口已接入代码，待真实账号验证 |
| 经营记录 | RecordsView.vue / DetailView.vue | 九类查询/分页/详情已接入代码，待真实账号验证 |
| 门店报表 | ReportsView.vue | 营业日口径使用保留规则，规则测试通过；真实接口待联调 |
| 我的 | MineView.vue | 组织展示、退出确认及接口代码已实现，待真实账号验证 |

本批 `npm run check`：5 个测试文件、9 项测试通过，TypeScript 与生产构建通过。npm 官方审计报告为 0 vulnerabilities。旧平台测试未计入上述数量。浏览器截图在本机交付 outputs/yc-h5/login-20261106.png，不含账号凭据。

## 本地测试账号联通（2026-11-06）

H5 已通过本机回环18481的 SSH 隧道连接 Mac mini 的 yc-acceptance。隔离网络不能直接映射端口，预览使用仅 Mac mini 回环可访问的转发容器；配置在私有部署目录 h5-preview.override.json，未开放公网。前端 .env.local 为忽略配置，不含凭据。已有合成验收租户的老板账号已验证组织名解析、登录、权限、管理门店、资金盘点和员工记录读取，验证会话已注销；凭据仅在私有 .runtime 文件中，不提交源码。

联调发现旧员工门店接口对未配置所属部门的老板返回500（AuthController.getMobilePermissionInfo 对空部门解引用），后端问题待修复。H5 管理身份读取与员工门店读取现已解耦：员工范围失败明确提示且保留空员工范围，不用管理门店替代员工授权；按独立权限开放管理查询。新增4项相关测试，连同原9项共13项通过，生产构建通过。
