function profilePayload(values, original) {
  const nickname=String(values.nickname || '').trim(), email=String(values.email || '').trim(), mobile=String(values.mobile || '').trim()
  if(!nickname || nickname.length>30)throw Error('姓名须为1至30个字符')
  if(email && (email.length>50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error('邮箱格式不正确')
  if(mobile && !/^1\d{10}$/.test(mobile))throw Error('请填写有效手机号')
  // The existing backend ignores null fields; never claim an existing phone was cleared.
  if(!mobile && original.mobile)throw Error('当前接口暂不支持清空已绑定手机号，请填写手机号')
  const result={nickname,email}
  if(mobile)result.mobile=mobile
  if(original.sex!=null)result.sex=original.sex
  return result
}
function passwordPayload(values) {
  const oldPassword=String(values.oldPassword || ''), newPassword=String(values.newPassword || ''), confirmation=String(values.confirmation || '')
  if(oldPassword.length<4 || oldPassword.length>16)throw Error('原密码长度为4至16位')
  if(newPassword.length<4 || newPassword.length>16)throw Error('新密码长度为4至16位')
  if(oldPassword===newPassword)throw Error('新密码不能与原密码相同')
  if(newPassword!==confirmation)throw Error('两次输入的新密码不一致')
  return {oldPassword,newPassword}
}
export {profilePayload,passwordPayload}
