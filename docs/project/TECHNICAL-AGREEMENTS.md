# AI-CLO PTITHCM — THỐNG NHẤT KỸ THUẬT CHUNG

> Tài liệu này ghi các **quy tắc bắt buộc** khi tiếp tục phát triển AI-CLO PTITHCM. Bản đồ kiến trúc/owner xem tại `ARCHITECTURE-AI-CLO.md`; quyết định UI/nghiệp vụ ưu tiên xem tại `PROJECT-NOTES-AI-CLO.md`.

Cập nhật: **07/09/2026 — chuẩn hóa kỹ thuật V12.6.17**.

## 1. Nguồn mã và môi trường chạy

### Frontend

- Repository chính: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`.
- Frontend chạy trên GitHub Pages.
- Nhánh chuẩn để đọc code hiện hành: `main`.
- Trước khi sửa phải đọc code mới nhất trên `main`, không suy đoán từ ZIP/chat/version cũ.
- Không coi nội dung trong chat cũ là source of truth nếu code `main` đã thay đổi.

### Supabase

Supabase là backend đang chạy thực tế:

- PostgreSQL.
- Auth.
- Storage.
- RPC / SQL functions.
- Row Level Security.
- Edge Functions.

GitHub lưu source backend để đọc/chỉnh; Supabase là nơi backend chạy thực tế.

## 2. Quy trình bắt buộc trước khi sửa code

Trước thay đổi có ý nghĩa phải thực hiện theo thứ tự:

1. Đọc `PROJECT-NOTES-AI-CLO.md` để xác nhận nghiệp vụ/UI đã chốt.
2. Đọc `ARCHITECTURE-AI-CLO.md` để tìm owner.
3. Đọc file owner hiện tại trên `main`.
4. Nếu có backend liên quan, đọc migration/schema/Function hiện tại.
5. Tạo backup branch từ `main`.
6. Chỉ sau đó mới sửa.

Nếu chưa xác định được owner, **không tạo file patch mới để làm nhanh**; phải điều tra owner trước.

## 3. Quy tắc owner — bắt buộc

- Một behavior chỉ nên có **một owner runtime**.
- Nếu owner tồn tại, sửa trực tiếp owner.
- Không tạo `oldFunction = window.function; window.function = ...` chỉ để thay một phần behavior nếu có thể sửa owner.
- Không dùng event capture/interception để thay behavior của owner khác nếu sửa trực tiếp được.
- Không dùng `MutationObserver` để “đợi DOM rồi sửa lại” markup do owner vừa render nếu owner có thể render đúng ngay.
- Không dùng text replacement runtime để đổi nhãn nếu markup source có owner rõ ràng.
- File UI chung không được chứa business logic domain trừ adapter được thiết kế chính thức.

### Ngoại lệ compatibility

Nếu thật sự cần compatibility patch tạm thời:

- phải ghi comment `COMPATIBILITY TEMPORARY`;
- ghi owner đích cần chuyển về;
- không mở rộng patch thành nơi chứa chức năng mới;
- phải đưa vào danh sách technical debt để dọn ở đợt refactor gần nhất;
- patch không được trở thành mẫu cho code mới.

## 4. Edge Function — quy tắc bắt buộc

- Mỗi Function phải **self-contained**.
- Không phụ thuộc `_shared` giữa các Function.
- Không giả định deploy toàn project bằng CLI.
- Function phải copy/deploy độc lập từ Supabase Dashboard được.
- Khi cần xem Function hiện tại, đọc `supabase/functions/<function-name>/index.ts` trên `main`.
- Không dựa vào Function từng gửi ở chat cũ hoặc ZIP cũ.
- Sửa source Function trên GitHub **không đồng nghĩa Function trên Supabase đã redeploy**.
- Khi sửa Function phải nói rõ Function nào cần redeploy.
- Frontend-only phải nói rõ **không cần thao tác Supabase**.
- Logic model/quota/fallback phải giữ deploy độc lập.

## 5. Database / SQL / migration

- Supabase database là nguồn dữ liệu nghiệp vụ chính thức.
- Không sửa schema ngầm từ frontend.
- Schema/RPC/RLS thay đổi phải có SQL rõ ràng.
- Migration/upgrade: `supabase/migrations/`.
- Snapshot schema/RLS/policies: `supabase/schema/`.
- Policy SQL độc lập: `supabase/policies/`.
- Trước SQL mới phải kiểm migration mới nhất và schema hiện tại.
- Không tạo constraint/RPC trùng hoặc làm yếu RLS.
- Nếu migration mới thay thế migration cũ, phải ghi rõ migration nào không cần chạy nữa.
- Assessment backend checkpoint hiện tại: `assessment_schema_version = 12.3.1` cho đến khi có migration chính thức mới.

### Quy tắc transaction/data integrity

- Multi-step write có nguy cơ để dữ liệu dở dang phải dùng RPC/transaction hoặc rollback rõ ràng.
- Insert parent rồi insert child: nếu child lỗi phải rollback parent hoặc dùng transaction backend.
- Không cập nhật source question và snapshot theo thứ tự có thể khiến bản cũ ghi ngược source.
- Dữ liệu lịch sử attempt đã submit phải được xem là audit-sensitive.

## 6. RLS và bảo mật

- Không bypass RLS bằng frontend.
- Không đưa service-role key vào frontend.
- Admin/Giảng viên/Sinh viên phải kiểm quyền ở backend với dữ liệu nhạy cảm.
- RPC `security definer` phải kiểm quyền người gọi bên trong function.
- Ngân hàng đề thi bảo mật không được dùng sai mục đích cho bài luyện tập/online.
- Review bài, đáp án đúng, AI feedback và dữ liệu kết quả phải tuân permission của bài và vai trò.
- Query/feedback phải scope đúng `subject_id`, `exam_id`, `attempt_id`, student liên quan.
- Global account ban và per-course lock là hai nghiệp vụ khác nhau; không dùng thay thế lẫn nhau.

## 7. Kiến trúc frontend chung

- Chia JS theo domain/chức năng.
- Một domain quan trọng chỉ có **một owner runtime rõ ràng**.
- Child module nhận dependency qua context/API thay vì global ngầm khi có thể.
- Hạn chế gán global; nếu cần compatibility API thì owner chịu trách nhiệm công khai.
- Không monkey patch nếu có thể sửa đúng owner.
- Không tạo nhiều lớp vá JS/CSS chồng lên nhau.
- Khi refactor phải bảo toàn behavior trước khi tối ưu thêm.
- Không thêm chức năng mới vào file chỉ vì file đó “đang chạy sau cùng”.

Bản đồ owner xem `ARCHITECTURE-AI-CLO.md`.

## 8. Assessment — single-owner runtime

Cấu trúc chuẩn:

```text
js/
├─ assessment.js
└─ assessment/
   ├─ common.js
   ├─ online-lifecycle.js
   ├─ online-builder.js
   ├─ final-exam.js
   ├─ student-attempt.js
   └─ results.js
```

Quy tắc:

- `assessment.js` là owner/router/lifecycle public duy nhất.
- Child modules không tự gán owner public song song.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Dependency truyền qua context/API.
- Không monkey patch Assessment.
- Không thêm `MutationObserver` vào Assessment child modules.
- Utility xuất đề online ở `js/exams/online-export.js`.
- Load order phải giữ child modules trước owner khi kiến trúc hiện tại yêu cầu.

### Builder

- Ma trận/rút câu/thay câu/AI sinh câu thuộc `online-builder.js`.
- Nếu thay UI của Builder, ưu tiên sửa markup/handler trong Builder thay vì interceptor bên ngoài.
- AI sinh câu phải có lifecycle rõ: idle → input → generating → preview → accept/cancel/error.
- Đóng X/cancel phải trả state nút về bình thường.
- Response AI đến muộn sau cancel không được tự lưu câu.

## 9. Persistence / giữ màn hình

Hai lớp dùng chung:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

### `subpage-state.js`

Phụ trách:

- workspace/subpage hiện tại;
- system/course/view context;
- entity/mode;
- scroll position;
- restore sau reload/discard/pageshow;
- registry chung của module.

### `form-persistence.js`

Phụ trách:

- form draft;
- input/textarea/select;
- checkbox/radio;
- matrix/form state.

### Quy tắc

- Không tạo navigation persistence riêng cho từng module nếu có thể đăng ký `AICLO_SUBPAGE_STATE`.
- UI persistence không thay thế dữ liệu chính thức ở Supabase.
- Chỉ xóa state khi người dùng chủ động rời workflow hoặc workflow save/complete đã rời trang con.
- Không xóa vì `visibilitychange`, `pagehide` hoặc browser tab switch.
- Không restore/render đè workspace đang sống.

## 10. Student Attempt

- Đáp án autosave lên Supabase.
- Có local recovery khi mạng lỗi.
- Khi mở lại: ưu tiên server, sau đó phủ pending local chưa sync.
- Deadline không được kéo dài bởi reload/tab switch.
- Deadline thực không lớn hơn deadline server.
- Local draft giữ `currentQuestionIndex`.
- Sau submit thành công phải xóa local attempt draft.
- Student Attempt là full-width subpage trong `#content`.
- Không hiển thị Chapter/Topic/CLO trong lúc làm bài nếu nghiệp vụ đã chốt ẩn.

Local attempt recovery không được biến thành navigation persistence thứ ba.

## 11. CSS ownership

### Core/UI

- `css/app.css`: token màu, typography/control base, field/input/button và form primitives.
- `css/app-brand.css`: sole owner logo/brand login + sidebar.
- `css/ui/application.css`: app geometry/layout, content sizing, desktop shell geometry, boot guard.
- `css/ui/primitives.css`: stats, panel, toolbar, table, badge, row-actions, empty, toast, progress bar.
- `css/ui/shell.css`: sidebar/header/footer shell chrome + Drawer.
- `css/ui/dialogs.css`: native dialog/modal/confirm chrome.
- `css/ui/app-window.css`: AI-CLO app-window chrome/drag/resize/mobile.
- `css/ui/layout-system.css`: generic-only layout primitives.
- `css/ui/mobile-overrides.css`: mobile guards/fallback dùng chung còn cần thiết.

### Domain

- `css/courses/`: course catalog, class/member, Chương · Chủ đề · CLO.
- `css/questions/`: Question Bank, workspace, duplicate scan, matrix, quick edit, tools.
- `css/exams/`: Assessment/final/detail/attempt/export/builder.
- `css/system/`: Dashboard, Notifications, Activity, Profile, system Question Banks.
- `css/students/`: student profile.
- `css/results/`: result-specific UI.

### Quy tắc CSS

- Không tạo lại `css/ui/final-layer.css`.
- Không đưa app layout trở lại `app.css`.
- Không đưa logo/brand ra khỏi `app-brand.css`.
- Không đưa selector module vào `layout-system.css`.
- Domain CSS phải tự cung cấp first-paint layout.
- `questions/bank.css` là owner canonical của Question Bank table/card/tab/scope.
- `css/legacy/` là archive only, không load runtime.
- Không dùng `!important` để chữa ownership conflict trừ guard đặc biệt có comment.
- Nếu cần giảm request, ưu tiên build-time bundle.

## 12. UI consistency contract

Mọi trang cùng cấp phải dùng cùng cấu trúc trình bày.

### Page header

Chuẩn:

```text
Eyebrow
Title
Description
Actions/Status
```

- Eyebrow đỏ, uppercase, ngắn.
- Title lớn, cùng cấp semantic.
- Description muted, 1–2 dòng.
- Back button riêng khỏi primary actions.
- Không lặp title lần hai trong panel nội dung.

### List page

Chuẩn:

```text
Header
Primary actions
Search/filters
Filter summary/chips
List/table/cards
Count/pagination
```

### Detail page

Chuẩn:

```text
Header
Status/actions
Info grid
Main detail
History/audit
```

### Form page

- Full edit lớn → subpage/workspace.
- Quick edit → app-window.
- Save/Cancel ở footer/action row ổn định.
- Validation phải chỉ ra trường cần sửa.

### Modal / Window / Drawer

- Modal: xác nhận/form ngắn.
- App-window: quick edit/AI flow tập trung.
- Drawer: xem nhanh/chi tiết phụ trợ.
- Không dùng Drawer cho workflow dài nhiều bước.

## 13. Button / badge / naming contract

### Button

- `primary`: hành động chính.
- `secondary`: hành động phụ.
- `danger`: xóa/rủi ro.
- `ai-btn`: thao tác gọi AI.
- Không tạo semantic màu mới nếu đã có loại tương ứng.

### AI naming

- UI dùng từ **AI**, không dùng provider làm tên chức năng.
- Ví dụ: `AI hỗ trợ`, `AI sinh câu hỏi`, `AI phân tích`, `AI nhận xét`.
- Tên model thật như Gemini chỉ hiện ở metadata/result/log kỹ thuật khi cần.
- Dữ liệu legacy `origin_type='gemini'` có thể giữ để tương thích; UI label là `AI hỗ trợ`.

### Badge/status

- Màu và semantic phải nhất quán giữa các trang.
- Không dùng một màu cho hai nghĩa đối lập.
- Badge chỉ chứa metadata/status ngắn, không dùng như button.

## 14. Question Bank

Tách rõ:

- **Luyện tập – kiểm tra**.
- **Đề thi – bảo mật**.

Quy tắc:

- Online Assessment không dùng câu chỉ thuộc bank bảo mật.
- Thi cuối kỳ dùng nguồn bảo mật theo workflow đã chốt.
- `display_code` phải ổn định.
- Không để CSS/class nghiệp vụ Question Bank, duplicate scan và Assessment dùng lẫn nhau.
- Sửa nhanh câu từ Builder nếu được định nghĩa là sửa lỗi nguồn thì phải update câu gốc, giữ ID/mã câu, lưu revision và đồng bộ working snapshot.
- AI sinh câu là **câu mới**; chỉ insert khi giảng viên chấp nhận; câu mới có ID/mã riêng.

## 15. Snapshot / identity / lịch sử

Phân biệt rõ:

- source question;
- frozen pool/snapshot của bài;
- mapping câu trong bài;
- attempt/student answer lịch sử.

Quy tắc:

- Không coi snapshot là source question.
- Không để snapshot cũ ghi ngược source.
- Không tự cập nhật lịch sử attempt đã nộp khi câu nguồn thay đổi.
- Bài đã có attempt phải khóa structural changes có thể ảnh hưởng công bằng.
- Nếu phải thay đổi sau attempt, chỉ thay field đã được product contract cho phép và bảo toàn lịch sử.

## 16. Assessment product rules

Framework chung:

1. Mục 1 — Thông tin.
2. Mục 2 — Cấu trúc/Ma trận.
3. Mục 3 — Danh sách câu/rules theo mode.
4. Mục 4 — Xuất với loại bài phù hợp.

Quy tắc:

- Tổng phân bổ ma trận phải bằng `total_questions` trước khi rút.
- Không tạo draft `total_questions = 0`.
- Đổi câu phải giữ đúng cell cấu trúc ban đầu.
- `max_attempts` có thể chỉnh nếu nghiệp vụ cho phép; không sửa/xóa lịch sử cũ.
- Thi cuối kỳ không phát hành sinh viên làm online.
- Chế độ random thuần không hiển thị câu cụ thể ở bước design.
- Mixed mode phải chọn câu cố định trước, phần còn lại mới random.

## 17. CLO / kết quả

- Không hard-code CLO1/2/3 nếu UI có thể hỗ trợ dynamic CLO.
- Bảng/Excel dùng cột CLO theo dữ liệu thực tế khi phù hợp.
- Ngưỡng đạt hiện dùng 4/10 ở nơi đã chốt.
- Không trộn AI feedback/kết quả giữa học phần.
- Scope query đúng subject/exam/student.
- Dashboard/analytics nên ưu tiên insight/actionable state hơn bộ đếm đơn thuần.

## 18. AI / Gemini backend

- AI chỉ gọi khi người dùng chủ động yêu cầu, trừ nơi đã chốt khác.
- Không gọi AI tự động mỗi lần render trang.
- Giảm request không cần thiết.
- Khi model/quota/fallback thay đổi phải đọc Function hiện tại trên GitHub trước.
- AI feedback phải kiểm permission/backend guard.
- Edge Function AI tiếp tục self-contained.
- Cancel/close UI không đồng nghĩa request mạng chắc chắn bị abort; code phải ignore response muộn nếu workflow đã cancelled.

## 19. Excel / Office export

- Với Excel nghiệp vụ cần trình bày đẹp, ưu tiên ExcelJS.
- Office libs lazy-load nếu không cần lúc initial page load.
- File chính thức cần border/alignment/header/width/print setup hợp lý.
- Excel đáp án+CLO cho `/cham-thi-clo` giữ cấu trúc canonical.
- `/cham-thi-clo` là công cụ public riêng, không trộn nghiệp vụ Assessment online.

## 20. Math / LaTeX

- Nội dung toán trên web dùng MathJax/renderMath chung.
- Không tạo MathJax loader riêng ở từng module.
- MathJax nên lazy-load.
- Export TeX giữ source LaTeX càng nguyên vẹn càng tốt.
- Thay exporter phải static-check và nên compile thử với dữ liệu thật trước khi tuyên bố ổn định.

## 21. Hiệu năng

- Tránh reload toàn trang khi chỉ đổi view nội bộ.
- Ưu tiên cache/query cache nơi an toàn.
- Lazy-load MathJax, ExcelJS, JSZip và thư viện nặng.
- Hạn chế MutationObserver rộng toàn document.
- Observer nếu cần phải debounce/coalesce.
- Không polling dày nếu event-driven xử lý được.
- Không ghi storage liên tục khi state không thay đổi.
- Không restore/render đè workspace đang sống chỉ vì tab browser đổi visibility.
- Không dùng observer để chữa layout/render nếu owner có thể làm đúng ngay.
- Nếu tối ưu request thì bundle ở build/deploy, không phá source ownership.

## 22. Cache/versioning

- Khi sửa file JS/CSS đang được `app.html` load với query version, phải đánh giá có cần bump cache key không.
- Không để user phải Ctrl+F5 như cơ chế cập nhật chính thức.
- Thay đổi quan trọng nên bump version/query để trình duyệt lấy file mới.
- Version trong comment file không thay thế cache-busting runtime.
- Không bump hàng loạt file không đổi.

## 23. Testing bắt buộc theo phạm vi

### Frontend UI

- desktop;
- mobile;
- loading/empty/error;
- back/forward;
- reload/tab switch/restore;
- không horizontal overflow ngoài chỗ chủ đích.

### Question Bank

- list/filter/detail/back;
- add/edit/quick-edit;
- AI create/preview/accept/cancel;
- origin/status/bank scope.

### Assessment

- create;
- matrix;
- draw;
- fixed/random/mixed;
- save/edit;
- student attempt;
- autosave/reload;
- submit/result;
- lock behavior sau attempt.

### Permission

- Admin;
- Teacher;
- Student;
- backend enforcement với thao tác nhạy cảm.

Không được tuyên bố “đã test runtime” nếu chỉ mới static review/code inspection.

## 24. Git / quy trình thay đổi

Trước thay đổi có ý nghĩa:

1. Đọc docs chuẩn.
2. Đọc owner/code `main`.
3. Tạo backup branch.
4. Sửa đúng owner.
5. So diff.
6. Static/smoke check phù hợp.
7. Kiểm cache key.
8. Kiểm Pages/CI nếu có.
9. Ghi rõ tác động Supabase.
10. Cập nhật docs nếu owner/quy tắc thay đổi.

Không force push trừ trường hợp thật sự cần và đã hiểu hậu quả.

## 25. Quy tắc review diff

Trước khi kết thúc một thay đổi phải tự hỏi:

- Có tạo owner thứ hai không?
- Có thêm wrapper/observer không cần thiết không?
- Có selector CSS mới ghi đè owner cũ không?
- Có sửa đúng mobile không?
- Có làm mất persistence không?
- Có thay đổi schema mà chưa có migration không?
- Có làm yếu permission không?
- Có cần cache bump không?
- Có giữ behavior lịch sử không?

Nếu câu trả lời không chắc chắn, chưa nên coi thay đổi hoàn tất.

## 26. Tài liệu — nguồn ưu tiên

Thứ tự đọc:

1. `PROJECT-NOTES-AI-CLO.md` — quyết định UI/nghiệp vụ.
2. `ARCHITECTURE-AI-CLO.md` — owner map và architecture contract.
3. `TECHNICAL-AGREEMENTS.md` — quy tắc bắt buộc.
4. `PROJECT-STATUS-YYYY-MM-DD.md` mới nhất.
5. `PROJECT-PROGRESS-YYYY-MM-DD.md` mới nhất.
6. Code `main`.

Nếu code và tài liệu xung đột: xác minh `main`, xác định tài liệu lỗi thời, cập nhật docs trong cùng phiên.

## 27. Mục tiêu kỹ thuật V12.7

Ưu tiên:

- quét owner toàn hệ thống;
- loại dần monkey-patch/wrapper/observer chỉ dùng để vá;
- thống nhất page header/list/detail/form/window/drawer/button/badge;
- không thêm CSS override version mới nếu có thể sửa canonical owner;
- giữ nguyên behavior nghiệp vụ đã ổn;
- thêm regression checklist/test cho luồng quan trọng;
- giảm trường hợp phải nhớ lịch sử patch để hiểu code hiện tại.

---

**Nguyên tắc cao nhất:** trước khi “làm cho chạy”, phải xác định **đúng owner + đúng data lifecycle + đúng UI contract**. Patch nhanh chỉ được chấp nhận như giải pháp tạm thời có kế hoạch loại bỏ, không phải kiến trúc chuẩn.