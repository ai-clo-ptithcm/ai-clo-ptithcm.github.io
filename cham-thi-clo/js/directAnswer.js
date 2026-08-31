function normalizeCode(value){
  const raw=String(value??'').replace(/\s+/g,'');
  if(!raw) return '';
  return /^\d+$/.test(raw)?raw.padStart(3,'0'):raw.toUpperCase();
}

function splitTokens(text){
  return String(text??'')
    .replace(/[\r\n\t,;|]+/g,' ')
    .split(/\s+/)
    .map(x=>x.trim())
    .filter(Boolean);
}

function normalizeAnswers(tokens){
  return tokens.map(x=>String(x??'').replace(/\s+/g,'').toUpperCase()).filter(Boolean);
}

function normalizeClo(value){
  const raw=String(value??'').replace(/\s+/g,'').toUpperCase();
  if(/^[123]$/.test(raw)) return `CLO${raw}`;
  const m=raw.match(/^CLO([123])$/);
  return m?`CLO${m[1]}`:raw;
}

export function createDirectAnswerStore(){ return {exams:{}}; }

function ensureExam(store,code){
  const key=normalizeCode(code);
  if(!key) throw new Error('Vui lòng nhập mã đề.');
  if(!store.exams[key]) store.exams[key]={answers:[],clos:[]};
  return {key,exam:store.exams[key]};
}

export function appendDirectChunk(store,code,answerText,cloText){
  const {key,exam}=ensureExam(store,code);
  const answers=normalizeAnswers(splitTokens(answerText));
  const clos=splitTokens(cloText);
  if(!answers.length && !clos.length) throw new Error('Chưa có dữ liệu để thêm.');
  if(answers.length && clos.length && answers.length!==clos.length){
    throw new Error(`Đoạn vừa dán có ${answers.length} đáp án nhưng ${clos.length} CLO.`);
  }
  answers.forEach(a=>{if(!['A','B','C','D'].includes(a)) throw new Error(`Đáp án “${a}” không hợp lệ. Chỉ dùng A, B, C, D.`)});
  if(answers.length) exam.answers.push(...answers);
  if(clos.length) exam.clos.push(...clos);
  return {code:key,answerCount:exam.answers.length,cloCount:exam.clos.length};
}

export function replaceDirectExam(store,code,answers,clos){
  const key=normalizeCode(code);
  if(!key) throw new Error('Mã đề không hợp lệ.');
  const ans=normalizeAnswers(Array.isArray(answers)?answers:splitTokens(answers));
  const cls=(Array.isArray(clos)?clos:splitTokens(clos)).map(normalizeClo);
  ans.forEach(a=>{if(!['A','B','C','D'].includes(a)) throw new Error(`Đáp án “${a}” không hợp lệ.`)});
  store.exams[key]={answers:ans,clos:cls};
}

export function renameDirectExam(store,oldCode,newCode){
  const oldKey=normalizeCode(oldCode), newKey=normalizeCode(newCode);
  if(!oldKey||!store.exams[oldKey]) throw new Error('Không tìm thấy mã đề cần đổi.');
  if(!newKey) throw new Error('Mã đề mới không hợp lệ.');
  if(newKey!==oldKey && store.exams[newKey]) throw new Error(`Mã đề ${newKey} đã tồn tại.`);
  if(newKey===oldKey) return newKey;
  store.exams[newKey]=store.exams[oldKey]; delete store.exams[oldKey]; return newKey;
}

export function deleteDirectExam(store,code){ delete store.exams[normalizeCode(code)]; }

export function parseHorizontalPaste(store,text){
  const lines=String(text??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length) throw new Error('Chưa có bảng để dán.');
  const rows=lines.map(line=>line.split(/\t+/).length>1?line.split(/\t+/).map(x=>x.trim()):splitTokens(line));
  let start=0;
  if(String(rows[0]?.[0]??'').toLowerCase()==='câu') start=1;
  let added=0;
  for(let r=start;r<rows.length;r++){
    const first=String(rows[r]?.[0]??'').trim();
    if(!first) continue;
    if(first.toUpperCase()==='CLO') continue;
    const code=normalizeCode(first);
    const answers=normalizeAnswers(rows[r].slice(1));
    if(!answers.length) continue;
    answers.forEach(a=>{if(!['A','B','C','D'].includes(a)) throw new Error(`Mã đề ${code} có đáp án “${a}” không hợp lệ.`)});
    const next=rows[r+1]||[];
    const hasClo=String(next[0]??'').trim().toUpperCase()==='CLO';
    const clos=hasClo?next.slice(1).map(normalizeClo):[];
    if(hasClo && clos.length!==answers.length) throw new Error(`Mã đề ${code}: ${answers.length} đáp án nhưng ${clos.length} CLO.`);
    store.exams[code]={answers,clos}; added++;
    if(hasClo) r++;
  }
  if(!added) throw new Error('Không nhận ra mã đề nào trong bảng đã dán.');
  return added;
}

function rebuildExam(answers,clos){
  const exam={totalQuestion:answers.length,cloCount:{},questions:{}};
  for(let i=0;i<answers.length;i++){
    const clo=normalizeClo(clos[i]);
    if(clo) exam.cloCount[clo]=(exam.cloCount[clo]||0)+1;
    exam.questions[i+1]={answer:String(answers[i]).toUpperCase(),clo};
  }
  return exam;
}

export function buildAnswerDataFromDirect(store){
  const codes=Object.keys(store.exams);
  if(!codes.length) throw new Error('Chưa nhập đáp án trực tiếp.');
  const lengths=codes.map(c=>store.exams[c].answers.length);
  if(lengths.some(n=>!n)) throw new Error('Có mã đề chưa có đáp án.');
  if(new Set(lengths).size>1) throw new Error('Số câu giữa các mã đề nhập trực tiếp chưa bằng nhau.');
  const totalQuestion=lengths[0];
  let useCLO=false;
  for(const code of codes){
    const e=store.exams[code];
    e.answers.forEach((a,i)=>{if(!['A','B','C','D'].includes(String(a).replace(/\s+/g,'').toUpperCase())) throw new Error(`Mã đề ${code}, câu ${i+1}: đáp án không hợp lệ.`)});
    if(e.clos.some(x=>String(x??'').trim())) useCLO=true;
  }
  if(useCLO){
    for(const code of codes){
      const e=store.exams[code];
      if(e.clos.length!==totalQuestion) throw new Error(`Mã đề ${code}: có ${totalQuestion} đáp án nhưng ${e.clos.length} CLO.`);
      const normalized=e.clos.map(normalizeClo); e.clos=normalized;
      const missing=normalized.map((x,i)=>x?null:i+1).filter(Boolean);
      if(missing.length) throw new Error(`Mã đề ${code} thiếu CLO ở câu ${missing.join(', ')}.`);
      const invalid=normalized.map((x,i)=>['CLO1','CLO2','CLO3'].includes(x)?null:{q:i+1,value:x}).filter(Boolean);
      if(invalid.length) throw new Error(`Mã đề ${code}, câu ${invalid[0].q}: CLO “${invalid[0].value}” không hợp lệ. Chỉ dùng CLO1, CLO2, CLO3.`);
    }
  }
  const exams={}; codes.forEach(c=>exams[c]=rebuildExam(store.exams[c].answers,store.exams[c].clos));
  return {sheetName:'Nhập trực tiếp',layout:'manual',totalQuestion,useCLO,exams,sourceLabel:'Nhập/dán trực tiếp trên web'};
}

export function directStoreSummary(store){
  return Object.entries(store.exams).map(([code,e])=>({code,answers:e.answers.length,clos:e.clos.length}));
}

export function storeFromAnswerData(answerData){
  const store=createDirectAnswerStore();
  for(const [code,exam] of Object.entries(answerData?.exams||{})){
    const answers=[],clos=[];
    for(let q=1;q<=Number(answerData.totalQuestion||0);q++){
      answers.push(String(exam.questions?.[q]?.answer??''));
      clos.push(String(exam.questions?.[q]?.clo??''));
    }
    store.exams[code]={answers,clos};
  }
  return store;
}
