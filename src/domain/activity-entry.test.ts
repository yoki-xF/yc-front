import {expect,test} from 'vitest'
import {activityId,activityAmount,activityStaff,activitySnapshot,activityPayload,activityJournal,activityJournalKey,readActivityJournal,requireActivityDay,compareActivity} from './activity-entry'
const scope={tenantId:'1',actorId:'9007199254740993',deptId:'10'},day={id:'12345678-abcd-abcd-abcd-123456789abc',date:'2026-11-09'},revision='a'.repeat(64)
const staff=[{value:scope.actorId,label:'员工'}]
const row={deptId:'10',activityId:'9007199254740994',activityName:'活动',userId:scope.actorId,salesAmount:'9999999999.99'}
const snapshot=()=>activitySnapshot({revision,items:[row]},scope.deptId)
const command=()=>activityJournal(scope,day,activityPayload(snapshot(),snapshot().items,scope.deptId,staff))
test('strict IDs, monetary precision and active staff contract',()=>{
 expect(activityId(row.activityId)).toBe(row.activityId)
 for(const id of [1,9007199254740992,'0','01','-1','9223372036854775808'])expect(()=>activityId(id)).toThrow()
 expect(activityAmount('0')).toBe('0.00');expect(activityAmount('9999999999.99')).toBe('9999999999.99')
 for(const value of ['0.001','1e2','-1','10000000000',9999999999.99,'01',''])expect(()=>activityAmount(value)).toThrow()
 expect(activityStaff(staff)).toEqual(staff)
 for(const value of [null,[...staff,...staff],[{value:1,label:'员工'}],[{value:'1',label:''}]])expect(()=>activityStaff(value)).toThrow()
})
test('full snapshot whitelist; missing values remain blank, empty activities clear',()=>{
 expect(activitySnapshot({revision,items:[]},'10').items).toEqual([])
 expect(activitySnapshot({revision,items:[{...row,userId:null,salesAmount:null}]},'10').items[0]).toMatchObject({userId:'',salesAmount:''})
 for(const raw of [{revision,items:[row,row]},{revision,items:[{...row,deptId:'11'}]},{revision:'bad',items:[]},{revision,items:null}])expect(()=>activitySnapshot(raw,'10')).toThrow()
 const s=snapshot(),payload=activityPayload(s,s.items,'10',staff)
 expect(payload).toEqual({deptId:'10',revision,items:[{deptId:'10',activityId:row.activityId,userId:scope.actorId,salesAmount:row.salesAmount}]})
 for(const rows of [[],[...s.items,...s.items],[{...s.items[0]!,activityId:'2'}],[{...s.items[0]!,userId:'2'}],[{...s.items[0]!,deptId:'11'}]])expect(()=>activityPayload(s,rows,'10',staff)).toThrow()
 expect(()=>activityPayload(activitySnapshot({revision,items:[]},'10'),[],'10',staff)).toThrow()
})
test('journal owns an immutable copy, restores across login without login key and isolates scope',()=>{
 const s=snapshot(),payload=activityPayload(s,s.items,'10',staff),j=activityJournal(scope,day,payload)
 payload.items[0]!.salesAmount='1.00';s.items[0]!.userId='2'
 expect(j.payload.items[0]!.salesAmount).toBe(row.salesAmount)
 expect(readActivityJournal(JSON.stringify(j),scope)).toEqual(j)
 for(const changed of [{...scope,actorId:'2'},{...scope,tenantId:'2'},{...scope,deptId:'11'}]){
  expect(activityJournalKey(changed)).not.toBe(activityJournalKey(scope));expect(()=>readActivityJournal(JSON.stringify(j),changed)).toThrow()
 }
 expect(()=>readActivityJournal('{',scope)).toThrow()
 expect(()=>readActivityJournal(JSON.stringify({...j,payload:{...j.payload,revision:'bad'}}),scope)).toThrow()
 expect(readActivityJournal(null,scope)).toBeNull()
})
test('original revision/day stay locked; reread comparison never resolves or retries unknown write',()=>{
 const j=command(),before=JSON.stringify(j)
 expect(compareActivity(j,snapshot(),day)).toContain('不能据此证明')
 expect(compareActivity(j,activitySnapshot({revision:'b'.repeat(64),items:[{...row,salesAmount:'1'}]},'10'),day)).toContain('不同')
 expect(JSON.stringify(j)).toBe(before);expect(j.payload.revision).toBe(revision)
 for(const changed of [{...day,date:'2026-11-10'},{...day,id:'22345678-abcd-abcd-abcd-123456789abc'}])expect(()=>requireActivityDay(j.day,changed)).toThrow()
 expect(()=>activityJournal(scope,{...day,date:'2026-02-30'},j.payload)).toThrow()
})

test('activity response accepts precise numeric fields from the legacy backend',()=>{
 const numeric={deptId:10,activityId:12,activityName:'活动',userId:13,salesAmount:1.25}
 expect(activitySnapshot({revision,items:[numeric]},'10').items[0]).toEqual({...numeric,deptId:'10',activityId:'12',userId:'13',salesAmount:'1.25'})
 expect(()=>activitySnapshot({revision,items:[{...numeric,activityId:Number.MAX_SAFE_INTEGER+1}]},'10')).toThrow()
 expect(()=>activitySnapshot({revision,items:[{...numeric,salesAmount:1.251}]},'10')).toThrow()
})
