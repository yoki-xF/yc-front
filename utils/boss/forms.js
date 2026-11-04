const definitions = {
  materials: [
    ['materialName','物料名称','text',true,100], ['brandName','品牌名称','text',true,100],
    ['money','面值（元）','money',true], ['price','单包价格（元）','money',true], ['num','单包张数','positive',true]
  ],
  roles: [
    ['name','角色名称','text',true,30], ['code','角色编码','text',true,100],
    ['sort','显示顺序','integer',true], ['status','状态','status',true], ['remark','备注','text',false,500]
  ],
  costs: [
    ['deptId','所属门店','department',true], ['costTypeName','成本类型','text',true,100],
    ['cost','成本金额（整元）','integer',true], ['belongTime','归属日期','date',true]
  ],
  users: [
    ['username','账号','username',true,30], ['nickname','姓名','text',true,30],
    ['deptId','主部门','department',true], ['deptIds','授权门店','departments',true],
    ['mobile','手机号','phone',false], ['email','邮箱','email',false,50],
    ['password','初始密码','password',true,16], ['remark','备注','text',false,500]
  ]
}
function fields(type, edit) {
  if (!Object.prototype.hasOwnProperty.call(definitions,type)) throw Error('该功能暂不支持此操作')
  return definitions[type].filter(f => !(edit && f[0] === 'password')).map(([key,label,kind,required,max]) => ({key,label,kind,required,max:max || 100}))
}
function payload(type, values, original, departments) {
  const edit = original && original.id != null, output = edit ? {id:original.id} : {}
  for (const f of fields(type,edit)) {
    let value = values[f.key]
    if (f.kind==='departments') {
      if(!Array.isArray(value) || !value.length || value.some(id => !departments.some(d => String(d.id)===String(id)))) throw Error('请选择有权限的授权门店')
      output[f.key]=[...new Set(value.map(String))];continue
    }
    value=String(value == null ? '' : value)
    if (f.kind !== 'password') value=value.trim()
    if (!value && f.required) throw Error('请填写'+f.label)
    if (!value && !f.required) { output[f.key]='';continue }
    if (['integer','positive'].includes(f.kind)) {
      if(!/^(0|[1-9]\d{0,8})$/.test(value) || (f.kind==='positive' && Number(value)===0)) throw Error(f.label+'须为有效整数')
      output[f.key]=Number(value)
    } else if(f.kind==='money') {
      if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) throw Error(f.label+'须为非负金额，最多两位小数')
      output[f.key]=value
    } else if(f.kind==='status') {
      if(!['0','1'].includes(value)) throw Error('请选择状态')
      output[f.key]=Number(value)
    } else if(f.kind==='department') {
      const dept=departments.find(d=>String(d.id)===value)
      if(!dept) throw Error('请选择有权限的部门或门店')
      output[f.key]=String(dept.id); if(type==='costs')output.deptName=dept.name
    } else if(f.kind==='date') {
      const {query}=require('./resources');query('costs',{start:value,end:value},1)
      output[f.key]=value+' 00:00:00'
    } else {
      if(value.length>f.max)throw Error(f.label+'过长')
      if(f.kind==='username'&&!/^[A-Za-z0-9]{4,30}$/.test(value))throw Error('账号须为4至30位字母或数字')
      if(type==='roles'&&f.key==='code'&&['super_admin','tenant_admin'].includes(value))throw Error('此角色编码由系统保留，请使用其他编码')
      if(f.kind==='password'&&(value.length<4||value.length>16))throw Error('初始密码长度为4至16位')
      if(f.kind==='phone'&&!/^1\d{10}$/.test(value))throw Error('请填写有效手机号')
      if(f.kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('邮箱格式不正确')
      output[f.key]=value
    }
  }
  if(type==='users'&&edit) {
    // 新表单不编辑的岗位、性别和头像仍保留，避免覆盖原有资料。
    for(const key of ['postIds','sex','avatar'])if(original[key]!=null)output[key]=original[key]
  }
  return output
}
module.exports={fields,payload}
