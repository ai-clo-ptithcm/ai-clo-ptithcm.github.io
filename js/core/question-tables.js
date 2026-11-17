/* AI-CLO: read-only rendering of tabular question data; keeps Supabase records unchanged. */
(()=>{
'use strict';
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function numbers(v){
 const s=String(v??'').trim();
 const quoted=[...s.matchAll(/['"](-?\d+(?:[.,]\d+)?)['"]/g)].map(m=>m[1]);
 if(quoted.length>=2)return quoted;
 const parts=s.replace(/^\$|\$|^\[|\]$/g,'').split(',').map(x=>x.trim()).filter(Boolean);
 if(parts.length>=2&&parts.every(x=>/^-?\d+(?:\.\d+)?$/.test(x)))return parts;
 return (s.match(/-?\d+(?:[.,]\d+)?/g)||[]);
}
function matrix(headers,rows){
 const h='<thead><tr>'+headers.map(x=>'<th scope="col">'+escapeHtml(x)+'</th>').join('')+'</tr></thead>';
 const b='<tbody>'+rows.map(r=>'<tr>'+r.map((x,i)=>i===0?'<th scope="row">'+escapeHtml(x)+'</th>':'<td>'+escapeHtml(x)+'</td>').join('')+'</tr>').join('')+'</tbody>';
 return '<span class="aiclo-data-table-scroll"><table class="aiclo-data-table">'+h+b+'</table></span>';
}
function frame(s,start,end,h,r){
 const p=s.slice(0,start).replace(/[\s$;:,.]+$/g,'').trim();
 const tail=s.slice(end).replace(/^[\s$;:,.]+/g,'').trim();
 return (p?'<span>'+escapeHtml(p)+'</span>':'')+matrix(h,r)+(tail?'<span class="aiclo-table-after">'+escapeHtml(tail)+'</span>':'');
}
function convertQuestionTable(value){
 const s=String(value||'').trim();
 if(!/(bảng|tần số|trung điểm|giá trị đại diện|ghép lớp)/i.test(s)||/\\begin\{array\}|<table/i.test(s))return null;
 let m=[...s.matchAll(/P\(X\s*=\s*(-?\d+(?:[.,]\d+)?)\)\s*=\s*(\d+(?:[.,]\d+)?)/g)];
 if(m.length>=3&&/bảng phân bố/i.test(s))return frame(s,m[0].index,m[m.length-1].index+m[m.length-1][0].length,['Giá trị X',...m.map(x=>x[1])],[['P(X = x)',...m.map(x=>x[2])]]);
 m=[...s.matchAll(/P\(\s*(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)\s*\)\s*=\s*(\d+(?:[.,]\d+)?)/g)];
 if(m.length>=4&&/bảng|phân bố/i.test(s)){
  const xs=[...new Set(m.map(x=>x[1]))],ys=[...new Set(m.map(x=>x[2]))];
  if(xs.length*ys.length===m.length){
   const rows=xs.map(x=>[x,...ys.map(y=>m.find(v=>v[1]===x&&v[2]===y)?.[3]||'')]);
   if(rows.every(r=>r.slice(1).every(Boolean)))return frame(s,m[0].index,m[m.length-1].index+m[m.length-1][0].length,['X / Y',...ys],rows);
  }
 }
 let rm=[...s.matchAll(/hàng\s*\$?X\s*=\s*(-?\d+(?:[.,]\d+)?)\$?\s*:\s*\[([^\]]+)\]/gi)];
 if(rm.length>=2){
  let rows=rm.map(x=>[x[1],...numbers(x[2])]);let width=rows[0].length;
  if(width>=3&&rows.every(r=>r.length===width))return frame(s,rm[0].index,rm[rm.length-1].index+rm[rm.length-1][0].length,['X / Y',...Array.from({length:width-1},(_,i)=>'Cột '+(i+1))],rows);
 }
 rm=[...s.matchAll(/hàng\s+ứng\s+với\s+\$?X\s*=\s*(-?\d+(?:[.,]\d+)?)\$?\s+là\s*\[([^\]]+)\]/gi)];
 if(rm.length>=2){
  let rows=rm.map(x=>[x[1],...numbers(x[2])]);let y=s.match(/Y\\in\[([^\]]+)\]/)?.[1];let ys=y?numbers(y):[];
  if(rows.every(r=>r.length===rows[0].length)&&rows[0].length>=3&&ys.length===rows[0].length-1)return frame(s,rm[0].index,rm[rm.length-1].index+rm[rm.length-1][0].length,['X / Y',...ys],rows);
 }
 rm=[...s.matchAll(/\$X\s*=\s*(-?\d+(?:[.,]\d+)?)\$\s+là\s+\$([0-9.,\s]+)\$/g)];
 if(rm.length>=2&&/bảng/i.test(s)){
  const ym=s.match(/\$Y\s*=\s*([^$]+)\$/)?.[1];let ys=ym?numbers(ym):[];
  let rows=rm.map(x=>[x[1],...numbers(x[2])]);
  if(ys.length===rows[0].length-1&&rows.every(r=>r.length===rows[0].length))return frame(s,rm[0].index,rm[rm.length-1].index+rm[rm.length-1][0].length,['X / Y',...ys],rows);
 }
 const ints=[...s.matchAll(/\[\s*(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)\s*\)/g)];
 if(ints.length>=3&&/tần số/i.test(s)){
  const f=s.match(/tần số(?:\s+lần lượt)?\s*\$([^$]+)\$/i);
  const fs=f?numbers(f[1]):[];
  if(fs.length===ints.length){
   const start=ints[0].index;const end=s.indexOf(f[0])+f[0].length;
   return frame(s,start,end,['Khoảng lớp',...ints.map(x=>'['+x[1]+', '+x[2]+')')],[['Tần số',...fs]]);
  }
 }
 const vals=s.match(/(?:giá trị(?:\s+đại diện)?|trung điểm)\s*(\$[^$]+\$|\[[^\]]+\])\s*(?:với|và)\s*(?:các\s+)?tần số(?:\s+tương ứng)?\s*(\$[^$]+\$|\[[^\]]+\])/i);
 if(vals){
  const xs=numbers(vals[1]),fs=numbers(vals[2]);
  if(xs.length>=3&&xs.length===fs.length){
   const start=s.indexOf(vals[1]),end=s.indexOf(vals[0])+vals[0].length;
   const firstLabel=/trung điểm/i.test(vals[0])?'Trung điểm':'Giá trị';
   return frame(s,start,end,[firstLabel,...xs],[['Tần số',...fs]]);
  }
 }
 const simple=s.match(/tần số(?:\s+lần lượt)?\s*(\$[0-9,.\s]+\$|\[[0-9,.\s]+\])/i);
 if(simple){
  const fs=numbers(simple[1]);
  if(fs.length>=3){
   const start=s.indexOf(simple[1]),end=start+simple[1].length;
   return frame(s,start,end,['Nhóm',...fs.map((_,i)=>String(i+1))],[['Tần số',...fs]]);
  }
 }
 return null;
}
function formatTablesInNode(root){
 if(!root||!(root.textContent||'').match(/bảng|tần số|trung điểm|giá trị đại diện|ghép lớp/i))return 0;
 const targets=[root,...(root.querySelectorAll?root.querySelectorAll('div,p,span,section,article,td,li,h3,h4'):[])];
 let count=0;
 for(const el of targets){
  if(!el||el.nodeType!==1||el.children.length!==0||el.dataset?.aicloTableFormatted)continue;
  if(el.closest?.('button,textarea,pre,code,script,style,a,table,[contenteditable="true"],.aiclo-data-table-scroll'))continue;
  const txt=el.textContent||'';
  if(txt.length<35||txt.length>1800)continue;
  const html=convertQuestionTable(txt);
  if(!html)continue;
  el.innerHTML=html;
  el.dataset.aicloTableFormatted='1';
  count++;
 }
 return count;
}
function mountStyles(){
 if(document.getElementById('aiclo-question-table-styles'))return;
 const style=document.createElement('style');style.id='aiclo-question-table-styles';
 style.textContent='.aiclo-data-table-scroll{display:block;max-width:100%;overflow-x:auto;margin:10px 0 12px}.aiclo-data-table{border-collapse:collapse;width:max-content;max-width:none;background:var(--surface,#fff);font-size:.95em;line-height:1.45;margin:0 auto}.aiclo-data-table th,.aiclo-data-table td{border:1px solid #a7b4c5;padding:7px 11px;text-align:center;white-space:nowrap}.aiclo-data-table th{background:#eef3f9;font-weight:600}.aiclo-table-after{display:block;margin-top:7px}.aiclo-data-table-scroll+span{display:block}';
 document.head.appendChild(style);
}
if(typeof document!=='undefined')mountStyles();
window.AICLO_QUESTION_TABLES=Object.freeze({convertQuestionTable,formatTablesInNode});
})();
