export interface RecordFilters { keyword: string; start: string; end: string; deptId: string }
const queries = new Map<string, RecordFilters>()
const cacheKey = (login: string, type: string) => JSON.stringify([login, type])
export function recallRecordQuery(login: string, type: string): RecordFilters | null {
  const filters = queries.get(cacheKey(login, type))
  return filters ? { ...filters } : null
}
export function rememberRecordQuery(login: string, type: string, filters: RecordFilters) {
  if (!login) return
  const key = cacheKey(login, type)
  queries.delete(key)
  queries.set(key, { keyword: filters.keyword, start: filters.start, end: filters.end, deptId: filters.deptId })
  if (queries.size > 30) queries.delete(queries.keys().next().value!)
}
export function clearRecordQueries() { queries.clear() }
export function visibleDepartment(id: string, departments: { id: string | number }[]) {
  return id && departments.some(dept => String(dept.id) === id) ? id : ''
}
