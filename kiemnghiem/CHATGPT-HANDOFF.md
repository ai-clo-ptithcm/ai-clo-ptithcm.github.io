# AI-CLO PTIT HCM — Handoff cho ChatGPT khi làm trong `/kiemnghiem`

Cập nhật: 07/09/2026

## 1. Trạng thái an toàn hiện tại

- Production đang chạy tại thư mục gốc của repo.
- Production phải giữ nguyên ở mốc đã xác nhận ổn: **V12.6.13**.
- Commit Production an toàn: `57a725a1a07ffd9982f429a51579c5fcff1ca7e1`.
- Môi trường kiểm nghiệm nằm tại: `/kiemnghiem`.
- URL kiểm nghiệm: `https://ai-clo-ptithcm.github.io/kiemnghiem/app.html`.
- `/kiemnghiem` được tạo bằng cách copy bản V12.6.13 để làm nền sạch.
- Chỉ Admin Nam dùng `/kiemnghiem` để kiểm nghiệm.
- `/kiemnghiem` vẫn dùng **cùng Supabase production hiện tại**.
- Vì dùng chung Supabase, mọi thao tác ghi dữ liệu trong `/kiemnghiem` vẫn ghi vào database thật. Vì vậy chỉ kiểm nghiệm trên **môn Demo + ngân hàng câu hỏi Demo + bài kiểm tra Demo riêng**.

## 2. Quy tắc bắt buộc khi ChatGPT tiếp tục dự án

1. **Không sửa file Production ở root** khi đang phát triển chức năng mới.
2. Mọi thay đổi mới chỉ được thực hiện bên trong `kiemnghiem/`, trừ khi người dùng nói rõ **“xuất bản”**.
3. Trước mỗi thay đổi đáng kể trong `/kiemnghiem`, tạo một branch backup mới từ `main`.
4. Không copy nguyên các commit lỗi cũ sang `/kiemnghiem`; chỉ phục hồi **mục tiêu/chức năng**, viết lại theo kiến trúc sạch.
5. Một hành vi chỉ có **một runtime owner**. Không dùng wrapper/monkey-patch/capture event/MutationObserver để thay thế behavior của owner nếu có thể sửa trực tiếp owner.
6. Không thay đổi Supabase schema, migration, RLS hay Edge Function nếu chưa có yêu cầu rõ và chưa chứng minh là cần.
7. Sau mỗi nhóm thay đổi, phải kiểm tra lại Assessment đề cố định trước khi làm tiếp.
8. Nếu một thay đổi làm hỏng đề cố định, dừng ngay tại commit đó, không tiếp tục chồng thêm bản vá.
9. Chỉ khi `/kiemnghiem` đã kiểm nghiệm ổn và người dùng nói **“xuất bản”**, mới đồng bộ các file đã kiểm tra từ `/kiemnghiem` ra root Production.

## 3. Lỗi đã khoanh được ngày 07/09/2026

### Triệu chứng chính

Trong Assessment, khi **chỉnh đề cố định**, luồng rút câu bị lỗi. Có lúc bấm **Rút câu** đứng im; có lúc trước đó Console báo:

`NotFoundError: Failed to set the 'innerHTML' property on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?`

### Mốc đã kiểm nghiệm

- **V12.6.13: hoạt động đúng.**
- **V12.6.14: lỗi xuất hiện.**

Do đó, lỗi bắt đầu từ thay đổi sau V12.6.13, đặc biệt vùng `quick-edit-window.js` của V12.6.14 trở đi.

### Nguyên nhân kỹ thuật đáng nghi nhất

V12.6.14 bắt đầu can thiệp sâu vào luồng **Sửa nhanh câu hỏi trong Assessment**: chặn Save, ghi trực tiếp về câu gốc trong ngân hàng rồi cho handler Builder chạy tiếp.

V12.6.15 tiếp tục làm sâu hơn bằng cách:

- wrap `createOnlineBuilderModule`;
- proxy `db`;
- wrap `modal` và `notify`;
- dùng global capture click cho nút AI;
- dùng `MutationObserver` trên `#content`.

Đây là kiểu tích hợp cần tránh khi viết lại.

V12.6.21 còn thay đổi global `window.render` và lifecycle shell/navigation. Đây cũng là vùng phải kiểm nghiệm riêng vì có tác động toàn app.

## 4. Chuỗi kiểm tra bắt buộc cho Assessment đề cố định

Sau mỗi nhóm thay đổi, phải test ít nhất chuỗi sau trên môn Demo:

1. Vào **Đánh giá**.
2. Tạo bài kiểm tra mới ở chế độ **đề chung cố định**.
3. Chọn Chương/Chủ đề.
4. Nhập ma trận CLO.
5. Bấm **Rút câu hỏi**.
6. Xác nhận đã rút đúng số câu.
7. Đổi một câu.
8. Sửa nhanh một câu nếu chức năng đó đang được kiểm nghiệm.
9. Lưu bài kiểm tra.
10. Mở lại bài kiểm tra vừa tạo.
11. Chỉnh ma trận nếu cho phép.
12. Rút lại câu.
13. Lưu lại.
14. Kiểm tra Console không có lỗi DOM/event.

Nếu một bước trên lỗi thì dừng, không làm nhóm tiếp theo.

## 5. Các chức năng cần làm lại trong `/kiemnghiem`

Mục tiêu là phục hồi các ý tưởng từ **V12.6.15 đến V12.6.27**, nhưng theo cách an toàn, không copy nguyên cách cài đặt cũ.

### Nhóm A — V12.6.15–V12.6.16: AI trong Assessment

Mục tiêu:

- Nút **AI sinh câu hỏi** tại từng vị trí câu hỏi trong Assessment.
- Trước khi gọi AI, mở cửa sổ cấu hình ngắn.
- Chương, Chủ đề, CLO phải khóa theo vị trí hiện tại trong ma trận.
- Có ô cho giảng viên nhập yêu cầu thêm cho AI.
- Câu AI sinh ra chỉ được lưu vào ngân hàng luyện tập/kiểm tra theo đúng quy tắc hiện có.
- UI hiển thị chữ **AI**, không hiển thị “Gemini” cho người dùng.
- Chuỗi `gemini` vẫn được giữ ở metadata kỹ thuật/provider/log nếu backend đang dùng nó.

Cách làm mới:

- Sửa trực tiếp owner phù hợp của Assessment, ưu tiên `kiemnghiem/js/assessment/online-builder.js`.
- Không dùng global capture click.
- Không proxy `db` chỉ để chèn thêm payload.
- Không dùng MutationObserver để sửa text/nút sau render.
- Không wrap `createOnlineBuilderModule` từ file UI khác.

### Nhóm B — V12.6.18–V12.6.20: canonical owners

Mục tiêu:

- Dashboard có owner rõ ràng.
- Danh sách thành viên học phần có owner rõ ràng.
- Hồ sơ người dùng có owner rõ ràng.
- Từ danh sách thành viên, tên người dùng mở đúng hồ sơ canonical.

Nguyên tắc:

- Không tạo hai module cùng render một màn hình.
- Không để legacy wrapper giành quyền render sau owner mới.

### Nhóm C — V12.6.21–V12.6.22: Shell/Navigation

Mục tiêu:

- Chuẩn hóa shell/navigation runtime owner.
- Sửa hiện tượng nháy layout trên mobile/system dashboard.

Cảnh báo:

- Không được thay `window.render` theo cách có thể phá domain render hoặc gây render lồng nhau.
- Phải test riêng: Dashboard, Học phần, Ngân hàng, Đánh giá, Kết quả, Thông báo, Người dùng.
- Sau nhóm này phải test lại đầy đủ đề cố định.

### Nhóm D — V12.6.23–V12.6.27: navigation/history/account/UI

Mục tiêu cần phục hồi theo yêu cầu đã trao đổi trước đó:

- Lịch sử màn hình và nút Back hợp lý.
- Quay lại đúng màn hình trước thay vì luôn về hệ thống.
- Giữ trạng thái trang con cần thiết khi điều hướng.
- Các cải tiến tài khoản/tạm thời nếu còn phù hợp.
- Chuẩn hóa text UI liên quan AI.

Các backup cũ còn trong repo để tham khảo mục tiêu, nhưng không được lấy nguyên code nếu code đó kéo theo lỗi.

## 6. Thứ tự triển khai khuyến nghị

Làm theo từng nhóm nhỏ:

1. **Nhóm A: V12.6.15–16** → kiểm tra Assessment đề cố định.
2. **Nhóm B: V12.6.18–20** → kiểm tra Dashboard/Thành viên/Hồ sơ + Assessment.
3. **Nhóm C: V12.6.21–22** → kiểm tra navigation/mobile + Assessment.
4. **Nhóm D: V12.6.23–27** → kiểm tra tổng.

Không gom tất cả thành một commit lớn.

## 7. Quy ước dữ liệu kiểm nghiệm

- Tạo riêng một **môn Demo** trong Supabase production.
- Tạo **ngân hàng câu hỏi Demo** riêng.
- Chỉ thử tạo/sửa/xóa câu hỏi trong Demo.
- Chỉ tạo bài kiểm tra Demo.
- Không dùng học phần có sinh viên thật để thử chức năng mới.
- Không xóa hoặc sửa dữ liệu thật của Production từ `/kiemnghiem`.

## 8. Quy ước xuất bản

Chỉ khi người dùng nói **“xuất bản”**:

1. Xác định chính xác file nào trong `/kiemnghiem` đã kiểm nghiệm ổn.
2. Tạo backup mới của Production.
3. Copy đúng các file đã kiểm nghiệm từ `/kiemnghiem/...` ra root tương ứng.
4. Không mang theo file thử, log, marker staging hoặc code debug.
5. So diff trước/sau và xác nhận chỉ đúng file dự kiến thay đổi.
6. Deploy Production.
7. Chạy smoke test ngắn trên Production.

## 9. Mốc Git quan trọng

- Production an toàn V12.6.13: `57a725a1a07ffd9982f429a51579c5fcff1ca7e1`
- Commit tạo `/kiemnghiem` từ V12.6.13: `d863f2d0fd7c746bc31602f805e1df56876f49ac`
- Backup trước khi tạo `/kiemnghiem`: `backup-before-kiemnghiem-v12.6.13-20260907`
- Backup trước file handoff này: `backup-before-kiemnghiem-chatgpt-handoff-20260907`

## 10. Điều ChatGPT phải nhớ khi mở chat mới

Nếu người dùng nói “tiếp tục kiểm nghiệm”, “làm bản mới”, “tiếp tục V12.6.15–27”, hoặc tương tự:

- Đọc file này trước.
- Chỉ sửa trong `/kiemnghiem`.
- Không đụng root Production.
- Bắt đầu từ V12.6.13 sạch.
- Ưu tiên phục hồi chức năng theo kiến trúc sạch, không khôi phục nguyên patch lỗi cũ.
- Sau mỗi nhóm thay đổi, test lại luồng **đề cố định → ma trận → Rút câu → chỉnh → lưu**.
- Chỉ xuất bản khi người dùng ra lệnh rõ ràng.
