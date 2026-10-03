// Pure KPI calculations; no credentials, remote calls or browser globals.
export const TYPE_CODES={'học liệu':'I.10','bài báo':'II.1','patent':'II.2','nhiệm vụ':'II.9','hội thảo':'III.2','ngoại khóa':'IV.4','chuyên gia':'III.1_dl2'};
const fold=s=>String(s??'').trim().toLocaleLowerCase('vi').replace(/\s+/g,' ');
export function codeForType(type){const t=fold(type);return Object.entries(TYPE_CODES).find(([name])=>t.includes(name))?.[1]??null;}
export function evidenceLinks(value){return [...new Set((String(value??'').match(/https:\/\/[^\s,<>"']+/g)??[]).map(x=>x.replace(/[);]+$/,'')))].filter(x=>{try{return new URL(x).protocol==='https:';}catch{return false;}});}
export function timestampParts(value){
 if(typeof value==='number'&&Number.isFinite(value)){const date=new Date(Date.UTC(1899,11,30)+value*86400000);return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,key:String(value)};}
 const text=String(value??'').trim();let m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 if(m)return {year:+m[3],month:+m[2],key:text};
 m=text.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return {year:+m[1],month:+m[2],key:text};
 throw Error('Dấu thời gian không hợp lệ. Giữ nguyên cột thời gian do Form tạo.');
}
export async function sheetRecords(matrix,sheetId,hash){
 const expected=['Dấu thời gian','Tên nội dung/Kết quả','Loại nội dung','Người khai báo','Thông tin thêm','Tải minh chứng'];
 const header=matrix[0]??[];
 if(expected.some((x,i)=>fold(header[i]).replace(/\s*\/\s*/g,'/')!==fold(x)))throw Error('Tên hoặc thứ tự 6 cột Form đã đổi. Kiểm tra hướng dẫn trước khi đồng bộ.');
 if(matrix.length>5001)throw Error('Sheet vượt 5.000 hồ sơ. Cần chia nguồn trước khi đồng bộ.');
 const occurrences=new Map(),records=[];
 for(const row of matrix.slice(1)){
  if(row.every(x=>String(x??'').trim()===''))continue;
  const cells=Array.from({length:6},(_,i)=>row[i]??'');const [time,title,type,reporter,info,evidence]=cells;
  if(!String(type).trim()||!String(reporter).trim()||!String(evidence).trim())throw Error('Có dòng thiếu loại nội dung, người khai báo hoặc minh chứng. Kiểm tra Sheet.');
  const date=timestampParts(time);if(date.year<2000||date.year>2100||date.month<1||date.month>12)throw Error('Thời gian ngoài phạm vi 2000–2100.');
  const occurrence=(occurrences.get(date.key)??0)+1;occurrences.set(date.key,occurrence);
  const effective={title:String(title).trim()||`${type} – ${reporter}`,type:String(type),reporter:String(reporter),info:String(info),evidence:String(evidence),quantity:1,dedup_key:'',start_date:'',end_date:''};
  records.push({source_key:sheetId+':'+await hash(date.key)+':'+occurrence,source_hash:await hash(JSON.stringify(cells)),effective,code:codeForType(type),year:date.year,month:date.month});
 }
 return records;
}
const num=x=>x===null||x===undefined||x===''?null:Number(x);
export function dashboard(data,year,month){
 return data.metrics.filter(m=>!m.archived&&data.plans.find(p=>p.metric_id===m.id)?.active!==false).map(metric=>{
  const plan=data.plans.find(p=>p.metric_id===metric.id)??{target:null,deadline:null};
  const records=data.records.filter(r=>r.status==='approved'&&r.metric_id===metric.id);
  const periods=Array.from({length:12},()=>null),natural=Array.from({length:12},()=>null);
  if(metric.method==='stock'){
   for(let i=0;i<12;i++){const end=new Date(Date.UTC(year,i+1,0)).toISOString().slice(0,10);const active=records.filter(r=>r.effective.start_date&&r.effective.start_date<=end&&(!r.effective.end_date||r.effective.end_date>end));
    // Any approved task known by this date makes a true zero distinguishable from missing data.
    natural[i]=records.some(r=>r.effective.start_date&&r.effective.start_date<=end)?active.reduce((a,r)=>a+(num(r.effective.quantity)??1),0):null;
   }
  }else if(metric.method==='people'){
   const seen=new Set();for(const r of [...records].filter(r=>r.year===year).sort((a,b)=>a.month-b.month)){
    const key=fold(r.effective.dedup_key);if(!key||seen.has(key))continue;seen.add(key);natural[r.month-1]=(natural[r.month-1]??0)+1;
   }
  }else if(metric.method==='sum'){
   for(const r of records.filter(r=>r.year===year))natural[r.month-1]=(natural[r.month-1]??0)+(num(r.effective.quantity)??1);
  }
  for(let i=0;i<12;i++){const override=data.months.find(v=>v.metric_id===metric.id&&v.year===year&&v.month===i+1);periods[i]=num(override?.value)??natural[i];}
  const past=periods.slice(0,month);let cumulative=null;
  if(metric.method==='stock')cumulative=periods[month-1];
  else if(metric.method==='ratio')cumulative=past.findLast(x=>x!==null)??null;
  else if(past.some(x=>x!==null))cumulative=past.reduce((a,x)=>a+(x??0),0);
  const target=num(plan.target);const percent=target!==null&&target>0&&cumulative!==null?cumulative/target*100:null;
  return {...metric,plan,periods,current:periods[month-1],cumulative,percent,records:records.filter(r=>metric.method==='stock'||r.year===year)};
 });
}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
