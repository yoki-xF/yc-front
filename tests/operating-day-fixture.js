module.exports = {
 async bind(page, prefix, suffix = []) { if (!page.operatingDay) { page.operatingDay = {id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',deptId:String(page.deptId),userId:String(page.userId)}; if(prefix)page.draftKey=[prefix,String(page.session.tenantId),String(page.userId),String(page.deptId),page.operatingDay.id].concat(suffix).join('_') } return page.operatingDay },
 header(page, headers) { if(!page.operatingDay)throw Error('missing day'); return {...headers,'X-Operating-Day':page.operatingDay.id} }
}
