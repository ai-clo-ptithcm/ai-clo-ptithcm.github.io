/* AI-CLO PTITHCM V12.1.1 — Assessment UI lifecycle stability patch. */
(()=>{
'use strict';
const VERSION='12.1.1';
let observer=null,statusBusy=false;
const $=s=>document.querySelector(s);

function hideButton(button){
 if(!button)return;
 button.hidden=true;
 button.style.setProperty('display','none','important');
 button.setAttribute('aria-hidden','true');
 button.tabIndex=-1;
}
function showButton(button){
 if(!button)return;
 button.hidden=false;
 button.style.removeProperty('display');
 button.removeAttribute('aria-hidden');
 button.tabIndex=0;
}
function enforceSingleOnlineCreate(){
 if(state?.view!=='exams')return;
 const root=$('#v109AssessmentBody')||$('#content');
 if(!root)return;
 const primary=root.querySelector('#createAssessmentV12');
 const legacy=root.querySelector('#addExam');
 hideButton(root.querySelector('#addCloAssessment'));
 hideButton(root.querySelector('#createReviewExam'));
 if(primary){
  hideButton(legacy);
  showButton(primary);
  primary.textContent='+ Tạo bài kiểm tra';
  primary.className='primary';
 }else if(legacy){
  showButton(legacy);
  legacy.textContent='+ Tạo bài kiểm tra';
  legacy.className='primary';
 }
}
function normalizeDetailStatusLabel(){
 const page=$('.assessment-detail-page'),button=page?.querySelector('#detailStatus');
 if(!button)return;
 const text=String(button.textContent||'').trim();
 if(/Đóng bài|Tạm đóng|Tạm dừng/i.test(text)){
  button.textContent='Tạm dừng';
  button.className='secondary';
 }else if(/Mở lại/i.test(text)){
  button.textContent='Mở lại';
  button.className='primary';
 }else if(/Phát hành/i.test(text)){
  button.textContent='Phát hành';
  button.className='primary';
 }
}
function enforceUi(){
 enforceSingleOnlineCreate();
 normalizeDetailStatusLabel();
}
function armObserver(){
 const host=$('#content');if(!host)return;
 if(observer)observer.disconnect();
 observer=new MutationObserver(()=>requestAnimationFrame(enforceUi));
 observer.observe(host,{childList:true,subtree:true});
 enforceUi();
}
function detailExamId(){
 try{
  const direct=sessionStorage.getItem(`aiclo:v115:active-exam:${state.subjectId}`);
  if(direct)return direct;
 }catch{}
 try{
  const user=state?.user?.id||'user';
  const raw=localStorage.getItem(`aiclo:v118:active:${user}:${state.subjectId}`);
  return JSON.parse(raw||'null')?.examId||null;
 }catch{return null}
}
async function handleDetailStatus(event,button){
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 if(statusBusy)return;
 const id=detailExamId();
 if(!id)return window.toast?.('Không xác định được bài kiểm tra.',true);
 statusBusy=true;button.disabled=true;
 try{
  const {data:exam,error}=await db.from('exams').select('id,title,status,published_at').eq('id',id).single();
  if(error)throw error;
  const current=exam.status||'draft';
  const next=current==='active'?'closed':'active';
  const pausing=current==='active',reopening=current==='closed';
  const ok=await confirmAction(
   pausing?'Tạm dừng bài kiểm tra':reopening?'Mở lại bài kiểm tra':'Phát hành bài kiểm tra',
   pausing
    ?'Tạm dừng sẽ ngăn sinh viên bắt đầu lượt làm mới. Dữ liệu và các lượt đã làm vẫn được giữ nguyên.'
    :reopening?'Bài kiểm tra sẽ được mở lại theo thời gian đã cấu hình.':'Sinh viên có thể truy cập bài theo thời gian đã cấu hình.',
   {confirmLabel:pausing?'Tạm dừng':reopening?'Mở lại':'Phát hành',danger:false}
  );
  if(!ok)return;
  const patch={status:next};
  if(next==='active'&&!exam.published_at)patch.published_at=new Date().toISOString();
  const {error:updateError}=await db.from('exams').update(patch).eq('id',id);
  if(updateError)throw updateError;
  const {data:fresh,error:freshError}=await db.from('exams').select('*').eq('id',id).single();
  if(freshError)throw freshError;
  window.toast?.(pausing?'Đã tạm dừng bài kiểm tra':reopening?'Đã mở lại bài kiểm tra':'Đã phát hành bài kiểm tra');
  const open=window.AICLO_ASSESSMENT?.openExamDetail||window.openExamAttempts;
  if(typeof open==='function')await open(fresh);else await window.render?.();
  requestAnimationFrame(enforceUi);
 }catch(error){window.err?.(error)}
 finally{statusBusy=false;if(document.body.contains(button))button.disabled=false}
}
function clickCapture(event){
 const publish=event.target?.closest?.('#ubPublish');
 if(publish){
  try{window.AICLO_SUBPAGE_STATE?.clear?.()}catch{}
  try{sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'online')}catch{}
 }
 const status=event.target?.closest?.('.assessment-detail-page #detailStatus');
 if(status){void handleDetailStatus(event,status);return}
 if(event.target?.closest?.('[data-view="exams"],[data-assessment-tab],#examDetailBack,#ubBack'))setTimeout(enforceUi,0);
}
function init(){
 document.addEventListener('click',clickCapture,true);
 document.addEventListener('change',event=>{if(event.target?.id==='subjectSelect')setTimeout(enforceUi,0)},true);
 window.addEventListener('pageshow',()=>setTimeout(enforceUi,0));
 armObserver();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V1211=Object.freeze({version:VERSION,enforce:enforceUi});
})();
