const entries = [];
let target = null;

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function icon(level){return level==='error'?'❌':level==='warn'?'⚠️':level==='info'?'ℹ️':'✅'}
export function initLog(el){ target=el; renderLog(); }
export function clearLog(){ entries.length=0; renderLog(); }
export function addLog(message, level='ok'){
  entries.push({time:new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),message,level});
  renderLog();
}
export function getLogText(){ return entries.map(e=>`[${e.time}] ${icon(e.level)} ${e.message}`).join('\n'); }
export function renderLog(){
  if(!target) return;
  target.innerHTML = entries.length ? entries.map(e=>`<div class="log-line log-${e.level}"><span>${e.time}</span> <b>${icon(e.level)}</b> ${esc(e.message)}</div>`).join('') : '<div class="log-empty">Chưa có hoạt động.</div>';
  target.scrollTop=target.scrollHeight;
}
