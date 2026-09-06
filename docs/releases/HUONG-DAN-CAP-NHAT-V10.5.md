# Cập nhật AI-CLO PTITHCM V10.5

## Nếu đang ở V10.4
1. Chạy `supabase/v10.5-upgrade.sql` trong Supabase SQL Editor.
2. Upload frontend V10.5 lên GitHub Pages.
3. Không cần deploy lại Edge Function Gemini. Các function tiếp tục self-contained như V10.2+.

## Ngân hàng câu hỏi
Trang **Ngân hàng câu hỏi** có hai tab con ngay dưới tiêu đề:
- **Luyện tập - kiểm tra**: mở mặc định; dùng cho luyện tập và bài kiểm tra trực tuyến.
- **🔒 Ngân hàng đề thi - bảo mật**: dùng cho đề thi cuối kỳ/chính thức.

Bộ lọc “Nhóm sử dụng” đã được bỏ. Khi thêm/sửa hoặc duyệt câu Gemini, giảng viên chọn một trong ba nơi lưu:
- Luyện tập - kiểm tra (`practice`)
- Ngân hàng đề thi (`secure_exam`)
- Cả hai (`both`)

Câu `both` xuất hiện ở cả hai tab.

## Bảo mật nguồn câu hỏi kiểm tra
Bài kiểm tra trực tuyến chỉ sử dụng câu `practice` hoặc `both`. Câu `secure_exam` bị loại ở frontend và bị trigger Supabase từ chối nếu cố đưa trực tiếp vào `exam_questions` hoặc `exam_question_pool`.

## Sửa giao diện/ngữ cảnh
- Sửa lỗi quay lại từ màn hình sửa câu hỏi làm ô tìm kiếm nhận chữ `all` và trả `0/...` câu.
- Khi quay lại, giữ tab ngân hàng, từ khóa, Chương, Chủ đề, CLO, trạng thái duyệt, người tạo và vị trí cuộn.
- Thu hẹp cột **Mã câu**, cân lại **Nội dung**, mở rộng **Chương · Chủ đề**.

## Đề thi cuối kỳ
Giữ nguyên V10.4: ma trận BM06, duyệt câu, đổi câu/Gemini, tạo 4 mã đề, BM07/BM08 DOCX, TeX, `Dap_an_CLO.xlsx`, lịch sử tạo/sửa/xuất, và người tạo/Admin được xóa hồ sơ.
