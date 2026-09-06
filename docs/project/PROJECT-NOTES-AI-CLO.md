# AI-CLO PTITHCM — Ghi nhớ kỹ thuật và quyết định thiết kế

> File này là **nguồn ghi nhớ kỹ thuật ưu tiên** để tiếp tục phát triển dự án trong các phiên sau. Khi bắt đầu chỉnh sửa AI-CLO, hãy đọc file này trước các changelog phiên bản nếu cần hiểu các quyết định đã chốt.

Cập nhật gần nhất: **06/09/2026 — V12.4.24**

Bản đồ kiến trúc hiện hành nằm tại `docs/project/ARCHITECTURE-AI-CLO.md`. Khi cần tìm đúng owner/file trước khi sửa, đọc file kiến trúc này ngay sau PROJECT-NOTES.

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

### Quy ước Sửa nhanh / Chi tiết

Đây là quy định UI/UX chung, áp dụng cho toàn hệ thống:

- **Chi tiết / xem thông tin** → dùng **panel/drawer**. Panel không dùng để chỉnh sửa nhanh.
- **Sửa nhanh** → dùng **AI-CLO app-window** thống nhất, không mở drawer/panel.
- **Sửa đầy đủ / chỉnh cấu trúc lớn** → dùng trang con/full-width workspace phù hợp, không ép vào panel nhỏ.
- Trên desktop, cửa sổ Sửa nhanh dùng cùng chuẩn app-window: header đỏ, cùng kích thước cơ sở, kéo/resize được khi phù hợp.
- Trên mobile, Sửa nhanh chuyển sang dạng gần full-screen để đủ chỗ cho nội dung và công thức.

Ba ngữ cảnh Sửa nhanh câu hỏi phải **cùng giao diện và cách thao tác**, nhưng giữ riêng semantics lưu dữ liệu:

1. **Ngân hàng câu hỏi — Sửa nhanh câu nguồn**
   - Sửa trực tiếp câu hỏi trong ngân hàng.
   - Thay đổi được lưu vào lịch sử chỉnh sửa câu hỏi.
   - Giao diện phải ghi rõ rằng thao tác này cập nhật ngân hàng câu hỏi.

2. **Kiểm tra câu hỏi trùng — Sửa nhanh trong ngữ cảnh kiểm tra trùng**
   - Vẫn sửa **chính câu hỏi nguồn** trong ngân hàng, không tạo bản sao riêng.
   - Sau khi lưu, quay lại đúng cặp đang xem và đánh dấu cặp đó **cần kiểm tra lại**.
   - Giao diện phải ghi rõ rằng thao tác cập nhật ngân hàng và kết quả trùng cần được thẩm định lại.

3. **Đánh giá / Builder — Sửa nhanh câu trong bản nháp**
   - Chỉ sửa câu đang dùng trong **bản nháp bài kiểm tra/đánh giá**.
   - **Không thay đổi ngân hàng câu hỏi**.
   - Với online builder, tiếp tục dùng `draftOverrides`/draft state hiện hành; không đổi semantics lưu chỉ để đồng nhất giao diện.
   - Giao diện phải ghi rõ “Chỉ áp dụng cho bài kiểm tra này; ngân hàng câu hỏi không thay đổi”.

Các cửa sổ Sửa nhanh ưu tiên cùng bố cục:

- Nội dung câu hỏi;
- phương án A/B/C/D;
- đáp án đúng;
- lời giải/giải thích nếu nghiệp vụ hỗ trợ;
- Hủy + Lưu/Áp dụng ở cuối.

Ownership kỹ thuật:

- `css/ui/app-window.css` chỉ sở hữu **window chrome**: vị trí, kích thước, header, drag, resize, responsive.
- `css/ui/dialogs.css` sở hữu **native dialog/modal/confirmation chrome** (`dialog`, backdrop, `modal-head`, `confirm-dialog` và confirm actions). Không đặt các rule này trở lại `css/app.css`.
- `css/app-brand.css` là **owner duy nhất của brand/logo trong app runtime**: `.logo` base, logo đăng nhập và logo sidebar. Không đặt typography/màu/kích thước logo trở lại `css/app.css` hoặc `css/login-app.css`.
- `css/ui/application.css` là owner duy nhất của **app layout/kích thước dùng chung**: `.app`, `.app>main`, `.app .content`, desktop shell geometry, content padding/overflow và boot visibility guard; không chứa component primitive hay CSS nghiệp vụ.
- `css/ui/primitives.css` sở hữu **UI primitives dùng chung**: `stats/stat`, `grid2`, `panel/panel-head`, `toolbar`, `table/table-wrap`, `badge`, `row-actions`, `empty`, `toast` và progress `bar`, kèm responsive trực tiếp của các primitive này.
- `css/ui/layout-system.css` chỉ sở hữu **framework layout generic** `.aiclo-kpi-grid`, `.aiclo-action-grid`, `.aiclo-filter-bar`; không chứa selector domain/module trực tiếp. `js/ui/layout-system.js` chỉ gắn các class generic sau render. Domain/module CSS phải tự cung cấp first-paint layout khớp contract này, không dựa vào late alias.
- `css/ui/shell.css` sở hữu **shell chrome**: sidebar/header controls và **Drawer xem chi tiết** (`drawer-backdrop`, `side-drawer`, `drawer-head`, `drawer-body`, responsive drawer).
- `css/login-app.css` sở hữu **giao diện Auth/Login đang chạy**, gồm login card và UI “Quên mật khẩu / liên hệ Quản trị viên”. `css/login-fit.css` chỉ sở hữu **viewport/height fit** của màn đăng nhập; brand/logo thuộc `css/app-brand.css`.
- `css/courses/structure.css` sở hữu **CSS nghiệp vụ Chương · Chủ đề · CLO**: danh sách chương/chủ đề, action edit/delete, safe-delete/dependency và compatibility `structure-v95`; không đặt các rule này trở lại `css/app.css` hoặc `css/ui/application.css`.
- `css/courses/catalog.css` sở hữu **danh sách Môn học dạng card** ở không gian hệ thống (`course-grid`, `course-card`, `course-toolbar`, `course-card-actions` và metadata card liên quan).
- `css/system/dashboard.css` sở hữu **Dashboard hệ thống/học phần V10.9** (`v109-dashboard`, hero, KPI `v109-stats`, course cards và quick actions), gồm first-paint KPI breakpoint khớp layout framework.
- `css/system/profile.css` sở hữu cả **profile V10.8** và **profile/tài khoản V10.9 đang chạy** (`v109-profile`, `v109-security`, `v109-account-form`, password control).
- `css/questions/analysis.css` sở hữu **thống kê/phân tích câu hỏi**; `css/question-exam.css` sở hữu metadata/list/detail của Ngân hàng câu hỏi như `question-clo`; `css/courses/class-list.css` sở hữu action/trạng thái và UI thành viên của học phần (`class-stats`, `last-login-cell`, `message-student`, `v109-member-tabs`, member summary/table compatibility).
- `css/system/notifications.css` sở hữu **notification UI**: badge chưa đọc, task cards trên dashboard, `v109-notices`/“Thông báo gần đây”, Trung tâm thông báo và trang chi tiết; `css/system/activity.css` chỉ sở hữu **Nhật ký hoạt động** (`activity-filter`). Không tạo lại stylesheet trộn `activity-notifications.css`.
- `css/questions/bank.css` là owner canonical cho **tab ngân hàng, scope chooser, fallback toolbar, bảng desktop và card mobile**. Các lớp V10.5/V10.5.3 phải được hợp nhất trong file này thay vì thêm tầng override/`!important`; `css/questions/bank-layout.css` chỉ sở hữu enhancement toolbar/filter drawer/chips. Không tạo lại late override riêng cho Question Bank.
- `css/system/question-banks.css` sở hữu **quản trị Ngân hàng câu hỏi cấp hệ thống** do `js/system/question-banks.js` render (`v112/v113/v114`); không đưa các selector này về global UI.
- `css/exams/assessment-shared.css` sở hữu **Assessment runtime dùng chung**, gồm `v109-tabs`, `v109-workspace-head`, `v109-assessment-workspace` và `online-matrix-*`; `css/exams/detail-enhancements.css` sở hữu toàn bộ **trang Chi tiết bài kiểm tra/attempt table**, cả layout lẫn chrome và first-paint KPI/action/filter breakpoints khớp generic layout contract; `css/exams/final-workflow.css` sở hữu compatibility của danh sách đề cuối kỳ như `v102-final-list`.
- `css/students/profile.css` sở hữu **Hồ sơ học tập sinh viên**, gồm `academic-profile-summary` và breakpoint first-paint khớp generic KPI contract.
- `css/ui/final-layer.css` đã **được loại khỏi runtime và xóa ở V12.4.22**. Không tạo lại “late compatibility layer”; rule còn sống phải về đúng owner domain/UI.
- `app.html` **không load `css/public.css`**. Landing/public hiện dùng stylesheet riêng (`landing-v11.css`, `public-nav-static.css`); `public.css` chỉ được giữ như tài sản lịch sử nếu còn cần đối chiếu, không được để rule public/generic rò vào app runtime.
- `css/legacy/auth-v8.css` và `css/legacy/question-v95.css` là **archive only, không load runtime**. V9.5 question tool grid/mobile table cũ không được đưa trở lại `application.css` khi UI hiện hành đã dùng V9.6/V10.5.
- `css/app.css` chỉ giữ **global base/control/form primitives**: token màu, typography/control cơ bản, field/input/button states và `form-grid/form-actions/option-grid`. Không đặt logo/brand, app layout, panel/table/badge/toast, dialog/confirm/Drawer hay CSS nghiệp vụ trở lại file này.
- CSS/module nghiệp vụ chỉ sở hữu **nội dung bên trong editor** và khác biệt theo ngữ cảnh.
- Không để class nghiệp vụ của Ngân hàng, Kiểm tra trùng và Assessment dùng lẫn nhau để tránh cascade/logic ảnh hưởng chéo.
- Khi tái sử dụng cùng `#modal`, phải xóa class ngữ cảnh cũ trước khi gắn class ngữ cảnh mới.

### Card thống kê / KPI

Toàn web cần thống nhất một chuẩn `dense stats grid`:

- desktop rộng: nhóm **5–6 card ưu tiên nằm trên 1 hàng**;
- generic KPI contract dùng breakpoint **>1000 / ≤1000 / ≤700 / ≤430** tương ứng số cột theo nội dung / tối đa 3 / tối đa 2 / 1; domain owner phải cho first paint tương thích contract này nếu được layout adapter tag;
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

### Tài liệu bắt buộc đọc

- `docs/project/PROJECT-NOTES-AI-CLO.md` — quyết định kỹ thuật/UI/nghiệp vụ ưu tiên.
- `docs/project/ARCHITECTURE-AI-CLO.md` — bản đồ kiến trúc hiện hành và owner theo domain.
- `docs/project/TECHNICAL-AGREEMENTS.md` — quy tắc kỹ thuật bắt buộc.
- `docs/project/PROJECT-STATUS-2026-09-06.md` — snapshot trạng thái hiện tại.
- `docs/project/PROJECT-PROGRESS-2026-09-06.md` — tiến trình chi tiết trong ngày.

### File runtime quan trọng

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

Đợt CSS ownership/refactor lớn đã hoàn tất ở V12.4.24. Không tiếp tục chia/tách CSS chỉ vì muốn giảm số file nếu chưa có lỗi/điểm nghẽn rõ ràng.

Ưu tiên tiếp theo:

- smoke desktop/mobile shell;
- login/Auth;
- Question Bank desktop/mobile, filter, card/table, quick edit;
- Assessment Detail/Builder/Attempt;
- kiểm tra Chrome tab-switch/reload/discard cho từng trang con;
- teacher/student qua Supabase/RLS;
- đổi học phần không lẫn state/feedback;
- Excel đáp án+CLO với `/cham-thi-clo`;
- compile TeX với dữ liệu thật;
- nếu profiling cho thấy số request CSS là bottleneck thì cân nhắc **build-time bundle**, không nhập thủ công source CSS lại thành file lớn.

Khi thêm bất kỳ trang con mới nào: **đăng ký restore với lớp chung ngay từ đầu**.

## 11. Nguyên tắc làm việc với repo

Trước khi sửa lớn ở các phiên sau:

1. Đọc `PROJECT-NOTES-AI-CLO.md` trước.
2. Đọc `ARCHITECTURE-AI-CLO.md` để xác định đúng owner/file.
3. Đọc `TECHNICAL-AGREEMENTS.md` và release note liên quan nếu cần.
4. Quét code mới nhất trên GitHub `main` trước khi quyết định thay đổi.
5. Không giả định UI/state cũ còn đúng nếu repo đã có phiên bản mới.
6. Ưu tiên thay đổi theo framework chung, không tạo “bản vá riêng” cho một trang nếu vấn đề có tính toàn hệ thống.
