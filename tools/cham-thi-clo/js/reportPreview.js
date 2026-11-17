// BM33 preview owns only the report dialog. Grading/export remain in their original modules.
import { orderedCloList, cloDisplayName } from './exportCommon.js';

const NOTE_FIELDS = [
  ['statistics','1. Nhận xét về thống kê điểm thi'],
  ['distribution','2.1. Nhận xét về phân bố điểm thi'],
  ['difficulty','Độ khó và độ phân hóa'],
  ['clo','Mức độ đạt các CLO'],
  ['alignment','Mức độ phù hợp với đề cương'],
  ['coverage','Tính bao quát và phân hóa'],
  ['incidents','Tình huống trong thi/chấm thi (giảng viên nhập)'],
  ['bank','Cải tiến ngân hàng đề'],
  ['teaching','Cải tiến giảng dạy'],
  ['curriculum','Cải tiến chương trình đào tạo']
];
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
const round = (v,n=1) => v == null ? null : Number(v.toFixed(n));
const pct = v => v == null ? '—' : (v*100).toFixed(1) + '%';
const $ = id => document.getElementById(id);
const td = (text, tag='td') => { const el=document.createElement(tag); el.textContent=String(text??'—'); return el };
const clear = node => node.replaceChildren();
function row(node,values){const tr=document.createElement('tr');values.forEach(x=>tr.append(td(x)));node.append(tr)}
function bandName(i){return ['<4','4–<5','5–<7','7–<8','8–<9','9–10'][i]}
function bandOf(v){return v<4?0:v<5?1:v<7?2:v<8?3:v<9?4:5}
function sortQuestions(a,b){return a.rate-b.rate || a.code.localeCompare(b.code) || a.question-b.question}

// Question discrimination is calculated separately for each version of the exam:
// upper 27% correct rate minus lower 27% correct rate, when the cohort is large enough.
export function summarizeBm33(answerData,rooms,passScore=4,target=70){
  const students=rooms.flatMap(r=>(r.untData.students||[]).filter(s=>s.result&&!s.result.error));
  const grades=students.map(s=>num(s.result.marks?.GPA));
  const bands=[0,0,0,0,0,0];grades.forEach(g=>bands[bandOf(g)]++);
  const rawClos=answerData.useCLO?orderedCloList(answerData):[];
  const clos=rawClos.map((raw,i)=>{
    const scores=students.map(s=>s.result.marks?.[raw]).filter(Number.isFinite).map(Number);
    return {raw,label:cloDisplayName(raw,i),count:scores.length,avg:round(mean(scores),2),
      passed:scores.filter(x=>x>=passScore).length,passRate:scores.length?scores.filter(x=>x>=passScore).length/scores.length:null};
  });
  const byCode=new Map();
  students.forEach(s=>{const code=String(s.examCode);if(!byCode.has(code))byCode.set(code,[]);byCode.get(code).push(s)});
  const items=[];
  for(const [code,group] of byCode){
    const exam=answerData.exams?.[code];if(!exam)continue;
    const rank=[...group].sort((a,b)=>num(a.result.marks?.GPA)-num(b.result.marks?.GPA));
    const n=Math.floor(rank.length*.27);
    const enough=rank.length>=12 && n>=3;
    for(let q=1;q<=num(exam.totalQuestion);q++){
      const key=exam.questions?.[q];
      if(!key)continue;
      const correct=s=>Boolean(s.result.questionDetail?.[q-1]?.correct);
      const count=group.filter(correct).length;
      const discrimination=enough?mean(rank.slice(-n).map(s=>correct(s)?1:0))-mean(rank.slice(0,n).map(s=>correct(s)?1:0)):null;
      items.push({code,question:q,clo:String(key.clo||'—'),responses:group.length,
        correct:count,rate:group.length?count/group.length:0,discrimination:round(discrimination,3)});
    }
  }
  const itemsByClo=clos.map(c=>{
    const relevant=items.filter(q=>q.clo===c.raw),valid=relevant.filter(q=>q.discrimination!=null);
    const attempts=relevant.reduce((a,q)=>a+q.responses,0);
    return {raw:c.raw,label:c.label,rate:attempts?relevant.reduce((a,q)=>a+q.correct,0)/attempts:null,
      discrimination:round(mean(valid.map(q=>q.discrimination)),3),questionCount:relevant.length};
  });
  return {
    overview:{students:students.length,rooms:rooms.length,average:round(mean(grades),2),
      minimum:grades.length?Math.min(...grades):null,maximum:grades.length?Math.max(...grades):null,
      passed:grades.filter(g=>g>=passScore).length,passRate:grades.length?grades.filter(g=>g>=passScore).length/grades.length:null},
    bands:bands.map((count,i)=>({label:bandName(i),count,rate:grades.length?count/grades.length:0})),
    clos,items,itemsByClo,passScore,target
  };
}
function renderStats(stats){
  $('bm33Summary').textContent='Số bài: '+stats.overview.students+' · Điểm TB: '+(stats.overview.average??'—')+
    ' · Cao nhất: '+(stats.overview.maximum??'—')+' · Thấp nhất: '+(stats.overview.minimum??'—')+
    ' · Tỷ lệ đạt: '+pct(stats.overview.passRate);
  const b=$('bm33Bands');clear(b);
  stats.bands.forEach(x=>row(b,[x.label,x.count,pct(x.rate)]));
  const c=$('bm33Clo');clear(c);
  stats.clos.forEach(x=>row(c,[x.label,x.avg??'—',pct(x.passRate),
    x.passRate==null?'Không đủ dữ liệu':x.passRate*100>=stats.target?'Đạt':'Chưa đạt']));
  if(!stats.clos.length)row(c,['Không có CLO','—','—','—']);
  const q=$('bm33Questions');clear(q);
  stats.items.slice().sort(sortQuestions).slice(0,25).forEach(x=>
    row(q,[x.code+' / '+x.question,x.clo,pct(x.rate),x.discrimination==null?'Chưa đủ mẫu':x.discrimination]));
  if(!stats.items.length)row(q,['Không có câu hỏi','—','—','—']);
  $('bm33QuestionCount').textContent='Hiển thị 25 câu có tỷ lệ đúng thấp nhất (nếu có); xuất Excel chứa toàn bộ '+stats.items.length+' nhóm câu theo mã đề.';
}
function renderWeights(stats){
  const box=$('bm33Weights');clear(box);
  const fields=[...stats.clos.map(c=>({key:c.raw,label:c.label})),{key:'GPA',label:'GPA'}];
  fields.forEach(field=>{
    const label=document.createElement('label');label.textContent=field.label+' (%)';
    const input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='0.1';
    input.dataset.weightKey=field.key;input.placeholder='Để trống nếu chưa có';
    label.append(input);box.append(label);
  });
}
function getWeights(){
  const out=Object.create(null);
  for(const input of $('bm33Weights').querySelectorAll('input')){
    if(input.value.trim()==='')continue;
    const n=Number(input.value);
    if(!Number.isFinite(n)||n<0||n>100)throw new Error('Tỷ trọng CLO/GPA phải nằm trong khoảng 0–100%.');
    out[input.dataset.weightKey]=n;
  }
  return out;
}
function getNotes(){return Object.fromEntries(NOTE_FIELDS.map(([key])=>[key,$('bm33Note-'+key).value.trim()]))}
function getMetadata(){return Object.fromEntries(['courseName','courseCode','credits','semester','teacher','department']
  .map(k=>[k,$('bm33Meta-'+k).value.trim()]))}
function setNote(key,value){const el=$('bm33Note-'+key);if(el && typeof value==='string' && value.trim())el.value=value.trim()}
function noteUI(){
  const wrap=$('bm33Notes');if(wrap.children.length)return;
  NOTE_FIELDS.forEach(([key,title])=>{
    const label=document.createElement('label');label.className='bm33-note-field';
    const name=document.createElement('span');name.textContent=title;
    const textarea=document.createElement('textarea');textarea.id='bm33Note-'+key;
    textarea.rows=3;textarea.maxLength=1800;textarea.placeholder=key==='incidents'?
      'Chỉ giảng viên ghi nhận sự cố thực tế (nếu có)':'Có thể sửa nhận xét hoặc yêu cầu AI gợi ý';
    label.append(name,textarea);
    const host=key==='statistics' ? $('bm33NoteStatisticsHost') :
      key==='distribution' ? $('bm33NoteDistributionHost') : wrap;
    host.append(label);
  });
}
function safeStatsForAi(stats){
  return {
    total_students:stats.overview.students, average:stats.overview.average,
    highest:stats.overview.maximum,lowest:stats.overview.minimum,
    pass_rate:round(stats.overview.passRate,3),pass_score:stats.passScore,
    required_clo_attainment_percent:stats.target,
    bands:stats.bands, clos:stats.clos.map(c=>({label:c.label,count:c.count,avg:c.avg,pass_rate:round(c.passRate,3)})),
    question_summary:stats.itemsByClo,
    hardest_items:stats.items.slice().sort(sortQuestions).slice(0,20).map(q=>({
      code:q.code,question:q.question,clo:q.clo,responses:q.responses,
      correct_rate:round(q.rate,3),discrimination:q.discrimination
    }))
  };
}
async function aiAnalyze(stats){
  const status=$('bm33AiStatus'),btn=$('bm33AiAnalyze');
  if(!window.supabase?.createClient || !window.AICLO_CONFIG?.SUPABASE_URL){
    status.textContent='Chưa tải thư viện xác thực. Có thể tiếp tục xuất báo cáo không dùng AI.';return;
  }
  btn.disabled=true;status.textContent='Đang kiểm tra tài khoản giảng viên…';
  try{
    const conf=window.AICLO_CONFIG;
    const client=window.supabase.createClient(conf.SUPABASE_URL,conf.SUPABASE_PUBLISHABLE_KEY);
    const {data:{session},error:authError}=await client.auth.getSession();
    if(authError)throw authError;
    if(!session?.access_token){status.textContent='Cần đăng nhập tài khoản giảng viên tại Hệ thống trước khi dùng AI. Bảng điểm và xuất Excel vẫn hoạt động không cần đăng nhập.';return}
    status.textContent='Đang gửi thống kê ẩn danh đến AI. Không gửi SBD hoặc câu trả lời từng sinh viên.';
    const {data,error}=await client.functions.invoke('bm33-ai',{
      body:{summary:safeStatsForAi(stats),context:$('bm33CourseContext').value.trim().slice(0,2000)}
    });
    if(error)throw new Error(data?.error||error.message||'Không thể gọi AI.');
    if(!data?.success || !data?.analysis)throw new Error(data?.error||'AI chưa trả về nhận xét hợp lệ.');
    for(const [key] of NOTE_FIELDS){if(key!=='incidents')setNote(key,data.analysis[key]);}
    status.textContent='Đã tạo gợi ý AI. Kiểm tra và chỉnh sửa trước khi xuất. Mô hình: '+(data.model||'AI')+'.';
  }catch(err){status.textContent='AI chưa hoàn tất: '+(err.message||err)+'. Có thể nhập nhận xét và xuất Excel bình thường.'}
  finally{btn.disabled=false}
}
export function openReportPreview({answerData,rooms,onExport,onLog}){
  const dialog=$('reportPreviewDialog');if(!dialog)throw new Error('Không tìm thấy cửa sổ BM33.');
  noteUI();
  // Each opening starts from the newest graded result; no stale AI output is silently reused.
  NOTE_FIELDS.forEach(([key])=>{$('bm33Note-'+key).value=''});
  const passScore=4,target=70;
  const stats=summarizeBm33(answerData,rooms,passScore,target);
  renderStats(stats);renderWeights(stats);$('bm33AiStatus').textContent='AI chỉ phân tích khi giảng viên bấm nút. Báo cáo đã có thống kê ngay cả khi không dùng AI.';
  $('bm33AiAnalyze').onclick=()=>aiAnalyze(stats);
  $('bm33Close').onclick=()=>dialog.close();
  $('bm33Download').onclick=async()=>{
    const button=$('bm33Download');button.disabled=true;
    try{await onExport({metadata:getMetadata(),notes:getNotes(),weights:getWeights(),stats});
      onLog?.('Đã xuất BM33 từ cửa sổ xem trước.');dialog.close();
    }catch(e){$('bm33AiStatus').textContent='Lỗi xuất Excel: '+e.message;onLog?.(e.message,'error')}
    finally{button.disabled=false}
  };
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('.bm33-dialog-body')?.focus();
}
