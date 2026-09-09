// Export-time validation for /cham-thi-clo.
// Duplicate keys with identical scores are accepted automatically.
// Different results require an explicit choice. Office matching is checked by key.

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function keyOf(v){const s=String(v??'').trim();return /^\d+$/.test(s)&&Number(s)>0?String(Number(s)):''}

function ensureStyles(){
  if(document.getElementById('exportValidationStyles'))return;
  const style=document.createElement('style');style.id='exportValidationStyles';style.textContent=`
    .export-conflict-backdrop{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.48)}
    .export-conflict-dialog{width:min(820px,100%);max-height:min(82vh,760px);overflow:auto;background:#fff;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
    .export-conflict-dialog .table-wrapper{margin-top:12px}.export-conflict-dialog .inline-error{display:block;margin:10px 0;padding:11px 13px;border-radius:9px;background:#fff4f5;color:#8d1c2b;border:1px solid #f1c9cf}
    .export-conflict-dialog .review-actions{position:sticky;bottom:-22px;background:#fff;padding-top:14px;margin-top:16px}
    @media(max-width:640px){.export-conflict-backdrop{padding:8px}.export-conflict-dialog{padding:16px;border-radius:12px}}
  `;document.head.appendChild(style);
}

function scoreEntries(student){const marks=student?.result?.marks||{};return Object.keys(marks).sort().map(k=>[k,Number(marks[k])])}
function scoreSignature(student){return JSON.stringify({correct:student?.result?.correct??null,total:student?.result?.total??null,marks:scoreEntries(student)})}
function scoreText(student){const marks=student?.result?.marks||{},clos=Object.keys(marks).filter(k=>k!=='GPA').sort();return [`Đúng ${student?.result?.correct??'—'}/${student?.result?.total??'—'}`,`GPA ${marks.GPA??'—'}`,...clos.map(k=>`${k} ${marks[k]??'—'}`)].join(' · ')}

function groupsFor(room){const map=new Map();for(const s of room?.untData?.students||[]){const key=keyOf(s.sbd);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(s)}return map}
function currentSignature(room){const groups=groupsFor(room),bits=[];for(const [key,items] of groups)bits.push(`${key}:${items.map(s=>`${s.examCode}|${scoreSignature(s)}`).join('||')}`);const office=(room?.officeSheet?.sbds||[]).map(keyOf).filter(Boolean).join(',');return `${bits.sort().join('###')}@@${office}`}

function showChoice(room,key,items){
  ensureStyles();
  return new Promise((resolve,reject)=>{
    const backdrop=document.createElement('div');backdrop.className='export-conflict-backdrop';backdrop.innerHTML=`<section class="export-conflict-dialog" role="dialog" aria-modal="true"><div class="result-head"><div><span class="section-kicker">XUNG ĐỘT SỐ PHÁCH / SBD</span><h2 class="result-title">Có nhiều bài cho số ${esc(key)}</h2></div><span class="warning-pill">Cần chọn</span></div><p class="review-description">Các bài bên dưới có kết quả khác nhau nên hệ thống không tự chọn. Chọn đúng bài cần dùng để xuất, hoặc dừng xuất để kiểm tra dữ liệu.</p><div class="table-wrapper"><table><thead><tr><th>Chọn</th><th>Dòng UnT</th><th>Mã đề</th><th>Kết quả</th></tr></thead><tbody>${items.map((s,i)=>`<tr><td><input type="radio" name="exportConflictPick" value="${i}" ${i===0?'checked':''}></td><td>${esc(s.excelRow??'—')}</td><td>${esc(s.examCode??'—')}</td><td>${esc(scoreText(s))}</td></tr>`).join('')}</tbody></table></div><div class="review-actions"><button type="button" class="secondary-action" data-stop>Dừng xuất</button><button type="button" class="primary-inline-action" data-use>Dùng bài đã chọn</button></div></section>`;
    document.body.appendChild(backdrop);document.documentElement.style.overflow='hidden';
    const close=()=>{backdrop.remove();document.documentElement.style.overflow=''};
    backdrop.querySelector('[data-use]')?.addEventListener('click',()=>{const picked=backdrop.querySelector('input[name="exportConflictPick"]:checked');const student=items[Number(picked?.value||0)];close();resolve(student)});
    backdrop.querySelector('[data-stop]')?.addEventListener('click',()=>{close();const e=new Error('Đã dừng xuất để kiểm tra xung đột số phách/SBD.');e.name='UserCancelledError';reject(e)});
  });
}

function showCoverage(room,missing,extra){
  ensureStyles();
  return new Promise((resolve,reject)=>{
    const backdrop=document.createElement('div');backdrop.className='export-conflict-backdrop';backdrop.innerHTML=`<section class="export-conflict-dialog" role="dialog" aria-modal="true"><div class="result-head"><div><span class="section-kicker">KIỂM TRA GHÉP KHẢO THÍ</span><h2 class="result-title">${esc(room.displayName||room.fileName||'Phòng thi')}</h2></div><span class="warning-pill">Cần kiểm tra</span></div><p class="review-description">Hệ thống đã đối chiếu từng số phách/SBD, không chỉ lấy số lượng hai danh sách trừ nhau.</p>${missing.length?`<div class="inline-error"><b>${missing.length} số phách chưa có bài:</b> ${esc(missing.join(', '))}</div>`:''}${extra.length?`<div class="inline-error"><b>${extra.length} bài không khớp số phách trong sheet:</b> ${esc(extra.join(', '))}</div>`:''}<div class="review-actions"><button type="button" class="secondary-action" data-stop>Dừng xuất</button><button type="button" class="primary-inline-action" data-continue>Đã kiểm tra, tiếp tục xuất</button></div></section>`;
    document.body.appendChild(backdrop);document.documentElement.style.overflow='hidden';const close=()=>{backdrop.remove();document.documentElement.style.overflow=''};
    backdrop.querySelector('[data-continue]')?.addEventListener('click',()=>{close();resolve(true)});backdrop.querySelector('[data-stop]')?.addEventListener('click',()=>{close();const e=new Error('Đã dừng xuất để kiểm tra danh sách số phách.');e.name='UserCancelledError';reject(e)});
  });
}

export async function validateRoomsBeforeExport(rooms){
  for(const room of rooms||[]){
    const signature=currentSignature(room);if(room._exportValidatedSignature===signature)continue;
    const groups=groupsFor(room),selected=new Map();
    for(const [key,items] of groups){if(items.length===1){selected.set(key,items[0]);continue}const same=items.every(s=>scoreSignature(s)===scoreSignature(items[0]));selected.set(key,same?items[0]:await showChoice(room,key,items))}
    room._exportStudentBySbd=selected;
    if(room.officeSheet){const officeKeys=[...new Set((room.officeSheet.sbds||[]).map(keyOf).filter(Boolean))],officeSet=new Set(officeKeys),studentKeys=[...selected.keys()],missing=officeKeys.filter(k=>!selected.has(k)),extra=studentKeys.filter(k=>!officeSet.has(k));if(missing.length||extra.length)await showCoverage(room,missing,extra)}
    room._exportValidatedSignature=signature;
  }
}

export function getExportStudents(room){
  const students=room?.untData?.students||[],selected=room?._exportStudentBySbd instanceof Map?room._exportStudentBySbd:null,officeRows=room?.officeSheet?.rows?.length?room.officeSheet.rows:(room?.officeSheet?.sbds||[]).map(sbd=>({sbd,note:''}));
  if(!officeRows.length){if(!selected)return students;const seen=new Set(),out=[];for(const s of students){const k=keyOf(s.sbd);if(!k||seen.has(k))continue;seen.add(k);out.push(selected.get(k)||s)}return out}
  const by=selected||new Map(students.map(s=>[keyOf(s.sbd),s]).filter(([k])=>k));return officeRows.map(entry=>{const key=keyOf(entry.sbd),found=by.get(key);if(found)return {...found,officeNote:entry.note??''};return {sbd:key,result:null,isAbsent:true,officeNote:entry.note??''}});
}
