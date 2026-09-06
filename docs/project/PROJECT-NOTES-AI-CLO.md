# AI-CLO PTITHCM — Ghi nhớ kỹ thuật và quyết định thiết kế

> File này là **nguồn ghi nhớ kỹ thuật ưu tiên** để tiếp tục phát triển dự án trong các phiên sau. Khi bắt đầu chỉnh sửa AI-CLO, hãy đọc file này trước các changelog phiên bản nếu cần hiểu các quyết định đã chốt.

Cập nhật gần nhất: **04/09/2026 — V11.8.2**

## 1. Nguyên tắc phát triển

- Ưu tiên **framework dùng chung**, tránh sửa chắp vá từng trang.
- Tái sử dụng component, CSS, app-window, toolbar, panel, state manager hiện có trước khi tạo style/hàm mới.
- Không thay schema Supabase nếu chưa thật sự cần; ưu tiên tương thích dữ liệu cũ.
- Không xóa engine legacy quan trọng nếu UI mới vẫn cần dữ liệu/khả năng xuất của nó. Có thể ngừng routing UI vào legacy trước, rồi loại bỏ sau khi framework mới ổn định.
- Supabase Edge Function Gemini phải **self-contained**, không phụ thuộc `_shared`, vì deploy từng function trực tiếp trên Supabase Dashboard.
- AI chỉ gọi khi người dùng chủ động yêu cầu.

## 2. Chuẩn giao diện toàn web

### Popup / window

Mọi popup chỉnh sửa dùng **AI-CLO app-window** thống nhất:

- header đỏ;
- cùng nút đóng;
- cùng padding/footer;
- desktop có thể kéo/thay đổi kích thước nếu component hỗ trợ;
- mobile chuyển dạng gần full-screen;
- boolean dùng **toggle switch kiểu iPhone**, không dùng checkbox vuông nếu đó là thiết lập bật/tắt.

Drawer chỉ dùng cho **xem nhanh/chi tiết** khi phù hợp. Không dùng drawer legacy để chỉnh cấu trúc bài kiểm tra.

### Card thống kê / KPI

Toàn web cần thống nhất một chuẩn `dense stats grid`:

- desktop rộng: nhóm **5–6 card ưu tiên nằm trên 1 hàng**;
- chỉ xuống hàng khi thực sự thiếu chiều rộng;
- tablet: 2–3 cột tùy không gian;
- mobile: 2 cột hoặc 1 cột;
- không để màn hình desktop khoảng 1400–1500 px tự xuống 2 hàng chỉ vì breakpoint cũ.

### Action toolbar

Nhóm 4–6 nút thao tác trên trang chi tiết nên ưu tiên **một hàng trên desktop**, cùng chiều cao/khoảng cách, rồi mới responsive xuống hàng ở tablet/mobile.

## 3. Framework chung cho 4 loại bài

Bốn loại bài dùng cùng một framework builder:

1. **Mục 1 — Thông tin bài**
2. **Mục 2 — Cấu trúc / Ma trận**
3. **Mục 3 — Danh sách câu hỏi đã rút**
4. **Mục 4 — Xuất** chỉ có với Ôn tập thi và Thi cuối kỳ

Cuối trang có thanh hành động theo trạng thái.

### 3.1. Kiểm tra thường

- Nguồn câu: **Ngân hàng luyện tập – kiểm tra**.
- Mục 1 **không chọn Chương**.
- Mục 2 có nút **Chọn phạm vi**.
- Chọn các Chương cần kiểm tra, sau đó chỉ hiện các Mục thuộc Chương đã chọn.
- Ma trận: **CLO cho mỗi mục** (`Mục × CLO`).
- Giải thích ngắn cho giảng viên: “Phân bố số câu CLO riêng cho từng mục.”
- Có thể phát hành cho sinh viên làm trên web.

### 3.2. Đánh giá CLO

- Nguồn câu: **Ngân hàng luyện tập – kiểm tra**.
- Mục 1 **không chọn Chương**.
- Mục 2 chọn phạm vi Chương.
- Trong mỗi Chương có thể chọn các Mục con được phép dùng; **không mặc định trộn toàn bộ Mục trong Chương**.
- Ma trận: hàng = Chương, cột = CLO.
- Chế độ: **CLO chung các mục được chọn**, nhưng **tách riêng theo từng Chương**.
- Mỗi ô hiển thị dạng `[số câu cần] (n)` với `n` là số câu khả dụng trong đúng Chương + CLO + tập Mục đã chọn.
- Đổi câu phải giữ **Chương + CLO**, có thể đổi sang Mục khác trong tập Mục đã chọn của Chương đó.
- Gemini sinh câu thay thế cũng phải giữ ngữ cảnh Chương + CLO.
- Có thể phát hành cho sinh viên làm trên web.

### 3.3. Ôn tập thi

- Nguồn câu: **Ngân hàng luyện tập – kiểm tra**.
- Cấu trúc/giao diện gần giống Thi cuối kỳ nhưng **không được dùng Ngân hàng đề thi – bảo mật**.
- Mục 2: sau khi chọn phạm vi Chương và các Mục, giảng viên chọn 1 trong 2 chế độ:
  - **CLO cho mỗi mục**;
  - **CLO chung các mục được chọn**.
- Với chế độ CLO chung, vẫn **tách theo từng Chương**, không gộp toàn bộ Chương thành một pool duy nhất.
- Mục 1 có tùy chọn bật/tắt xem đáp án/lời giải sau khi nộp.
- Có thể phát hành cho sinh viên làm trên web.
- Mục 4: **Xuất TeX**. Không xuất BM07/BM08 hành chính chính thức.

### 3.4. Thi cuối kỳ

- **Chỉ** dùng **Ngân hàng đề thi – bảo mật**.
- Không cho người dùng chọn nguồn luyện tập/cả hai.
- Mục 2: sau khi chọn phạm vi Chương và các Mục, giảng viên chọn 1 trong 2 chế độ:
  - **CLO cho mỗi mục**;
  - **CLO chung các mục được chọn**.
- Với chế độ CLO chung, vẫn **tách theo từng Chương**.
- Không phát hành cho sinh viên và không cho làm trên web.
- Trạng thái: **Bản nháp → Khóa ↔ Mở khóa**.
- Khi Khóa: khóa cấu trúc/đổi câu; vẫn xem và xuất.
- Mục 4: dùng engine xuất đã kiểm nghiệm cho **BM07 · BM08 · TeX** và các đầu ra liên quan.

## 4. Quy tắc chung Mục 1 / Mục 2 / Mục 3

### Mục 1 — Thông tin

- Hiển thị thông tin gọn theo kiểu **liệt kê 2 cột như văn bản**, không chia thành nhiều card xám nhỏ.
- Có **Tổng số câu**.
- Khi mở Mục 1, hiển thị đầy đủ thông tin read-only gọn; nút Chỉnh sửa mở AI-CLO app-window.
- Mục 1 không chứa chọn Chương; phạm vi nội dung nằm hoàn toàn ở Mục 2.

### Mục 2 — Cấu trúc

- Có **Chọn phạm vi**.
- Có giải thích ngắn trực tiếp dưới tiêu đề và tooltip `ⓘ`.
- Tổng phân bổ ma trận phải bằng `total_questions` trước khi rút.
- Nếu ô yêu cầu vượt số câu có sẵn thì cảnh báo và không rút.

### Mục 3 — Danh sách câu

- Hiển thị câu số, CLO, Chương, Mục, nội dung/phương án.
- Có **Đổi câu** và **Gemini sinh câu** trước khi bị khóa.
- Đổi câu phải giữ đúng cell cấu trúc ban đầu của bài.

## 5. Lưu nháp và trạng thái

- Với builder online, thông tin Mục 1 cần được bảo vệ ngay từ lúc nhập/chỉnh.
- Khi **Rút câu hỏi**, phải tạo/cập nhật **bản nháp** trong danh sách bài kiểm tra để có thể quay lại sửa sau.
- Sau khi có draft trên Supabase, DB là nguồn dữ liệu bền vững; local/session chỉ hỗ trợ workspace chưa đồng bộ hoặc UI state.
- Không tạo nháp với `total_questions = 0`; phải luôn thỏa check constraint hiện có.

### Trạng thái bài online

Dùng ý nghĩa rõ cho sinh viên:

- **Bản nháp** — sinh viên không thấy/làm.
- **Sắp mở** — đã phát hành nhưng chưa đến giờ mở.
- **Đang mở** — có thể bắt đầu lượt mới.
- **Tạm đóng** — giảng viên tạm ngưng, không cho bắt đầu lượt mới.
- **Đã hết hạn** — qua `closes_at`.
- **Đã hết lượt** — sinh viên đã dùng đủ `max_attempts`.

Trang chi tiết giảng viên cần có nút **Phát hành / Tạm đóng / Mở lại** tương ứng.

## 6. Quy tắc `max_attempts`

**`max_attempts` luôn được phép chỉnh sửa dù đã có sinh viên làm.**

- Tăng giới hạn → sinh viên có thêm lượt nếu chưa đạt giới hạn mới.
- Giảm giới hạn xuống thấp hơn số lượt lịch sử của sinh viên → **không xóa, không sửa, không báo lỗi** các lượt cũ.
- Chỉ chặn tạo lượt mới khi `số lượt hiện có >= max_attempts mới`.
- Quy tắc áp dụng cho Kiểm tra thường, Đánh giá CLO, Ôn tập thi.
- Thi cuối kỳ không phát hành nên không dùng nghiệp vụ lượt làm sinh viên.

## 7. Trang Chi tiết bài kiểm tra

Desktop cần bố trí gọn:

- **5 card KPI trên 1 hàng**: Đã nộp · Đang làm · GPA trung bình · GPA dưới 4 · Thời lượng.
- **5 nút trên 1 hàng**: AI phân tích · Sửa cấu trúc · Làm thử · Phát hành/Tạm đóng/Mở lại · Xóa bài.
- Toolbar danh sách lượt làm: **Tìm kiếm · Trạng thái · Sắp xếp · Xuất báo cáo** trên 1 hàng ở desktop.
- “Sửa cấu trúc” không mở UI legacy; phải vào đúng builder framework mới theo `exam_type`.

## 8. Subpage State Manager — V11.8.2

Đây là quy tắc bắt buộc cho mọi trang con mới.

File chính:

- `js/ui/subpage-state.js`
- `js/ui/subpage-bootstrap.js`

Mục tiêu: nếu người dùng đang ở một trang con, chuyển sang tab Chrome khác rồi quay lại, tab bị discard, `pageshow`, hoặc `#content` bị render lại thì **không được mất trang hiện tại**.

State chung lưu tối thiểu:

- `space`
- `view`
- `subjectId`
- `kind` / loại subpage
- `entityType`
- `entityId`
- `mode`
- `scrollY`
- `updated_at`

Các trang đã/đang nối vào cơ chế này:

- Chi tiết bài kiểm tra;
- unified builder 4 loại bài;
- Hồ sơ sinh viên;
- workspace Ngân hàng câu hỏi (tạo/sửa câu, AI, duplicate scan, AI review);
- workspace đề thi cuối kỳ.

### Nguyên tắc mở rộng

Không tạo thêm một cơ chế `sessionStorage` điều hướng riêng cho trang mới. Trang mới phải **đăng ký với `AICLO_SUBPAGE_STATE`** bằng cơ chế registry/detect/restore của lớp chung.

Module-specific draft store vẫn được phép tồn tại để lưu **nội dung form/draft**, nhưng việc **đang đứng ở trang nào** phải do Subpage State Manager quản lý.

### Khi nào xóa state

Chỉ xóa subpage state khi người dùng **chủ động**:

- bấm Quay lại;
- đổi menu;
- đổi học phần;
- Về hệ thống;
- đăng xuất;
- hoàn tất/lưu thành công và workflow đã rời trang con.

Không xóa state chỉ vì `visibilitychange`, `pagehide`, hoặc render lại `#content`.

## 9. Các file/mốc cần nhớ

- `js/exams/unified-builder.js` — framework chung 4 loại bài.
- `css/exams/unified-builder.css` — giao diện builder chung.
- `js/exams/unified-list-adapter.js` — adapter danh sách/trang chi tiết cho framework mới.
- `js/exams/assessment-window.js` — chuẩn hóa popup về AI-CLO app-window.
- `js/ui/subpage-state.js` — quản lý trang con chung, hiện V11.8.2.
- `js/ui/subpage-bootstrap.js` — khôi phục context trước render đầu tiên.
- `js/exams/detail-enhancements.js` — chi tiết bài kiểm tra, sort/scroll/layout hiện hành; nên dần phụ thuộc lớp chung thay vì tự giữ lifecycle riêng.
- `js/questions/workspace.js` — cơ chế workspace câu hỏi cũ nhưng ổn định; khi refactor tiếp cần tích hợp registry chung, không phá lưu nháp câu hỏi.
- `js/exams/final-workflow.js` — engine cuối kỳ/biểu mẫu đã kiểm nghiệm; không xóa vội.

## 10. Việc cần tiếp tục kiểm tra

- Rà toàn web các nhóm KPI/card để áp dụng rule 5–6 card/1 hàng trên desktop.
- Rà action toolbar 4–6 nút để dùng một chuẩn responsive.
- Kiểm tra thực tế Chrome tab-switch cho từng trang con: Chi tiết bài kiểm tra, builder, hồ sơ SV, ngân hàng câu hỏi, final workflow.
- Giảm dần các lifecycle/persistence cục bộ đã trùng chức năng với `AICLO_SUBPAGE_STATE`, nhưng chỉ sau khi test ổn định.
- Khi thêm bất kỳ trang con mới nào: **đăng ký restore với lớp chung ngay từ đầu**.

## 11. Nguyên tắc làm việc với repo

Trước khi sửa lớn ở các phiên sau:

1. Đọc file này.
2. Đọc `VERSION-v11.8.md` và các VERSION mới hơn nếu có.
3. Quét code mới nhất trên GitHub trước khi quyết định thay đổi.
4. Không giả định UI/state cũ còn đúng nếu repo đã có phiên bản mới.
5. Ưu tiên thay đổi theo framework chung, không tạo “bản vá riêng” cho một trang nếu vấn đề có tính toàn hệ thống.
