# Cập nhật AI-CLO PTITHCM v9.4.2

## Thay đổi

- Sidebar cố định khi nội dung dài; vùng nội dung luôn chừa đúng khoảng bên trái.
- Biểu tượng thông báo đổi thành chuông.
- Chi tiết câu hỏi hiển thị người tạo, ngày tạo, lần cập nhật gần nhất và lịch sử sửa.
- Chi tiết và sửa câu hỏi hiển thị trực tiếp trong trang, không mở cửa sổ.
- Bộ lọc/từ khóa ngân hàng được giữ khi quay lại danh sách.
- Mỗi lần sửa lưu snapshot nội dung, phương án, đáp án và lời giải cũ.

## Cài đặt

1. Mở Supabase Dashboard → SQL Editor.
2. Chạy toàn bộ file `supabase/v9.4-question-history.sql` một lần.
3. Đưa toàn bộ mã nguồn v9.4.2 lên GitHub Pages.
4. Không cần cập nhật Edge Function.

## Kiểm tra

1. Mở một câu hỏi và kiểm tra người tạo/ngày tạo.
2. Chọn **Sửa câu hỏi**, thay một nội dung nhỏ rồi lưu.
3. Mở lại chi tiết: phải có **Lần 1**, người sửa và thời gian sửa.
4. Sửa lần thứ hai: lịch sử phải có **Lần 2** và **Lần 1**.
5. Cuộn danh sách câu hỏi dài: sidebar phải đứng yên và phủ hết chiều cao màn hình.

Lịch sử chỉ bắt đầu được ghi từ khi v9.4 được cài đặt; hệ thống không thể tái tạo các lần chỉnh sửa xảy ra trước đó.

## Bổ sung trong v9.4.2

- Khi chuyển nhanh qua lại giữa các tab Chrome, ứng dụng không ép tải lại thông báo.
- Thông báo chỉ được đồng bộ khi người dùng đã rời tab ít nhất 5 phút.
- Không cần chạy thêm SQL nếu SQL v9.4 đã được cài đặt.
