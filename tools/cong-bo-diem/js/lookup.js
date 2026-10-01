
import {$,esc,api,busy,stamp,status} from './api.js';
const id=new URLSearchParams(location.search).get('id');
async function init(){
 if(!id)throw Error('Thiếu mã công bố. Mở link hoặc QR do giảng viên cung cấp.');
 const g=await api('meta',{id});$('#title').textContent=g.title;$('#subtitle').textContent=g.class_name+' · '+g.teacher+' · '+g.semester;
 $('#fields').innerHTML=g.verification.map((v,i)=>'<label>'+esc(v.label||({mssv:'MSSV',phone:'Số điện thoại',dob:'Ngày sinh',code:'Mã riêng'}[v.type]))+'<input data-field="'+i+'" type="'+(v.type==='dob'?'date':v.type==='phone'?'tel':'text')+'" required maxlength="200" autocomplete="off"></label>').join('');
 $('#lookup').onsubmit=e=>{e.preventDefault();$('#resultPanel').hidden=true;busy($('#lookupBtn'),async()=>{
  const values=[...document.querySelectorAll('[data-field]')].map(el=>el.value);
  const r=await api('lookup',{id,values});$('#result').innerHTML=r.fields.map(f=>'<div><dt>'+esc(f.label)+'</dt><dd>'+esc(f.value)+'</dd></div>').join('');
  $('#note').textContent=r.note||'';$('#note').hidden=!r.note;$('#time').textContent='Dữ liệu cập nhật: '+stamp(r.synced_at||r.updated_at);
  $('#resultPanel').hidden=false;status('Tra cứu thành công.');
 });};
}
busy(null,init);
