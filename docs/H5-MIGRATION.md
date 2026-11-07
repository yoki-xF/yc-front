# H5 重建进度

2026-11-06：用户确认废止小程序，原仓库重建移动 H5；后端单体沿用，第三方支付、短信及外部邮件/社交继续暂缓。现有小程序代码已提交并推送，基线 a25e538。

当前完整功能清单见 [H5 功能核对与补齐清单](FUNCTION-CHECKLIST.md)。下文按日期保留实施证据，不用旧页面清单推算完成率。

## 初始实施范围（历史基线）

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


## 独立公网测试站点（2026-11-06）

https://yc-test.yoki.ink 已按统一规则部署在 Mac mini Docker，经云入口HTTPS/持久隧道访问。第一轮先记录问题，再集中修复并上线复验：前端18测试、后端428测试、公网51检查通过。已实现的查询/详情/报表及权限边界有实际浏览器和API验证，不再仅为接口代码；未实现的写入与平台管理仍是缺口。完整结果及未覆盖项见 [第一轮验收报告](acceptance/2026-11-06-round1.md)，运维入口见 [部署SOP](../deploy/README.md)。继续保留旧测试作为需求核对依据。

### 2026-11-06 个人销量入口

- 已接入 `/personal-report`：仅员工授权门店、本人电彩与竞彩；支持今日、本周、本月及自选日期。
- 按营业日显示已核对、营业中、待核对、未营业；合计仅包含已核对日期，未核对不能当作零销量。
- 前端验证账号/门店/日期范围、重复日期、金额精度及明细合计；不展示个人即开或盈亏。
- 本地 21 项测试、类型检查与构建通过；部署及浏览器检查以实际后续记录为准。营业日开结店与其他写入表单仍待接入。

- 测试站 c187436 已部署：公网 HTTP/API 回归 51/51 通过；原生 Chrome 验证员工本周个人电彩20.00、竞彩10.00、未营业不计零，以及无员工门店老板账号的空授权状态。报表页也提供个人销量入口。未完成真机验收。

### 2026-11-06 营业日与报表 UI（待本批测试站验收）

- 新增营业日管理：按管理范围查询、开店、五类资金及销量结店预览、二次确认结店；独立 query/open/close 权限。
- 写入前将原请求标识保留在当前标签会话，网络结果不明时仅允许核对并重试原请求；业务拒绝后重新读取预览。不会自动重放写入。
- 员工底部报表直达个人销量；不再把正常的员工身份显示成门店报表权限错误。快捷周期改为三列，个人销量使用两列金额卡。
- 前端 24 项测试、类型检查与构建通过。真实浏览器与测试站验收结果另记；完整盘点录入、财务更正和平台管理仍待接入。

本批测试站前端263773a / 后端83f28cd已更新，前端24测试、后端429测试、公网51检查通过。浏览器使用专用合成数据完成结店预览、取消、重新预览、确认、刷新与报表核对。员工报表320/393像素布局有截图记录。发现并修复结店后刷新误显示开店入口的问题。详细范围与限制见 [营业日及报表UI验收](acceptance/2026-11-06-ui-business-day.md)。完整盘点、更正和平台管理仍待接入，未宣称全功能或真机验收完成。

## 2026-11-06 账号自动识别组织与老板业务补齐

- H5 改用 `/system/auth/account-login`，账号、密码登录后由服务端返回绑定组织。唯一用户名可直接使用；跨组织重名使用稳定专属登录号 `yc-用户ID`，在“我的”及授权账号详情展示。客户端不选择或传入组织，旧登录接口保留兼容。
- 新增首次初始化和财务更正页面。初始化核对所有资金与票种、阻止覆盖、保留同请求重试；明确被拒绝后重新读取选项。财务更正使用原因、预览、原版本、审计和服务端重核；待确认命令按组织及操作者保存，重新登录可恢复，切换账号立即锁定。
- 测试部署增加容量预检、已验证相同后端复用、发布证据与限定本项目的历史镜像清理。未通过验收的功能以 FUNCTION-CHECKLIST 标记为准，不视为完整交付。

## 2026-11-07 订票调拨与个人资料

Mac mini按约定模型完成三个员工单据文件，本机复核补充回执检查、明确拒绝恢复、表单营业日锁和源库存上限区分。H5新增/orders，由员工门店范围约束，支持订票与调入/调出查询、列表分页、详情、创建/编辑及已有安全确认/取消操作；未知结果保存原命令并禁止自动重放，创建须人工查单核对。旧调拨只读，不回退旧CRUD；拒绝接口与历史异常待单仍待补。

本机新增个人资料编辑（昵称、联系电话、邮箱、性别）和操作指引，未接入头像或真实第三方短信/邮件。后端支持显式清空联系电话并校验数字格式/性别。64项前端测试与构建、473项后端测试通过；测试站部署及真实操作验收结果另记。
