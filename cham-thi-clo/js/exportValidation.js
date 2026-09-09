// Export-time validation for /cham-thi-clo.
// Rules:
// - A phach/SBD key should map to one result.
// - Duplicate keys with identical scores are accepted automatically.
// - Duplicate keys with different scores require the user to choose or stop export.
// - When an office sheet is used, report phach without a submission and submissions not found in the phach list.

function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function keyOf(v){const s=String(v??'').trim();return /^\d+$/.test(s)&&Number(s)>0?String(Number(s)):''}

function scoreEntries(student){
  const marks=student?.result?.marks||{};
  return Object.keys(marks).sort().map(k=>[k,Number(marks[k])]);
}
function scoreSignature(student){
  return JSON.stringify({correct:student?.result?.correct??null,total:student?.result?.total??null,marks:scoreEntries(student)});
}
function scoreText(student){
  const marks=student?.result?.marks||{};
  const clos=Object.keys(marks).filter(k=>k!=='GPA').sort();
  return [
    `Đúng ${student?.result?.correct??'—'}/${student?.result?.total??'—'}`,
    `GPA ${marks.GPA??'—'}`,
    ...clos.map(k=>`${k} ${marks[k]??'—'}`)
  ].join(' · ');
}

function groupsFor(room){
  const map=new Map();
  for(const s of room?.untData?.students||[]){
    const key=keyOf(s.sbd);if(!key)continue;
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(s);
  }
  return map;
}

function currentSignature(room){
  const groups=groupsFor(room);
  const bits=[];
  for(const [key,items] of groups){
    bits.push(`${key}:${items.map(s=>`${s.examCode}|${scoreSignature(s)}`).join('||')}`);
  }
  const office=(room?.officeSheet?.sbds||[]).map(keyOf).filter(Boolean).join(',');
  return `${bits.sort().join('###')}@@${office}`;
}

function showChoice(room,key,items){
  return new Promise((resolve,reject)=>{
    const backdrop=document.createElement('div');
    backdrop.className='export-conflict-backdrop';
    backdrop.innerHTML=`<section class="export-conflict-dialog" role="dialog" aria-modal="true">
      <div class="result-head"><div><span class="section-kicker">XUNG ĐỘT SỐ PHÁCH / SBD</span><h2 class="result-title">Có nhiều bài cho số ${esc(key)}</h2></div><span class="warning-pill">Cần chọn</span></div>
      <p class="review-description">Các bài bên dưới có kết quả khác nhau nên hệ thống không tự chọn. Chọn đúng bài cần dùng để xuất, hoặc dừng xuất để kiểm tra dữ liệu.</p>
      <div class="table-wrapper"><table><thead><tr><th>Chọn</th><th>Dòng UnT</th><th>Mã đề</th><th>Kết quả</th></tr></thead><tbody>
      ${items.map((s,i)=>`<tr><td><input type="radio" name="exportConflictPick" value="${i}" ${i===0?'checked':''}></td><td>${esc(s.excelRow??'—')}</td><td>${esc(s.examCode??'—')}</td><td>${esc(scoreText(s))}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="review-actions"><button type="button" class="secondary-action" data-stop>Dừng xuất</button><button type="button" class="primary-inline-action" data-use>Dùng bài đã chọn</button></div>
    </section>`;
    document.body.appendChild(backdrop);
    document.documentElement.style.overflow='hidden';
    const close=()=>{backdrop.remove();document.documentElement.style.overflow=''};
    backdrop.querySelector('[data-use]')?.addEventListener('click',()=>{
      const picked=backdrop.querySelector('input[name="exportConflictPick"]:checked');
      const student=items[Number(picked?.value||0)];close();resolve(student);
    });
    backdrop.querySelector('[data-stop]')?.addEventListener('click',()=>{
      close();const e=new Error('Đã dừng xuất để kiểm tra xung đột số phách/SBD.');e.name='UserCancelledError';reject(e);
    });
  });
}

function showCoverage(room,missing,extra){
  return new Promise((resolve,reject)=>{
    const backdrop=document.createElement('div');
    backdrop.className='export-conflict-backdrop';
    backdrop.innerHTML=`<section class="export-conflict-dialog" role="dialog" aria-modal="true">
      <div class="result-head"><div><span class="section-kicker">KIỂM TRA GHÉP KHẢO THÍ</span><h2 class="result-title">${esc(room.displayName||room.fileName||'Phòng thi')}</h2></div><span class="warning-pill">Cần kiểm tra</span></div>
      <p class="review-description">Hệ thống đã đối chiếu từng số phách/SBD, không chỉ lấy số lượng hai danh sách trừ nhau.</p>
      ${missing.length?`<div class="inline-error"><b>${missing.length} số phách chưa có bài:</b> ${esc(missing.join(', '))}</div>`:''}
      ${extra.length?`<div class="inline-error"><b>${extra.length} bài không khớp số phách trong sheet:</b> ${esc(extra.join(', '))}</div>`:''}
      <div class="review-actions"><button type="button" class="secondary-action" data-stop>Dừng xuất</button><button type="button" class="primary-inline-action" data-continue>Đã kiểm tra, tiếp tục xuất</button></div>
    </section>`;
    document.body.appendChild(backdrop);document.documentElement.style.overflow='hidden';
    const close=()=>{backdrop.remove();document.documentElement.style.overflow=''};
    backdrop.querySelector('[data-continue]')?.addEventListener('click',()=>{close();resolve(true)});
    backdrop.querySelector('[data-stop]')?.addEventListener('click',()=>{close();const e=new Error('Đã dừng xuất để kiểm tra danh sách số phách.');e.name='UserCancelledError';reject(e)});
  });
}

export async function validateRoomsBeforeExport(rooms){
  for(const room of rooms||[]){
    const signature=currentSignature(room);
    if(room._exportValidatedSignature===signature)continue;
    const groups=groupsFor(room);
    const selected=new Map();

    for(const [key,items] of groups){
      if(items.length===1){selected.set(key,items[0]);continue}
      const same=items.every(s=>scoreSignature(s)===scoreSignature(items[0]));
      if(same){selected.set(key,items[0]);continue}
      selected.set(key,await showChoice(room,key,items));
    }

    room._exportStudentBySbd=selected;

    if(room.officeSheet){
      const officeKeys=[...new Set((room.officeSheet.sbds||[]).map(keyOf).filter(Boolean))];
      const officeSet=new Set(officeKeys),studentKeys=[...selected.keys()];
      const missing=officeKeys.filter(k=>!selected.has(k));
      const extra=studentKeys.filter(k=>!officeSet.has(k));
      if(missing.length||extra.length) await showCoverage(room,missing,extra);
    }

    room._exportValidatedSignature=signature;
  }
}

export function getExportStudents(room){
  const students=room?.untData?.students||[];
  const selected=room?._exportStudentBySbd instanceof Map?room._exportStudentBySbd:null;
  const officeRows=room?.officeSheet?.rows?.length
    ? room.officeSheet.rows
    : (room?.officeSheet?.sbds||[]).map(sbd=>({sbd,note:''}));

  if(!officeRows.length){
    if(!selected)return students;
    const seen=new Set(),out=[];
    for(const s of students){const k=keyOf(s.sbd);if(!k||seen.has(k))continue;seen.add(k);out.push(selected.get(k)||s)}
    return out;
  }

  const by=selected||new Map(students.map(s=>[keyOf(s.sbd),s]).filter(([k])=>k));
  return officeRows.map(entry=>{
    const key=keyOf(entry.sbd),found=by.get(key);
    if(found)return {...found,officeNote:entry.note??''};
    return {sbd:key,result:null,isAbsent:true,officeNote:entry.note??''};
  });
}
