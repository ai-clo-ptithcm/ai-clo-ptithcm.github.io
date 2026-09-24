import { addQuestion } from '../../services/papers.js';
import { storageService } from '../../services/storage.js';
import { readFirstSheet,pick } from '../../services/spreadsheet.js';
import { loadUiState,saveUiState } from '../../state.js';
import { typesetMath } from '../../core/math.js';
import { escapeHtml,openModal,closeModal,toast,setBusy,errorMessage } from '../../core/ui.js';

const KEYS=['A','B','C','D'];
let jsZipLoader=null;

function normalizeClo(value){
  const raw=String(value??'').trim().toUpperCase();
  const m=raw.match(/CLO\s*[:=\-]?\s*(?:CLO\s*)?(\d+)/i);
  if(m)return `CLO${m[1]}`;
  return /^\d+$/.test(raw)?`CLO${Number(raw)}`:'';
}
function normalizeAnswer(value){
  const m=String(value||'').toUpperCase().match(/\b([A-D])\b/);
  return m?m[1]:'';
}
function normalizeQuestionNo(value){
  const m=String(value??'').match(/\d+/);
  return m?Number(m[0]):null;
}
function extractClo(text){
  const s=String(text||'');
  const patterns=[/\(\s*CLO\s*(\d+)\s*\)/i,/\[\s*CLO\s*(\d+)\s*\]/i,/\bCLO\s*[:=\-]?\s*(?:CLO\s*)?(\d+)\b/i];
  for(const p of patterns){const m=s.match(p);if(m)return `CLO${m[1]}`;}
  return '';
}
function stripClo(text){return String(text||'').replace(/^[ \t]*%[^\n]*\bCLO\s*[:=\-]?\s*(?:CLO\s*)?\d+[^\n]*\n?/gim,'').replace(/\(\s*CLO\s*\d+\s*\)/ig,'').replace(/\[\s*CLO\s*\d+\s*\]/ig,'').replace(/\bCLO\s*[:=\-]?\s*(?:CLO\s*)?\d+\b/ig,'').replace(/[ \t]+\n/g,'\n').trim();}
function textHtml(text){return escapeHtml(String(text||'')).replace(/\n/g,'<br>');}
function stripAnswerPrefix(text){return String(text||'').replace(/^\s*\\True\s*/,'').replace(/^\s*\*\s*/,'').trim();}
function uniqueMessages(items){return [...new Set((items||[]).filter(Boolean))];}

function bracedGroups(source,start){
  const groups=[];let i=start;
  while(i<source.length&&groups.length<4){while(i<source.length&&/\s/.test(source[i]))i++;if(source[i]!=='{')break;let depth=0,begin=i+1,escaped=false,end=-1;
    for(;i<source.length;i++){const ch=source[i];if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){end=i;break;}}}
    if(end<0)break;groups.push(source.slice(begin,end));i=end+1;
  }
  return groups;
}

export function parseTexQuestions(source){
  const text=String(source||'').replace(/\r\n?/g,'\n');
  const blocks=[];const re=/\\begin\{(question|ex)\}(?:\s*\[([^\]]+)\])?([\s\S]*?)\\end\{\1\}/gi;let m;
  while((m=re.exec(text))){blocks.push({option:m[2]||'',body:m[3]||'',sourceNo:blocks.length+1});}
  if(!blocks.length){
    const chunks=text.split(/(?=^\s*(?:Câu|Cau|Question)\s*\d+\s*[\.:)]?)/gim).filter(x=>/\\choice\b/.test(x));
    chunks.forEach((body,i)=>blocks.push({option:'',body,sourceNo:i+1}));
  }
  return blocks.map((b,index)=>{
    const choiceAt=b.body.search(/\\choice\b/i),reviewWarnings=[];let stem=b.body,choices=[],correct='';
    if(choiceAt>=0){stem=b.body.slice(0,choiceAt);const groups=bracedGroups(b.body,choiceAt+b.body.slice(choiceAt).match(/\\choice\b/i)[0].length);choices=groups.map((g,i)=>{if(/^\s*\\True\b/.test(g)||/^\s*\*/.test(g))correct=KEYS[i];return {key:KEYS[i],text:stripAnswerPrefix(g)};});}
    const noMatch=stem.match(/^\s*(?:Câu|Cau|Question)\s*(\d+)\s*[\.:)]?/i);
    const sourceNo=noMatch?Number(noMatch[1]):index+1;
    if(choices.length!==4)reviewWarnings.push(`Nhận được ${choices.length}/4 lựa chọn`);
    if(!correct)reviewWarnings.push('Chưa xác định đáp án đúng');
    const clo=normalizeClo(b.option)||extractClo(b.body);if(!clo)reviewWarnings.push('Chưa nhận CLO');
    stem=stripClo(stem).replace(/^\s*(?:Câu|Cau|Question)\s*\d+\s*[\.:)]?\s*/i,'').trim();
    return {sourceNo,body:stem,choices:KEYS.map(k=>choices.find(x=>x.key===k)||{key:k,text:''}),correct,clo,points:1,reviewWarnings,conflicts:[],format:'tex',answerSource:correct?'TeX':'',cloSource:clo?'TeX':''};
  });
}

async function ensureJSZip(){
  if(window.JSZip)return window.JSZip;
  if(!jsZipLoader)jsZipLoader=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=()=>resolve(window.JSZip);s.onerror=()=>reject(new Error('Không tải được bộ đọc DOCX.'));document.head.appendChild(s);});
  return jsZipLoader;
}
function xmlText(node){return [...node.getElementsByTagName('*')].filter(x=>x.localName==='t').map(x=>x.textContent||'').join('');}
function isRedWordColor(value){
  const v=String(value||'').replace('#','').trim();
  if(!/^[0-9a-f]{6}$/i.test(v))return false;
  const r=parseInt(v.slice(0,2),16),g=parseInt(v.slice(2,4),16),b=parseInt(v.slice(4,6),16);
  return r>=170&&g<=120&&b<=120&&r>=g+60&&r>=b+60;
}
function paragraphInfo(p){
  const runs=[...p.getElementsByTagName('*')].filter(x=>x.localName==='r');let text='',redChars=0,underlineChars=0,boldChars=0,totalChars=0;
  for(const r of runs){
    const rt=xmlText(r);if(!rt)continue;text+=rt;const n=rt.replace(/\s/g,'').length||rt.length;totalChars+=n;
    const props=[...r.children].find(x=>x.localName==='rPr');let red=false,underline=false,bold=false;
    if(props){for(const x of props.children){
      if(x.localName==='b'&&x.getAttribute('w:val')!=='0'&&x.getAttribute('val')!=='0')bold=true;
      if(x.localName==='u'){const v=x.getAttribute('w:val')||x.getAttribute('val')||'single';if(v!=='none'&&v!=='0')underline=true;}
      if(x.localName==='color'){const v=x.getAttribute('w:val')||x.getAttribute('val')||'';if(isRedWordColor(v))red=true;}
    }}
    if(red)redChars+=n;if(underline)underlineChars+=n;if(bold)boldChars+=n;
  }
  if(!text)text=xmlText(p);
  const hasWordMath=[...p.getElementsByTagName('*')].some(x=>x.localName==='oMath'||x.localName==='oMathPara');
  return {text:text.trim(),red:redChars>0,underline:underlineChars>0,bold:totalChars>0&&boldChars/totalChars>=0.55,hasWordMath};
}

function chooseMarkedAnswer(current,explicitAnswer){
  const red=current.choices.filter(x=>x.red).map(x=>x.key),under=current.choices.filter(x=>x.underline).map(x=>x.key),bold=current.choices.filter(x=>x.bold).map(x=>x.key);
  const markedSet=new Set([...red,...under]);
  if(explicitAnswer){
    if(markedSet.size&&(!markedSet.has(explicitAnswer)||markedSet.size>1))current.reviewWarnings.push(`Dòng đáp án (${explicitAnswer}) khác đánh dấu màu/gạch chân trong Word`);
    return {correct:explicitAnswer,source:'Word: dòng đáp án'};
  }
  if(red.length===1&&under.length===1&&red[0]!==under[0]){current.reviewWarnings.push(`Đánh dấu Word mâu thuẫn: tô đỏ ${red[0]}, gạch chân ${under[0]}`);return {correct:'',source:''};}
  if(red.length>1){current.reviewWarnings.push(`Có nhiều đáp án tô đỏ trong Word: ${red.join(', ')}`);return {correct:'',source:''};}
  if(under.length>1){current.reviewWarnings.push(`Có nhiều đáp án gạch chân trong Word: ${under.join(', ')}`);return {correct:'',source:''};}
  if(red.length===1)return {correct:red[0],source:'Word: tô đỏ'};
  if(under.length===1)return {correct:under[0],source:'Word: gạch chân'};
  if(bold.length===1)return {correct:bold[0],source:'Word: in đậm'};
  if(bold.length>1)current.reviewWarnings.push('Có nhiều lựa chọn in đậm; không dùng in đậm để suy ra đáp án');
  return {correct:'',source:''};
}

export async function parseDocxQuestions(file){
  const JSZip=await ensureJSZip(),zip=await JSZip.loadAsync(await file.arrayBuffer()),entry=zip.file('word/document.xml');if(!entry)throw new Error('DOCX không có word/document.xml.');
  const xml=await entry.async('text'),doc=new DOMParser().parseFromString(xml,'application/xml');
  const paragraphs=[...doc.getElementsByTagName('*')].filter(x=>x.localName==='p').map(paragraphInfo).filter(x=>x.text);
  const out=[];let current=null,lastChoice=null,explicitAnswer='';
  const finish=()=>{
    if(!current)return;
    const picked=chooseMarkedAnswer(current,explicitAnswer);current.correct=picked.correct;current.answerSource=picked.source;
    if(!current.correct)current.reviewWarnings.push('Chưa xác định đáp án đúng');
    if(!current.clo)current.reviewWarnings.push('Chưa nhận CLO');
    if(current.hasWordMath)current.reviewWarnings.push('Có công thức Word: cần rà soát hiển thị');
    for(const k of KEYS)if(!current.choices.some(x=>x.key===k))current.choices.push({key:k,text:'',red:false,underline:false,bold:false});
    current.choices.sort((a,b)=>KEYS.indexOf(a.key)-KEYS.indexOf(b.key));
    if(current.choices.some(x=>!x.text))current.reviewWarnings.push('Có lựa chọn trống');
    current.reviewWarnings=uniqueMessages(current.reviewWarnings);out.push(current);current=null;lastChoice=null;explicitAnswer='';
  };
  for(const p of paragraphs){
    let s=p.text;const q=s.match(/^\s*(?:Câu|Cau|Question)\s*(\d+)\s*[\.:)]?\s*(.*)$/i);
    if(q){finish();const clo=extractClo(s);current={sourceNo:Number(q[1])||out.length+1,body:stripClo(q[2]||''),choices:[],correct:'',clo,points:1,reviewWarnings:[],conflicts:[],format:'docx',hasWordMath:p.hasWordMath,answerSource:'',cloSource:clo?'Word':''};continue;}
    if(!current)continue;if(p.hasWordMath)current.hasWordMath=true;
    const ans=s.match(/^\s*(?:Đáp\s*án|Dap\s*an|Answer)\s*[:\-]\s*([A-D])\b/i);if(ans){explicitAnswer=ans[1].toUpperCase();continue;}
    const c=s.match(/^\s*([A-D])\s*[\.)\:\-]\s*(.*)$/i);
    if(c){const key=c[1].toUpperCase(),raw=c[2]||'';const foundClo=extractClo(raw);if(!current.clo&&foundClo){current.clo=foundClo;current.cloSource='Word';}current.choices.push({key,text:stripClo(raw),red:p.red,underline:p.underline,bold:p.bold});lastChoice=current.choices[current.choices.length-1];continue;}
    const clo=extractClo(s);if(!current.clo&&clo){current.clo=clo;current.cloSource='Word';}
    const cleaned=stripClo(s);if(!cleaned)continue;if(lastChoice){lastChoice.text+=`\n${cleaned}`;lastChoice.red=lastChoice.red||p.red;lastChoice.underline=lastChoice.underline||p.underline;lastChoice.bold=lastChoice.bold||p.bold;}else current.body+=`${current.body?'\n':''}${cleaned}`;
  }
  finish();
  if(!out.length)throw new Error('Không nhận ra câu hỏi. DOCX cần có dạng “Câu 1.” và các lựa chọn A., B., C., D.');
  return out;
}

export async function parseAnswerSheet(file){
  const rows=await readFirstSheet(file),out=[],seen=new Set(),issues=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    const no=normalizeQuestionNo(pick(row,['Câu','Cau','Question','Số câu','So cau','STT']));
    const answer=normalizeAnswer(pick(row,['Đáp án','Dap an','Answer','ĐA','DA']));
    const clo=normalizeClo(pick(row,['CLO','Clo','Chuẩn đầu ra','Chuan dau ra']));
    if(no===null&&!answer&&!clo)continue;
    if(no===null){issues.push(`Dòng ${i+2}: thiếu số câu.`);continue;}
    if(seen.has(no)){issues.push(`Dòng ${i+2}: câu ${no} bị lặp trong Excel.`);continue;}seen.add(no);
    if(!answer)issues.push(`Dòng ${i+2}: câu ${no} chưa có đáp án A–D.`);
    if(!clo)issues.push(`Dòng ${i+2}: câu ${no} chưa có CLO.`);
    out.push({sourceNo:no,answer,clo,rowNo:i+2});
  }
  if(!out.length)throw new Error('Excel chưa có dữ liệu hợp lệ. Cần 3 cột: Câu, Đáp án, CLO.');
  if(issues.some(x=>/bị lặp/.test(x)))throw new Error(issues.filter(x=>/bị lặp/.test(x)).join(' '));
  return {rows:out,issues};
}

function mergeAnswerSheet(questions,answerRows){
  const byNo=new Map(questions.map(q=>[Number(q.sourceNo),q])),unmatched=[];
  for(const row of answerRows){
    const q=byNo.get(Number(row.sourceNo));if(!q){unmatched.push(row.sourceNo);continue;}
    q.conflicts=(q.conflicts||[]).filter(x=>!['correct','clo'].includes(x.field));
    if(row.answer){
      if(q.correct&&q.correct!==row.answer)q.conflicts.push({field:'correct',message:`Đáp án Excel (${row.answer}) khác ${q.answerSource||q.format?.toUpperCase()||'đề'} (${q.correct}); đang ưu tiên Excel.`});
      q.correct=row.answer;q.answerSource='Excel';
    }
    if(row.clo){
      if(q.clo&&q.clo!==row.clo)q.conflicts.push({field:'clo',message:`CLO Excel (${row.clo}) khác ${q.cloSource||q.format?.toUpperCase()||'đề'} (${q.clo}); đang ưu tiên Excel.`});
      q.clo=row.clo;q.cloSource='Excel';
    }
  }
  return unmatched;
}

function numberingWarnings(rows){
  const nums=rows.map(x=>Number(x.sourceNo)).filter(Number.isFinite),messages=[];
  const seen=new Set();for(const n of nums){if(seen.has(n))messages.push(`Trùng số câu ${n} trong đề.`);seen.add(n);}
  if(nums.length){const sorted=[...new Set(nums)].sort((a,b)=>a-b);for(let n=sorted[0];n<sorted[sorted.length-1];n++)if(!seen.has(n))messages.push(`Thiếu câu ${n} trong dãy số câu.`);}
  return messages;
}

function sourceBadge(source){return source?`<span class="badge badge-info">Nguồn: ${escapeHtml(source)}</span>`:'<span class="muted">Chưa xác định nguồn</span>';}
function cardHtml(q,index){
  const review=uniqueMessages([...(q.reviewWarnings||[]),...(q.conflicts||[]).map(x=>x.message)]);
  const warn=review.length?`<div class="alert alert-warning" data-review-warnings>${review.map(escapeHtml).join(' · ')}</div>`:'';
  return `<article class="card import-question" data-index="${index}" data-source-no="${escapeHtml(q.sourceNo||index+1)}" data-answer-source="${escapeHtml(q.answerSource||'')}" data-clo-source="${escapeHtml(q.cloSource||'')}" style="margin-bottom:12px"><div class="toolbar"><div class="row wrap"><label class="choice-row"><input type="checkbox" data-include ${q.include===false?'':'checked'}><strong>Câu ${escapeHtml(q.sourceNo||index+1)}</strong></label><span class="badge ${review.length?'badge-warning':'badge-success'}" data-status>${review.length?'Cần kiểm tra':'Hợp lệ'}</span></div><div class="row wrap"><div class="field" style="min-width:140px"><label>CLO</label><input class="input" data-clo value="${escapeHtml(q.clo||'')}" placeholder="CLO1"><div data-clo-source-label>${sourceBadge(q.cloSource)}</div></div><div class="field" style="width:100px"><label>Điểm</label><input class="input" data-points type="number" min="0" step="0.25" value="${Number(q.points??1)}"></div><div class="field" style="width:145px"><label>Đáp án</label><select class="select" data-correct><option value="">-- Chọn --</option>${KEYS.map(k=>`<option value="${k}" ${q.correct===k?'selected':''}>${k}</option>`).join('')}</select><div data-answer-source-label>${sourceBadge(q.answerSource)}</div></div></div></div>${warn}<div class="field"><label>Nội dung câu hỏi</label><textarea class="input" data-body rows="3">${escapeHtml(q.body||'')}</textarea></div><div class="form-grid">${KEYS.map(k=>{const c=q.choices.find(x=>x.key===k);return `<div class="field"><label>${k}</label><textarea class="input" data-choice="${k}" rows="2">${escapeHtml(c?.text||'')}</textarea></div>`;}).join('')}</div><details><summary>Xem trước công thức</summary><div class="question-card" data-preview style="margin-top:8px"></div></details></article>`;
}
function readConflicts(card){try{return JSON.parse(card.dataset.conflicts||'[]');}catch{return [];}}
function readReviewWarnings(card){try{return JSON.parse(card.dataset.reviewWarnings||'[]');}catch{return [];}}
function readCard(card){return {include:card.querySelector('[data-include]').checked,sourceNo:Number(card.dataset.sourceNo)||null,body:card.querySelector('[data-body]').value.trim(),choices:KEYS.map(k=>({key:k,text:card.querySelector(`[data-choice="${k}"]`).value.trim()})),correct:card.querySelector('[data-correct]').value,clo:normalizeClo(card.querySelector('[data-clo]').value),points:Number(card.querySelector('[data-points]').value||1),answerSource:card.dataset.answerSource||'',cloSource:card.dataset.cloSource||'',reviewWarnings:readReviewWarnings(card),conflicts:readConflicts(card)};}
function structuralWarnings(q){const a=[];if(!q.body)a.push('Thiếu nội dung');if(q.choices.some(x=>!x.text))a.push('Có lựa chọn trống');if(!KEYS.includes(q.correct))a.push('Chưa chọn đáp án đúng');if(!q.clo)a.push('Chưa có CLO');return a;}
function allWarnings(q){return uniqueMessages([...structuralWarnings(q),...(q.reviewWarnings||[]),...(q.conflicts||[]).map(x=>x.message)]);}
function blockingWarnings(q){return structuralWarnings(q).filter(w=>w!=='Chưa có CLO');}
async function refreshPreview(card){const q=readCard(card),host=card.querySelector('[data-preview]');host.innerHTML=`<div>${textHtml(q.body)}</div><div class="choice-grid" style="margin-top:8px">${q.choices.map(c=>`<div class="choice-row"><span class="choice-key">${c.key}</span><div>${textHtml(c.text)}</div>${q.correct===c.key?'<span class="badge badge-success">Đúng</span>':''}</div>`).join('')}</div>`;await typesetMath(host.querySelectorAll('div'));}
function syncSourceLabels(card){card.querySelector('[data-answer-source-label]').innerHTML=sourceBadge(card.dataset.answerSource||'');card.querySelector('[data-clo-source-label]').innerHTML=sourceBadge(card.dataset.cloSource||'');}
function attachRowMetadata(card,q){card.dataset.reviewWarnings=JSON.stringify(q.reviewWarnings||[]);card.dataset.conflicts=JSON.stringify(q.conflicts||[]);}
function setManualSource(card,field){
  if(field==='correct'){card.dataset.answerSource='Giảng viên';card.dataset.conflicts=JSON.stringify(readConflicts(card).filter(x=>x.field!=='correct'));}
  if(field==='clo'){card.dataset.cloSource='Giảng viên';card.dataset.conflicts=JSON.stringify(readConflicts(card).filter(x=>x.field!=='clo'));}
  syncSourceLabels(card);
}
function matrixHtml(rows){
  const map=new Map();for(const q of rows){const key=q.clo||'Chưa có CLO',v=map.get(key)||{count:0,points:0};v.count++;v.points+=Number(q.points||0);map.set(key,v);}
  const body=[...map.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${v.count}</td><td>${Number(v.points.toFixed(2))}</td></tr>`).join('');
  return `<div class="table-wrap" style="margin-top:8px"><table class="table"><thead><tr><th>CLO</th><th>Số câu</th><th>Tổng điểm</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
function updateSummary(modal){
  const cards=[...modal.querySelectorAll('.import-question')],rows=cards.map(readCard).filter(x=>x.include),missing=rows.filter(x=>!x.clo).length,bad=rows.filter(x=>allWarnings(x).length).length,totalPoints=rows.reduce((s,x)=>s+Number(x.points||0),0);
  modal.querySelector('[data-summary]').innerHTML=`Đang chọn <strong>${rows.length}</strong> câu · Tổng điểm <strong>${Number(totalPoints.toFixed(2))}</strong>${missing?` · <span class="text-danger">Thiếu CLO: <strong>${missing}</strong></span>`:''}${bad?` · <span class="text-danger">Cần rà soát: <strong>${bad}</strong></span>`:''}`;
  modal.querySelector('[data-matrix]').innerHTML=rows.length?matrixHtml(rows):'';
  for(const card of cards){const q=readCard(card),warnings=allWarnings(q),status=card.querySelector('[data-status]');status.textContent=warnings.length?'Cần kiểm tra':'Hợp lệ';status.className=`badge ${warnings.length?'badge-warning':'badge-success'}`;const box=card.querySelector('[data-review-warnings]');if(box)box.innerHTML=uniqueMessages([...(q.reviewWarnings||[]),...(q.conflicts||[]).map(x=>x.message)]).map(escapeHtml).join(' · ');}
}
function serializeDraft(modal,extra={}){
  const list=modal.querySelector('[data-import-list]');return {...extra,rows:[...modal.querySelectorAll('.import-question')].map(readCard),listScrollTop:list?.scrollTop||0,filter:modal.dataset.filter||'all',savedAt:Date.now()};
}
function renderRows(modal,rows){
  const list=modal.querySelector('[data-import-list]');list.innerHTML=rows.map(cardHtml).join('');list.querySelectorAll('.import-question').forEach((card,i)=>{attachRowMetadata(card,rows[i]||{});syncSourceLabels(card);card.querySelector('details').addEventListener('toggle',e=>{if(e.currentTarget.open)refreshPreview(card);});});
}
function applyFilter(modal,mode){
  modal.dataset.filter=mode;for(const card of modal.querySelectorAll('.import-question')){const q=readCard(card),warnings=allWarnings(q);card.style.display=mode==='all'||(mode==='warning'&&warnings.length)||(mode==='clo'&&!q.clo)?'':'none';}
}

export function openQuestionImporter(ctx,sessionId,ws,onDone){
  if(ws.version?.status!=='draft')return toast('Chỉ nhập hàng loạt vào bản nháp.','error');
  const returnScrollY=window.scrollY,draftKey=`question-import:${ctx.exam.id}:${sessionId}:${ws.version.id}`;
  let selectedFile=null,selectedAnswerFile=null,parsed=[],answerSheetName='',sourceFileName='';
  const saved=loadUiState(draftKey,null);
  openModal({title:'Nhập đề DOCX / TEX + đáp án Excel',wide:true,body:`<div class="stack"><div class="alert"><strong>Quy trình:</strong> tải DOCX/TEX → hệ thống phân tích → có thể ghép Excel 3 cột <strong>Câu | Đáp án | CLO</strong> → rà soát/chỉnh trực tiếp → xác nhận nhập đề. Excel được ưu tiên cho Đáp án và CLO nhưng mọi mâu thuẫn đều được cảnh báo.</div><div class="form-grid"><div class="field"><label>File đề (.docx hoặc .tex)</label><input class="input" data-import-file type="file" accept=".docx,.tex"></div><div class="field"><label>Đáp án Excel (tùy chọn)</label><input class="input" data-answer-file type="file" accept=".xlsx,.xls,.csv"><div class="muted">Ba cột: Câu, Đáp án, CLO.</div></div></div><div class="row wrap"><button class="btn btn-secondary" type="button" data-filter="all">Tất cả</button><button class="btn btn-secondary" type="button" data-filter="warning">Cần kiểm tra</button><button class="btn btn-secondary" type="button" data-filter="clo">Chưa có CLO</button><button class="btn btn-secondary" type="button" data-review>Rà soát đề</button><span class="muted" data-summary>Chưa đọc file.</span></div><div class="row wrap"><div class="field" style="min-width:180px"><label>Đổi CLO hàng loạt</label><input class="input" data-bulk-clo placeholder="CLO1"></div><button class="btn btn-secondary" type="button" data-apply-clo>Áp dụng cho các câu đang chọn</button></div><div data-import-state class="muted">Word: ưu tiên dòng “Đáp án: B”, sau đó nhận tô đỏ hoặc gạch chân; in đậm chỉ là phương án dự phòng. TEX: nhận \\begin{question}/\\begin{ex}, \\choice và \\True.</div><div data-global-review></div><div data-matrix></div><div data-import-list style="max-height:58vh;overflow:auto"></div></div>`,footer:'<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-primary" data-import disabled>Nhập các câu đã chọn</button>',onMount(modal){
    const input=modal.querySelector('[data-import-file]'),answerInput=modal.querySelector('[data-answer-file]'),list=modal.querySelector('[data-import-list]'),state=modal.querySelector('[data-import-state]'),globalReview=modal.querySelector('[data-global-review]'),importBtn=modal.querySelector('[data-import]');
    let persistTimer=null;
    const persist=()=>saveUiState(draftKey,serializeDraft(modal,{sourceFileName,answerSheetName,globalReview:globalReview.textContent||''}));
    const schedulePersist=()=>{clearTimeout(persistTimer);persistTimer=setTimeout(persist,140);};
    const restore=()=>{
      if(!saved?.rows?.length)return;
      parsed=saved.rows;sourceFileName=saved.sourceFileName||'';answerSheetName=saved.answerSheetName||'';renderRows(modal,parsed);state.textContent=`Đã khôi phục bản nháp ${parsed.length} câu${sourceFileName?` từ ${sourceFileName}`:''}. Hãy chọn lại file gốc nếu muốn lưu file nguồn cùng đề.`;globalReview.textContent=saved.globalReview||'';importBtn.disabled=false;applyFilter(modal,saved.filter||'all');requestAnimationFrame(()=>{list.scrollTop=Number(saved.listScrollTop||0);});updateSummary(modal);
    };
    modal.querySelector('[data-cancel]').onclick=()=>{persist();closeModal();window.scrollTo(0,returnScrollY);};
    input.onchange=async()=>{
      selectedFile=input.files?.[0]||null;if(!selectedFile)return;sourceFileName=selectedFile.name;selectedAnswerFile=null;answerSheetName='';answerInput.value='';state.textContent='Đang phân tích file đề…';list.innerHTML='';globalReview.innerHTML='';importBtn.disabled=true;
      try{const ext=selectedFile.name.toLowerCase().split('.').pop();parsed=ext==='tex'?parseTexQuestions(await selectedFile.text()):ext==='docx'?await parseDocxQuestions(selectedFile):[];if(!parsed.length)throw new Error('Không tìm thấy câu hỏi.');const numbering=numberingWarnings(parsed);globalReview.innerHTML=numbering.length?`<div class="alert alert-warning"><strong>Số thứ tự câu:</strong> ${numbering.map(escapeHtml).join(' · ')}</div>`:'';renderRows(modal,parsed);state.textContent=`Đã nhận ${parsed.length} câu từ ${selectedFile.name}. Hãy rà soát và sửa trực tiếp trước khi nhập.`;importBtn.disabled=false;applyFilter(modal,'all');updateSummary(modal);persist();}catch(e){state.textContent=errorMessage(e);toast(errorMessage(e),'error',6000);}
    };
    answerInput.onchange=async()=>{
      selectedAnswerFile=answerInput.files?.[0]||null;if(!selectedAnswerFile)return;if(!modal.querySelectorAll('.import-question').length)return toast('Hãy tải file DOCX/TEX trước rồi mới ghép Excel đáp án.','error',5000);
      try{answerSheetName=selectedAnswerFile.name;const previousScroll=list.scrollTop;const sheet=await parseAnswerSheet(selectedAnswerFile);parsed=[...modal.querySelectorAll('.import-question')].map(readCard);const unmatched=mergeAnswerSheet(parsed,sheet.rows);renderRows(modal,parsed);requestAnimationFrame(()=>{list.scrollTop=previousScroll;});const notes=[];if(sheet.issues.length)notes.push(...sheet.issues);if(unmatched.length)notes.push(`Excel có câu không tìm thấy trong đề: ${unmatched.join(', ')}.`);globalReview.innerHTML=notes.length?`<div class="alert alert-warning"><strong>Excel:</strong> ${notes.map(escapeHtml).join(' · ')}</div>`:`<div class="alert alert-success">Đã ghép ${sheet.rows.length} dòng đáp án/CLO từ Excel. Excel được ưu tiên khi có khác biệt.</div>`;state.textContent=`Đã ghép đáp án từ ${selectedAnswerFile.name}. Các khác biệt với Word/TEX được giữ lại dưới dạng cảnh báo.`;updateSummary(modal);persist();}catch(e){toast(errorMessage(e),'error',6500);}
    };
    list.addEventListener('input',e=>{const card=e.target.closest('.import-question');if(!card)return;if(e.target.matches('[data-clo]'))setManualSource(card,'clo');updateSummary(modal);schedulePersist();});
    list.addEventListener('change',e=>{const card=e.target.closest('.import-question');if(!card)return;if(e.target.matches('[data-correct]'))setManualSource(card,'correct');if(e.target.matches('[data-clo]'))setManualSource(card,'clo');updateSummary(modal);schedulePersist();});
    list.addEventListener('scroll',schedulePersist,{passive:true});
    modal.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>{applyFilter(modal,btn.dataset.filter);persist();});
    modal.querySelector('[data-review]').onclick=()=>{applyFilter(modal,'warning');const first=[...list.querySelectorAll('.import-question')].find(x=>x.style.display!=='none');if(first){list.scrollTop=Math.max(0,first.offsetTop-list.offsetTop-8);first.querySelector('textarea,input,select')?.focus({preventScroll:true});toast('Đang hiển thị các câu cần kiểm tra.','info');}else toast('Không phát hiện câu cần kiểm tra.','success');persist();};
    modal.querySelector('[data-apply-clo]').onclick=()=>{const clo=normalizeClo(modal.querySelector('[data-bulk-clo]').value);if(!clo)return toast('Nhập CLO hợp lệ, ví dụ CLO1.','error');let n=0;for(const card of list.querySelectorAll('.import-question')){if(!card.querySelector('[data-include]').checked)continue;card.querySelector('[data-clo]').value=clo;setManualSource(card,'clo');n++;}updateSummary(modal);persist();toast(`Đã gán ${clo} cho ${n} câu đang chọn.`,'success');};
    importBtn.onclick=async e=>{
      const rows=[...list.querySelectorAll('.import-question')].map(readCard).filter(x=>x.include);if(!rows.length)return toast('Chưa chọn câu nào để nhập.','error');
      const blocking=rows.flatMap(q=>blockingWarnings(q).map(w=>`Câu ${q.sourceNo||'?'}: ${w}`));if(blocking.length)return toast(`Còn ${blocking.length} lỗi cần sửa trước khi nhập.`, 'error',6000);
      const missing=rows.filter(x=>!x.clo).length;if(missing&&!confirm(`Có ${missing} câu chưa có CLO. Vẫn nhập vào đề?`))return;
      const btn=e.currentTarget;setBusy(btn,true,'Đang nhập…');
      try{
        if(selectedFile)await storageService.upload({examId:ctx.exam.id,file:selectedFile,kind:'source',metadata:{purpose:'import_source',session_id:sessionId}});
        if(selectedAnswerFile)await storageService.upload({examId:ctx.exam.id,file:selectedAnswerFile,kind:'source',metadata:{purpose:'answer_key',session_id:sessionId,source_file:sourceFileName||null}});
        for(let i=0;i<rows.length;i++){
          const q=rows[i];btn.textContent=`Đang nhập ${i+1}/${rows.length}…`;
          await addQuestion(ws.paper,ws.version,{code:null,group_id:null,group_version_id:null,body_html:textHtml(q.body),choices:q.choices.map(c=>({key:c.key,html:textHtml(c.text)})),correct_key:q.correct,points:q.points,metadata:{shuffle_choices:true,clo_code:q.clo||null,import_source:sourceFileName||null,import_format:sourceFileName.toLowerCase().endsWith('.tex')?'tex':'docx',answer_source:q.answerSource||null,clo_source:q.cloSource||null,answer_file:answerSheetName||null,source_question_no:q.sourceNo||null}},ctx.profile.id);
        }
        saveUiState(draftKey,null);closeModal();toast(`Đã nhập ${rows.length} câu vào đề${missing?` (${missing} câu chưa có CLO)`:''}.`,'success',6000);await onDone?.();requestAnimationFrame(()=>window.scrollTo(0,returnScrollY));
      }catch(err){toast(errorMessage(err),'error',6500);setBusy(btn,false);}
    };
    restore();
  }});
}
