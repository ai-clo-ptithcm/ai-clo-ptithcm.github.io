/* AI-CLO PTITHCM V10.10 — hồ sơ học tập trong trang và đồ thị tiến bộ. */
(() => {
'use strict';
const api=window.AICLO_ASSESSMENT;if(!api)return;
const n=v=>Number(v||0),score=(a,b)=>b?a*10/b:0;
const date=v=>v?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const mapBy=(rows,key)=>new Map(rows.map(x=>[x[key],x]));
const profileCache=new Map();

async function loadProfileData(student){
 const cacheKey=`${state.subjectId}:${student.id}`;
 const exams=await q('exams','id,title,allow_ai_feedback',x=>x.eq('subject_id',state.subjectId)),examIds=exams.map(x=>x.id);
 const attempts=examIds.length?await q('exam_attempts','id,exam_id,student_id,attempt_number,score,started_at,submitted_at',x=>x.eq('student_id',student.id).in('exam_id',examIds).not('submitted_at','is',null).order('submitted_at')):[];
 const attemptIds=attempts.map(x=>x.id),[snapshots,answers,chapters,clos]=await Promise.all([
  attemptIds.length?q('attempt_questions','attempt_id,question_id,clo_code,chapter_name,topic_name',x=>x.in('attempt_id',attemptIds)):[],
  attemptIds.length?q('student_answers','attempt_id,question_id,is_correct',x=>x.in('attempt_id',attemptIds)):[],
  q('chapters','id,name,order_index',x=>x.eq('subject_id',state.subjectId).order('order_index')),
  q('clos','id,code',x=>x.eq('subject_id',state.subjectId).order('code'))
 ]);
 let feedback=[];try{feedback=await q('assessment_ai_feedback','analysis,generated_at',x=>x.eq('scope','student').eq('student_id',student.id).order('generated_at',{ascending:false}).limit(1))}catch{}
 const data={student,exams,attempts,snapshots,answers,chapters,clos,feedback:feedback[0]};profileCache.set(cacheKey,data);return data;
}

function aggregate(data,attemptIds,key){
 const ids=new Set(attemptIds),meta=new Map(data.snapshots.map(x=>[`${x.attempt_id}|${x.question_id}`,x])),out=new Map();
 for(const a of data.answers){if(!ids.has(a.attempt_id))continue;const s=meta.get(`${a.attempt_id}|${a.question_id}`),label=s?.[key];if(!label)continue;const x=out.get(label)||{correct:0,total:0};x.total++;if(a.is_correct)x.correct++;out.set(label,x)}return out;
}
function attemptClo(data,attemptId){return aggregate(data,[attemptId],'clo_code')}
function svgLine(data){
 const rows=data.attempts,clos=data.clos.map(x=>x.code),series=[{name:'Điểm',color:'#b51d31',values:rows.map(x=>n(x.score))},...clos.map((code,i)=>({name:code,color:['#2867b2','#138466','#7b4bc4','#d17822'][i%4],values:rows.map(a=>{const x=attemptClo(data,a.id).get(code);return x?score(x.correct,x.total):null})}))];
 if(!rows.length)return '<div class="profile-chart-empty">Chưa có lượt làm để vẽ đồ thị.</div>';
 const w=760,h=260,p=38,x=i=>rows.length===1?w/2:p+i*(w-2*p)/(rows.length-1),y=v=>h-p-v*(h-2*p)/10;
 const grid=[0,2,4,6,8,10].map(v=>`<line x1="${p}" y1="${y(v)}" x2="${w-p}" y2="${y(v)}"/><text x="8" y="${y(v)+4}">${v}</text>`).join('');
 const paths=series.map(s=>{const chunks=[];let current=[];s.values.forEach((v,i)=>{if(v==null){if(current.length)chunks.push(current);current=[]}else current.push([x(i),y(v)])});if(current.length)chunks.push(current);return chunks.map(points=>`<polyline style="--chart-color:${s.color}" points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('')+s.values.map((v,i)=>v==null?'':`<circle style="--chart-color:${s.color}" cx="${x(i)}" cy="${y(v)}" r="4"><title>${s.name}: ${v.toFixed(2)}</title></circle>`).join('')}).join('');
 return `<div class="profile-chart-legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div><div class="profile-svg-scroll"><svg class="profile-line-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tiến bộ điểm và CLO"><g class="grid">${grid}</g><g class="series">${paths}</g>${rows.map((a,i)=>`<text class="x-label" x="${x(i)}" y="${h-8}">L${i+1}</text>`).join('')}</svg></div>`;
}
function bars(items,kind){
 if(!items.length)return '<div class="profile-chart-empty">Chưa có dữ liệu.</div>';
 return `<div class="profile-bars">${items.map(([label,x])=>{const value=score(x.correct,x.total);return `<div class="profile-bar-row"><span title="${esc(label)}">${esc(label)}</span><div><i style="width:${value*10}%"></i></div><b>${value.toFixed(2)}</b><small>${x.correct}/${x.total}</small></div>`}).join('')}</div><p class="profile-chart-note">${kind==='clo'?'Điểm quy đổi theo từng chuẩn đầu ra':'Kết quả tổng hợp theo chương'} · thang 10</p>`;
}
function aiHtml(value){
 const a=value?.analysis;if(!a)return '<p class="hint">Chưa có nhận xét AI tổng hợp cho sinh viên này.</p>';
 if(typeof a==='string')return `<p>${esc(a)}</p>`;
 const list=(title,items)=>items?.length?`<div><b>${title}</b><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
 return `<p>${esc(a.summary||a.overview||'Đã có nhận xét AI.')}</p>${list('Điểm mạnh',a.strengths)}${list('Cần cải thiện',a.needs_improvement||a.weaknesses)}${list('Gợi ý tiếp theo',a.next_actions||a.recommendations)}<small>Cập nhật ${date(value.generated_at)}</small>`;
}
async function renderProfile(student,{back=true,teacher=false}={}){
 const c=$('#content');c.innerHTML='<div class="panel">Đang mở hồ sơ học tập…</div>';
 try{
  const data=await loadProfileData(student),ids=data.attempts.map(x=>x.id),clo=aggregate(data,ids,'clo_code'),chapter=aggregate(data,ids,'chapter_name'),avg=data.attempts.length?data.attempts.reduce((s,x)=>s+n(x.score),0)/data.attempts.length:null,exams=mapBy(data.exams,'id');
  $('#pageTitle').textContent=teacher?`Hồ sơ · ${student.full_name}`:'Tiến độ học tập của tôi';$('#pageSub').textContent='Kết quả, tiến bộ CLO và lịch sử bài kiểm tra trong học phần';
  c.innerHTML=`<div class="academic-profile-page">${back?'<button id="academicProfileBack" class="secondary academic-profile-back">← Danh sách thành viên</button>':''}<section class="academic-profile-hero"><div class="avatar">${esc((student.full_name||'?')[0].toUpperCase())}</div><div><small>HỒ SƠ HỌC TẬP</small><h3>${esc(student.full_name||'Sinh viên')}</h3><p>${esc(student.mssv||'')}${student.email?` · ${esc(student.email)}`:''}</p></div>${teacher?`<button id="academicProfileAi" class="ai-btn" ${data.attempts.length?'':'disabled'}>✦ AI nhận xét sinh viên</button>`:''}</section><div class="assessment-summary academic-profile-summary"><div><small>Lượt đã nộp</small><b>${data.attempts.length}</b></div><div><small>Điểm trung bình</small><b>${avg==null?'—':avg.toFixed(2)}</b></div><div><small>Bài đã làm</small><b>${new Set(data.attempts.map(x=>x.exam_id)).size}</b></div><div><small>CLO đang theo dõi</small><b>${clo.size}</b></div></div><section class="panel academic-chart wide-chart"><div class="panel-head"><div><h3>Tiến bộ qua các lượt làm</h3><p class="hint">Đường điểm tổng và điểm từng CLO theo thời gian.</p></div></div>${svgLine(data)}</section><div class="academic-chart-grid"><section class="panel academic-chart"><h3>Mức đạt theo CLO</h3>${bars([...clo.entries()],'clo')}</section><section class="panel academic-chart"><h3>Kết quả theo chương</h3>${bars([...chapter.entries()],'chapter')}</section></div><section class="panel"><div class="panel-head"><h3>Nhận xét AI gần nhất</h3></div><div id="academicAiBox" class="academic-ai-box">${aiHtml(data.feedback)}</div></section><section class="panel table-wrap"><div class="panel-head"><h3>Lịch sử bài kiểm tra</h3></div><table><thead><tr><th>Thời điểm</th><th>Bài</th><th>Lần</th><th>Điểm</th>${data.clos.map(x=>`<th>${esc(x.code)}</th>`).join('')}<th></th></tr></thead><tbody>${data.attempts.map(a=>{const ac=attemptClo(data,a.id);return `<tr><td>${date(a.submitted_at)}</td><td>${esc(exams.get(a.exam_id)?.title||'Bài kiểm tra')}</td><td>${a.attempt_number}</td><td><b>${n(a.score).toFixed(2)}</b></td>${data.clos.map(x=>{const v=ac.get(x.code);return `<td>${v?score(v.correct,v.total).toFixed(2):'—'}</td>`}).join('')}<td><button class="secondary" data-academic-attempt="${a.id}">Xem bài</button></td></tr>`}).join('')||`<tr><td class="empty" colspan="${data.clos.length+5}">Chưa có bài đã nộp.</td></tr>`}</tbody></table></section></div>`;
  $('#academicProfileBack')?.addEventListener('click',()=>render());
  $$('[data-academic-attempt]',c).forEach(b=>b.onclick=()=>api.openStudentAttemptResult(b.dataset.academicAttempt));
  $('#academicProfileAi')?.addEventListener('click',async()=>{const b=$('#academicProfileAi');b.disabled=true;b.textContent='✦ Đang phân tích…';try{const {data:r,error}=await db.functions.invoke('analyze-assessment',{body:{subject_id:state.subjectId,scope:'student',student_id:student.id}});if(error)throw error;profileCache.delete(`${state.subjectId}:${student.id}`);$('#academicAiBox').innerHTML=aiHtml({analysis:r.analysis,generated_at:new Date().toISOString()});b.textContent=r.cached?'✓ Nhận xét đã lưu':'✓ Đã nhận xét';toast(r.cached?'Đang dùng nhận xét AI đã lưu':'Gemini đã hoàn tất nhận xét')}catch(ex){b.disabled=false;b.textContent='✦ Thử lại AI';err(ex)}});
  window.scrollTo({top:0,behavior:'smooth'});
 }catch(ex){c.innerHTML='<div class="panel"><b>Không thể mở hồ sơ học tập</b></div>';err(ex)}
}

const baseResults=api.results;
api.results=async c=>{if(role()!=='student')return baseResults(c);return renderProfile({id:state.user.id,full_name:state.profile?.full_name||'Sinh viên',email:state.profile?.email||state.user?.email,mssv:state.profile?.mssv},{back:false,teacher:false})};
const baseClassList=api.teacherClassList;
api.teacherClassList=async c=>{await baseClassList(c);c.addEventListener('click',async e=>{const b=e.target.closest('[data-profile]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const p=await q('profiles','id,full_name,email,mssv,is_active',x=>x.eq('id',b.dataset.profile).limit(1));if(p[0])renderProfile(p[0],{back:true,teacher:true})},true)};
const baseRefresh=window.v95RefreshShell;
window.v95RefreshShell=function(){baseRefresh?.();if(role()==='student'&&state.space==='course'){const button=$('#nav [data-view="results"]');if(button){const label=button.querySelector('span:last-child');if(label)label.textContent='Tiến độ học tập'}if(state.view==='results'){const title=$('#pageTitle'),sub=$('#pageSub');if(title)title.textContent='Tiến độ học tập của tôi';if(sub)sub.textContent='Kết quả, tiến bộ CLO và lịch sử bài kiểm tra trong học phần'}}};
})();
