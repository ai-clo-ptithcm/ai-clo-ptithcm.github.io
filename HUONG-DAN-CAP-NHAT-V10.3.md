# AI-CLO PTITHCM V10.3

## Mục tiêu
Không mất trạng thái khi sinh viên đang làm bài hoặc giảng viên đang tạo/làm thử đề.

## Thay đổi chính
- Sinh viên: mỗi đáp án được lưu ngay vào localStorage rồi đồng bộ bằng RPC `save_exam_progress` hiện có.
- Khi mất mạng hoặc rời mục rồi quay lại, dữ liệu local được ghép với bản nháp trên Supabase.
- Đồng hồ thi dùng một deadline cố định trong phiên, không khởi tạo lại `remaining_seconds` khi chuyển câu.
- Khi nộp thành công, bản nháp local của lượt làm được xóa.
- Giảng viên làm thử bài kiểm tra: đáp án tạm được giữ trên thiết bị cho đến khi nộp bài thử.
- Giảng viên tạo đề cuối kỳ: thông tin BM06, ma trận, nguồn câu và bộ câu đang duyệt được autosave.
- Bản nháp đề cuối kỳ dùng bảng `final_exam_packages` đã có từ V10.2 với trạng thái `draft` / `reviewing`; quay lại sẽ có nút `Tiếp tục`.

## Supabase
V10.3 không cần migration SQL mới và không thêm Edge Function mới.
Giữ nguyên 4 Edge Function self-contained của V10.2:
- generate-questions
- analyze-assessment
- analyze-student-clo
- generate-one-question

Nếu V10.2 đã chạy `supabase/v10.2-upgrade.sql` thì chỉ cần cập nhật frontend V10.3 lên GitHub.
