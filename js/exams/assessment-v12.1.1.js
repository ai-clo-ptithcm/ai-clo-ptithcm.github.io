/* AI-CLO PTITHCM V12.1.2 — Assessment UI/status lifecycle stability patch. */
(()=>{
'use strict';
const VERSION='12.1.2';
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
function statusFromUi(page,button){
 const badge=page?.querySelector('.assessment-detail-head .badge');
 const statusText=String(badge?.textContent||'').trim();
 const buttonText=String(button?.textContent||'').trim();
 if(/Tạm đóng|Đã đóng/i.test(statusText)||/Mở lại/i.test(buttonText))return'closed';
 if(/Bản nháp/i.test(statusText)||/Phát hành/i.test(buttonText))return'draft';
 return'active';
}
function normalizeDetailStatusLabel(){
 const page=$('.assessment-detail-page'),button=page?.querySelector('#detailStatus');
 if(!button)return;
 const status=statusFromUi(page,button);
 if(status==='closed'){
  button.textContent='Mở lại';
  button.className='primary';
 }else if(status==='draft'){
  button.textContent='Phát hành';
  button.className='primary';
 }else{
  button.textContent='Tạm dừng';
  button.className='secondary';
 }
}
function enforceUi(){
 enforceSingleOnlineCreate();
 normalizeDetailStatusLabel();
}
function stabilizeUi(){
 requestAnimationFrame(()=>requestAnimationFrame(enforceUi));
 setTimeout(enforceUi,0);
 setTimeout(enforceUi,90);
 setTimeout(enforceUi,260);
}
function armObserver(){
 const host=$('#content');if(!host)return;
 if(observer)observer.disconnect();
 observer=new MutationObserver(stabilizeUi);
 observer.observe(host,{childList:true,subtree:true});
 stabilizeUi();
}
async function handleDetailStatus(event,button){
 event?.preventDefault?.();
 event?.stopPropagation?.();
 event?.stopImmediatePropagation?.();
 if(statusBusy)return;
 const id=detailExamId();
 if(!id)return toast('Không xác định được bài kiểm tra.',true);
 statusBusy=true;
 button.disabled=true;
 try{
  const {data:exam,error}=await db.from('exams').select('id,title,status,published_at').eq('id',id).single();
  if(error)throw error;
  const current=exam.status||'draft';
  const next=current==='active'?'closed':'active';
  const pausing=current==='active';
  const reopening=current==='closed';
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
  const {data:fresh,error:updateError}=await db.from('exams').update(patch).eq('id',id).select('*').single();
  if(updateError)throw updateError;
  if(!fresh||fresh.status!==next)throw new Error(`Không đổi được trạng thái bài kiểm tra sang ${next}.`);
  toast(pausing?'Đã tạm dừng bài kiểm tra':reopening?'Đã mở lại bài kiểm tra':'Đã phát hành bài kiểm tra');
  const open=window.AICLO_ASSESSMENT?.openExamDetail||window.openExamAttempts;
  if(typeof open==='function')await open(fresh);else await render();
  stabilizeUi();
 }catch(error){
  console.error('AI-CLO V12.1.2 status update failed',error);
  err(error);
 }finally{
  statusBusy=false;
  if(document.body.contains(button))button.disabled=false;
 }
}
function clickCapture(event){
 const publish=event.target?.closest?.('#ubPublish');
 if(publish){
  try{window.AICLO_SUBPAGE_STATE?.clear?.()}catch{}
  try{sessionStorage.setItem(`aiclo:v109:assessment:${state.subjectId}`,'online')}catch{}
 }
 const status=event.target?.closest?.('.assessment-detail-page #detailStatus');
 if(status){void handleDetailStatus(event,status);return}
 if(event.target?.closest?.('[data-view="exams"],[data-assessment-tab],#examDetailBack,#ubBack'))stabilizeUi();
}
function init(){
 document.addEventListener('click',clickCapture,true);
 document.addEventListener('change',event=>{if(event.target?.id==='subjectSelect')stabilizeUi()},true);
 window.addEventListener('pageshow',stabilizeUi);
 armObserver();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.AICLO_ASSESSMENT_V1211=Object.freeze({version:VERSION,enforce:enforceUi,setStatus:handleDetailStatus});
})();
