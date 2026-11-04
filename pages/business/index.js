const operatingDay = require('../../utils/operating-day')
const { request, sameSession } = require('../../utils/request')
const { apiBase } = require('../../utils/config')
const fields = [
  ['dcSaleMoney','电彩销售','元'],['dcSaleNum','电彩销售','张'],['dcConversionMoney','电彩兑奖','元'],['dcConversionNum','电彩兑奖','张'],
  ['jcSaleMoney','竞彩销售','元'],['jcSaleNum','竞彩销售','张'],['jkConversionMoney','即开兑奖','元'],['jkConversionNum','即开兑奖','张'],
  ['ydPay','彩银缴款','元'],['outAmount','费用支出','元'],['yjMoney','佣金','元'],['giftTicket','赠票','元'],['redEnvelope','红包','元'],
  ['discountTicket','折扣票','元'],['commissionFee','手续费','元'],['wrongTicket','错票','元'],['jkOrderAmount','即开票下单金额','元']
].map(([key,label,unit]) => ({ key,label,unit }))
const ocrMap = { dcSalesAmount:'dcSaleMoney', dcZhang:'dcSaleNum', dcSalesDjAmount:'dcConversionMoney', dcSalesDjZhang:'dcConversionNum', jcSalesAmount:'jcSaleMoney', jcSalesZhang:'jcSaleNum', gglAmount:'jkConversionMoney', gglZhang:'jkConversionNum' }
const headers = s => ({ Authorization:'Bearer '+s.accessToken, 'tenant-id':String(s.tenantId) })
function upload(path, deptId, session) { return new Promise((resolve,reject) => wx.uploadFile({ url:apiBase.replace(/\/$/,'')+'/sport/wx/night/count/service/voucher', filePath:path, name:'file', formData:{deptId:String(deptId)}, header:headers(session), success(res) { try { const body=JSON.parse(res.data); if (res.statusCode < 200 || res.statusCode >= 300 || body.code !== 0 || typeof body.data !== 'string' || !/^pv:[0-9a-f]{32}$/.test(body.data)) throw Error((body && body.msg) || '上传失败'); resolve(body.data) } catch(e) { reject(e) } }, fail() { reject(Error('上传失败，请检查网络')) } })) }
function download(ref, deptId, session) { return new Promise((resolve,reject)=>wx.downloadFile({url:apiBase.replace(/\/$/,'')+'/sport/wx/night/count/service/voucher?deptId='+encodeURIComponent(deptId)+'&ref='+encodeURIComponent(ref),header:headers(session),success:r=>{if(r.statusCode===200 && r.tempFilePath)resolve(r.tempFilePath);else reject(Error(r.statusCode===401?'登录已过期，请重新登录':'无法读取凭证，请检查权限或重试'))},fail:()=>reject(Error('读取凭证失败，请检查网络'))})) }

Page({
  data:{ fields, values:{}, classes:[], classIndex:-1, images:[], loading:true, ready:false, busy:false, scanning:false, error:'', notice:'', uncertain:false, conflict:false, existing:false, suggestions:[] },
  onLoad(options) {
    this.session=wx.getStorageSync('yc_session'); this.deptId=String(options.deptId || ''); this.userId=String(options.userId || '')
    this.setData({ deptName:options.deptName ? decodeURIComponent(options.deptName) : '' })
    if (!this.session || !this.deptId || !this.userId) { this.setData({ loading:false,error:'登录或门店信息已失效，请返回重新进入' }); return }
    this.load()
  },
  current() { return !this.destroyed && (!this.operatingDay || (String(this.deptId) === this.operatingDay.deptId && String(this.userId) === this.operatingDay.userId)) && sameSession(this.session,wx.getStorageSync('yc_session')) },
  saveDraft() { if (!this.current()) return; const { values,classes,classIndex,images,uncertain }=this.data; wx.setStorageSync(this.draftKey,{ values, classValue:classes[classIndex] && classes[classIndex].dictValue, images,uncertain,revision:this.revision }) },
  onUnload() { this.destroyed = true },
  async load(discardDraft = false) {
    if (!this.current()) { this.setData({ loading:false,error:'账号已切换，请返回重新进入' }); return }
    this.setData({loading:true,error:''})
    try {
      await operatingDay.bind(this, 'yc_business')
      const session=wx.getStorageSync('yc_session')
      const [snapshot,classes]=await Promise.all([request('/sport/wx/night/count/service/safe-item',{data:{deptId:this.deptId},header: operatingDay.header(this, headers(session))}),request('/system/dict-data/type',{data:{type:'class'},header: operatingDay.header(this, headers(session))})])
      if (!this.current()) return
      if (!Array.isArray(classes) || !classes.length) throw Error('未获取到班次，请联系管理员配置')
      if(!snapshot || !snapshot.revision || !Object.prototype.hasOwnProperty.call(snapshot,'record')) throw Error('营业数据或版本不完整，请重试')
      const row=snapshot.record, draft=!discardDraft && wx.getStorageSync(this.draftKey); const values={}
      const conflict=!!(draft && draft.revision!==snapshot.revision); this.revision=draft ? draft.revision : snapshot.revision
      this.originalValues = row || {}
      fields.forEach(f => { const v=draft && draft.values ? draft.values[f.key] : row && row[f.key]; values[f.key]=v == null ? '' : String(v) })
      const classValue=draft ? draft.classValue : ((row && row.classes) || 'Late')
      const classIndex=classes.findIndex(x => x.dictValue===classValue)
      const images=draft && Array.isArray(draft.images) ? draft.images : ((row && row.voucherPic) ? row.voucherPic.split(',').filter(Boolean).map(value=>value.startsWith('pv:')?{ref:value}:{url:value}) : [])
      this.setData({values,classes,classIndex,images,existing:!!(row && row.id),uncertain:!!(draft && draft.uncertain),conflict,ready:true,notice:conflict ? '营业数据已变化，本机草稿已保留。请核对后选择是否加载最新记录。' : draft ? '已恢复本机草稿，请核对后提交。' : ''}); if(discardDraft) wx.removeStorageSync(this.draftKey)
    } catch(e) { if(this.current()) this.setData({error:e.message || '加载失败，请重试'}) }
    finally { if(this.current()) this.setData({loading:false}) }
  },
  retry() { if(!this.data.busy && !this.data.loading) this.load() },
  reloadLatest() { if(this.data.busy || this.data.loading || this.data.scanning) return; wx.showModal({title:'加载最新营业数据',content:'加载最新记录会放弃本机草稿，请先记录需要保留的内容。确定继续吗？',success:r=>{if(r.confirm && this.current()) this.load(true)}}) },
  input(e) { if(this.data.busy || this.data.conflict) return; const key=e.currentTarget.dataset.key; if(!fields.some(f=>f.key===key)) return; this.setData({['values.'+key]:e.detail.value}); this.saveDraft() },
  changeClass(e) { if(this.data.busy || this.data.conflict) return; this.setData({classIndex:Number(e.detail.value)}); this.saveDraft() },
  async addImage() {
    if(this.data.busy || this.data.conflict || !this.current()) return
    const count=6-this.data.images.length; if(count<=0) return
    try {
      const result=await new Promise((resolve,reject)=>wx.chooseImage({count,success:resolve,fail:reject}))
      for(const path of result.tempFilePaths) {
        const saved=await new Promise((resolve,reject)=>wx.saveFile({tempFilePath:path,success:r=>resolve(r.savedFilePath),fail:reject}))
        if (!this.current()) return
        this.setData({images:this.data.images.concat([{local:saved}])}); this.saveDraft()
      }
    } catch(e) { if(this.current() && !(e.errMsg || '').includes('cancel')) this.setData({error:'图片未能保存到本机，请检查存储空间后重试。'}) }
  },
  async preview(e) { const item=this.data.images[Number(e.currentTarget.dataset.index)]; if(!item || !this.current())return; try { const path=item.ref ? await download(item.ref,this.deptId,wx.getStorageSync('yc_session')) : (item.local || item.url); if(!this.current() || !path)return; wx.previewImage({urls:[path],current:path}) } catch(err) { if(this.current())this.setData({error:err.message || '读取凭证失败'}) } },
  async protectLegacy(e) {
    const index=Number(e.currentTarget.dataset.index), item=this.data.images[index];
    if(!item || !item.url || this.data.busy || this.data.conflict || this.data.uncertain || this.data.scanning || !this.current())return;
    const ok=await new Promise(resolve=>wx.showModal({title:'复制历史凭证',content:'复制到受控存储后还需提交营业数据才会更新引用。原文件和公开链接会保留。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
    if(!ok || this.data.busy || !this.current())return;
    this.setData({busy:true,error:''});
    try { const ref=await request('/sport/wx/night/count/service/voucher/copy-legacy',{method:'POST',data:{deptId:this.deptId,revision:this.revision,legacyUrl:item.url},header:headers(wx.getStorageSync('yc_session'))});
      if(!this.current())return;if(typeof ref!=='string' || !/^pv:[0-9a-f]{32}$/.test(ref))throw Error('未取得复制结果，请稍后重试');
      if(!this.data.images[index] || this.data.images[index].url!==item.url)throw Error('凭证已变化，复制结果未应用');
      const images=this.data.images.slice();images[index]={ref,legacyUrl:item.url};this.setData({images,notice:'已复制凭证，提交营业数据后才会更新引用。原公开链接仍可访问。'});this.saveDraft();
    } catch(err) { if(this.current()) {this.setData({error:err.message || '复制失败，原凭证已保留。',conflict:err.code===10086 && /营业数据已变化/.test(err.message || '')});this.saveDraft()} }
    finally {if(this.current())this.setData({busy:false})}
  },
  revertLegacy(e) {const index=Number(e.currentTarget.dataset.index),item=this.data.images[index];if(this.data.busy || this.data.conflict || !item || !item.legacyUrl)return;const images=this.data.images.slice();images[index]={url:item.legacyUrl};this.setData({images,notice:'已恢复原凭证引用。'});this.saveDraft()},
  removeImage(e) { if(this.data.busy || this.data.conflict) return; const images=this.data.images.slice(); images.splice(Number(e.currentTarget.dataset.index),1); this.setData({images}); this.saveDraft() },
  async scan() {
    if(this.data.scanning || this.data.busy || this.data.conflict || !this.current()) return
    const consent=await new Promise(resolve=>wx.showModal({title:'拍照识别',content:'照片将发送到本系统服务器进行识别，请勿拍摄无关的个人信息。识别结果需核对后应用。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!consent || !this.current()) return
    const initial=Object.assign({},this.data.values); this.setData({scanning:true,error:'',suggestions:[]})
    try {
      const photo=await new Promise((resolve,reject)=>wx.chooseImage({count:1,sourceType:['camera'],success:resolve,fail:reject}))
      const base64=await new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath:photo.tempFilePaths[0],encoding:'base64',success:r=>resolve(r.data),fail:reject}))
      if (!this.current()) throw Error('账号或日期已变化，请重新进入。')
      const result=await request('/sport/wx/generalBasicOCR',{method:'POST',timeout:35000,data:{cBase64:base64},header:headers(wx.getStorageSync('yc_session'))})
      if(!this.current()) return
      const suggestions=Object.keys(ocrMap).filter(k=>result && result[k] != null).map(k=>{const key=ocrMap[k]; return {key,label:fields.find(f=>f.key===key).label,unit:fields.find(f=>f.key===key).unit,value:String(result[k]),initial:initial[key]} })
      this.setData({suggestions,notice:suggestions.length ? '请核对识别结果，再选择应用。' : '没有识别到可用数据。'})
    } catch(e) { if(this.current() && !(e.errMsg || '').includes('cancel')) this.setData({error:e.message || '识别失败，请手动输入。'}) }
    finally { if(this.current()) this.setData({scanning:false}) }
  },
  applyScan() { if(this.data.busy || this.data.conflict) return; const values=Object.assign({},this.data.values); let skipped=0; this.data.suggestions.forEach(s=>{ if(values[s.key]===s.initial) values[s.key]=s.value; else skipped++ }); this.setData({values,suggestions:[],notice:skipped ? '已应用识别结果，识别期间修改过的字段保持原值。' : '已应用识别结果，请核对。'}); this.saveDraft() },
  async submit() {
    if(this.data.busy || this.data.loading || this.data.uncertain || this.data.conflict || !this.revision || !this.current()) return
    if(!this.data.classes[this.data.classIndex]) { this.setData({error:'请选择班次。'}); return }
    for(const f of fields) { const v=this.data.values[f.key]; if(v === '' && this.originalValues[f.key] != null) { this.setData({error:f.label+'（'+f.unit+'）已有数据，请填写数值；清零请填 0。'}); return } if(v !== '' && !(f.unit==='张' ? /^\d{1,8}$/ : /^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/).test(v)) { this.setData({error:f.label+'（'+f.unit+'）格式不正确。'}); return } }
    const confirmed=await new Promise(resolve=>wx.showModal({title:'提交营业数据',content:this.data.existing ? '当天已有记录，提交会替换当天记录，请核对后继续。' : '请核对营业数据及凭证后提交。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!confirmed || !this.current() || this.data.busy) return
    this.setData({busy:true,error:'',notice:''}); let submitting=false
    try {
      const images=this.data.images.slice()
      for(let i=0;i<images.length;i++) if(!images[i].url && !images[i].ref) { const ref=await upload(images[i].local,this.deptId,wx.getStorageSync('yc_session')); if(!this.current()) return; images[i]=Object.assign({},images[i],{ref}); this.setData({images:images.slice()}); this.saveDraft() }
      if(!this.current()) throw Error('账号或日期已变化，请重新进入。')
      const data={deptId:this.deptId,classes:this.data.classes[this.data.classIndex].dictValue,voucherPic:images.map(i=>i.ref || i.url).join(',')}
      fields.forEach(f=>{if(this.data.values[f.key]!=='') data[f.key]=this.data.values[f.key]})
      submitting=true; await request('/sport/wx/night/count/service/safe-submit',{method:'POST',data:{deptId:this.deptId,revision:this.revision,record:data},header: operatingDay.header(this, headers(wx.getStorageSync('yc_session')))})
      if(!this.current()) return
      wx.removeStorageSync(this.draftKey); await this.load(true); if(this.current()) {this.setData({existing:true,notice:'提交成功，请核对最新记录。'}); wx.showToast({title:'提交成功',icon:'success'})}
    } catch(e) { if(this.current()) { if(submitting && [10086,401,403].includes(e.code)) this.setData({error:e.message || '提交失败，草稿已保留。',conflict:e.code===10086 && /营业数据已变化/.test(e.message || '')}); else this.setData({error:submitting ? '提交结果未确认，请先核对当天记录，避免重复提交。' : (e.message || '图片上传失败，草稿已保留。'),uncertain:submitting}); this.saveDraft() } }
    finally { if(this.current()) this.setData({busy:false}) }
  },
  confirmChecked() { wx.showModal({title:'核对提交结果',content:'请先通过其他方式核对当天营业数据。确认已核对后，才可再次提交。',success:r=>{if(r.confirm && this.current()) {this.setData({uncertain:false,error:'',notice:'请核对内容后提交。'});this.saveDraft()}}}) }
})
