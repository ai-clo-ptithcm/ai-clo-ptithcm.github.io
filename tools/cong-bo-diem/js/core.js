function dataError(message,details={}){return Object.assign(new Error(message),details);}

export function normalize(value,type='text'){
 const s=String(value??'').trim();
 if(type==='dob'){
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if(!m){const d=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(d)m=[d[0],d[3],d[2],d[1]];}
  if(!m)return '';
  const y=+m[1],month=+m[2],day=+m[3],date=new Date(Date.UTC(y,month-1,day));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
  return m[1]+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 }
 if(type==='phone'){let p=s.replace(/[\s().-]/g,'');if(p.startsWith('+84'))p='0'+p.slice(3);if(p.startsWith('84')&&p.length===11)p='0'+p.slice(2);return /^0\d{8,10}$/.test(p)?p:'';}
 return s.normalize('NFKC').toLocaleLowerCase('vi');
}
export function validateTable(columns,rows,visible,verification){
 if(!Array.isArray(columns)||!columns.length||columns.length>100)throw Error('Cần từ 1 đến 100 cột.');
 if(columns.some(c=>typeof c!=='string'||!c.trim()||c.length>200))throw dataError('Tên cột không được trống và tối đa 200 ký tự.',{columns:columns.map((c,i)=>typeof c!=='string'||!c.trim()||c.length>200?i:-1).filter(i=>i>=0)});
 if(new Set(columns.map(c=>c.trim().toLowerCase())).size!==columns.length)throw dataError('Tên cột bị trùng. Hãy đổi tên.',{columns:columns.map((c,i)=>columns.some((d,j)=>j!==i&&d.trim().toLowerCase()===c.trim().toLowerCase())?i:-1).filter(i=>i>=0)});
 if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw Error('Cần từ 1 đến 5000 dòng dữ liệu.');
 const invalidRow=rows.findIndex(r=>!Array.isArray(r)||r.length!==columns.length||r.some(c=>typeof c!=='string'||c.length>2000));
 if(invalidRow>=0)throw dataError('Dòng '+(invalidRow+1)+': dữ liệu lệch cột hoặc ô vượt 2000 ký tự.',{row:invalidRow,columns:columns.map((_,i)=>typeof rows[invalidRow]?.[i]!=='string'||rows[invalidRow][i].length>2000?i:-1).filter(i=>i>=0)});
 if(!Array.isArray(visible)||!visible.length||visible.some(i=>!Number.isInteger(i)||i<0||i>=columns.length)||new Set(visible).size!==visible.length)throw Error('Chọn ít nhất một cột công bố hợp lệ.');
 if(!Array.isArray(verification)||!verification.length||verification.length>4||verification.some(v=>!Number.isInteger(v.column)||v.column<0||v.column>=columns.length||!['mssv','phone','dob','code'].includes(v.type))||new Set(verification.map(v=>v.column)).size!==verification.length)throw Error('Chọn cột xác nhận hợp lệ, không trùng.');
 const seen=new Set();
 rows.forEach((r,i)=>{
  const values=verification.map(v=>normalize(r[v.column],v.type));
  if(values.some(s=>!s))throw dataError('Dòng '+(i+1)+': thông tin xác nhận trống hoặc sai định dạng.',{row:i,columns:verification.filter((v,j)=>!values[j]).map(v=>v.column)});
  const key=JSON.stringify(values);if(seen.has(key))throw dataError('Dòng '+(i+1)+': tổ hợp xác nhận bị trùng. Chọn thêm trường xác nhận.',{row:i,columns:verification.map(v=>v.column)});seen.add(key);
 });
}
export function tableFromMatrix(matrix,header=0){
 if(!Array.isArray(matrix)||!matrix[header])throw Error('Không có dòng tiêu đề.');
 const width=matrix[header].length;
 const columns=matrix[header].map((c,i)=>String(c??'').trim()||'Cột '+(i+1));
 const rows=matrix.slice(header+1).filter(r=>r.some(c=>String(c??'').trim())).map(r=>Array.from({length:width},(_,i)=>String(r[i]??'')));
 return {columns,rows};
}
export function parseTSV(text){
 // Excel clipboard uses tabs/newlines and quoted multiline cells.
 const rows=[];let row=[],cell='',quote=false;
 const s=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
 for(let i=0;i<s.length;i++){const ch=s[i];
  if(ch==='"'){if(quote&&s[i+1]==='"'){cell+='"';i++;}else if(quote||!cell)quote=!quote;else cell+=ch;}
  else if(ch==='\t'&&!quote){row.push(cell);cell='';}
  else if(ch==='\n'&&!quote){row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(quote)throw Error('Vùng dán có dấu ngoặc kép chưa đóng.');
 row.push(cell);if(row.some(c=>c!==''))rows.push(row);
 return rows;
}

