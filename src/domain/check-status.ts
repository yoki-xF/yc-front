export function checkRows(raw: any,deptId:string) {
 for(const key of ['morningCheck','nightCheck','fundCheck','businessCheck','requireInventory','requireFund'])if(typeof raw?.[key]!=='boolean')throw Error('盘点进度数据不完整，请重新读取')
 return [
  {key:'morning',label:'早盘与期初资金',required:raw.requireInventory,done:raw.morningCheck,to:'/count/morning'},
  {key:'business',label:'营业数据',required:true,done:raw.businessCheck,to:'/entry/business'},
  {key:'evening',label:'晚盘库存',required:raw.requireInventory,done:raw.nightCheck,to:'/count/evening'},
  {key:'fund',label:'晚班五类资金',required:raw.requireFund,done:raw.fundCheck,to:'/entry/fund'}
 ].map(row=>({...row,state:row.required?row.done?'已提交':'未提交':'当前模式不需要',to:row.to+'?deptId='+encodeURIComponent(deptId)}))
}
