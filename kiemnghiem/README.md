# Môi trường kiểm nghiệm AI-CLO PTIT HCM

Thư mục này là bản sao frontend của Production tại mốc V12.6.13 để kiểm nghiệm trước khi xuất bản.

- Production: các file ở thư mục gốc của repository.
- Kiểm nghiệm: các file trong `/kiemnghiem`.
- Chỉ dùng học phần Demo và ngân hàng câu hỏi Demo khi thử các thao tác ghi dữ liệu.
- `/kiemnghiem` hiện dùng cùng Supabase với Production, vì vậy mọi thao tác tạo/sửa/xóa dữ liệu vẫn tác động vào database thật.
- Không đưa thay đổi từ `/kiemnghiem` ra Production trước khi kiểm tra đầy đủ.

Mốc khởi tạo: V12.6.13 (`57a725a1a07ffd9982f429a51579c5fcff1ca7e1`).
