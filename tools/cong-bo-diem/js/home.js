
import {$,esc,api,busy,showQR,bindQR,stamp,status,fieldError} from './api.js';
let offset=0,count=0;
async function load(){
 const list=await api('list',{search:$('#search').value.trim(),offset});count=list.length;
 $('#list').innerHTML=list.length?list.map(g=>'<article class="card"><span class="badge">'+esc(g.class_name)+'</span><h2>'+esc(g.title)+'</h2><p>'+esc(g.teacher)+' · '+esc(g.semester)+'</p><small>Cập nhật '+esc(stamp(g.updated_at))+'</small><div class="toolbar"><a class="button primary" href="tra-cuu/?id='+g.id+'">Tra cứu</a><a class="button" href="quan-ly/?id='+g.id+'">Chỉnh sửa</a><button data-qr="'+g.id+'">QR</button></div></article>').join(''):'<p class="muted">Không có công bố phù hợp.</p>';
 $('#page').textContent='Trang '+(offset/50+1);$('#prev').disabled=offset===0;$('#next').disabled=count<50;
}
$('#searchBtn').onclick=()=>{offset=0;busy($('#searchBtn'),load);};
$('#search').onkeydown=e=>{if(e.key==='Enter')$('#searchBtn').click();};
$('#prev').onclick=()=>{offset=Math.max(0,offset-50);busy(null,load);};
$('#next').onclick=()=>{offset+=50;busy(null,load);};
$('#list').onclick=e=>{const button=e.target.closest('[data-qr]');if(button)busy(button,()=>showQR(button.dataset.qr));};
$('#openManage').onclick=()=>{$('#manageLink').value='';$('#manageDialog').showModal();};
$('#cancelManage').onclick=()=>$('#manageDialog').close();
$('#manageForm').onsubmit=e=>{e.preventDefault();busy(null,async()=>{
 const text=$('#manageLink').value.trim();let value=text;
 if(!/^[0-9a-f-]{36}$/i.test(value)){
  let link;try{link=new URL(text);}catch{throw fieldError('Dán link công bố đã lưu.',['#manageLink']);}
  if(!['https://ai-clo-ptithcm.github.io'].includes(link.origin)||!/^\/tools\/cong-bo-diem\/(tra-cuu|quan-ly)\/?$/.test(link.pathname))throw fieldError('Link phải là trang tra cứu hoặc quản lý công bố của AI-CLO PTITHCM.',['#manageLink']);
  value=link.searchParams.get('id')||'';
 }
 if(!/^[0-9a-f-]{36}$/i.test(value))throw fieldError('Link chưa có thông tin công bố hợp lệ.',['#manageLink']);
 location.href='quan-ly/?id='+encodeURIComponent(value);
});};
bindQR();busy(null,load);

