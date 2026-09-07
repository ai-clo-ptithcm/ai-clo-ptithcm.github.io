# Legacy CSS

Thư mục này lưu CSS lịch sử đã được loại khỏi runtime hiện hành để phục vụ rollback và đối chiếu trong giai đoạn ổn định V12.

- Các file trong thư mục này **không được load bởi `app.html`** trừ khi có quyết định khôi phục rõ ràng.
- Không thêm selector mới vào đây.
- Khi một nhóm legacy đã được xác nhận không còn cần cho rollback, có thể xóa ở một lượt dọn riêng.
