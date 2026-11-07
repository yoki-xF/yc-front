import {expect,test} from 'vitest'
import {cashAmount,cashCommand,cashJournalKey,cashJournals,cashKey,cashOutcome,cashPage,cashPayload,readCashJournal,requireCashDay} from './cash-ledger'
const scope={tenantId:'1',actorId:'9007199254740993',deptId:'10'},day={id:'a'.repeat(8)+'-'+['b'.repeat(4),'c'.repeat(4),'d'.repeat(4),'e'.repeat(12)].join('-'),date:'2026-11-06'}
const command=()=>cashCommand(scope,day,'10.1','合成备付金转入','cash-request-12345678')
test('金额采用定点字符串，正金额边界与精度严格校验',()=>{
 expect(cashAmount('0.01')).toBe('0.01');expect(cashAmount('9999999999.99')).toBe('9999999999.99')
 for(const value of ['0','-1','1e2','01','0.001','10000000000','',0.1])expect(()=>cashAmount(value)).toThrow()
})
test('日志恢复同一原键和完整命令，账号/组织/门店隔离且不依赖登录或当前营业日',()=>{
 const j=command();expect(readCashJournal(JSON.stringify(j),scope)).toEqual(j)
 expect(cashKey({...scope,actorId:'2'})).not.toBe(cashKey(scope));expect(cashKey({...scope,tenantId:'2'})).not.toBe(cashKey(scope));expect(cashKey({...scope,deptId:'11'})).not.toBe(cashKey(scope))
 for(const changed of [{...j,actorId:'2'},{...j,deptId:'11'},{...j,tenantId:'2'},{...j,transfer:{...j.transfer,shiftAmount:'10.100'}},{...j,transfer:{...j.transfer,shiftSource:1}}])expect(()=>readCashJournal(JSON.stringify(changed),scope)).toThrow()
 expect(readCashJournal(null,scope)).toBeNull();expect(()=>readCashJournal('{',scope)).toThrow()
})
test('只提交原请求键及转入白名单，不把身份或营业日元数据写进业务DTO',()=>{
 const j=command();expect(cashPayload(j)).toEqual({requestKey:j.requestKey,transfer:{deptId:'10',shiftAmount:'10.10',shiftSource:0,remark:'合成备付金转入'}})
 for(const invalid of ['2026-02-30','2026-13-01',''])expect(()=>cashCommand(scope,{...day,date:invalid},'1','','cash-request-12345678')).toThrow()
 expect(()=>cashCommand(scope,day,'1','字'.repeat(301),'cash-request-12345678')).toThrow()
})
test('查询结果须严格匹配原键和门店；未找到仍不同于成功，不允许跨营业日重试',()=>{
 const j=command();for(const status of ['APPLIED','NOT_FOUND'])expect(cashOutcome({status,deptId:j.deptId,requestKey:j.requestKey},j)).toBe(status)
 for(const raw of [null,{}, {status:'APPLIED',deptId:'11',requestKey:j.requestKey},{status:'APPLIED',deptId:j.deptId,requestKey:'other'}])expect(()=>cashOutcome(raw,j)).toThrow()
 expect(()=>requireCashDay(j,day)).not.toThrow();expect(()=>requireCashDay(j,{...day,id:'f'.repeat(36)})).toThrow('营业日')
})
test('共享流水保留长ID、历史营业日空值和精确金额，不接收越店或浮点金额',()=>{
 const row={id:'9007199254740993',deptId:'10',userName:'其他同店员工',price:'999999999999999999.99',source:0,remark:'原始备注',createTime:'2026-11-07T00:01',businessDate:null}
 expect(cashPage({list:[row],total:'1'},'10').list[0]).toEqual(row)
 for(const patch of [{deptId:'11'},{price:0.1},{price:'1e2'},{businessDate:'2026-02-30'}])expect(()=>cashPage({list:[{...row,...patch}],total:1},'10')).toThrow()
 expect(()=>cashPage({list:[row,row],total:2},'10')).toThrow('重复')
})

test('每个请求使用独立日志，旧请求完成不会删除另一标签页的新请求',()=>{
 const first=command(),second=cashCommand(scope,day,'20','','cash-request-second-12345')
 const entries:[string,string|null][]=[[cashJournalKey(first),JSON.stringify(first)],[cashJournalKey(second),JSON.stringify(second)],[cashJournalKey({...first,actorId:'2'}),JSON.stringify({...first,actorId:'2'})]]
 expect(cashJournals(entries,scope)).toHaveLength(2)
 const after=entries.filter(([key])=>key!==cashJournalKey(first));expect(cashJournals(after,scope)).toEqual([second])
 expect(()=>cashJournals([[cashKey(scope)+':wrong',JSON.stringify(first)]],scope)).toThrow()
})
