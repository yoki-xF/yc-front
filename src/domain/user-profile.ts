import { identityId } from './account-login'
export interface Profile { id: string; username: string; nickname: string; email: string; mobile: string; sex: string }
export function profile(raw: any): Profile {
  if (!raw || typeof raw.username !== 'string') throw Error('个人资料不完整')
  return { id: identityId(raw.id), username: raw.username, nickname: String(raw.nickname ?? ''), email: String(raw.email ?? ''), mobile: String(raw.mobile ?? ''), sex: String(raw.sex ?? 0) }
}
export function profileCommand(value: Profile) {
  const nickname = value.nickname.trim(), email = value.email.trim(), mobile = value.mobile.trim()
  if (!nickname || nickname.length > 30) throw Error('姓名或昵称须为1至30字')
  if (email.length > 50 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw Error('请填写有效邮箱，最多50字')
  if (mobile && !/^[0-9]{11}$/.test(mobile)) throw Error('联系电话须为11位数字')
  if (!['0','1','2'].includes(value.sex)) throw Error('请选择有效性别')
  return { nickname, email, mobile, sex: Number(value.sex) }
}
