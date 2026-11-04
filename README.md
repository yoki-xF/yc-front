# 易彩统一原生微信小程序

员工、老板和平台管理共用本项目，按账号角色及权限展示功能。使用微信开发者工具导入本目录；后端独立仓库为 [yc-backend](https://github.com/yoki-xF/yc-backend)，采用单模块Spring Boot单体服务。

本轮源码迁移和旧项目清理已收口，实际能力、暂缓范围及检查证据见后端仓库的 [迁移记录](https://github.com/yoki-xF/yc-backend/blob/main/docs/MIGRATION.md)。支付、短信验证、外部邮件/社交等第三方能力暂缓。原生表单、GoView和积木静态模板工具的能力边界见该文档，不等同完整浏览器设计器。

`utils/config.js` 默认连接本机 `http://127.0.0.1:48080/admin-api`；运行后端前按其新空库说明初始化独立数据库。真机需要独立HTTPS和微信合法域名；不得把localhost配置当作手机可访问地址，也不要将账号密码放入源码。

本轮70组Node测试文件通过；检查不代替真实MySQL、完整营业日与真机验收。本轮没有发布新后端或上传微信。Mac mini开发者工具登录已过期，需要重新登录后才能打开新项目。

运行页面测试：`for test in tests/*.test.js; do node "$test" || break; done`；工具辅助测试位于 `utils/admin-infra/*.test.js`。本项目和后端是后续唯一开发源码，不再使用旧员工端、老板端或网页管理端项目目录。
