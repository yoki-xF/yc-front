import { shallowRef } from 'vue'
import { request } from './client'
import { session, isCurrent } from './session'
export interface Identity { user: { id: string; nickname?: string; username: string }; permissions: string[] }
export interface Department { id: string; name: string }
export const identity = shallowRef<Identity | null>(null)
export const departments = shallowRef<Department[]>([])
export const selectedDept = shallowRef('')
export function allowed(permission: string) { return !!identity.value?.permissions.some(p => p === '*:*:*' || p === permission) }
export function clearAccount() { identity.value = null; departments.value = []; selectedDept.value = '' }
export async function loadAccount() {
  const key = session.value?.key
  if (!key) throw Error('请先登录')
  clearAccount()
  const info = await request<Identity>('/system/auth/get-permission-info')
  if (!info?.user || !Array.isArray(info.permissions)) throw Error('账号权限数据不完整')
  if (!isCurrent(key)) return
  identity.value = info
  // Employee scope is separate from boss management scope; never substitute one for the other.
  const mobile = await request<{ depts: Department[] }>('/system/auth/get-mobile-permission-info')
  if (!isCurrent(key)) return
  if (!Array.isArray(mobile.depts)) throw Error('门店范围数据不完整')
  departments.value = mobile.depts.map(d => ({ id: String(d.id), name: d.name }))
  selectedDept.value = departments.value[0]?.id || ''
}
