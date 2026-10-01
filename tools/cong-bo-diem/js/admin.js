
import {$,esc,api,busy,client,stamp,status,fieldError} from './api.js';
let offset=0;
async function list(){
 const rows=await api('list',{search:$('#search').value.trim(),offset},true);
 $('#adminList').innerHTML='<table><thead><tr><th>Lớp</th><th>Công bố / Giảng viên</th><th>Trạng thái</th><th>Cập nhật</th><th>Quản lý</th></tr></thead><tbody>'+rows.map(g=>'<tr><td>'+esc(g.class_name)+'</td><td>'+esc(g.title)+'<br><small>'+esc(g.teacher)+' · '+esc(g.semester)+'</small></td><td>'+(g.published?'Đang mở':'Bản nháp / Tắt')+'</td><td>'+esc(stamp(g.updated_at))+'</td><td><div class="toolbar"><a class="button" href="../quan-ly/?id='+g.id+'&admin=1">Chỉnh sửa</a><button data-reset="'+g.id+'">Đặt lại mật khẩu</button><button class="danger" data-delete="'+g.id+'">Xóa</button></div></td></tr>').join('')+'</tbody></table>';
 $('#page').textContent='Trang '+(offset/50+1);$('#prev').disabled=offset===0;$('#next').disabled=rows.length<50;
}
async function init(){
 const settings=await api('settings',{},true);
 $('#loginPanel').hidden=true;$('#adminPanel').hidden=false;
 $('#codeState').textContent=settings.code_configured?'Đã thiết lập mã tạo. Bạn có thể đổi mã bên dưới.':'Chưa có mã tạo. Thiết lập mã trước khi giảng viên sử dụng.';
 $('#googleState').textContent=settings.google_email?'Giảng viên chia sẻ Google Sheets với quyền Người xem cho: '+settings.google_email:'Chưa cấu hình Google Sheets. Excel và dán bảng có thể dùng ngay. Cần tạo tài khoản dịch vụ Google và thêm secret GRADE_GOOGLE_SERVICE_ACCOUNT_JSON theo hướng dẫn.';
 await list();
}
$('#loginForm').onsubmit=e=>{e.preventDefault();busy($('#loginBtn'),async()=>{
 const {error}=await client.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
 if(error)throw fieldError('Đăng nhập không thành công. Kiểm tra email và mật khẩu.',['#email','#password']);
 $('#password').value='';try{await init();status('Đã đăng nhập admin.');}catch(e){await client.auth.signOut();throw e;}
});};
$('#logout').onclick=()=>busy($('#logout'),async()=>{await client.auth.signOut();$('#adminPanel').hidden=true;$('#loginPanel').hidden=false;$('#adminList').replaceChildren();status('Đã đăng xuất.');});
$('#codeForm').onsubmit=e=>{e.preventDefault();busy($('#codeBtn'),async()=>{await api('set_code',{code:$('#code').value},true);$('#code').value='';await init();status('Đã lưu mã tạo chung.');});};
$('#refresh').onclick=()=>{offset=0;busy($('#refresh'),list);};
$('#search').onkeydown=e=>{if(e.key==='Enter')$('#refresh').click();};
$('#prev').onclick=()=>{offset=Math.max(0,offset-50);busy(null,list);};
$('#next').onclick=()=>{offset+=50;busy(null,list);};
$('#adminList').onclick=e=>{
 const reset=e.target.closest('[data-reset]'),del=e.target.closest('[data-delete]');
 if(reset){const password=prompt('Mật khẩu chỉnh sửa mới (tối thiểu 8 ký tự). Các phiên chỉnh sửa cũ sẽ hết hiệu lực:');if(password)busy(reset,async()=>{await api('reset_password',{id:reset.dataset.reset,password},true);status('Đã đặt lại mật khẩu. Hãy gửi mật khẩu mới riêng cho giảng viên.');});}
 if(del&&confirm('Xóa công bố và file gốc? Thao tác này không thể hoàn tác.'))busy(del,async()=>{await api('delete',{id:del.dataset.delete},true);await list();status('Đã xóa công bố.');});
};
busy(null,async()=>{const {data}=await client.auth.getSession();if(data.session)await init();});

