export type CatalogType = 'materials' | 'costs'
export type CatalogValues = Record<string, string>
export interface CatalogDepartment { id: string; name: string }
export interface CatalogContext { permissions: string[]; departments: CatalogDepartment[]; writeScopeAllowed: boolean; original?: Record<string, unknown> }
export function catalogType(value: unknown): CatalogType {
  if (value !== 'materials' && value !== 'costs') throw Error('不支持的管理类型')
  return value
}
export function catalogId(value: unknown): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw Error('记录编号精度无效')
  const text = String(value)
  if (!/^[1-9]\d*$/.test(text) || BigInt(text) > 9223372036854775807n) throw Error('记录编号无效')
  return text
}
export function catalogPermission(type: CatalogType, action: string) { return `sport:${type === 'materials' ? 'material-ggl' : 'cost-record'}:${action}` }
export function requireCatalogPermission(type: CatalogType, permissions: string[], edit: boolean) {
  for (const action of edit ? ['query', 'update'] : ['create']) {
    if (!permissions.includes('*:*:*') && !permissions.includes(catalogPermission(type, action))) throw Error('当前账号没有此管理操作权限')
  }
}
export function catalogFields(type: CatalogType) {
  return type === 'materials' ? [
    {key:'materialName',label:'物料名称',max:100}, {key:'brandName',label:'品牌名称',max:100},
    {key:'money',label:'面值（元）',max:13}, {key:'price',label:'单包价格（元）',max:13}, {key:'num',label:'单包张数',max:9}
  ] : [{key:'costTypeName',label:'成本类型',max:100},{key:'cost',label:'成本金额（整元）',max:9},{key:'belongTime',label:'归属日期',max:10}]
}
function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') throw Error('请选择有效归属日期')
  const d = new Date(value + 'T00:00:00Z')
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw Error('请选择有效归属日期')
  return value
}
function dateTime(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || '0') > 59) throw Error('归属日期格式无效')
  return date(match[1]!) + ' ' + match[2] + ':' + match[3] + ':' + (match[4] || '00')
}
export function catalogValues(type: CatalogType, row?: Record<string, unknown>): CatalogValues {
  const values: CatalogValues = {}
  for (const f of catalogFields(type)) {
    if (row && row[f.key] == null) throw Error('记录字段缺失，请重新读取')
    values[f.key] = row ? String(row[f.key]) : ''
  }
  if (type === 'costs') {
    values.deptId = row ? catalogId(row.deptId) : ''
    // Preserve the original time on an unchanged date; never silently rewrite historical time.
    if (row) {
      const integralCost = /^(0|[1-9]\d{0,8})(?:\.0{1,2})?$/.exec(values.cost!)
      if (!integralCost) throw Error('原成本不是有效整元金额，请联系管理员核对')
      values.cost = integralCost[1]!
      values.belongTime = dateTime(values.belongTime!).slice(0,10)
    }
  }
  return values
}
export function catalogPayload(type: CatalogType, values: CatalogValues, context: CatalogContext): Record<string, unknown> {
  const original = context.original, edit = !!original
  requireCatalogPermission(type, context.permissions, edit)
  if (type === 'materials' && context.writeScopeAllowed !== true) throw Error('票种物料需要全部数据管理范围')
  const body: Record<string, unknown> = {}
  if (original) {
    body.id = catalogId(original.id)
    if (typeof original.revision !== 'string' || !/^[a-f0-9]{64}$/.test(original.revision)) throw Error('记录版本缺失，请重新读取')
    body.revision = original.revision
  }
  for (const f of catalogFields(type)) {
    const value = String(values[f.key] ?? '').trim()
    if (['money','price'].includes(f.key)) {
      if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) throw Error(f.label+'须为非负金额，最多两位小数')
      body[f.key] = value
    } else if (['cost','num'].includes(f.key)) {
      if (!/^(0|[1-9]\d{0,8})$/.test(value) || (f.key === 'num' && value === '0')) throw Error(f.label+'超出有效整数范围')
      body[f.key] = Number(value)
    } else if (f.key === 'belongTime') {
      const day = date(value), before = String(original?.belongTime || '')
      body.belongTime = before.slice(0,10) === day ? dateTime(before) : day + ' 00:00:00'
    } else {
      if (!value || value.length > 100) throw Error(f.label+'须为1至100字')
      body[f.key] = value
    }
  }
  if (type === 'costs') {
    const deptId = catalogId(values.deptId)
    if (!context.departments.some(d => d.id === deptId)) throw Error('请选择管理范围内的启用门店')
    body.deptId = deptId
  }
  return body
}
