/* AI-CLO PTITHCM V11.8.1 — restore saved navigation context before the first app render. */
(()=>{
'use strict';
const api=window.AICLO_SUBPAGE_STATE;if(!api)return;
function apply(){const x=api.current?.();if(!x)return false;if(x.subjectId){state.subjectId=x.subjectId;try{localStorage.setItem('aiclo_subject',x.subjectId)}catch{}}if(x.space){state.space=x.space;try{localStorage.setItem('aiclo_space',x.space)}catch{}}if(x.view)state.view=x.view;return true}
apply();
const base=window.enterApp;
if(typeof base==='function'&&!base.__aicloSubpageState){const wrapped=function(...args){apply();const r=base.apply(this,args);Promise.resolve(r).finally(()=>setTimeout(()=>api.restore?.(),40));return r};wrapped.__aicloSubpageState=true;wrapped.__aicloBase=base;window.enterApp=wrapped}
})();
