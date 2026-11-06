# yc-test Docker deployment

固定入口：https://yc-test.yoki.ink。源码仅为 `/Users/yoki/Projects/{yc-front,yc-backend}`；部署实体在 `/Users/yoki/ServerData/deployments/yc-acceptance`，操作日志/隧道/发布证据在 `/Users/yoki/ServerData/operations/yc-test`。现有测试MySQL/Redis及数据卷复用，不复制生产数据，不运行SQL初始化或恢复。

1. 当前电脑提交并推送，Mac mini 两仓库检查干净后 fetch、merge --ff-only，核对 origin/main。网络不通按统一规则临时使用各自127.0.0.1:7897代理。
2. Mac mini 执行 `bash /Users/yoki/Projects/yc-front/deploy/test.sh`。脚本核对干净/已推送源码，备份独立测试库与原镜像ID，保存部署Compose实体，从Mac源码构建后端及H5，再按顺序更新backend/web，检查健康。脚本不会停止/删除其他容器、数据卷、临时预览容器或恢复SQL。
3. Maven settings 位于 operations/yc-test/maven-settings.xml：使用已有本机HTTP代理7897及中央/华为镜像仓库ID，匹配既有缓存，临时采用已缓存Surefire3.5.6。后端源码pom仍为3.2.2；这是构建环境差异，不能把跳过测试的打包称为测试通过。
4. web仅绑定Mac mini回环15181；backend/MySQL/Redis不暴露宿主端口。前端同源/admin-api经Docker内部网络访问backend；数据库网络仍为internal。独立launchd隧道只转发云回环15181，不对公网直接开放。首次需要安装时运行`python3 deploy/install-tunnel.py`；已有定义只检查，不重复启动。
5. 云端仅 `/etc/nginx/sites-enabled/yc-test.conf` 转发该回环端口。HTTP ACME目录`/var/www/yc-test-acme`；域名证书`/etc/letsencrypt/live/yc-test-domain`，复用Certbot自动续期与已有Nginx reload hook。配置模板在本目录，替换后必须先nginx -t再reload。
6. 检查公网 /healthz、/version.json、登录及读取权限。发布记录必须保存前后端提交、镜像ID、JAR SHA256、实际测试数量与探针结果。

回退：先停止本次发布，核对operations中的before-发布号.json，人工将其中镜像ID重新标记为yc-front:test/yc-backend:acceptance，再用部署目录Compose加`--no-build`更新相应服务并核对健康。仅支持应用回退；有数据库迁移时另审查迁移和后续写入，不自动恢复SQL。生产及其他项目不在脚本范围。

容量与复用：Docker VM容量与macOS可用空间不同。脚本在构建前检查VM空间：后端重建至少1GiB，只构建前端至少64MiB；空间不足直接停止，不关闭磁盘健康检查。后端提交与成功发布回执、运行镜像及健康状态全部一致时复用，不重复运行后端测试/构建；前端仍在Docker构建内检查。成功后保存backend-release.json及本次发布回执。

旧构建清理：`python3 deploy/prune-test-images.py`只生成计划；确认后`--execute`。候选仅来自本部署before-*.json的易彩测试镜像，排除任何容器引用、标签/摘要镜像，默认保留最近两份历史镜像；`--keep-history 1`至少保留最近一次回退镜像。脚本从不删除容器、数据卷、SQL备份或其他项目镜像。
