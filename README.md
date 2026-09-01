# AI-CLO PTITHCM — V10.9

V10.9 tổ chức rõ hai không gian **Tổng quan hệ thống** và **Tổng quan học phần** theo từng vai trò Admin, Giảng viên và Sinh viên. Menu học phần dùng thống nhất **Chương · Chủ đề · CLO**; mục **Đánh giá** của giảng viên tách thành hai tab **Bài kiểm tra trực tuyến** và **Đề thi cuối kỳ**.

Hồ sơ được phân biệt theo ngữ cảnh: **Hồ sơ của tôi**, **Quản lý tài khoản** dành cho Admin và **Hồ sơ học tập** trong học phần hiện tại dành cho giảng viên. Trang công khai đồng thời xác nhận **Chấm thi CLO** là công cụ công khai cho mọi người, không yêu cầu đăng nhập.

V10.9 không yêu cầu migration Supabase hoặc deploy Edge Function mới.

---

# AI-CLO PTITHCM — V10.6

**V10.6 là phiên bản chuẩn hiện tại của AI-CLO PTITHCM.**

V10.6 tập trung hoàn thiện trải nghiệm sử dụng và tích hợp quy trình chấm thi CLO. Ngân hàng câu hỏi giữ trạng thái khi thêm/sửa, giữ bộ lọc và vị trí quay lại danh sách, tối ưu bảng hiển thị và hỗ trợ xóa nhiều câu hỏi. Quản lý người dùng được tách rõ với **Danh sách lớp**: Admin chỉ thêm/bớt tài khoản đã tồn tại khỏi học phần, còn thống kê lớp và trang Tổng quan đều được tính riêng theo học phần đang chọn.

Phiên bản này đồng thời tích hợp công cụ **Chấm thi CLO** tại `cham-thi-clo/`, giữ riêng CSS/JS/libs/templates, đồng bộ favicon, màu sắc, nav và footer với AI-CLO PTITHCM. Liên kết **Chấm thi CLO** được bổ sung vào footer của hệ thống; các link điều hướng của trang chấm thi mở ở tab mới.

V10.6 **không yêu cầu migration Supabase mới và không thay đổi model Gemini** cho các chỉnh sửa trên.

Xem chi tiết tại [`VERSION-v10.6.md`](VERSION-v10.6.md).

---

# AI-CLO PTITHCM — V10.5

## Nâng cấp V10.5

V10.5 tách trang **Ngân hàng câu hỏi** thành hai tab con rõ ràng: **Luyện tập - kiểm tra** và **🔒 Ngân hàng đề thi - bảo mật**. Một câu có thể lưu ở một ngân hàng hoặc **Cả hai**. Bài kiểm tra trực tuyến chỉ được lấy câu thuộc Luyện tập/Cả hai; Supabase cũng chặn câu chỉ thuộc ngân hàng đề thi ở tầng database.

Bản này đồng thời thay favicon đỏ AI·CLO, sửa lỗi quay lại màn hình ngân hàng làm từ khóa thành `all`, giữ trạng thái bộ lọc/tab/vị trí cuộn, và cân lại độ rộng các cột Mã câu — Nội dung — Chương/Chủ đề.

Nếu đã triển khai V10.4, chạy `supabase/v10.5-upgrade.sql` rồi cập nhật frontend. **Không cần deploy Edge Function mới.**

Xem `HUONG-DAN-CAP-NHAT-V10.5.md`.

---

# AI-CLO PTITHCM — V10.4

## Nâng cấp V10.4

V10.4 tập trung hoàn thiện **hồ sơ đề thi cuối kỳ**: BM06/BM07/BM08 xuất DOCX thật, BM07 tự bố trí 4 phương án theo 1 dòng / 2 dòng / 4 dòng để tránh wrap; hồ sơ đã chốt có **Mở / Sửa / Xuất**, quay lại đúng luồng chỉnh sửa đề, lưu lịch sử tạo/sửa/xuất và cho **người tạo hoặc Admin** xóa hồ sơ. Favicon mới dùng chữ `AI·CLO / PTITHCM`.

Nếu đã triển khai V10.3, chỉ cần chạy thêm `supabase/v10.4-upgrade.sql` rồi cập nhật frontend. **Không cần deploy Edge Function mới.** Các Edge Function Gemini vẫn self-contained.

Xem `HUONG-DAN-CAP-NHAT-V10.4.md`.

---

# AI-CLO PTITHCM — V10.1

## Nâng cấp V10.1

V10.1 sửa thanh điều hướng trên điện thoại theo bố cục hai hàng, giữ cố định thứ tự Home → Thông báo → Học phần và không để tiêu đề đẩy tràn màn hình. Luồng tạo câu hỏi Gemini hiển thị nội dung lỗi Edge Function ngay trong trang, bỏ tham số lấy mẫu không tương thích của Gemini 3.6 và cho phép cấu hình model bằng secret `GEMINI_MODEL`.

Phần sinh bài kiểm tra cũng được siết lại: giảng viên chọn rõ nguồn **Luyện tập · Kiểm tra** hoặc **Đề thi · Bảo mật**; hệ thống chỉ đưa câu có đủ bốn lựa chọn A–D và đáp án hợp lệ vào pool, dùng thuật toán trộn đều, đồng thời tự phân bổ mặc định đủ 10 câu theo số CLO thực tế.

V10.1 không có migration cơ sở dữ liệu mới. Cần redeploy Edge Function `generate-questions` trong thư mục `supabase/functions/generate-questions`.

## Nâng cấp V10

V10 sửa triệt để lỗi nhấn **Chi tiết** nhưng không hiển thị và thống nhất toàn bộ quy trình Ngân hàng câu hỏi trong trang: xem chi tiết, thêm, sửa, tạo bằng Gemini, xem phiên AI và duyệt bản nháp. Nút Sửa/Xóa được dựng trước dữ liệu phụ nên vẫn hoạt động nếu lịch sử hoặc đề nghị chỉnh sửa chưa tải được.

V10 không có migration cơ sở dữ liệu mới. Nếu nâng trực tiếp từ V9.5 trở xuống, vẫn phải chạy `supabase/v9.6-question-bank.sql` trước.

---

## Nâng cấp V9.6

V9.6 bổ sung ngân hàng câu hỏi hai nhóm (luyện tập và đề thi bảo mật), quy trình duyệt/đề nghị chỉnh sửa, phát hiện câu tương tự, kết quả CLO sinh viên theo chương với nhận xét Gemini theo yêu cầu, đồng thời hoàn thiện giao diện Home, Hero và trải nghiệm di động.

Sau khi cập nhật mã nguồn, chạy `supabase/v9.6-question-bank.sql` trong Supabase SQL Editor. Migration này phải chạy sau các migration đến V9.5.

Xem trình tự chi tiết trong `HUONG-DAN-CAP-NHAT-V9.6.md`.

---

## Nâng cấp V9.5

V9.5 tách giao diện thành Tổng quan hệ thống và không gian riêng của từng môn học; đồng thời sửa responsive trên điện thoại/laptop, bổ sung chế độ chỉnh sửa cấu trúc, làm gọn Ngân hàng câu hỏi và Danh sách lớp.

Sau khi đưa mã nguồn lên GitHub Pages, chạy thêm `supabase/v9.5-addon.sql` trong Supabase SQL Editor để bật chức năng giảng viên gửi thông báo riêng cho sinh viên. Các migration V9.1, V9.2 và V9.4 vẫn phải được cài đặt trước.

---

## Nền tảng chức năng V9.1

V9.1 mở rộng V9 theo hướng hoàn thiện quy trình bài kiểm tra, giữ lịch sử câu hỏi/bài làm ổn định và hạn chế mở cửa sổ mới.

## Điểm mới chính

- Landing page luôn hiển thị kể cả khi người dùng đã đăng nhập; khi đó nút chính đổi thành **Vào hệ thống**.
- Trang Bài kiểm tra dùng **drawer/panel bên phải** để xem cấu trúc đề, danh sách bài làm, chi tiết bài làm và hồ sơ sinh viên.
- Danh sách bài làm có nút **Xem bài**; bấm tên sinh viên mở hồ sơ ngay trong panel.
- Các thao tác quan trọng có hộp xác nhận: bắt đầu/nộp bài, phát hành/đóng/xóa, chỉnh cấu trúc, rút lại/đổi câu.
- Ba chế độ rút câu:
  - `common_fixed`: một bộ câu chung cố định;
  - `student_fixed`: mỗi sinh viên có bộ câu riêng và giữ nguyên qua các lần làm;
  - `attempt_random`: mỗi lượt làm rút lại, ưu tiên tránh câu đã gặp.
- Có `exam_question_pool` để đóng băng nguồn câu khi tạo bài và `attempt_questions` để lưu snapshot từng lượt làm.
- Trước khi có sinh viên làm, giảng viên có thể xem ma trận Chương/Chủ đề/CLO, đổi riêng câu hoặc rút lại bộ câu mẫu/chung.
- Sau khi đã có lượt làm, cấu trúc đo lường và bộ câu bị khóa để bảo toàn kết quả.
- Hồ sơ sinh viên có lịch sử bài kiểm tra, tiến bộ CLO và thống kê theo chương.
- Gemini vẫn **on-demand**: không dùng để chấm điểm, tính CLO hay xuất báo cáo; chỉ gọi khi sinh viên/giảng viên chủ động nhấn nút AI.

## Nâng từ V9 lên V9.1

Nếu hệ thống hiện tại đã chạy V9, **không chạy lại migration V9**.

1. Chạy `docs/assessment-v9.1-migration.sql` trong Supabase SQL Editor.
2. Redeploy `supabase/functions/analyze-assessment/index.ts` bằng code V9.1.
3. Đưa toàn bộ mã nguồn V9.1 lên GitHub Pages.
4. Kiểm thử bằng một tài khoản giảng viên và ít nhất hai tài khoản sinh viên nếu muốn đối chiếu ba chế độ rút câu.

Xem chi tiết trong `UPGRADE-V9.1.md`.

## Cấu hình Supabase/Gemini

- `js/config.js` chỉ chứa thông tin public dành cho frontend; không đưa `service_role` key lên GitHub.
- Edge Function `analyze-assessment` dùng `GEMINI_API_KEY` đã cấu hình trong Supabase Secrets.
- V9.1 không yêu cầu đổi Gemini key nếu V9 đã chạy AI thành công.

## File quan trọng

```text
index.html
css/app.css
css/question-exam.css
css/public.css
js/app.js
js/assessment.js
js/assessment-v91.js
docs/assessment-v9.1-migration.sql
supabase/functions/analyze-assessment/index.ts
UPGRADE-V9.1.md
VERSION-v9.1.txt
```

`js/assessment.js` của V9 vẫn được giữ làm nền tương thích; `js/assessment-v91.js` được nạp sau để cung cấp luồng Bài kiểm tra V9.1.

## V10.2 (2026-08-31)
Xem `HUONG-DAN-CAP-NHAT-V10.2.md`. V10.2 bổ sung Gemini auto-fallback, `clos.short_description`, nhập hàng loạt câu hỏi và quy trình đề cuối kỳ BM06 → duyệt câu → BM07/BM08 + đáp án CLO.

## V10.3
Autosave/resume cho sinh viên làm bài, giảng viên làm thử và tạo đề cuối kỳ. Không cần SQL/Edge Function mới nếu đã triển khai V10.2.
