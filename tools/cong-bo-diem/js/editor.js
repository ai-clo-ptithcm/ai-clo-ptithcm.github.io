
import {$,esc,api,busy,client,stamp,status,showQR,bindQR,lookupLink,fieldError,clearErrors,manualEntry} from './api.js';
import {normalize,validateTable,tableFromMatrix,parseTSV} from './core.js';
const params=new URLSearchParams(location.search);let id=params.get('id');const admin=params.get('admin')==='1';
let creationCode='';
let token='',g=null,columns=[],rows=[],visible=[],verification=[],page=0,book=null,file=null,dirty=false,undo=null,pendingPaste=null,pasteOrigin=null,loadedSource='excel',loadedGoogleConfig=null,connectorLoaded=false;
const verificationNames={mssv:'MSSV',phone:'Số điện thoại',dob:'Ngày sinh',code:'Mã riêng'};
const credentials=()=>({id,token});
const request=(action,data={})=>api(action,{...credentials(),...data},admin);
function mark(){dirty=true;$('#savedState').textContent='Có thay đổi chưa lưu';}
function snapshot(){undo=JSON.stringify({columns,rows,visible,verification});}
function metadata(){
 return {title:$('#title').value.trim(),teacher:$('#teacher').value.trim(),class_name:$('#className').value.trim(),semester:$('#semester').value.trim(),note:$('#note').value,published:$('#published').checked};
}
function validate(){
 clearErrors();
 const missing=['title','teacher','className'].filter(id=>!$('#'+id).value.trim());
 if(missing.length)throw fieldError('Nhập đầy đủ tên công bố, giảng viên và lớp.',missing.map(id=>'#'+id));
 try{validateTable(columns,rows,visible,verification);}catch(e){
  if(Number.isInteger(e.row)){page=Math.floor(e.row/50);renderTable();}
  e.fields=(e.columns||[]).map(col=>Number.isInteger(e.row)?'[data-row="'+e.row+'"][data-cell="'+col+'"]':'[data-column="'+col+'"]');
  if(!visible.length)e.fields.push('#visibleColumns');
  if(!verification.length||/cột xác nhận/.test(e.message))e.fields.push('#verification');
  throw e;
 }
 if($('#source').value!==loadedSource)throw Error('Nguồn đã đổi. Hãy đọc dữ liệu nguồn mới trước khi lưu.');
 if(loadedSource==='google'&&JSON.stringify(googleConfig())!==JSON.stringify(loadedGoogleConfig))throw Error('Thông tin Google Sheets đã đổi. Hãy đọc lại trước khi lưu.');
}
function defaults(){
 visible=columns.map((_,i)=>i).filter(i=>!/(mssv|sđt|sdt|điện thoại|ngày sinh|mã riêng|mã tra cứu|phone|birth)/i.test(columns[i]));
 if(!visible.length)visible=[0];
 const candidate=columns.findIndex(c=>/mssv|mã sinh viên/i.test(c));
 verification=candidate>=0?[{type:'mssv',column:candidate,label:'MSSV'}]:[];
}
function setTable(table,source){
 snapshot();columns=table.columns;rows=table.rows;page=0;loadedSource=source;
 defaults();mark();render();
}
function tableHTML(limit=50){
 const start=page*50;
 return '<table><thead><tr><th>Dòng</th>'+columns.map((c,i)=>'<th><input aria-label="Tên cột '+(i+1)+'" data-column="'+i+'" value="'+esc(c)+'" '+(loadedSource==='google'?'readonly':'')+'>'+(loadedSource==='google'?'':'<button data-remove-column="'+i+'" title="Xóa cột">×</button>')+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(start,start+limit).map((r,j)=>'<tr><td>'+(start+j+1)+(loadedSource==='google'?'':'<button data-remove-row="'+(start+j)+'" title="Xóa dòng">×</button>')+'</td>'+r.map((c,i)=>'<td '+(loadedSource==='google'?'':'contenteditable="true" spellcheck="false"')+' data-row="'+(start+j)+'" data-cell="'+i+'">'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function renderTable(){
 $('#table').innerHTML=columns.length?tableHTML():'<p class="muted">Chưa có dữ liệu. Tải file, đọc Sheets hoặc dán bảng.</p>';
 $('#page').textContent=rows.length?('Dòng '+(page*50+1)+'–'+Math.min(rows.length,(page+1)*50)+' / '+rows.length):'0 dòng';
 $('#prev').disabled=page===0;$('#next').disabled=(page+1)*50>=rows.length;
}
function renderConfig(){
 $('#visibleColumns').innerHTML=columns.map((c,i)=>'<label><input type="checkbox" data-visible="'+i+'" '+(visible.includes(i)?'checked':'')+'>'+esc(c)+'</label>').join('');
 $('#verification').innerHTML=verification.map((v,i)=>'<div class="verification-row"><select data-type="'+i+'" aria-label="Loại xác nhận">'+Object.entries(verificationNames).map(([key,name])=>'<option value="'+key+'" '+(key===v.type?'selected':'')+'>'+name+'</option>').join('')+'</select><select data-auth-column="'+i+'" aria-label="Cột xác nhận">'+columns.map((c,j)=>'<option value="'+j+'" '+(j===v.column?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select><button data-remove-auth="'+i+'" title="Xóa trường xác nhận">×</button></div>').join('');
 $('#addVerification').disabled=verification.length>=4||!columns.length;
}
function sourceUI(){
 const source=$('#source').value;$('#excelSource').hidden=source!=='excel';$('#googleSource').hidden=source!=='google';
 const readonly=source==='google';
 if(readonly&&!connectorLoaded){connectorLoaded=true;api('connector').then(c=>{
  $('#googleHelp').textContent=c.email?'Chia sẻ sheet với email '+c.email+' (Người xem). Tự đồng bộ khi có lượt tra cứu, tối đa một lần mỗi 15 phút.':'Admin chưa cấu hình kết nối Google Sheets. Bạn có thể dùng Excel hoặc dán bảng trước.';
 }).catch(e=>{connectorLoaded=false;status(e.message,true);});}
 ['pasteWhole','addRow','addColumn','undo'].forEach(name=>$('#'+name).disabled=readonly);
 $('#tableHint').textContent=readonly?'Dữ liệu Google Sheets chỉ xem tại đây. Chỉnh điểm ở Google Sheets, sau đó hệ thống tự đồng bộ.':'Sửa từng ô, hoặc chọn một ô rồi dán vùng sao chép từ Excel. Có thể sửa tên cột. Mỗi trang hiển thị 50 dòng.';
}
function render(){renderTable();renderConfig();sourceUI();}
function fill(data){
 g=data;columns=data.columns;rows=data.rows;visible=data.visible_columns;verification=data.verification;loadedSource=data.source;loadedGoogleConfig=data.source==='google'?data.source_config:null;page=0;undo=null;
 $('#title').value=data.title;$('#teacher').value=data.teacher;$('#className').value=data.class_name;$('#semester').value=data.semester;$('#note').value=data.note;$('#published').checked=data.published;$('#source').value=data.source;
 const sc=data.source_config||{};$('#googleLink').value=sc.spreadsheet_id?'https://docs.google.com/spreadsheets/d/'+sc.spreadsheet_id+'/edit':'';$('#googleSheet').value=sc.sheet_name||'';$('#googleHeader').value=sc.header_row||1;
 $('#publicationId').value=new URL('/tools/cong-bo-diem/quan-ly/?id='+encodeURIComponent(id),location.origin).href;$('#heading').textContent='Quản lý công bố điểm';$('#gate').hidden=true;$('#editor').hidden=false;
 $('#lookupLink').href=lookupLink(id);$('#syncState').textContent=(data.sync_error?'Đồng bộ chưa thành công: '+data.sync_error+' · ':'')+'Đồng bộ lần cuối: '+stamp(data.synced_at);
 dirty=false;$('#savedState').textContent='Đã lưu: '+stamp(data.updated_at);render();
}
async function open(){fill(await request('read'));history.replaceState(null,'','?id='+id+(admin?'&admin=1':''));}
$('#newFields').hidden=!!id;if(id){$('#heading').textContent='Mở quản lý công bố';$('#passwordLabel small').textContent='Nhập mật khẩu chỉnh sửa của công bố. Nếu quên, liên hệ admin.';$('#editPassword').removeAttribute('minlength');}
manualEntry();
function askCreationCode(){
 $('#gate').hidden=true;$('#creationDialog').showModal();
}
$('#creationForm').onsubmit=e=>{e.preventDefault();busy($('#checkCreationCode'),async()=>{
 const code=$('#creationCode').value.trim();
 if(!/^[0-9]{4}$/.test(code))throw fieldError('Mã tạo phải gồm đúng 4 chữ số.',['#creationCode']);
 await api('check_code',{code});clearErrors();$('#status').replaceChildren();creationCode=code;$('#creationCode').value='';
 $('#creationDialog').close();$('#gate').hidden=false;$('#newTitle').focus();
});};
$('#creationDialog').addEventListener('cancel',e=>{e.preventDefault();location.href='../';});
if(!id&&!admin)askCreationCode();
$('#gateForm').onsubmit=e=>{e.preventDefault();busy($('#gateBtn'),async()=>{
 if(!id){const missing=['newTitle','newTeacher','newClass'].filter(id=>!$('#'+id).value.trim());if(missing.length)throw fieldError('Nhập tên công bố, giảng viên và lớp.',missing.map(id=>'#'+id));}
 if(id){token=(await request('unlock',{password:$('#editPassword').value})).token;}
 else{
  let created;try{created=await api('create',{title:$('#newTitle').value.trim(),teacher:$('#newTeacher').value.trim(),class_name:$('#newClass').value.trim(),semester:$('#newSemester').value.trim(),code:creationCode,password:$('#editPassword').value},admin);}catch(e){if(/Mã tạo/.test(e.message)){creationCode='';askCreationCode();e.fields=['#creationCode'];}throw e;}
  id=created.id;token=created.token;
 }
 $('#editPassword').value='';creationCode='';$('#creationCode').value='';await open();status('Đã mở quản lý. Chọn dữ liệu và cấu hình trước khi công bố.');
});};
if(id&&admin)busy(null,open);
$('#editor').addEventListener('input',e=>{if(e.target.matches('input,textarea,[contenteditable]'))mark();});
$('#source').onchange=()=>{mark();sourceUI();};
$('#table').addEventListener('focusin',e=>{if(e.target.matches('[contenteditable]'))snapshot();});
$('#table').addEventListener('input',e=>{
 const el=e.target;
 if(el.matches('[data-cell]'))rows[+el.dataset.row][+el.dataset.cell]=el.textContent??'';
 if(el.matches('[data-column]')){columns[+el.dataset.column]=el.value;renderConfig();}
 mark();
});
$('#table').addEventListener('focusout',e=>{const el=e.target;if(el.matches('[contenteditable]'))el.textContent=rows[+el.dataset.row][+el.dataset.cell];});
$('#table').onclick=e=>{
 const row=e.target.closest('[data-remove-row]'),col=e.target.closest('[data-remove-column]');
 if(loadedSource==='google')return;
 if(row&&confirm('Xóa dòng '+(+row.dataset.removeRow+1)+'?')){snapshot();rows.splice(+row.dataset.removeRow,1);page=Math.min(page,Math.max(0,Math.ceil(rows.length/50)-1));mark();renderTable();}
 if(col&&confirm('Xóa cột này?')){snapshot();const i=+col.dataset.removeColumn;columns.splice(i,1);rows.forEach(r=>r.splice(i,1));visible=visible.filter(j=>j!==i).map(j=>j>i?j-1:j);verification=verification.filter(v=>v.column!==i).map(v=>({...v,column:v.column>i?v.column-1:v.column}));mark();render();}
};
$('#prev').onclick=()=>{page--;renderTable();};$('#next').onclick=()=>{page++;renderTable();};
$('#visibleColumns').onchange=e=>{const i=+e.target.dataset.visible;visible=e.target.checked?[...visible,i].sort((a,b)=>a-b):visible.filter(j=>j!==i);mark();};
$('#verification').onchange=e=>{
 const t=e.target;if(t.matches('[data-type]')){const i=+t.dataset.type;verification[i].type=t.value;verification[i].label=verificationNames[t.value];}
 if(t.matches('[data-auth-column]'))verification[+t.dataset.authColumn].column=+t.value;mark();
};
$('#verification').onclick=e=>{const b=e.target.closest('[data-remove-auth]');if(b){verification.splice(+b.dataset.removeAuth,1);renderConfig();mark();}};
$('#addVerification').onclick=()=>{const column=columns.findIndex((_,i)=>!verification.some(v=>v.column===i));if(column<0)return;verification.push({type:'code',column,label:'Mã riêng'});renderConfig();mark();};
$('#addRow').onclick=()=>{if(!columns.length){status('Tạo cột hoặc nhập bảng trước.',true);return;}snapshot();rows.push(columns.map(()=>''));page=Math.floor((rows.length-1)/50);mark();renderTable();};
$('#addColumn').onclick=()=>{const name=prompt('Tên cột mới:');if(!name?.trim())return;snapshot();columns.push(name.trim());rows.forEach(r=>r.push(''));mark();render();};
$('#undo').onclick=()=>{if(!undo){status('Không có thay đổi bảng để hoàn tác.',true);return;}const prior=JSON.parse(undo);undo=null;({columns,rows,visible,verification}=prior);page=0;mark();render();};
async function office(){
 if(window.XLSX)return;
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(Error('Không tải được thư viện Excel. Bạn có thể dán bảng trực tiếp.'));document.head.append(s);});
}
$('#file').onchange=()=>busy($('#readExcel'),async()=>{
 const chosen=$('#file').files[0];if(!chosen)return;if(chosen.size>5*1024*1024)throw Error('File vượt 5 MB.');
 if(!/\.(xlsx|xls|csv)$/i.test(chosen.name))throw Error('Chỉ nhận xlsx, xls, csv.');
 await office();book=window.XLSX.read(await chosen.arrayBuffer(),{type:'array',cellText:true,cellDates:false});
 file=chosen;$('#sheet').innerHTML=book.SheetNames.map(name=>'<option>'+esc(name)+'</option>').join('');$('#sheetControls').hidden=false;$('#readExcel').hidden=false;
 status('Đã đọc file. Chọn sheet và dòng tiêu đề rồi bấm Đọc sheet.');
});
$('#readExcel').onclick=()=>busy($('#readExcel'),async()=>{
 if(!book)throw Error('Chọn file trước.');
 const matrix=window.XLSX.utils.sheet_to_json(book.Sheets[$('#sheet').value],{header:1,raw:false,defval:'',blankrows:true});
 const header=Number($('#headerRow').value)-1;if(!Number.isInteger(header)||header<0||header>99)throw fieldError('Dòng tiêu đề phải từ 1 đến 100.',['#headerRow']);
 if(matrix.length>header+5001)throw Error('Bảng vượt 5000 dòng.');
 setTable(tableFromMatrix(matrix,header),'excel');status('Đã đọc bảng. Kiểm tra các cột và thông tin xác nhận.');
});
function googleConfig(){
 let url;try{url=new URL($('#googleLink').value);}catch{throw fieldError('Dán link Google Sheets hợp lệ.',['#googleLink']);}
 if(url.hostname!=='docs.google.com')throw fieldError('Cần link docs.google.com.',['#googleLink']);
 const match=url.pathname.match(/\/spreadsheets\/d\/([\w-]+)/);if(!match)throw fieldError('Link Google Sheets không hợp lệ.',['#googleLink']);
 if(!$('#googleSheet').value.trim())throw fieldError('Nhập tên sheet.',['#googleSheet']);
 const header=Number($('#googleHeader').value);if(!Number.isInteger(header)||header<1||header>100)throw fieldError('Dòng tiêu đề phải từ 1 đến 100.',['#googleHeader']);
 return {spreadsheet_id:match[1],sheet_name:$('#googleSheet').value.trim(),header_row:Number($('#googleHeader').value)};
}
$('#readGoogle').onclick=()=>busy($('#readGoogle'),async()=>{
 const source_config=googleConfig();const table=await request('google_preview',{source_config});setTable(table,'google');loadedGoogleConfig=source_config;status('Đã đọc Google Sheets. Chọn lại các cột trước khi lưu.');
});
$('#syncGoogle').onclick=()=>busy($('#syncGoogle'),async()=>{
 if(g.source!=='google')throw Error('Lưu công bố với nguồn Google Sheets trước.');
 if(dirty&&!confirm('Bạn có thay đổi chưa lưu. Cập nhật sẽ tải lại cấu hình đang lưu. Tiếp tục?'))return;
 const data=await request('sync_now');fill(data);if(data.sync_error)throw Error(data.sync_error);status('Đã đồng bộ Google Sheets.');
});
function startPaste(origin,text=''){
 if($('#source').value==='google')return;
 pasteOrigin=origin;pendingPaste=null;$('#pasteText').value=text;$('#pastePreview').replaceChildren();$('#applyPaste').disabled=true;
 $('#pasteTitle').textContent=origin?'Dán vùng dữ liệu':'Dán toàn bộ bảng';
 $('#pasteHint').textContent=origin?'Vùng dán sẽ bắt đầu tại dòng '+(origin.row+1)+', cột '+(origin.col+1)+'. Xem trước rồi áp dụng.':'Sao chép cả tên cột và dữ liệu từ Excel. Bảng hiện tại sẽ được thay thế sau khi bạn áp dụng.';
 $('#pasteDialog').showModal();
}
$('#pasteWhole').onclick=()=>startPaste(null);
$('#table').addEventListener('paste',e=>{
 if(loadedSource==='google')return;
 const el=e.target.closest('[data-cell]');if(!el)return;e.preventDefault();startPaste({row:+el.dataset.row,col:+el.dataset.cell},e.clipboardData.getData('text/plain'));
});
$('#pasteText').oninput=()=>{pendingPaste=null;$('#applyPaste').disabled=true;};
$('#inspectPaste').onclick=()=>busy($('#inspectPaste'),async()=>{
 const matrix=parseTSV($('#pasteText').value);if(!matrix.length)throw Error('Chưa có dữ liệu dán.');
 const width=Math.max(...matrix.map(r=>r.length));if(width>100||matrix.length>5001)throw Error('Vùng dán vượt 100 cột hoặc 5000 dòng.');
 if(pasteOrigin&&pasteOrigin.col+width>columns.length)throw Error('Vùng dán vượt số cột hiện tại. Thêm cột trước.');
 pendingPaste=matrix;
 $('#pastePreview').innerHTML='<table><tbody>'+matrix.slice(0,10).map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table><small>'+matrix.length+' dòng · '+width+' cột. Xem trước tối đa 10 dòng.</small>';
 $('#applyPaste').disabled=false;
});
$('#applyPaste').onclick=()=>busy($('#applyPaste'),async()=>{
 if(!pendingPaste)return;
 if(pasteOrigin){
  if(pasteOrigin.row+pendingPaste.length>5000)throw Error('Vượt 5000 dòng.');
  snapshot();pendingPaste.forEach((r,j)=>{const idx=pasteOrigin.row+j;while(rows.length<=idx)rows.push(columns.map(()=>''));r.forEach((c,k)=>{rows[idx][pasteOrigin.col+k]=c;});});mark();renderTable();
 }else{
  if(rows.length&&!confirm('Thay thế toàn bộ bảng hiện tại? Có thể hoàn tác ngay sau khi dán.'))return;
  const width=Math.max(...pendingPaste.map(r=>r.length));const matrix=pendingPaste.map(r=>Array.from({length:width},(_,i)=>r[i]??''));
  const source=$('#source').value==='excel'?'excel':'paste';setTable(tableFromMatrix(matrix),source);file=null;
 }
 $('#pasteDialog').close();status('Đã áp dụng bảng dán. Kiểm tra trước khi lưu.');
});
$('#cancelPaste').onclick=()=>$('#pasteDialog').close();
$('#validate').onclick=()=>busy($('#validate'),async()=>{validate();status('Dữ liệu hợp lệ: '+rows.length+' sinh viên, '+visible.length+' cột công bố.');});
$('#preview').onclick=()=>busy($('#preview'),async()=>{
 validate();$('#previewFields').innerHTML=verification.map((v,i)=>'<label>'+esc(v.label)+'<input data-preview="'+i+'" required type="'+(v.type==='dob'?'date':'text')+'"></label>').join('');
 $('#previewResult').replaceChildren();$('#previewNote').textContent='';$('#previewDialog').showModal();
});
$('#previewForm').onsubmit=e=>{e.preventDefault();try{
 $('#previewResult').replaceChildren();
 const wanted=[...document.querySelectorAll('[data-preview]')].map((el,i)=>normalize(el.value,verification[i].type));
 const matches=rows.filter(r=>verification.every((v,i)=>normalize(r[v.column],v.type)===wanted[i]));
 if(wanted.some(v=>!v)||matches.length!==1)throw Error('Không tìm thấy kết quả phù hợp.');
 $('#previewResult').innerHTML=visible.map(i=>'<div><dt>'+esc(columns[i])+'</dt><dd>'+esc(matches[0][i])+'</dd></div>').join('');$('#previewNote').textContent=$('#note').value;
}catch(e){document.querySelectorAll('[data-preview]').forEach(el=>el.setAttribute('aria-invalid','true'));status(e.message,true);}};
$('#closePreview').onclick=()=>$('#previewDialog').close();
$('#save').onclick=()=>busy($('#save'),async()=>{
 validate();
 const payload={...metadata(),columns,rows,visible_columns:visible,verification,source:loadedSource,source_config:loadedSource==='google'?googleConfig():{},revision:g.revision};
 const saved=await request('save',payload);
 g.revision=saved.revision;g.source=loadedSource;dirty=false;$('#savedState').textContent='Đã lưu: '+stamp(new Date().toISOString());
 status('Đã lưu '+($('#published').checked?'và mở công bố.':'bản nháp / tắt công bố.'));
 if(file){
  try{
   const extension=file.name.split('.').pop().toLowerCase();const signed=await request('upload',{extension});
   const {error}=await client.storage.from('grade-publications').uploadToSignedUrl(signed.path,signed.token,file,{contentType:extension==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':extension==='xls'?'application/vnd.ms-excel':'text/csv'});
   if(error)throw error;await request('original',{path:signed.path});file=null;
  }catch(e){status('Bảng điểm đã lưu, nhưng file gốc chưa tải được: '+e.message+'. Bấm Lưu cập nhật để thử lại.',true);}
 }
});
$('#restore').onclick=()=>busy($('#restore'),async()=>{if(!confirm('Khôi phục bản trước và tắt công bố để kiểm tra?'))return;await request('restore');await open();status('Đã khôi phục. Kiểm tra rồi bật công bố lại.');});
$('#changePassword').onclick=()=>busy($('#changePassword'),async()=>{
 const password=prompt('Nhập mật khẩu chỉnh sửa mới (tối thiểu 8 ký tự):');if(!password)return;
 await request('password',{password});dirty=false;location.reload();
});
$('#share').onclick=()=>busy($('#share'),()=>showQR(id));bindQR();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});


