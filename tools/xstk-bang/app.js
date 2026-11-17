/* AI-CLO authorized, one-time XSTK tabular question normalization.
   Writes through update_question_with_options (auth.uid() and revision safeguards). */
(()=>{
'use strict';
const BANK_ID='ca9cd78a-7ceb-44ec-a2d3-695f00e9e549';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db,changes=[],running=false;
function status(s,kind=''){const el=$('#status');el.className=kind;el.textContent=s;}
function texCell(value){
 const v=String(value||'').trim();
 if(v==='X / Y')return 'X\\backslash Y';
 if(v==='Giá trị X'||v==='Giá trị')return 'x_i';
 if(v==='Trung điểm')return 'm_i';
 if(v==='Khoảng lớp')return '\\text{Khoảng lớp}';
 if(v==='Tần số')return 'n_i';
 if(v==='P(X = x)')return 'P(X=x_i)';
 if(v==='Nhóm')return 'i';
 if(/^Cột \d+$/.test(v))return 'y_{'+v.split(' ')[1]+'}';
 if(/^-?\d+(?:[.,]\d+)?$/.test(v))return v.replace(',', '{,}');
 return '\\text{'+v.replaceAll('\\','').replaceAll('{','\\{').replaceAll('}','\\}')+'}';
}
function asLatex(question){
 const html=window.AICLO_QUESTION_TABLES?.convertQuestionTable(question.content);
 if(!html)return null;
 const tmp=document.createElement('div');tmp.innerHTML=html;
 const table=tmp.querySelector('table');
 if(!table)return null;
 const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
 const body=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(cell=>cell.textContent.trim()));
 if(headers.length<3||headers.length>12||!body.length||body.some(r=>r.length!==headers.length))return null;
 const rows=[headers,...body].map(row=>row.map(texCell).join(' & ')+' \\\\ \\hline').join('\n');
 const latex='$\\displaystyle\\begin{array}{|'+Array(headers.length).fill('c').join('|')+'|}\\hline\n'+rows+'\n\\end{array}$';
 let pre='Cho bảng số liệu sau:';
 const original=question.content.toLowerCase();
 if(/phân bố đồng thời|xác suất đồng thời/.test(original)||/p\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test(original))pre='Cho bảng phân bố xác suất đồng thời của $(X,Y)$:';
 else if(/bảng phân bố/.test(original))pre='Cho biến ngẫu nhiên $X$ có bảng phân bố xác suất sau:';
 else if(/ghép lớp|khoảng/.test(original))pre='Cho bảng tần số ghép lớp của mẫu:';
 else if(/tần số|trung điểm|giá trị đại diện/.test(original))pre='Cho bảng số liệu của mẫu:';
 const tail=tmp.querySelector('.aiclo-table-after')?.textContent.trim()||'';
 if(!tail)return null;
 const content=pre+'\n\n'+latex+'\n\n'+tail;
 if(content===question.content)return null;
 return content;
}
function itemCard(x){
 return '<div class="card"><strong>Câu '+esc(x.display_code||x.id.slice(0,8))+'</strong> <span class="badge">Có bảng</span>'+
 '<details><summary>Xem nội dung cũ và nội dung mới</summary><small>Trước</small><pre>'+esc(x.content)+'</pre><small>Sau (LaTeX)</small><pre>'+esc(x.new_content)+'</pre></details></div>';
}
function logLine(message,isError=false){
 const line=document.createElement('p');line.style.margin='7px 0';if(isError)line.style.color='#b02d38';
 line.textContent=message;$('#log').appendChild(line);
}
async function scan(){
 $('#scan').disabled=true;$('#apply').disabled=true;status('Đang đọc và kiểm tra ngân hàng câu hỏi…');
 try{
  const {data,error}=await db.from('questions')
    .select('id,display_code,content,explanation,correct_answer,chapter_id,topic_id,clo_id,question_scope,approval_status,updated_at')
    .eq('question_bank_id',BANK_ID).order('display_code').limit(1000);
  if(error)throw error;
  changes=(data||[]).map(q=>({...q,new_content:asLatex(q)})).filter(q=>q.new_content);
  $('#preview').classList.remove('hidden');
  $('#count').textContent='Đã xem '+(data||[]).length+' câu. Có '+changes.length+' câu đủ dữ liệu để chuyển thành bảng mà không thay đổi đáp án.';
  $('#items').innerHTML=changes.map(itemCard).join('')||'<p>Không có câu cần chuyển đổi.</p>';
  $('#apply').disabled=changes.length===0;
  status('Đã rà soát xong. Xem trước rồi chọn Áp dụng để lưu vào Supabase.','success');
 }catch(e){status('Không đọc được dữ liệu: '+(e.message||e),'error');}
 finally{$('#scan').disabled=false;}
}
async function apply(){
 if(running||!changes.length)return;
 if(!confirm('Cập nhật '+changes.length+' câu hỏi Xác suất thống kê qua tài khoản Admin? Lịch sử phiên bản cũ sẽ được lưu.'))return;
 running=true;$('#scan').disabled=true;$('#apply').disabled=true;$('#results').classList.remove('hidden');$('#log').textContent='';
 let ok=0,fail=0,skip=0;
 for(let i=0;i<changes.length;i++){
  const q=changes[i];status('Đang cập nhật '+(i+1)+'/'+changes.length+' (thành công '+ok+', lỗi '+fail+')…');
  try{
   const latest=await db.from('questions').select('content,updated_at').eq('id',q.id).single();
   if(latest.error)throw latest.error;
   if(latest.data.content!==q.content||latest.data.updated_at!==q.updated_at){skip++;logLine('Bỏ qua câu '+q.display_code+' vì đã có thay đổi sau khi rà soát.');continue;}
   const options=await db.from('question_options').select('option_key,content').eq('question_id',q.id);
   if(options.error)throw options.error;
   const o=Object.fromEntries((options.data||[]).map(x=>[x.option_key,x.content]));
   if(Object.keys(o).length!==4||['A','B','C','D'].some(k=>!o[k]))throw Error('Không đủ bốn phương án trả lời.');
   const args={
    p_question_id:q.id,p_content:q.new_content,p_explanation:q.explanation||'',
    p_correct_answer:String(q.correct_answer||'').trim(),
    p_chapter_id:q.chapter_id,p_topic_id:q.topic_id,p_clo_id:q.clo_id,
    p_question_scope:q.question_scope,p_approval_status:q.approval_status,p_options:o
   };
   const change=await db.rpc('update_question_with_options',args);
   if(change.error)throw change.error;
   const verified=await db.from('questions').select('content').eq('id',q.id).single();
   if(verified.error||verified.data?.content!==q.new_content)throw Error('Không xác minh được nội dung sau lưu.');
   ok++;logLine('Đã cập nhật và xác minh câu '+q.display_code+'.');
  }catch(e){fail++;logLine('Lỗi câu '+q.display_code+': '+(e.message||e),true);}
 }
 running=false;$('#scan').disabled=false;
 changes=[];$('#apply').disabled=true;
 status('Hoàn tất: '+ok+' câu thành công, '+skip+' câu bỏ qua, '+fail+' câu lỗi. Rà soát lại để xem trạng thái hiện tại.',fail?'error':'success');
}
async function init(){
 try{
  const c=window.AICLO_CONFIG;
  if(!window.supabase||!c?.SUPABASE_URL||!c?.SUPABASE_PUBLISHABLE_KEY||!window.AICLO_QUESTION_TABLES)throw Error('Không tải đủ thư viện.');
  db=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_PUBLISHABLE_KEY);
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user)throw Error('Bạn cần đăng nhập ứng dụng AI-CLO bằng tài khoản Admin trước.');
  const profile=await db.from('profiles').select('role').eq('id',user.id).single();
  if(profile.error||profile.data?.role!=='admin')throw Error('Phiên hiện tại không có quyền Admin. Không thực hiện cập nhật.');
  status('Đã xác minh phiên Admin. Có thể rà soát các câu hỏi.','success');
  $('#scan').disabled=false;$('#scan').onclick=scan;$('#apply').onclick=apply;
 }catch(e){status(e.message||String(e),'error');}
}
document.addEventListener('DOMContentLoaded',init,{once:true});
})();
