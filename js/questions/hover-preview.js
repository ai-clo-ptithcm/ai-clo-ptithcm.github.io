/* AI-CLO PTITHCM V12.6.43 — single-owner lazy hover preview for question-bank rows. */
(() => {
'use strict';

const HOVER_DELAY = 320;
const cache = new Map();
const controller = new AbortController();
const signal = controller.signal;
let timer = null;
let activeButton = null;
let preview = null;
let requestToken = 0;

/* If a newer copy is ever loaded in the same document, retire the previous owner first. */
try{ window.AICLO_QUESTION_HOVER_PREVIEW?.destroy?.(); }catch{}

document.querySelectorAll('#questionHoverPreview').forEach(node=>node.remove());

function stripNativeTooltip(button){
  button?.removeAttribute('title');
  button?.querySelectorAll?.('[title]').forEach(node=>node.removeAttribute('title'));
  button?.closest?.('.q-content-cell')?.removeAttribute('title');
}

function hidePreview(){
  clearTimeout(timer);
  timer = null;
  activeButton = null;
  requestToken++;
  if(preview) preview.hidden = true;
}

function ensurePreview(){
  const existing=[...document.querySelectorAll('#questionHoverPreview')];
  if(preview && document.body.contains(preview)){
    existing.filter(node=>node!==preview).forEach(node=>node.remove());
    return preview;
  }
  existing.forEach(node=>node.remove());
  preview = document.createElement('aside');
  preview.id = 'questionHoverPreview';
  preview.className = 'question-hover-preview';
  preview.setAttribute('role','tooltip');
  preview.hidden = true;
  preview.addEventListener('pointerleave', hidePreview, {signal});
  document.body.appendChild(preview);
  return preview;
}

function optionMap(question){
  return Object.fromEntries((question?.question_options || []).map(item => [String(item.option_key || '').toUpperCase(), item.content || '']));
}

function renderPreview(question){
  const box = ensurePreview();
  const options = optionMap(question);
  box.innerHTML = `<div class="question-hover-preview-head"><b>${esc(questionCode(question))}</b><span>Xem nhanh</span></div>
    <div class="question-hover-preview-content">${esc(question.content || '')}</div>
    <div class="question-hover-preview-options">${['A','B','C','D'].map(key => `<div><b>${key}.</b><span>${esc(options[key] || '—')}</span></div>`).join('')}</div>`;
  box.hidden = false;
  window.renderMath?.(box);
}

function positionPreview(button){
  const box = ensurePreview();
  if(box.hidden || !button) return;
  const rect = button.getBoundingClientRect();
  const margin = 12;
  const maxWidth = Math.min(520, window.innerWidth - margin * 2);
  box.style.width = `${maxWidth}px`;
  box.style.left = '0px';
  box.style.top = '0px';
  const boxRect = box.getBoundingClientRect();
  let left = rect.left;
  if(left + boxRect.width > window.innerWidth - margin) left = window.innerWidth - boxRect.width - margin;
  left = Math.max(margin, left);
  let top = rect.bottom + 8;
  if(top + boxRect.height > window.innerHeight - margin) top = rect.top - boxRect.height - 8;
  top = Math.max(margin, Math.min(top, window.innerHeight - boxRect.height - margin));
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
}

async function loadQuestion(id){
  if(cache.has(id)) return cache.get(id);
  try{
    const {data,error} = await db.from('questions').select('*, question_options(*)').eq('id',id).single();
    if(error) throw error;
    cache.set(id,data);
    return data;
  }catch(error){
    console.warn('Không tải được xem nhanh câu hỏi', error);
    return null;
  }
}

function schedulePreview(button){
  stripNativeTooltip(button);
  clearTimeout(timer);
  activeButton = button;
  const id = button?.dataset?.detail;
  if(!id) return;
  const token = ++requestToken;
  timer = setTimeout(async () => {
    const question = await loadQuestion(id);
    if(token !== requestToken || activeButton !== button || !question) return;
    renderPreview(question);
    positionPreview(button);
  }, HOVER_DELAY);
}

function isHoverCapable(){
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches !== false;
}

function onPointerOver(event){
  if(!isHoverCapable()) return;
  const button = event.target.closest?.('#qrows .question-summary[data-detail]');
  if(!button || button.contains(event.relatedTarget)) return;
  schedulePreview(button);
}
function onPointerOut(event){
  const button = event.target.closest?.('#qrows .question-summary[data-detail]');
  if(!button || button.contains(event.relatedTarget)) return;
  if(event.relatedTarget && preview?.contains(event.relatedTarget)) return;
  hidePreview();
}
function onKeydown(event){ if(event.key === 'Escape') hidePreview(); }
function destroy(){
  hidePreview();
  controller.abort();
  preview?.remove();
  preview=null;
}

document.addEventListener('pointerover', onPointerOver, {capture:true,signal});
document.addEventListener('pointerout', onPointerOut, {capture:true,signal});
document.addEventListener('scroll', hidePreview, {capture:true,signal});
window.addEventListener('resize', hidePreview, {signal});
document.addEventListener('keydown', onKeydown, {signal});
document.addEventListener('click', hidePreview, {capture:true,signal});

window.AICLO_QUESTION_HOVER_PREVIEW = Object.freeze({version:'12.6.43',clear:()=>cache.clear(),hide:hidePreview,destroy});
})();
