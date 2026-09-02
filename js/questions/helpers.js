/* AI-CLO PTITHCM V11 — question helper utilities extracted from legacy V9.6. */
(() => {
'use strict';

const scopeLabel=v=>v==='secure_exam'?'Đề thi · Bảo mật':'Luyện tập · Kiểm tra';
const approvalLabel=v=>({draft:'Bản nháp',pending:'Chờ duyệt',approved:'Đã duyệt',archived:'Lưu trữ'}[v]||v||'Bản nháp');
const canManage=x=>role()==='admin'||x?.created_by===state.user?.id;
const date=v=>v?v94Time(v):'—';

function similarity(a,b){
 const words=s=>new Set(String(s).toLowerCase().replace(/\s+/g,' ').split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1));
 const A=words(a),B=words(b),inter=[...A].filter(x=>B.has(x)).length,union=new Set([...A,...B]).size;
 return union?inter/union:0;
}

function scanDuplicates(items){
 const pairs=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const score=similarity(items[i].content,items[j].content);
  if(score>=.72)pairs.push({a:items[i],b:items[j],score});
 }
 pairs.sort((a,b)=>b.score-a.score);
 openDrawer('Kiểm tra câu hỏi trùng',`<div class="panel duplicate-results"><p class="hint">Hệ thống chỉ cảnh báo; giảng viên quyết định giữ, sửa hoặc lưu trữ.</p>${pairs.slice(0,50).map(p=>`<article><b>${questionCode(p.a.id)} ↔ ${questionCode(p.b.id)}</b><span>${Math.round(p.score*100)}% tương đồng</span><p>${esc(p.a.content)}</p><p>${esc(p.b.content)}</p></article>`).join('')||'<div class="empty"><b>Không phát hiện cặp gần trùng</b><span>Không có cặp câu nào vượt ngưỡng 72%.</span></div>'}</div>`,null,{wide:true,eyebrow:'CHỐNG TRÙNG'});
}

/* Legacy aliases kept until v105.js is modularized. */
window.v96ScopeLabel=scopeLabel;
window.v96ApprovalLabel=approvalLabel;
window.v96CanManage=canManage;
window.v96Date=date;
window.v96Similarity=similarity;
window.v96ScanDuplicates=scanDuplicates;
window.AICLO_QUESTION_HELPERS=Object.freeze({scopeLabel,approvalLabel,canManage,date,similarity,scanDuplicates});

document.addEventListener('DOMContentLoaded',()=>{$('#systemHomeBtn')?.setAttribute('data-tooltip','Về trang Tổng quan hệ thống')});
})();
