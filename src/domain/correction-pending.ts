export function correctionPending(value:string|null,type:string,id:string) {
 if(!value)return null
 const item=JSON.parse(value)
 if(!item || item.type!==type || String(item.id)!==id || !/^[a-f0-9]{64}$/.test(item.revision) || !/^[A-Za-z0-9-]{16,80}$/.test(item.requestKey) || typeof item.reason!=='string' || item.reason.trim().length<5 || item.reason.trim().length>500 || !item.fields || typeof item.fields!=='object' || Array.isArray(item.fields) || !Array.isArray(item.lines))throw Error('待核对更正请求不完整，请联系管理员核对；本页不会重新生成请求')
 return item
}
