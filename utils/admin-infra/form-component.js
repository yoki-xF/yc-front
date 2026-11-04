const model=require('./form-builder')
function generate(ruleText,optionText){
 const rules=model.parse(ruleText,'规则'),option=model.parse(optionText,'选项'),values={},options={},titles={},placeholders={},schema=[]
 const block=[]
 for(const r of rules){
  const field=r.field
  if(!model.types.includes(r.type)||!field||['constructor','prototype','__proto__'].includes(field))throw Error('组件生成仅支持七种已列出的原生控件和有效字段名')
  const props=r.props||{},required=Array.isArray(r.validate)&&r.validate.some(v=>v&&v.required===true)
  titles[field]=String(r.title||field);placeholders[field]=String(props.placeholder||'');let value=r.value
  if(value==null)value=r.type==='checkbox'?[]:r.type==='switch'?false:''
  if(r.type==='checkbox'&&!Array.isArray(value)||r.type==='switch'&&typeof value!=='boolean'||!['checkbox','switch'].includes(r.type)&&!['string','number','boolean'].includes(typeof value))throw Error('控件默认值格式无效：'+field)
  values[field]=value
  if(['select','radio','checkbox'].includes(r.type)){
   if(!Array.isArray(r.options)||!r.options.length||r.options.length>200)throw Error('请选择控件选项（1至200项）：'+field)
   const seen=new Set();options[field]=r.options.map((o,i)=>{if(!o||!['string','number','boolean'].includes(typeof o.value)||typeof o.value==='number'&&!Number.isFinite(o.value))throw Error('选项值必须是文字、数字或布尔值');const key=JSON.stringify(o.value);if(seen.has(key))throw Error('选项值重复：'+field);seen.add(key);return {key:String(i),value:o.value,label:String(o.label==null?o.value:o.label),checked:r.type==='checkbox'?value.includes(o.value):value===o.value}})
   if(value!==''&&(Array.isArray(value)?value:[value]).some(v=>!options[field].some(o=>o.value===v)))throw Error('默认值不在选项中：'+field)
  }
  const validation=(Array.isArray(r.validate)?r.validate:[]).map(v=>{if(!v||typeof v!=='object'||v.validator||v.asyncValidator||v.pattern&&typeof v.pattern!=='string')throw Error('自定义函数校验须由业务代码补充：'+field);const out={};for(const k of ['required','min','max','type','pattern','message'])if(v[k]!=null)out[k]=v[k];if(out.pattern&&out.pattern.length>200)throw Error('校验表达式过长');return out})
  schema.push({field,title:titles[field],rules:validation})
  const disabled=props.disabled?' disabled="{{true}}"':'',title='<view class="label">{{titles.'+field+'}}'+(required?' *':'')+'</view>',data=' data-field="'+field+'"'
  let control
  if(r.type==='input'||r.type==='textarea'){
   const tag=r.type==='input'?'input':'textarea',max=Number.isInteger(props.maxlength)&&props.maxlength>=1&&props.maxlength<=100000?props.maxlength:140
   control='<'+tag+data+' value="{{values.'+field+'}}" placeholder="{{placeholders.'+field+'}}" maxlength="'+max+'" bindinput="onInput"'+disabled+(props.type==='password'&&tag==='input'?' password="{{true}}"':'')+'/>'
  }else if(r.type==='switch')control='<switch'+data+' checked="{{values.'+field+'}}" bindchange="onInput"'+disabled+'/>'
  else if(r.type==='datePicker')control='<picker mode="date"'+data+' value="{{values.'+field+'}}" bindchange="onInput"'+disabled+'><view>{{values.'+field+" || '请选择日期'}}"+'</view></picker>'
  else if(r.type==='select')control='<picker'+data+' range="{{options.'+field+'}}" range-key="label" bindchange="onPick"'+disabled+'><view>{{labels.'+field+" || '请选择'}}"+'</view></picker>'
  else {const kind=r.type==='radio'?'radio':'checkbox';control='<'+kind+'-group'+data+' bindchange="'+(kind==='radio'?'onPick':'onCheck')+'"'+disabled+'><label wx:for="{{options.'+field+'}}" wx:key="key"><'+kind+' value="{{item.key}}" checked="{{item.checked}}"'+disabled+'/>{{item.label}}</label></'+kind+'-group>'}
  block.push('<view class="field">'+title+control+'</view>')
 }
 const labels={};for(const field of Object.keys(options)){const match=options[field].find(o=>o.value===values[field]);labels[field]=match?match.label:''}
 const encoded=JSON.stringify({values,options,titles,placeholders,labels,schema}).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')
 const js=`const initial=${encoded}
Component({
 data:JSON.parse(JSON.stringify(initial)),
 methods:{
  onInput(e){const field=e.currentTarget.dataset.field;if(!initial.schema.some(s=>s.field===field))return;this.setData({['values.'+field]:e.detail.value})},
  onPick(e){const field=e.currentTarget.dataset.field,list=this.data.options[field],index=Number(e.detail.value);if(!Array.isArray(list)||!Number.isInteger(index)||!list[index])return;this.setData({['values.'+field]:list[index].value,['labels.'+field]:list[index].label,['options.'+field]:list.map((o,i)=>({...o,checked:i===index}))})},
  onCheck(e){const field=e.currentTarget.dataset.field,list=this.data.options[field];if(!Array.isArray(list)||!Array.isArray(e.detail.value))return;const selected=e.detail.value.map(Number);if(selected.some(i=>!Number.isInteger(i)||!list[i]))return;this.setData({['values.'+field]:selected.map(i=>list[i].value),['options.'+field]:list.map((o,i)=>({...o,checked:selected.includes(i)}))})},
  reset(){this.setData(JSON.parse(JSON.stringify(initial)))},
  submit(){for(const field of initial.schema){const v=this.data.values[field.field],empty=v==null||v===''||Array.isArray(v)&&!v.length;for(const rule of field.rules){let invalid=!!rule.required&&empty;if(!empty){const size=typeof v==='number'?v:v.length;invalid=invalid||rule.min!=null&&size<rule.min||rule.max!=null&&size>rule.max;if(rule.type==='email')invalid=invalid||!/^\\S+@\\S+\\.\\S+$/.test(String(v));if(rule.type==='number')invalid=invalid||typeof v!=='number';if(rule.type==='integer')invalid=invalid||!Number.isInteger(v);if(rule.type==='array')invalid=invalid||!Array.isArray(v);if(rule.type==='boolean')invalid=invalid||typeof v!=='boolean';if(rule.pattern)try{invalid=invalid||!new RegExp(rule.pattern).test(String(v))}catch(_){invalid=true}}if(invalid){wx.showToast({title:String(rule.message||'请检查'+field.title).slice(0,50),icon:'none'});return}}}this.triggerEvent('submit',{values:JSON.parse(JSON.stringify(this.data.values))})}
 }
})\n`
 return [{name:'component.wxml',content:'<view class="form">\n'+block.join('\n')+'\n<button bindtap="submit">提交</button></view>\n'},{name:'component.js',content:js},{name:'component.wxss',content:'.form{font-size:30rpx;color:#172333;padding:24rpx}.field{margin-bottom:24rpx}.label{font-weight:bold;margin-bottom:12rpx}input,textarea,picker{padding:16rpx;border:1rpx solid #8795a1;border-radius:8rpx}label{display:block;margin:12rpx 0}\n'},{name:'component.json',content:'{"component":true}\n'},{name:'options.json',content:JSON.stringify(option,null,2)}]
}
module.exports={generate}
