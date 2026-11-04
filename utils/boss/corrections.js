const {getResource}=require('./resources')
const fundMoney=['xj','wxBalance','hsk','zfb','szRmb'],fundCounts=['wxBalanceCount','hskCount','zfbCount','szRmbCount']
const businessCounts=['dcSaleNum','jcSaleNum','dcConversionNum','jkConversionNum']
const businessMoney=['dcSaleMoney','dcConversionMoney','jcSaleMoney','jkConversionMoney','ydPay','outAmount','giftTicket','discountTicket','commissionFee','redEnvelope','jkOrderAmount','yjMoney','wrongTicket']
function definitions(type,record){
 let keys=[]
 if(type==='funds')keys=fundMoney.concat(fundCounts)
 else if(type==='business')keys=businessMoney.concat(businessCounts)
 else if(type==='inventory')keys=['remark']
 else if(type==='commission')keys=['salesAmount','rebate','commission']
 else throw Error('此类记录不支持盘点更正')
 const labels=Object.fromEntries(getResource(type).fields.map(f=>[f.key,f.label]))
 return keys.filter(key=>Object.prototype.hasOwnProperty.call(record,key)).map(key=>({key,label:labels[key]||key,kind:fundCounts.includes(key)||businessCounts.includes(key)?'count':key==='remark'?'text':'money'}))
}
function command(type,record,values,lines,reason,requestKey){
 if(typeof reason!=='string'||reason.trim().length<5||reason.trim().length>500)throw Error('请填写5至500字的更正原因')
 const fields={}
 for(const f of definitions(type,record)){
  const value=String(values[f.key]==null?'':values[f.key]),original=String(record[f.key]==null?'':record[f.key])
  if(value===original && type!=='commission')continue
  if(f.kind==='text'){if(value.length>500)throw Error('备注不能超过500字')}
  else if(f.kind==='count'){if(!/^(0|[1-9]\d{0,6})$/.test(value)||Number(value)>1000000)throw Error(f.label+'须为有效非负整数')}
  else if(!/^-?(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(value))throw Error(f.label+'须为有效金额，最多两位小数；清零请填写0')
  fields[f.key]=value
 }
 const edits=type==='inventory'?lines.map(x=>{if(!/^[1-9]\d*$/.test(String(x.id))||![x.invPackageNum,x.invZhangNum].every(v=>/^(0|[1-9]\d{0,6})$/.test(String(v))&&Number(v)<=1000000))throw Error('请核对票据数量');return{id:x.id,invPackageNum:String(x.invPackageNum),invZhangNum:String(x.invZhangNum)}}):[]
 return{type,id:record.id,revision:record.revision,reason:reason.trim(),requestKey,fields,lines:edits}
}
function labelled(type,changes){const labels=Object.fromEntries(getResource(type).fields.map(f=>[f.key,f.label]));return(changes||[]).map(x=>({...x,name:labels[x.name]||x.name}))}
function reports(before,after){const labels={instantSales:'即开销量',electronicSales:'电彩销量',sportsBettingSales:'竞彩销量',totalSales:'总销量',openingFunds:'早班五类资金',closingFunds:'晚班五类资金',reserveIn:'备付金转入',adjustments:'兑奖缴款等调整',wrongTicket:'错票（单列）',variance:'门店资金账差'};return Object.keys(after||{}).filter(k=>labels[k]).map(k=>({name:labels[k],before:before&&before[k]!=null?String(before[k]):'—',after:after[k]==null?'—':String(after[k])}))}
module.exports={definitions,command,labelled,reports}
