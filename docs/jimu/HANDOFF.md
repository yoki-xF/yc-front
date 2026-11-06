> 历史记录：本文描述已废止的小程序或旧迁移过程，不能作为 H5 完成证据。当前入口见 `docs/H5-MIGRATION.md`。

> 历史验证交接：下文旧源码路径已归档删除，不能照旧命令继续开发。当前仅使用 yc-front 与 yc-backend 两仓库；后端在根目录执行 Maven，不再使用 -pl/-am。当前交付状态以新仓库 README 和后端 docs/MIGRATION.md 为准。

# Jimu 原生模板管理交接

工作区：`/Users/yoki/Projects/yc-report-coop-20261104-next`。这是本轮唯一开发任务；未启动子任务。只新增规定的 Jimu Java、原生页面、工具和测试文件，以及本 delivery 目录。412 个 `root-handoff-baseline.json` 文件 SHA 全部保持一致。没有复制回主项目、修改运行环境、连接真实数据库、保存真实模板、调用外部提供方、部署或提交推送。

## 已实现，可供根协作者源码审阅

- 原生目录：当前平台租户 + 当前创建人 + 未删除；名称搜索、分页、仅模板筛选、详情。GET 不创建记录、不增加浏览次数、不执行报表查询。
- 模板创建、名称/说明编辑；静态表格配置编辑。提供原生行/列/文字/行高/列宽控件、本地文字预览和 JSON 配置编辑。
- 用户选取 JSON 后只创建内存草稿，再次确认保存才调用服务器；导出从服务器重新读取已保存配置，仅在用户明确操作时写微信应用私有目录，分享完成或失败后删除文件。无 URL 令牌，无直接浏览器授权跳转。
- 原生格式 `yc-jimu-static-v1` 可导入为新模板，导出后可由本页再次导入。内部 `configuration` 就是 Jimu jmsheet 的 `json_str` 静态子集，不是另起一个与插件无关的模板库。
- 受限配置为 JSON 对象：`name`、`rows`、`cols`、`styles`、`merges`。最多 200 行、50 列、2000 个单元格、100 个基础样式，128 KiB；服务端和原生端都校验类型、尺寸、字段白名单、样式引用和文本。禁止表达式、公式、URL、HTML、数据集绑定、脚本和凭据标记。
- 复杂旧模板仍可查看安全元数据并编辑名称/说明；原始 JSON、脚本、API 配置保持不变且不返回。存在敏感标记或不支持内容的名称/说明会隐藏，并保持只读；不导出隐藏配置。
- 编辑使用行锁、服务端 HMAC 修订摘要和插件 `update_count` 条件递增。版本不符则拒绝，失败回滚。修订摘要重启后失效，需要重新打开详情。
- 创建的操作标识在当前草稿内固定，按租户/账号/操作标识生成精确十进制字符串 ID；同一次操作的重试不能重复创建或覆盖不同内容。创建锁定当前有效用户行，再检查重复 ID。
- 写入超时或响应不完整时锁住表单，必须核对结果；冲突不刷新旧草稿的修订号，不允许直接重试覆盖。账号切换、页面离开后迟到响应不覆盖页面；未应用的单元格输入不会被静默保存。

## 实际核实的插件接口与表结构依据

旧页面只读取 `getRefreshToken()` 并嵌入 `/jmreport/list?token=...`，没有可复用的原生控件；该方式没有沿用。

只读参考：`/Users/yoki/Projects/yc/yc-backend-ui/src/views/report/jmreport/index.vue`，SHA256：`20e57850919d77c82203e47bff493c20c4134e905f9b3015efa2e5737829aeed`。

缓存插件：`org.jeecgframework.jimureport:jimureport-spring-boot3-starter-fastjson2:1.8.1`，JAR SHA256：`ae021e5e40d207d30e23653a09c981e5f7875e85c3ccfb284f5e21007b39a9f4`。通过 `jar tf`、`javap -c/-v` 和 JAR 内 SQL/JS 资源核实：

- `JimuReport` 实体的真实 getter/setter、`IJimuReportService`、`JimuReportDao`。
- `JimuReportDao_insert.sql`、`JimuReportDao_update.sql`、`JimuReportDao_pageList.sql`：实际 `jimu_report` 字段，`template=0` 表示模板，`del_flag=0` 表示有效；真实归属字段为 `tenant_id`、`create_by`。
- DAO 的 `modifyUpdateCount` 注解 SQL：`update jimu_report set update_count=:updateCount+1 WHERE id=:id and update_count=:updateCount`。
- `static/jmreport/desreport_/js/biz/design.js`：保存时使用 `rows`、`cols` 等 jmsheet 配置，默认类型 `printinfo`。
- `IJimuReportService.updateById` 仅调用已核实的有限字段 DAO update；新记录复用 `JimuReportDao.insert`。构造的 patch 不携带 SQL、脚本、数据源、原归属等字段。
- `saveReport` 的缓存字节码包含 `JmReportTokenClient.getToken()` 到 INFO 日志的路径，因此没有调用通用 `saveReport`。原始插件导入导出会包含 `jimu_report_db_list` 等关联数据，故没有把通用全量导入导出接口直接暴露给原生端。
- 原插件授权是 `izAllowDesignAndView(request)` 设计管理角色检查；当前 `JmReportTokenServiceImpl.getRoles()` 基于已登录用户返回 admin。新接口保留此检查，并先调用已有 `NativeReportGate.require`。
- 缓存 MiniDao 1.10.1 的 `MiniDaoHandler` 公开 JDBC 访问器用于确认插件持久化与本地行锁使用同一数据源（含 NamedParameterJdbcTemplate）。无法识别代理或数据源不一致时创建/编辑关闭，保持只读。

没有读取运行数据库。快照及已检查的 upstream schema 没有 Jimu 可执行 DDL，因此没有猜测或编写生产迁移 SQL。每次访问先对已核实的实际列做零行查询；创建/编辑还检查数据库报告的字段容量。缺少 `tenant_id`、`create_by`、`update_count`、`py_str` 等兼容列会拒绝访问。没有给旧空归属记录自动认领，也没有在读接口里建表。

## 接口与权限

基础路径：`${yc.web.admin-api.prefix:/admin-api}/report/admin-native/jimu`。原生工具使用已有 request 模块，路径为 `/report/admin-native/jimu/...`，认证只走 Header。

| 方法 / 路径 | 行为 | gate 权限 |
| --- | --- | --- |
| GET `/page` | 目录、筛选、分页 | `report:jmreport:query` |
| GET `/get?id=...` | 当前归属详情 | query |
| GET `/capabilities` | 当前操作权限、存储是否支持安全写入 | query |
| GET `/created?operationId=...` | 核对一次创建结果，只读 | query + create |
| POST `/create` | 创建经校验的静态模板 | query + create |
| PUT `/update` | 修订保护的元数据/静态配置修改 | query + update |
| GET `/export?id=...` | 安全静态配置包，包含固定四字段 | query + export |

`report:jmreport:{query,create,update,export}` 是本次新增原生操作权限名；旧 Vue 页面及插件没有这些字符串权限，不能称它们已存在于菜单库。调用遵从已有 PermissionApi 的 super_admin 通配语义；另有已有 gate 对有效系统租户、同租户有效 super_admin 的核查，以及插件原设计管理角色检查。没有新增租户 ID 配置或手工授权计数。

响应固定投影不含 datasource、API URL/请求凭据、token、JS/Python/CSS、缩略图地址或分享地址。目录不读取模板配置，详情只在整个配置符合安全子集时返回配置。控制器关闭请求/响应内容日志，并提供仅作用于本控制器的异常处理，避免共享异常处理记录其正文或原始 SQL/插件错误。本轮没有修改原有 `/jmreport/**` 浏览器认证与日志路径，也不宣称修复了旧页面的 URL token 行为。

## 根协作者需要应用的集成补丁（本轮没有应用）

1. 将 `delivery/PAGES.json` 的唯一路径追加到 `yc-native-miniapp/app.json` 的 `pages` 数组。
2. 将 `delivery/ENTRIES.json` 的记录并入 `yc-native-miniapp/utils/admin-entries.js` 的 entries 数组；若根项目已有 Jimu 占位项，按 key 替换而非重复添加。保留 `platformOnly:true`。
3. 如果根项目维护细粒度菜单权限清单，将上述四个原生操作名加入相应的自托管报表管理配置。没有为此执行数据库写入，也没有把非平台用户放进 gate。
4. Java 包会由现有 report 模块扫描，POM 已含 Jimu、MiniDao、JDBC、事务及测试依赖；不需要 POM 或现有 NativeReportGate 修改。若运行目标不是当前缓存的 MiniDao/Jimu 适配器，先审查其事务归属，不要绕开写入保护。

## 实际验证

Java 21：`/opt/homebrew/opt/openjdk@21`；Maven：`/opt/homebrew/bin/mvn`；离线仓库：`/private/tmp/yc-maven-repository`。

最终执行（工作区根目录）：

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21 /opt/homebrew/bin/mvn -o \
  -Dmaven.repo.local=/private/tmp/yc-maven-repository -f yc-backend/pom.xml \
  -pl yc-module-report/yc-module-report-biz -am \
  -Dtest='cn.jxc.yc.module.report.adminnative.jimu.*Test,NativeReportGateTest' \
  -Dsurefire.failIfNoSpecifiedTests=false -Dflatten.skip=true \
  -DargLine=-javaagent:/private/tmp/yc-maven-repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar test
```

结果：BUILD SUCCESS，19 tests，0 failures / errors / skipped。包含新 Jimu 16 项和已有 NativeReportGate 3 项。H2/Mockito 验证当前/外租户/外创建人/空归属/已删除边界、固定响应投影、无副作用 GET、缺表字段拒绝、静态配置校验、实际字段长度、敏感元数据隐藏、旧配置保留、修订冲突、事务回滚、并发写串行、创建重试不重复、原插件角色检查、实际路由前缀和同数据源保护。没有真实插件数据库或提供方调用。默认 Mockito 自挂载受环境限制；最终命令通过启动时显式 Byte Buddy agent 完成，无需更改 POM。

```sh
/Users/yoki/.local/opt/node-v24.18.0-darwin-arm64/bin/node --test yc-native-miniapp/tests/admin-jimu.test.js
```

结果：10 tests（含父测试），全部通过。覆盖精确字符串 ID、原生校验、受控 API/Header、登录轮换与账号切换、未知写入禁止自动重试、冲突保留旧修订、离页迟到响应、刷新失败保留列表、未应用单元格输入、导入仅本地草稿、导出私有临时文件及清理。新页面 JS/工具 JS 语法、页面 JSON 和 WXML 标签结构静态检查通过；WXML 结构检查不是微信编译或页面体验验收。

最终 Maven 日志：`/private/tmp/yc-jimu-tests-final.log`；编译日志：`/private/tmp/yc-jimu-compile.log`。最终构建同时覆盖新代码编译，使用 `flatten.skip=true`，基线 POM 和 flattened POM 保持不变。

## 准确的未完成及使用限制

- 未实现完整电子表格/画布设计器的拖拽、公式、图表、动态查询、SQL 数据集、数据源管理、子报表、分享发布、脚本增强、Excel/PDF 渲染和打印。它们没有被伪装为可用原生功能；现有浏览器插件路径保持原样。
- 导入导出仅限 `yc-jimu-static-v1` 安全静态子集，不是全量 Jimu 备份包。复杂已有模板不导出隐藏配置、不执行数据、不从 SQL/脚本中提取并外显信息。
- 原生预览只是前 20 行、10 列的静态文字，不模拟样式、合并及打印分页；基础样式和合并通过经校验 JSON 保存。
- 当前支持缓存插件使用的正十进制 ID（最多 19 位），始终是字符串；不自动转换或认领其他旧 ID 格式。
- 未提供 token SSO 或自动浏览器设计器交接；没有发送 token 到 URL。完整浏览器设计的安全独立登录方案仍由根协作者另行审查，不能复用旧 URL 令牌页充当已完成迁移。
- 真实目标库的 Jimu DDL、表引擎行锁及插件事务归属未进行运行验收；本轮禁止连接真实 DB。代码对缺失列、空归属、未知适配器、不同数据源和缺少版本均关闭相应能力。
- 修订 HMAC 为当前进程密钥。重启或跨不同实例读取后编辑会安全拒绝，需要重新读取；没有添加共享密钥/多实例配置。
- 未注册共享入口、未进行微信编译、模拟器、真机、HTTP 集成或上线验收。根协作者审阅并完成受控集成后再验收。源码及隔离测试通过不等于完整设计器迁移或生产可用。

所有延期支付/商业外部集成均未继续开发，也未作为本任务阻碍。
