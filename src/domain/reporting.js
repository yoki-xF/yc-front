const RULE='store-five-funds-three-sales-v1'
const METRICS=['instantSales','electronicSales','sportsBettingSales','variance','wrongTicket']
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw Error('请选择有效日期');const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('请选择有效日期');return d}
function label(d){return d.toISOString().slice(0,10)}
function days(start,end){const a=date(start),b=date(end),n=(b-a)/86400000;if(n<0||n>366)throw Error('查询范围须在367天以内');return Array.from({length:n+1},(_,i)=>label(new Date(a.getTime()+i*86400000)))}
function period(kind,value){const d=date(value),last=new Date(d);if(kind==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);last.setTime(d.getTime());last.setUTCDate(last.getUTCDate()+6)}else if(kind==='month'){d.setUTCDate(1);last.setUTCMonth(d.getUTCMonth()+1,0)}else if(kind!=='day')throw Error('无效周期');return {start:label(d),end:label(last)}}
function cents(value){if(typeof value!=='string'||!/^(-?)(0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(value))throw Error('日报金额格式无效');const negative=value[0]==='-',parts=(negative?value.slice(1):value).split('.');const n=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));if(!Number.isSafeInteger(n))throw Error('金额超出可核对范围');return negative?-n:n}
function add(a,b){const n=a+b;if(!Number.isSafeInteger(n))throw Error('汇总金额超出可核对范围，请缩短查询范围');return n}
function money(n){const digits=String(Math.abs(n)).padStart(3,'0');return(n<0?'-':'')+digits.slice(0,-2)+'.'+digits.slice(-2)}
function normalize(raw,filters){
 const range=days(filters.start,filters.end)
 if(!raw||raw.schemaVersion!==2||raw.start!==filters.start||raw.end!==filters.end||!Array.isArray(raw.stores))throw Error('报表接口尚未提供统一营业日数据，请等待接口接入')
 if(raw.stores.length>100)throw Error('门店较多，请选择单店查询')
 const ids=new Set(),summary={freshDays:0,pendingDays:0,notOpenDays:0},total=Object.fromEntries(METRICS.map(k=>[k,0]))
 const rows=raw.stores.map(store=>{
  const id=String(store.deptId);if(!/^[1-9]\d*$/.test(id)||ids.has(id)||typeof store.deptName!=='string'||!store.deptName.trim()||!Array.isArray(store.days)||store.days.length!==range.length)throw Error('门店日报数据不完整');ids.add(id)
  if(filters.deptId&&id!==String(filters.deptId))throw Error('报表返回了所选门店之外的数据')
  const seen=new Set(),values=Object.fromEntries(METRICS.map(k=>[k,0]));let fresh=0,pending=0,notOpen=0
  const records=store.days.map(day=>{
   if(!range.includes(day.businessDate)||seen.has(day.businessDate)||!['FRESH','STALE','NOT_GENERATED','NOT_OPEN','OPEN'].includes(day.status))throw Error('营业日状态缺失或重复');seen.add(day.businessDate)
   const result={businessDate:day.businessDate,status:day.status,statusLabel:{FRESH:'已核对',STALE:'需重新生成',NOT_GENERATED:'未生成',NOT_OPEN:'未营业',OPEN:'营业中'}[day.status]}
   if(day.status==='FRESH'){
    if(day.closed!==true||day.ruleVersion!==RULE)throw Error('已生成日报缺少结店确认或使用了旧账务规则')
    const numbers={};for(const key of METRICS){numbers[key]=cents(day[key]);values[key]=add(values[key],numbers[key]);total[key]=add(total[key],numbers[key]);result[key]=money(numbers[key])}
    const sales=add(add(numbers.instantSales,numbers.electronicSales),numbers.sportsBettingSales)
    if(cents(day.totalSales)!==sales)throw Error('日报总销量与三类销量不一致')
    result.totalSales=money(sales);fresh++;summary.freshDays++
   }else if(day.status==='NOT_OPEN'){notOpen++;summary.notOpenDays++}else{pending++;summary.pendingDays++}
   return result
  }).sort((a,b)=>a.businessDate.localeCompare(b.businessDate))
  const sales=add(add(values.instantSales,values.electronicSales),values.sportsBettingSales),complete=pending===0
  return {deptId:id,deptName:store.deptName,days:records,freshDays:fresh,pendingDays:pending,notOpenDays:notOpen,complete,rank:null,sales:complete?money(sales):'待核对',knownSales:money(sales),salesCents:sales,...Object.fromEntries(METRICS.map(k=>[k,complete?money(values[k]):'—']))}
 })
 const ranked=rows.filter(r=>r.complete&&r.freshDays>0).sort((a,b)=>b.salesCents-a.salesCents||a.deptId.localeCompare(b.deptId));let previous=null,rank=0
 ranked.forEach((r,i)=>{if(previous!==r.salesCents)rank=i+1;r.rank=rank;previous=r.salesCents})
 return {rows,ranked,summary:{...summary,rankedStores:ranked.length,totalSales:money(add(add(total.instantSales,total.electronicSales),total.sportsBettingSales)),...Object.fromEntries(METRICS.map(k=>[k,money(total[k])]))}}
}

export { RULE, days, period, normalize, money, cents }
