const { request, sameSession } = require('../request')
function active(s) { const c=wx.getStorageSync('yc_session'); if(!sameSession(s,c)) throw Error('账号已切换，请重新进入'); return c }
function headers(s) { const c=active(s); return {Authorization:'Bearer '+c.accessToken,'tenant-id':String(c.tenantId)} }
async function call(s,path,options={}) { const data=await request(path,{...options,header:headers(s)}); active(s); return data }
async function permissions(s) { const info=await call(s,'/system/auth/get-permission-info'); if(!info||!Array.isArray(info.permissions)) throw Error('权限信息不完整'); return info.permissions }
function can(ps,p) { return ps.includes('*:*:*')||ps.includes(p) }
async function permit(s, permission) { if(!can(await permissions(s),permission)) throw Error('当前账号没有操作权限') }
function id(v) { if(typeof v==='number'&&!Number.isSafeInteger(v)) throw Error('编号精度不足，请勿操作'); const x=String(v||''); if(!/^[1-9]\d*$/.test(x)) throw Error('编号无效'); return x }
function fen(v) { const m=String(v).trim().match(/^(\d{1,8})(?:\.(\d{1,2}))?$/); if(!m) throw Error('金额须为非负数，最多两位小数'); const n=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0')); if(n>2147483647) throw Error('金额超出范围'); return n }
function yuan(v) { if(!Number.isSafeInteger(v)) return '未读取'; const sign=v<0?'-':''; const n=Math.abs(v); return sign+Math.floor(n/100)+'.'+String(n%100).padStart(2,'0') }
module.exports={call,permit,permissions,can,id,fen,yuan}
