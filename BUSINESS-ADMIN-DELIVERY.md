# 业务配置管理迁移交付

独立新增 `utils/admin-business`、`pages/admin-business/manage` 和三个 `tests/admin-business-*`；没有修改 app.json、boss 页面和既有共享模块。root 合并时使用 ROUTES-business.json 注册一条路由，使用 ENTRIES-business.json 加入五个权限过滤入口。

覆盖门店、班次、促销活动、返佣玩法、门店月目标的分页列表、关键词/门店筛选、详情、新建、版本化保存、删除或停用。门店长编号保持字符串，金额保持十进制字符串。活动门店兼容旧逗号字符串、JSON字符串和数组。月目标固定月初，明确为门店总销量目标。班次类型来源 options.shiftTypes 的启用字典选项，历史值单独显示，不能伪造新枚举；空字典保存会提示先配置。返佣按旧原值传输，0至100、最多四位小数，不作百分比换算。

活动、玩法、月目标使用 update 权限停用；班次使用 delete；门店需 delete 和 update 两项权限。最终数据范围、历史关联和并发版本均以后端再次检查为准。操作先确认，双击只发一次，网络或未知结果停止写入，返回列表核对后方能重新进入。换账号、离页的异步结果不落界面。只读权限可查看所有字段。

验证：三个 Node 测试通过，覆盖长编号、精确金额、部门范围、月份、活动时间顺序、重复门店、权限、版本、未知写入、账号变化、确认取消、重复点击和离页保护；新增六个 JS 文件语法通过。未做 GUI、真机或生产发布。

接口约定：`/sport/boss/admin/options` 返回 `{departments:[{id,name}],shiftTypes:[{value,label}]}`；各资源 `/page,get,save,remove`，保存 `{id?,revision?,values}` 返回 String id。权限使用既有 boss/api.identity。日期字符串使用旧端兼容输入格式。
