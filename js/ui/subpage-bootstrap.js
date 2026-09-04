/* AI-CLO PTITHCM V11.8.2 — restore saved navigation context before the first app render. */
(()=>{
'use strict';
const api=window.AICLO_SUBPAGE_STATE;if(!api)return;
function apply(){return api.applyStartupLocation?.()||false}
apply();
const base=window.enterApp;
if(typeof base==='function'&&!base.__aicloSubpageState){const wrapped=function(...args){apply();const r=base.apply(this,args);Promise.resolve(r).finally(()=>setTimeout(()=>api.restore?.(),45));return r};wrapped.__aicloSubpageState=true;wrapped.__aicloBase=base;window.enterApp=wrapped}
})();
