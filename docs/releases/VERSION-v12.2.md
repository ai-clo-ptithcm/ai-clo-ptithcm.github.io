# AI-CLO PTITHCM V12.2 — Assessment Stability

V12.2 ổn định lại toàn bộ khu vực **Đánh giá** theo nguyên tắc một owner frontend duy nhất: `js/assessment.js`.

## Kiến trúc frontend

Trang Đánh giá không còn nạp các lớp vá/adapter cũ như `final-workflow.js`, `unified-builder.js`, `unified-list-adapter.js`, `create-wizard.js`, `assessment-unified-v12.js`, `assessment-subpages-v12.js`, `assessment-v12.1*.js`, `attempt-autosave.js`, `detail-enhancements.js`, `assessment-window.js`, `max-attempts-unlocked.js` hay `subpage-bootstrap.js`.

Các file cũ vẫn được giữ trong repo để đối chiếu lịch sử nhưng **không tham gia runtime Đánh giá V12.2**.

`js/exams/final-export.js` chỉ được tải khi giảng viên thực sự xuất hồ sơ đề cuối kỳ; file này chỉ làm nhiệm vụ xuất BM06/BM07/BM08/TeX/Excel/ZIP và không điều khiển giao diện Đánh giá.

## Các lỗi P1/P2 đã xử lý

- Cấu trúc, blueprint, pool đóng băng và bộ câu mẫu được cập nhật nguyên tử bằng RPC `replace_exam_design`.
- Builder/Chi tiết/Làm thử đọc từ snapshot `exam_question_pool`, không đọc lại nội dung sống của ngân hàng.
- Đổi câu và dùng câu Gemini đồng bộ cùng pool đóng băng, tránh tình trạng `exam_questions` và pool lệch nhau.
- Chỉnh cấu trúc luôn hiển thị Chương + Mục và không tồn tại trạng thái “ma trận mới, bộ câu cũ”.
- `score_policy` (`highest`, `latest`, `average`) được áp dụng thật khi tổng hợp GPA/CLO.
- Với `average`, GPA được tính **mỗi bài một trọng số**: trước hết lấy trung bình các lượt của bài đó, sau đó mới tính trung bình giữa các bài; một bài có nhiều lượt không còn bị nặng hơn bài khác.
- AI tổng hợp lớp/sinh viên dùng cùng quy tắc GPA chính thức nói trên.
- `counts_toward_grade` độc lập với `allow_ai_feedback`.
- Autosave sinh viên được tích hợp trong `js/assessment.js`: lưu local + RPC Supabase, không còn module ghi đè hàm runtime.
- Tạm dừng (`closed`) chặn lượt làm **mới**, nhưng lượt đang làm được phép tiếp tục/resume.
- Sinh viên vẫn xem được kết quả các bài đã làm sau khi giảng viên tạm dừng bài.
- Phát hành ghi `published_at` lần đầu.
- Backend chặn bài trực tuyến lấy câu chỉ thuộc Ngân hàng đề thi – bảo mật.
- Backend chặn hồ sơ đề cuối kỳ lấy câu ngoài Ngân hàng đề thi – bảo mật.
- Đề thi cuối kỳ chỉ dùng câu `secure_exam`/`both` đã duyệt.
- Số mã đề 1–20 được giữ xuyên suốt đến lúc tạo biến thể/xuất hồ sơ.
- “Lưu bản nháp” đề cuối kỳ cho phép lưu trước khi rút đủ câu; chỉ “Sinh mã đề & lưu” mới bắt buộc ma trận/bộ câu hoàn chỉnh.
- Ma trận ở trang Chi tiết đề cuối kỳ hiển thị tên Mục và mã CLO thay cho UUID kỹ thuật.
- Bỏ cơ chế ưu tiên mơ hồ `server || local` cho nháp đề cuối kỳ; server package là nguồn chuẩn, local chỉ phục hồi khi mới hơn bản server.
- Lỗi đồng bộ/export được báo rõ thay vì im lặng.
- Xuất hồ sơ kiểm tra lại frozen snapshot và từng mã đề trước khi tạo BM06/BM07/BM08/TeX/Excel/ZIP.
- Bỏ tải trùng `system-performance.js` trong `app.html`.

## Cập nhật Supabase bắt buộc

Sau khi frontend V12.2 được deploy, chạy trong **Supabase SQL Editor**:

`docs/assessment-v12.2-migration.sql`

Migration an toàn khi chạy lại và tạo/chuẩn hóa contract V12.2, gồm:

- `assessment_schema_version()`;
- `assessment_effective_attempts`;
- khóa cấu trúc sau khi có lượt làm;
- `replace_exam_design(...)` atomic;
- `start_exam_attempt(...)` hỗ trợ resume khi bài tạm dừng;
- `save_final_exam_package(...)`;
- ranh giới bảo mật nguồn câu ở backend cho bài trực tuyến và đề cuối kỳ.

Frontend V12.2 sẽ chủ động báo cần migration nếu backend chưa trả phiên bản `12.2`.

## Edge Function cần redeploy

Redeploy function:

`supabase/functions/analyze-assessment/index.ts`

Bản V12.2 Step 9 sửa tổng hợp GPA cho `highest / latest / average`, giữ đúng phạm vi `counts_toward_grade` và tránh việc một bài có nhiều lượt làm bị tính trọng số lớn hơn bài khác.

Các Edge Function khác không cần thay đổi riêng cho Step 9 nếu đang dùng đúng bản hiện tại của dự án.

## Smoke test sau deploy

1. Tạo bài kiểm tra → chỉ có một nút tạo → lưu bản nháp.
2. Phát hành → trở về trang Chi tiết → Tạm dừng → Mở lại.
3. Khi tạm dừng: SV chưa làm không bắt đầu được; SV đang làm vẫn resume được; SV đã nộp vẫn mở được kết quả cũ.
4. Chỉnh Thông tin: `Tính CLO` và `AI feedback` độc lập.
5. Chỉnh Cấu trúc trước khi có lượt làm → pool + bộ mẫu đổi cùng lúc.
6. Đổi một câu / Gemini sinh câu → Làm thử và bài SV dùng đúng snapshot mới.
7. Tạo ba bài có các chính sách `highest`, `latest`, `average`; với bài `average` tạo nhiều lượt và xác nhận GPA chỉ tính một trọng số cho mỗi bài.
8. Kiểm AI lớp và AI sinh viên cho cùng dữ liệu ở bước 7.
9. Tạm thời thử đưa câu `secure_exam` vào bài trực tuyến bằng client tùy biến → backend phải từ chối.
10. Tạo đề cuối kỳ, lưu bản nháp khi chưa rút đủ câu → phải lưu được.
11. Sinh đề cuối kỳ với 2 và 6 mã đề; kiểm đúng số mã, chỉ lấy ngân hàng bảo mật.
12. Trang Chi tiết đề cuối kỳ phải hiện tên Mục + mã CLO, không hiện UUID.
13. Xuất BM06/BM07/BM08/TeX/Excel/ZIP và kiểm mỗi mã đề có đúng số câu, đủ A–D, đáp án/CLO đúng snapshot đã lưu.
