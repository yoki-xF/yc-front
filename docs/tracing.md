# 自托管链路追踪原生入口

替代旧后台 SkyWalking iframe。原生页提供服务目录、15分钟/1小时/6小时/24小时链路查询、成功/错误筛选、分页和跨度详情。所有接口受有效平台超级管理员与 infra:skywalking:query 权限检查。

部署时设置 `yc.native-admin.skywalking.graphql-url`（例如 `http://127.0.0.1:12800/graphql`）。该地址只由服务器配置提供，原生请求不能传入地址、GraphQL或认证信息；无配置时明确显示未配置，不调用旧域名。目标应为受网络限制的自托管 OAP。此轮没有安装、连接或启动 OAP。

固定 GraphQL 查询使用变量，不执行任意查询或 mutation；响应最多1MiB、连接3秒/读取5秒超时、不跟随重定向；列表最多200服务、20链路/页、300跨度。只返回基础跨度字段，不读取标签/日志正文，endpoint中的查询参数会移除。时间范围按UTC解释。版本不兼容时失败，不使用模拟指标代替真实结果。

协议依据：[Apache SkyWalking query protocol](https://skywalking.apache.org/docs/main/v10.0.1/en/api/query-protocol/)、[metadata-v2](https://github.com/apache/skywalking-query-protocol/blob/v10.0.1/metadata-v2.graphqls)、[trace](https://github.com/apache/skywalking-query-protocol/blob/master/trace.graphqls)。

验证：NativeTracingTest 4项单元测试，原生隔离测试1组；未连接真实OAP，未做真机或生产验收。此入口覆盖链路查询，不替代完整 SkyWalking 的分析面板、告警配置或性能剖析任务。
