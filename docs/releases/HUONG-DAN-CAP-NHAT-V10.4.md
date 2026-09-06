# Cập nhật AI-CLO PTITHCM V10.4

1. Nếu V10.2 chưa chạy: chạy `supabase/v10.2-upgrade.sql`.
2. Chạy thêm `supabase/v10.4-upgrade.sql` để bật lịch sử hồ sơ đề thi.
3. Upload frontend V10.4 lên GitHub Pages.
4. Không cần deploy thêm Edge Function. 4 function Gemini của V10.2/V10.3 vẫn giữ nguyên và self-contained.

## Đề thi cuối kỳ
- Người tạo hoặc Admin có thể xóa hồ sơ.
- Hồ sơ đã tạo có nút `Mở / Sửa / Xuất`.
- Sửa câu/ma trận làm đề chuyển về trạng thái cần tạo lại mã đề.
- BM06, BM07, BM08 xuất `.docx` thật; cấu trúc dùng paragraph/table Word, không dùng Shift+Enter.
- BM07 tự chọn bố cục phương án 4 cột, 2 cột hoặc 1 cột để tránh phương án bị xuống dòng trong ô hẹp.
