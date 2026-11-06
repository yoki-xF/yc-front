function label(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function period(kind,now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());let start=new Date(today),end=new Date(today)
 if(kind==='week'){start.setDate(today.getDate()-((today.getDay()+6)%7));end=new Date(start);end.setDate(start.getDate()+6)}
 if(kind==='month'){start=new Date(today.getFullYear(),today.getMonth(),1);end=new Date(today.getFullYear(),today.getMonth()+1,0)}
 return {start:label(start),end:label(end)}
}
export {period}
