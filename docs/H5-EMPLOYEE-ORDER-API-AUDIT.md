# H5 员工订票 / 库存调拨实现规格（只读审计）

审计日期：2026-11-06。已读取 yc-front、yc-backend 根 AGENTS.md。仅检查现存源码、测试和验收脚本；未运行测试、连接 DB、部署、修改源码或执行 Git 操作。本文是唯一新增产物。面向 Vue 3 + TypeScript + Vant 移动 H5；后端路径中的 `wx` 是现存命名，不代表微信能力。支付、退款、钱包及第三方资金调用不接入。

## 1. HTTP 契约

默认基址 `/admin-api`，以下路径前缀均为 `/sport/wx`。携带 `Authorization: Bearer <token>`、`tenant-id`；返回 `{code,msg,data}`，只有 code=0 成功。ID 全程保留字符串；状态兼容数值和数值字符串。金额用十进制定点运算，避免 JS 浮点运算。

| 方法 / 路径 | 参数及 data |
|---|---|
| GET `/store/operating-day` | query `deptId`；data `{status:'OPEN',id,businessDate,deptId,actorId}` 或 `{status:'NOT_OPEN',deptId,actorId}` |
| GET `/order-ledger/page` | query `deptId,type:'purchase'|'transfer',direction:'in'|'out'`（默认 in），`pageNo` 默认1、范围1–100000，`pageSize` 默认20、范围1–50；data `{list,total}`，ID倒序；无状态/日期过滤 |
| GET `/order-ledger/detail` | query `deptId,type,id`；data `{order,items,revision}`，调拨另有 `direction` |
| GET `/common/material/List` | 可选 query `materialName`；data 票种数组，使用 `id,materialName,price,money`；price=每包价格，money=每张价格 |
| GET `/order-ledger/transfer/sources` | query `deptId`=调入店；data `[{id,name}]` |
| GET `/order-ledger/transfer/source-inventory` | query `deptId`=调入店、`sourceDeptId`=调出店；data `[{materialId,materialName,price,money,packageNum,sheetNum}]` |
| POST `/order-ledger/purchase/create` | JSON PurchaseRequest；data 新订单ID |
| POST `/order-ledger/purchase/edit` | JSON PurchaseRequest，必须带 id、revision；data true |
| POST `/order-ledger/transfer/create` | JSON TransferRequest；data 新订单ID |
| POST `/order-ledger/transfer/edit` | JSON TransferRequest，必须带 id、revision；data true |
| POST `/order-ledger/{purchase,transfer}/confirm` | **query** `deptId,id,revision`，不是 JSON 参数；data true |
| POST `/order-ledger/{purchase,transfer}/cancel` | **query** `deptId,id,revision`；data true |

```ts
interface PurchaseRequest {
  deptId: string; id?: string; revision?: string; remark?: string;
  items: Array<{
    materialId: string; packageNum: number; sheetNum: number;
    expectedMoney: string; expectedPrice: string;
  }>;
}
interface TransferRequest extends PurchaseRequest { sourceDeptId: string }
```

创建不要发送 id/revision、userId、stat、总额或入账日期。服务端取当前用户，计算价格快照和汇总。编辑是全量替换明细，保留原归属人；不能更换调拨源店。items 1–100条，materialId 不重复；每种数量为整数0–1000000，包/张至少一项大于0；不自动拆包换算。remark 最长255字符。expectedPrice/expectedMoney 必填，必须等于服务端当前票种价格（订票）或源店库存价格（调拨），且服务端价格非负、最多两位小数。总额上限999999999999999999.99。调拨创建/编辑还校验源店当前包、张库存分别足够，但**不预占库存**。

详情不是专用 VO，而是 DO：
- order 共用 `id,orderNo,deptId,deptName,userId,userName,totalPackageNum,totalSheetNum,totalAmount,stat`；订票另有 `purTime`，调拨另有 `exDeptId,exDeptName,remark,transferTime`。订票备注在明细上，没有主单 remark。
- items 共用 `id,materialId,materialName,deptId,deptName,userId,userName,packageNum,sheetNum,price,money,stat,remark`；订票另有 `purOrderId,orderAmount,purchasingTime`；调拨另有 `bjMasterId,exDeptId,exDeptName,totalAmount,transferTime`。还可能包含继承的审计字段。
- 不以 purTime/transferTime 推算营业日；营业日期由后端独立入账字段控制，当前 DO 没有暴露这些日期字段。LocalDateTime 全局序列化为时间戳。

## 2. 权限、范围和按钮规则

安全接口没有 `sport:purchasing-order:*` / `sport:allot-bill-join:*` 方法权限注解，不能据此权限字符串判断员工按钮。

- `MobileOrderReadService.authorize` 要求登录用户存在对应 user-dept 关系；租户配置 isManyDept 必须为 ENABLE(0) 或 DISABLE(1)，否则失败。ENABLE 时 `personalOnly=true`：订票、调入单仅本人可读/编辑/确认或取消；DISABLE 时同店员工可处理同店单据。
- 调出列表/详情和调出确认不限制为创建人。调拨创建/编辑/取消用**调入店 deptId**；确认用**调出店 deptId**。调入方不能确认，调出方没有拒绝/取消入口。
- 调拨源店发现及写入还由 `MobileStoreStaff` 校验当前员工、主门店均启用且未删除，成员关系有效。源店只需同租户、启用、未删除、已初始化、不同于调入店；不要求申请人是源店成员，不按名称判断门店。
- 默认开启的 OperatingDayWriteGuard 对所有写入额外执行 `BossAccess.dept(primary)`：当前员工的管理数据范围也必须包含主门店。仅有员工门店关系未必能写入；不得用扩大 H5 门店列表绕过。对端不套用操作者管理范围，而由租户及初始化检查控制。
- 租户隔离依赖框架租户拦截器及显式带 tenant 的 JDBC；本次未作运行环境隔离验证。

状态 `0=待确认，1=已确认，2=已取消`。仅允许0→编辑（仍为0）、0→1、0→2；无撤销确认、重开、删除。订票0显示编辑/确认/取消；调入0显示编辑/取消，调出0显示确认。最终权限以服务端结果为准，不能只检查 stat。

调拨写入要求 orderNo 匹配 `^T[0-9a-f]{32}$`，否则编辑/确认/**取消均拒绝**“历史调拨单暂不支持操作”；历史单可读。订票没有 P 单号限制，历史待确认单只要归属、明细状态、金额和汇总一致即可处理；异常数据连取消也会被完整性检查挡住。不要提供强制操作按钮。

## 3. 营业日与版本 / 重试

默认配置 `yc.operating-days-enabled: true`：
- 所有创建、编辑、确认、取消必须带 `X-Operating-Day`，值为**本次主门店当前营业日 UUID**。先读 operating-day，要求 OPEN。日期跨午夜仍使用返回的 businessDate，不使用浏览器当天日期。
- 调拨所有写操作要求**两店均已开店**，包括创建/编辑/取消；主店核验 header UUID，对端核验其当前营业日，不接受第二个对端版本。两店可在不同 businessDate 入账。
- detail、sources、source-inventory 发送该 header 可获得主店营业日锁和过期上下文校验；不带 header 仍可历史只读。page、票种目录没有该读锁。
- 创建/编辑/取消不要求早盘；确认要求涉及每家门店恰有一份 Morning 五账户盘点。另要求即开票 Morning 盘点：订票为本店；调拨为两店。personalOnly 时订票按操作者、调入按订单归属人、调出按确认人限定即开票盘点，否则按店要求恰好一份。
- detail 返回的 revision 是后端 SHA-256 内容版本，不是数字或时间戳。编辑/确认/取消原样传回；包括状态、汇总、明细及更新时间等。冲突后保留本地输入，重新拉详情供用户核对，禁止静默替换 revision 后自动重试。
- **没有 requestKey / Idempotency-Key 或创建去重查询**。重复 create 会产生多个待确认单；事务、锁及状态校验只防止同一单重复入库，重复 transition 返回错误而非幂等成功。
- H5 必须单次提交锁；超时/断网/切换账号等未知结果不自动重放。已知ID的操作重读详情；create 超时需查列表人工核对，无法可靠自动识别同一请求。草稿及未知状态按租户、账号、门店、营业日、单据ID隔离；切换上下文屏蔽迟到响应。
- 现有 `src/api/client.ts` 支持 operatingDay 和禁止写入重放，但 POST data 被编码为JSON；confirm/cancel 需把参数显式编码到 URL query，不能直接沿用 data 参数。

## 4. 库存、账户、报表及历史待单

- 创建/编辑仅写待确认主单和明细，不改变库存或五账户；取消仅将主单/明细标记2。
- 订票确认在事务中按包/张增加门店共享库存；缺库存行则用订单快照建行，重复库存行报错回滚。明细 stat=1、purchasingTime=营业日日期，主单 stat=1、purTime=实际系统时间；guard 给主单/明细写 business_date。
- 调拨确认锁两门店并锁单，重查源店库存、数量、双方价格：源店价格必须匹配订单，目标已有库存价格也必须匹配。原子减源店、加目标店；缺目标行则创建。明细/主单 stat=1、transferTime=实际时间；guard 写各自 in_business_date / out_business_date。失败整笔回滚。
- 上述订单路径没有扣现金、五账户转账、应付结算或第三方支付调用。`InventoryFundMapper.lockDept` 是锁门店行，不是扣款；H5 文案使用“确认入库/确认调出”，不可显示“付款成功”。
- 结店 `StoreDaySource` 按确认单的业务日期取数：即开票销量金额=期初库存价值+订票价值+调入价值−调出价值−期末库存价值；价格取历史快照，纳入门店整体核算，不当作个人销量。
- **所有日期的 stat=0 订票或任一方向调拨均阻塞结店**，不是仅今日创建的单据。personalOnly 的普通员工可能看不见其他员工待单。列表必须支持查看历史页；仍未找到的阻塞单交有权限人员核查。
- 确认后早盘修改可能被锁定；晚盘后又入库/调拨导致实时库存与晚盘不一致时，结店要求重新盘点。成功后刷新库存、单据及结店预检；不要宣称已自动重算/生成最终日报，最终统一报表随结店生成。

## 5. API 缺口及 H5 处理优先级

| 风险 | 源码事实与实施要求 |
|---|---|
| 创建未知结果无法安全重试 | 缺少服务端幂等键；H5本地锁不能解决跨端、丢响应去重。上线前建议补服务端幂等及查询，否则明确人工核对流程。 |
| 历史待调拨可阻塞结店且无法取消 | T 单号检查覆盖取消，关闭检查又不限日期。禁用操作并提供管理员处理提示；没有查到安全员工补救API，禁止回退旧CRUD。 |
| 订票确认价格一致性缺口 | 只按订单快照核金额，不核当前目录/现有库存价格；addStock不更新价格。可能形成订单与库存/盘点价格不一致，结店才拒绝。前端价格预检不能修复并发风险；建议后端确认事务内校验。 |
| 历史订票验证弱于创建 | transition 未重验数量上限、至少一个数量非零、价格精度、总额上限或当前票种存在；历史订单可能绕过新建约束。异常单只读交管理员，不能断言全部历史单可安全确认。 |
| 读写范围不完全一致 | membership 可读但管理数据范围挡写；personalOnly 隐藏他人待单；对端营业日没有客户端版本。按服务端失败解释，不扩大权限，不把对端日期视为用户已核对。 |
| 旧管理 CRUD 仍有绕过风险 | `/sport/purchasing-order` 和 `/sport/allot-bill-join` 控制器存在 create/update/delete；服务实现直接复制请求、改主明细/删除，没有安全订单版本/状态转换/营业日 guard。受各自权限注解约束，但有权限账号仍有风险；H5只使用本文安全入口，建议后端封禁或收敛旧写口。 |
| 缺专用能力/金额响应 | 接口无 canEdit/canConfirm、无创建幂等标识，BigDecimal 响应仍为 JSON 数值而非金额字符串。按钮需保守推导，超大金额可能在 JSON 解析时丢精度，建议后端金额字符串DTO；不可用 JS Number 做权威核算。 |

## 6. 证据与验证边界

以下均为 yc-backend 相对路径，结论来自读取实现，未执行测试或验收脚本：
- 路由：`src/main/java/cn/jxc/yc/module/sport/controller/admin/mobile/WxController.java`（order-ledger 段）；请求、鉴权、完整性校验、事务和版本：`service/mobile/order/{MobilePurchaseRequest,MobileTransferRequest,MobileOrderReadService,MobilePurchaseService,MobileTransferService,MobileTransferStores,PurchaseRevision,TransferRevision}.java`（同 sport 包）。
- 营业日：`service/accounting/{OperatingDayWriteGuard,OperatingDayReadGuard,StoreOperatingDay,StoreDaySource,StoreDayAccounting}.java`；范围：`boss/BossAccess.java`、`service/mobile/staff/MobileStoreStaff.java`；库存SQL：`dal/mysql/inventoryggl/InventoryGglMapper.java`。配置：`src/main/resources/application.yaml`。
- `src/test/java/cn/jxc/yc/module/sport/service/accounting/OperatingDayContextGuardTest.java`：缺失/过期header拒绝、跨自然日上下文、读上下文校验、调拨只将header用于主店。
- `src/test/java/cn/jxc/yc/module/sport/service/mobile/order/MobileTransferStoresTest.java`：同租户启用且初始化、长ID、不依赖中文名称、主店鉴权、对端无需成员关系。
- `src/test/java/cn/jxc/yc/module/sport/boss/{StoreDaySourceTest,StoreDayAccountingTest,BossDailyCalculatorTest,StoreMorningFundsTest}.java`：方向核算、历史快照、孤儿明细拒绝、待单拒绝生成报表、昨日建单今日确认锁早盘。
- `tools/transfer-acceptance.py`：写有双方确认权限、取消不改库存、待调拨阻塞结店及两店结店报表核对步骤；这是可变更DB的验收脚本，**本次未运行，不能当作当前已通过证据**。
- 没有发现 MobilePurchaseService / MobileTransferService / revision 的专门后端单元测试；当前检查不能证明并发去重、回滚或所有攻击路径已被运行验证。前端 `tests/purchase-*.test.js`、`tests/transfer-edit.test.js` 仍引用旧 pages 路径，不能证明当前 H5 已实现。当前 H5 客户端测试 `src/api/client.test.ts` 覆盖header和写请求不重放，本文不把静态测试源码当执行结果。

H5验收至少覆盖：本人/他人及越店、两个方向按钮、历史待单、缺失/过期营业日、双方未开店、缺早盘、价格变化/库存不足、并发修改冲突、重复确认、create超时未知结果、确认后晚盘重核。后续按已授权的独立测试环境使用合成数据验收；真实数据与生产仍需另行授权。
