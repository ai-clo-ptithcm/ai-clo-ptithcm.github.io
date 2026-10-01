# Công bố điểm — hướng dẫn

## Admin
Mở /tools/cong-bo-diem/login/ và đăng nhập bằng tài khoản có role=admin, đang hoạt động trong AI-CLO PTITHCM.
Thiết lập mã tạo dùng chung gồm đúng 4 chữ số, gửi riêng cho giảng viên.
Admin xem cả bản nháp và bài đang mở, sửa công bố, đặt lại mật khẩu (thu hồi toàn bộ phiên cũ), xóa bài và file gốc.
Không có mã tạo mặc định được ghi trong mã nguồn.

## Giảng viên
1. Chọn Tạo công bố, nhập mã chung 4 chữ số trong hộp thoại giữa màn hình. Sau khi kiểm tra đúng mã, nhập môn, giảng viên, lớp, học kỳ và đặt mật khẩu chỉnh sửa từ 8 ký tự. Mật khẩu các công bố có thể giống nhau.
2. Chọn một nguồn: Excel/CSV, dán bảng, hoặc Google Sheets. Mỗi công bố chỉ dùng một sheet và một lớp.
3. Với Excel, chọn đúng sheet và dòng tên cột. Với bảng dán, sao chép cả hàng tiêu đề.
4. Chọn các cột sinh viên được xem. Chọn một đến bốn trường xác nhận từ MSSV, SĐT, ngày sinh, mã riêng có trong dữ liệu.
5. Kiểm tra dữ liệu và xem thử một sinh viên. Bật công bố, Lưu cập nhật rồi gửi link/QR.
6. Lưu link quản lý và mật khẩu. Có thể mở lại qua nút Chỉnh sửa trong danh sách hoặc Mở lại công bố → dán link trong hộp thoại. Không cần nhớ mã dài.
7. Muốn sửa: nhập mật khẩu riêng. Excel/bảng dán sửa ô, thêm/xóa dòng/cột hoặc dán vùng; xem trước rồi áp dụng, có hoàn tác.
8. Khôi phục dữ liệu trước lần lưu/đồng bộ gần nhất sẽ tắt công bố để kiểm tra lại. File Excel gốc chỉ giữ bản mới nhất; khôi phục bảng không khôi phục file nhị phân cũ.

Giới hạn: 5 MB/file, tối đa 5000 dòng và 100 cột, tối đa 2000 ký tự/ô.
MSSV/SĐT nên đặt kiểu Text trước khi nhập số 0 đầu. Hệ thống giữ văn bản hiển thị; không tự suy đoán số 0 đã bị Excel xóa.
Ngày sinh dùng dd/mm/yyyy hoặc yyyy-mm-dd; nếu Excel hiển thị mm/dd/yyyy hãy đổi định dạng trước khi nhập.
Các trường xác nhận không được trống; tổ hợp xác nhận phải duy nhất. Nếu trùng MSSV, thêm trường xác nhận hoặc sửa dữ liệu.
Tên cột không được trống/trùng. Mã riêng phân biệt theo nội dung đã chuẩn hóa chữ hoa/thường.
Dữ liệu tra cứu không được ghi vào URL hoặc localStorage. Phiên chỉnh sửa riêng hết hạn sau 2 giờ, nhập lại mật khẩu để tiếp tục.
Khi thay nguồn, phải đọc dữ liệu nguồn mới trước khi lưu. Khi dán toàn bộ bảng, chọn lại các cột và trường xác nhận.

## Google Sheets riêng tư
Kết nối chưa tự hoạt động chỉ với link: cần admin cấu hình một lần thông tin tài khoản dịch vụ Google.

1. Trong Google Cloud, tạo/chọn project và bật Google Sheets API.
2. Tạo service account, tạo khóa JSON. Không đưa file JSON vào GitHub, không đưa vào JavaScript phía trình duyệt.
3. Trong đúng Supabase AI-CLO PTITHCM (rraooqedkpyhokattwdz), Edge Functions → Secrets:
   thêm GRADE_GOOGLE_SERVICE_ACCOUNT_JSON với toàn bộ nội dung JSON của khóa.
4. Mở lại LOGIN. Mục Kết nối Google Sheets sẽ hiện client_email của tài khoản dịch vụ.
5. Giảng viên mở Sheets → Chia sẻ → thêm email đó, quyền Người xem; không cần công khai bảng.
6. Trong công cụ, dán link docs.google.com/spreadsheets/d/..., nhập chính xác tên sheet và dòng tiêu đề.
7. Đọc Google Sheets, chọn cột và xác nhận, Lưu cập nhật.

Sinh viên tra cứu mới kích hoạt đồng bộ. Dữ liệu được lưu tạm 15 phút dùng chung cho các lượt tra cứu của công bố.
Không có lượt tra cứu thì không gọi Google định kỳ. Có khóa đồng bộ để tránh nhiều lượt cùng đọc một sheet.
Google không truy cập được, cấu trúc cột thay đổi hoặc thông tin xác nhận bị lỗi: giữ dữ liệu hợp lệ gần nhất và báo trong trang quản lý.
Giảng viên có nút Cập nhật ngay. Bản mới chỉ thay thế sau khi đọc và kiểm tra thành công.
Độ mới phụ thuộc lượt tra cứu, khoảng lưu tạm và khả năng truy cập nguồn; trang kết quả hiển thị thời điểm dữ liệu cập nhật.
Dữ liệu Google được đọc lại trên máy chủ khi lưu, không tin dữ liệu Google gửi từ trình duyệt.

## Sinh viên
Mở link/QR của lớp, nhập tất cả trường xác nhận. Chỉ nhận một dòng và các cột giảng viên chọn.
Không tải file gốc hay toàn bộ lớp về trình duyệt. Không thể tra cứu khi công bố đang tắt.

## Triển khai kỹ thuật
- Frontend: tools/cong-bo-diem/, tách file CSS và JavaScript theo chức năng.
- Backend: supabase/functions/grade-publications/, đã triển khai trên Supabase AI-CLO PTITHCM.
- SQL: supabase/migrations/20261001_grade_*.sql; bảng grade_* và bucket grade-publications riêng tư.
- Edge Function sử dụng SUPABASE_SERVICE_ROLE_KEY có sẵn trong môi trường, không xuất khóa này ra frontend.
- JWT gateway tắt vì sinh viên/giảng viên không có tài khoản; chức năng quản lý có xác thực mật khẩu/phiên riêng,
  chức năng admin kiểm tra JWT qua Auth rồi xác nhận profiles.role, is_active và locked_at.
- Gateway SQL chỉ service_role được gọi. anon/authenticated không có quyền đọc bảng riêng tư.
- Giới hạn lượt yêu cầu theo IP và loại thao tác; API công khai chỉ có metadata tối thiểu và kết quả sau xác nhận.
- Không lưu bản PDF/Excel mới mỗi lần sửa; một file gốc và tối đa một bản dữ liệu trước.


## Địa chỉ và dữ liệu riêng
Công cụ: https://ai-clo-ptithcm.github.io/tools/cong-bo-diem/.
Bản này dùng Supabase PTITHCM rraooqedkpyhokattwdz; không dùng chung công bố, mã tạo hay tài khoản Admin của APMaths.
Link quản lý/tra cứu và QR lấy tên miền đang truy cập. Không nhận link công bố APMaths vì thuộc cơ sở dữ liệu khác.

## Cấu hình sau triển khai
1. Vào /tools/cong-bo-diem/login/, dùng tài khoản Admin đang hoạt động của AI-CLO PTITHCM, thiết lập mã tạo chung 4 chữ số.
2. Excel/CSV, dán bảng và tra cứu không cần JSON Google. Mã chung cần được thiết lập trước khi giảng viên tạo bài.
3. Google Sheets có thể cấu hình sau: Supabase Dashboard → project rraooqedkpyhokattwdz → Edge Functions → Secrets → thêm GRADE_GOOGLE_SERVICE_ACCOUNT_JSON với toàn bộ nội dung JSON.
4. Có thể dùng tài khoản dịch vụ Google đang dùng cho APMaths, nhưng secret cần được thêm riêng vào Supabase PTITHCM. Chia sẻ sheet quyền Người xem cho client_email tương ứng.
5. Không đưa JSON hoặc service_role key vào GitHub hay JavaScript frontend.

## Mã backend để deploy độc lập
supabase/functions/grade-publications/index.ts đã chứa phần kiểm tra dữ liệu, không phụ thuộc _shared hoặc file tương đối khác. Khi deploy Dashboard: tên grade-publications, tắt Verify JWT ở gateway vì có sinh viên/giảng viên không đăng nhập; quyền Admin được kiểm tra JWT và profiles trong thân hàm, quyền sửa được kiểm tra bằng phiên riêng.
Các SQL được sao chép theo thứ tự tên file 20261001*grade*.sql. Chỉ chạy trên dự án chưa có các bảng grade_*; không chạy lại SQL tạo bảng sau khi đã triển khai.

## Trạng thái triển khai 01/10/2026
SQL và Edge Function đã được triển khai trên rraooqedkpyhokattwdz. Không cần chạy lại SQL hoặc tự deploy backend cho lần sao chép này. Việc còn lại: LOGIN đặt mã chung, và thêm JSON khi cần Google Sheets.
