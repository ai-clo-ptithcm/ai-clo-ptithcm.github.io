# AI-CLO PTIT HCM — Handoff cho ChatGPT khi làm trong `/kiemnghiem`

Cập nhật: 07/09/2026

## 1. Trạng thái an toàn hiện tại

- Production đang chạy tại thư mục gốc của repo.
- Production phải giữ nguyên ở mốc đã xác nhận ổn: **V12.6.13**.
- Commit Production an toàn: `57a725a1a07ffd9982f429a51579c5fcff1ca7e1`.
- Môi trường kiểm nghiệm nằm tại `/kiemnghiem`.
- URL kiểm nghiệm: `https://ai-clo-ptithcm.github.io/kiemnghiem/app.html`.
- `/kiemnghiem` được khởi tạo từ V12.6.13 sạch, sau đó đã phục hồi có chọn lọc các chức năng A–D theo kiến trúc mới.
- Không xem `/kiemnghiem` hiện tại là bản sao nguyên trạng của V12.6.13 nữa.
- Chỉ Admin Nam dùng `/kiemnghiem` để kiểm nghiệm.
- `/kiemnghiem` vẫn dùng **cùng Supabase Production hiện tại**.
- Vì dùng chung Supabase, mọi thao tác ghi dữ liệu trong `/kiemnghiem` vẫn ghi vào database thật. Chỉ thử trên **môn Demo + ngân hàng câu hỏi Demo + bài kiểm tra Demo + tài khoản Demo**.

## 2. Quy tắc bắt buộc khi tiếp tục dự án

1. **Không sửa file Production ở root** khi đang phát triển hoặc kiểm nghiệm chức năng mới.
2. Mọi thay đổi mới chỉ được thực hiện bên trong `kiemnghiem/`, trừ khi người dùng nói rõ **“xuất bản”**.
3. Trước mỗi thay đổi đáng kể trong `/kiemnghiem`, tạo một branch backup mới từ `main`.
4. Không copy nguyên commit/bản lỗi cũ sang `/kiemnghiem`; chỉ phục hồi mục tiêu/chức năng và viết lại theo kiến trúc sạch.
5. Một hành vi chỉ có **một runtime owner**.
6. Không dùng wrapper/monkey-patch/capture event/MutationObserver để thay thế behavior của owner nếu có thể sửa trực tiếp owner.
7. Legacy layer không được render thêm UI hoặc giành quyền behavior nếu canonical owner đã tồn tại.
8. Không thay đổi Supabase schema, migration, RLS hay Edge Function nếu chưa có yêu cầu rõ và chưa chứng minh là cần.
9. Sau thay đổi đáng kể, phải kiểm tra lại Assessment đề cố định.
10. Nếu một thay đổi làm hỏng đề cố định, dừng ngay tại commit đó; không chồng thêm patch.
11. Chỉ khi `/kiemnghiem` đã kiểm nghiệm ổn và người dùng nói **“xuất bản”**, mới đồng bộ các file đã kiểm tra ra root Production.

## 3. Lỗi gốc đã khoanh ngày 07/09/2026

### Triệu chứng

Trong Assessment, khi chỉnh đề cố định, luồng rút câu từng bị lỗi: có lúc bấm **Rút câu** đứng im; có lúc Console báo:

`NotFoundError: Failed to set the 'innerHTML' property on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?`

### Mốc đã kiểm nghiệm

- **V12.6.13: hoạt động đúng.**
- **V12.6.14: lỗi xuất hiện.**

V12.6.14 bắt đầu can thiệp sâu vào Sửa nhanh câu hỏi trong Assessment. Các bản sau còn wrap Builder, proxy DB, capture click và dùng MutationObserver. Những kiểu tích hợp đó không được phục hồi lại.

## 4. Trạng thái phục hồi A–D hiện tại

### Nhóm A — AI trong Assessment — ✅ đã phục hồi

Đã thực hiện trong canonical owner, chủ yếu `js/assessment/online-builder.js`:

- nút **AI sinh câu hỏi** tại vị trí câu hỏi;
- mở cấu hình ngắn trước khi gọi AI;
- khóa Chương/Chủ đề/CLO theo vị trí hiện tại;
- có yêu cầu bổ sung;
- câu AI chỉ được đưa vào ngân hàng theo quy tắc hiện có;
- UI dùng chữ **AI**, không hiển thị Gemini cho người dùng;
- không wrap `createOnlineBuilderModule`, không global capture click, không proxy DB, không MutationObserver để chèn behavior.

### Nhóm B — canonical owners — ✅ đã phục hồi

- Dashboard router owner: `js/system/dashboard.js`.
- Tổng quan học phần owner: `js/courses/overview.js` (`AICLO_OVERVIEW`).
- Danh sách thành viên owner: `js/courses/members.js` (`AICLO_COURSE_MEMBERS`).
- Hồ sơ người dùng owner: `js/system/profile.js` (`AICLO_PROFILE`).
- Tên thành viên gọi trực tiếp API Profile; không quét/sửa DOM hậu kỳ.
- Đã xử lý hiện tượng tab Sinh viên/Giảng viên bị lặp do legacy layer gọi lồng canonical members owner.

### Nhóm C — Shell / Navigation — ✅ đã phục hồi

Phân quyền hiện tại:

- `js/ui/navigation.js`: `state.space`, `state.view`, lịch sử Back, `navigate`, `enterSystem`, `enterCourse`.
- `js/ui/shell.js`: sidebar, header/context, tên học phần, nút quay lại/về hệ thống, shell UI.

Quy tắc:

- Shell không wrap `window.render`.
- Navigation không sở hữu HTML shell.
- Không tạo vòng render lồng nhau.

### Nhóm D — history / account / UI — ✅ đã phục hồi có chọn lọc

- Giữ history/back hiện có trong Navigation.
- Giữ `js/ui/subpage-state.js` cho trạng thái trang con.
- Không phục hồi history engine cũ dựa trên MutationObserver/capture click.
- Đã phục hồi tài khoản sinh viên tạm kiểu `MSSV@aiclo.local` và luồng Admin đổi email khi phù hợp.
- Đã chuẩn hóa wording UI từ **Gemini** sang **AI**.

## 5. Kiến trúc runtime hiện tại

### Assessment

Owner/router chính:

```text
js/assessment.js
  ├─ js/assessment/online-lifecycle.js
  ├─ js/assessment/online-builder.js
  ├─ js/assessment/student-attempt.js
  ├─ js/assessment/results.js
  └─ js/assessment/final-exam.js
```

`online-builder.js` sở hữu trực tiếp ma trận, rút câu, fixed/mixed, đổi câu và AI tại vị trí câu hỏi.

### Dashboard

```text
system/dashboard.js
  ├─ system space → System Dashboard
  └─ course space → AICLO_OVERVIEW.render()
```

`courses/overview.js` chỉ sở hữu Tổng quan học phần.

### Members / Profile

```text
courses/members.js
  → AICLO_PROFILE.openUserProfile(...)
  → system/profile.js
```

Không dùng Profile để quét DOM của Members sau render.

### Shell / Navigation / State

```text
navigation.js → điều hướng + history/back
shell.js      → shell UI
subpage-state.js → state trang con/workspace
```

Không tạo thêm một history engine thứ hai.

## 6. Quy tắc AI hiện tại

Nguyên tắc bắt buộc:

- **Người dùng nhìn thấy:** dùng từ **AI**.
- **Metadata/backend:** có thể giữ `gemini`, `origin_type='gemini'`, provider/model/log để tương thích dữ liệu và backend hiện có.

Ví dụ hợp lệ:

- UI: `AI hỗ trợ`, `AI sinh câu hỏi`, `AI đang phân tích`, `Nhận xét của AI`.
- Kỹ thuật: `origin_type = 'gemini'` vẫn được giữ nếu schema hiện tại dùng giá trị này.

Không đổi tên kỹ thuật chỉ để đồng bộ wording UI.

## 7. Quy tắc Assessment cần bảo vệ

Các chế độ chính:

- `common_fixed`
- `student_fixed`
- `attempt_random`
- `mixed_fixed_random`

Nguyên tắc:

- random-only builder không hiện danh sách câu cụ thể;
- mixed phải chọn ít nhất một câu cố định trước;
- phần random của mixed chỉ hiển thị số lượng/thống kê, không hiện danh sách câu;
- fixed chiếm đúng quota từng ô ma trận;
- fixed IDs lưu trong blueprint theo cấu trúc hiện hành;
- thay đổi ma trận phải làm mất hiệu lực selection cũ khi nghiệp vụ yêu cầu;
- thao tác **Rút câu/Rút phần còn lại** phải hoạt động ngay lần nhấn đầu tiên.

## 8. Chuỗi smoke test bắt buộc cho đề cố định

Sau thay đổi đáng kể, test trên Demo:

1. Vào **Đánh giá**.
2. Tạo/chỉnh bài ở chế độ **đề chung cố định**.
3. Chọn Chương/Chủ đề.
4. Nhập ma trận CLO.
5. Bấm **Rút câu hỏi**.
6. Xác nhận đúng số câu.
7. Đổi một câu.
8. Sửa nhanh/AI sinh câu nếu phần đó đang được kiểm nghiệm.
9. Lưu.
10. Mở lại.
11. Chỉnh ma trận nếu cho phép.
12. Rút lại.
13. Lưu lại.
14. Kiểm tra Console không có lỗi DOM/event.

Nếu lỗi tại bất kỳ bước nào thì dừng ở commit gần nhất.

## 9. Quy ước dữ liệu kiểm nghiệm

- Chỉ dùng môn Demo.
- Chỉ dùng ngân hàng câu hỏi Demo.
- Chỉ tạo/sửa/xóa câu hỏi Demo.
- Chỉ tạo bài kiểm tra Demo.
- Chỉ dùng tài khoản Demo cho thử nghiệm tài khoản.
- Không dùng học phần có sinh viên thật.
- Không xóa/sửa dữ liệu thật của Production từ `/kiemnghiem`.

## 10. Quy ước xuất bản

Chỉ khi người dùng nói rõ **“xuất bản”**:

1. Xác định chính xác file nào trong `/kiemnghiem` đã kiểm nghiệm ổn.
2. Tạo backup mới của Production.
3. Copy đúng các file staging đã kiểm nghiệm ra root tương ứng.
4. Không mang file thử, log, marker staging hoặc code debug.
5. So diff trước/sau.
6. Xác nhận không kéo theo patch legacy ngoài ý muốn.
7. Deploy Production.
8. Smoke test ngắn trên Production.

## 11. Mốc Git quan trọng

- Production an toàn V12.6.13: `57a725a1a07ffd9982f429a51579c5fcff1ca7e1`.
- Commit tạo `/kiemnghiem` từ V12.6.13: `d863f2d0fd7c746bc31602f805e1df56876f49ac`.
- Backup trước khi tạo `/kiemnghiem`: `backup-before-kiemnghiem-v12.6.13-20260907`.
- Backup trước khi refresh tài liệu staging hiện tại: `backup-before-kiemnghiem-md-refresh-20260907`.

## 12. Điều ChatGPT phải nhớ khi mở chat mới

Nếu người dùng nói “tiếp tục kiểm nghiệm”, “tiếp tục bản staging”, hoặc tương tự:

- đọc `kiemnghiem/README.md` và file này trước;
- chỉ sửa trong `/kiemnghiem`;
- không đụng root Production;
- coi A–D là **đã phục hồi**, không làm lại từ đầu;
- ưu tiên canonical owner và sửa trực tiếp owner;
- tránh wrapper/observer/capture/DOM patch hậu kỳ;
- sau thay đổi đáng kể, test lại **đề cố định → ma trận → Rút câu → chỉnh → lưu**;
- chỉ xuất bản khi người dùng ra lệnh rõ ràng.
