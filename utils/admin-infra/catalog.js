// Only explicitly reviewed fields are rendered; log bodies, addresses and credentials are never displayed.
const resources = {
 config: { title:'参数配置', query:'infra:config:query', search:'name', fields:[['name','名称'],['category','分类'],['key','键名'],['type','类型'],['createTime','创建时间']] },
 file: { title:'文件', query:'infra:file:query', search:'path', fields:[['name','文件名'],['type','类型'],['size','大小'],['createTime','创建时间']] },
 'file-config': { title:'文件配置', query:'infra:file-config:query', search:'name', fields:[['name','名称'],['storage','存储类型'],['master','主配置'],['createTime','创建时间']] },
 'data-source-config': { title:'数据源', query:'infra:data-source-config:query', fields:[['name','名称'],['createTime','创建时间']], list:true },
 'api-access-log': { title:'API 访问日志', query:'infra:api-access-log:query', search:'applicationName', fields:[['traceId','追踪号'],['applicationName','应用'],['requestMethod','方法'],['duration','耗时'],['resultCode','结果码'],['createTime','时间']] },
 'api-error-log': { title:'API 错误日志', query:'infra:api-error-log:query', search:'applicationName', fields:[['traceId','追踪号'],['applicationName','应用'],['requestMethod','方法'],['processStatus','处理状态'],['exceptionTime','时间'],['exceptionName','异常类型'],['exceptionClassName','类名'],['exceptionMethodName','方法'],['exceptionLineNumber','行号'],['processTime','处理时间'],['processUserId','处理人员编号']] },
 'job-log': { title:'任务日志', query:'infra:job:query', search:'handlerName', fields:[['jobId','任务编号'],['handlerName','处理器'],['executeIndex','执行序号'],['duration','耗时'],['status','状态'],['beginTime','开始时间'],['endTime','结束时间']] }
}
function get(key) { if (!Object.prototype.hasOwnProperty.call(resources,key)) throw Error('未知管理功能'); return resources[key] }
function rows(key, list) { const spec=get(key); return list.map(x => ({ id: String(x.id == null ? '' : x.id), revision: x.revision || '', fields: spec.fields.filter(([k]) => x[k] != null).map(([k,label])=>({label,value:String(x[k])})) })) }
module.exports={resources,get,rows}
