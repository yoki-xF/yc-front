// 接口以当前后端 Controller 为准，未找到的旧接口不自动回退或伪造数据。
const fields = (pairs) => pairs.map(([key, label]) => ({ key, label }))
const resources = {
  inventory: { title: '即开盘点', base: '/sport/check-ggl', permission: 'sport:check-ggl:query', dateField: 'checkTime', dept: true, titleField: 'deptName', fields: fields([['deptName','门店'],['checkUserName','核对人员'],['classes','班次'],['checkTime','盘点日期'],['invCount','库存金额'],['invYesterdayDiff','库存差额'],['remark','备注']]) },
  funds: { title: '资金盘点', base: '/sport/check-fund', permission: 'sport:check-fund:query', dateField: 'checkTime', dept: true, titleField: 'deptName', fields: fields([['deptName','门店'],['sellName','销售员'],['checkTime','盘点日期'],['classes','班次'],['xj','现金'],['wxBalance','微信余额'],['wxBalanceCount','微信笔数'],['hsk','收银通'],['hskCount','收银通笔数'],['zfb','支付宝'],['zfbCount','支付宝笔数'],['szRmb','数字人民币'],['szRmbCount','数字人民币笔数']]) },
  business: { title: '营业数据', base: '/sport/check-service', permission: 'sport:check-service:query', dateField: 'checkTime', dept: true, titleField: 'deptName', fields: fields([['deptName','门店'],['sellName','销售员'],['classes','班次'],['checkTime','盘点日期'],['dcSaleMoney','电彩销售金额'],['dcSaleNum','电彩销售张数'],['dcConversionMoney','电彩兑奖金额'],['dcConversionNum','电彩兑奖张数'],['jcSaleMoney','竞彩销售金额'],['jcSaleNum','竞彩销售张数'],['jkConversionMoney','即开兑奖金额'],['jkConversionNum','即开兑奖张数'],['ydPay','彩银缴款'],['outAmount','费用支出'],['giftTicket','赠票'],['discountTicket','折扣票'],['commissionFee','手续费'],['redEnvelope','红包'],['jkOrderAmount','即开票下单金额'],['yjMoney','佣金'],['wrongTicket','错票']]) },
  commission: { title: '返佣盘点', base: '/sport/check-game-sales', permission: 'sport:check-game-sales:query', dateField: 'createTime', dept: true, titleField: 'deptName', detail: false, fields: fields([['deptName','门店'],['gameSalesName','游戏'],['salesAmount','销售金额'],['rebate','返点'],['commission','佣金'],['checkDate','盘点日期'],['userName','盘点人'],['createTime','创建时间']]) },
  costs: { title: '成本记录', base: '/sport/cost-record', permission: 'sport:cost-record:query', dateField: 'belongTime', dept: true, titleField: 'deptName', fields: fields([['deptName','门店'],['costTypeName','成本类型'],['cost','成本金额'],['belongTime','归属日期']]) },
  materials: { title: '票种物料', base: '/sport/material-ggl', permission: 'sport:material-ggl:query', dateField: 'createTime', searchField: 'materialName', titleField: 'materialName', fields: fields([['materialName','物料名称'],['brandName','品牌'],['money','面值'],['price','单包价格'],['num','单包张数']]) },
  users: { title: '员工管理', base: '/system/user', permission: 'system:user:list', detailPermission: 'system:user:query', dateField: 'createTime', searchField: 'username', titleField: 'nickname', fields: fields([['username','账号'],['nickname','姓名'],['deptName','部门'],['mobile','手机号'],['email','邮箱'],['status','状态'],['createTime','创建时间']]) },
  roles: { title: '角色管理', base: '/system/role', permission: 'system:role:query', dateField: 'createTime', searchField: 'name', titleField: 'name', fields: fields([['name','角色名称'],['code','角色编码'],['sort','显示顺序'],['status','状态'],['remark','备注']]) },
  attendance: { title: '考勤排班', base: '/sport/staff-schedule', permission: 'sport:staff-schedule:query', dateField: 'scheduleDate', dept: true, titleField: 'deptName', fields: fields([['deptName','门店'],['userName','员工'],['configName','班次'],['scheduleDate','排班日期'],['status','出勤状态'],['startClockTime','上班打卡'],['endClockTime','下班打卡'],['startClockStatus','上班状态'],['endClockStatus','下班状态']]) }
}
for (const key of ['inventory','funds','business','commission']) resources[key].queryBase = '/sport/boss/records/' + key
for(const key of ['costs','materials']) { resources[key].queryBase='/sport/boss/catalog/'+key;resources[key].writeBase=resources[key].queryBase }
for(const key of ['users','roles']) { resources[key].queryBase='/system/boss/directory/'+key;resources[key].writeBase=resources[key].queryBase }
resources.commission.detail = true
resources.commission.dateField = 'checkDate'
resources.attendance.queryBase = '/sport/boss/schedules'
function getResource(key) { if (!Object.prototype.hasOwnProperty.call(resources, key)) throw Error('不支持的业务类型'); return resources[key] }
function can(permissions, permission) { return Array.isArray(permissions) && (permissions.includes('*:*:*') || permissions.includes(permission)) }
function display(value, key) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'classes') return ({ Morning: '早班', Late: '晚班' })[value] || String(value)
  if (key === 'status') return Number(value) === 0 ? '启用' : Number(value) === 1 ? '停用' : '未知'
  if (Array.isArray(value)) return value.join('-')
  return String(value)
}
function recordView(key, row) {
  const resource = getResource(key)
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error('记录格式不正确')
  const id = row.id
  return { id: id == null ? '' : String(id), title: display(row[resource.titleField]),
    canOpen: resource.detail !== false && /^\d+$/.test(String(id)) && Number(id) > 0,
    fields: resource.fields.map(f => ({ key: f.key, label: f.label, value: key === 'attendance' && f.key === 'status' ? ({1:'正常',2:'请假',3:'调休'})[row[f.key]] || '—' : display(row[f.key], f.key) })) }
}
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + 'T00:00:00').getTime()) && (() => { const d = new Date(value + 'T00:00:00'); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') === value })() }
function query(key, filters, pageNo) {
  const r = getResource(key), data = { pageNo, pageSize: 20 }
  if (!Number.isInteger(pageNo) || pageNo < 1) throw Error('分页参数无效')
  if (filters.start || filters.end) {
    if (!validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end) throw Error('请选择有效的起止日期')
    data[r.dateField + '[0]'] = filters.start + ' 00:00:00'; data[r.dateField + '[1]'] = filters.end + ' 23:59:59'
  }
  if (r.dept && filters.deptId) data.deptId = filters.deptId
  if (r.searchField && filters.keyword && filters.keyword.trim()) data[r.searchField] = filters.keyword.trim()
  return data
}
export { resources, getResource, can, recordView, query }
