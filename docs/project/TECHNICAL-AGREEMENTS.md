# AI-CLO PTITHCM — THỐNG NHẤT KỸ THUẬT CHUNG

> Tài liệu này ghi các **quy tắc bắt buộc** khi tiếp tục phát triển AI-CLO PTITHCM. Bản đồ kiến trúc xem tại `ARCHITECTURE-AI-CLO.md`; các quyết định UI/nghiệp vụ ưu tiên xem tại `PROJECT-NOTES-AI-CLO.md`.

Cập nhật: **08/09/2026 — checkpoint V12.6.43**

## 1. Nguồn mã và môi trường chạy

### Frontend

- Repository chính: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`.
- Frontend chạy trên GitHub Pages.
- Nhánh chuẩn để đọc code hiện hành: `main`.
- Trước khi sửa phải đọc code mới nhất trên `main`, không suy đoán từ ZIP/chat/version cũ.
- Khi người dùng chỉ đang trao đổi/góp ý thì không tự ý sửa runtime. Chỉ triển khai khi yêu cầu đã rõ và người dùng xác nhận thực hiện.

### Supabase

Supabase là backend đang chạy thực tế:

- PostgreSQL.
- Auth.
- Storage.
- RPC / SQL functions.
- Row Level Security.
- Edge Functions.

GitHub lưu source backend để đọc/chỉnh; Supabase là nơi backend chạy thực tế.

## 2. Edge Function — quy tắc bắt buộc

- Mỗi Function phải **self-contained**.
- Không phụ thuộc `_shared` giữa các Function.
- Không giả định người dùng deploy toàn project bằng CLI.
- Function phải có thể copy/deploy độc lập trên Supabase Dashboard.
- Khi cần xem Function hiện tại, đọc `supabase/functions/<function-name>/index.ts` trên `main`.
- Không dựa vào Function từng gửi ở chat cũ hoặc ZIP cũ.
- Sửa source Function trên GitHub **không đồng nghĩa Function trên Supabase đã redeploy**.
- Khi sửa Function phải nói rõ Function nào cần redeploy.
- Frontend-only phải nói rõ **không cần thao tác Supabase**.
- Logic AI/model fallback nếu Function cần phải nằm trong chính Function hoặc theo cấu trúc vẫn deploy độc lập được.

## 3. Database / SQL / migration

- Supabase database là nguồn dữ liệu nghiệp vụ chính thức.
- Không sửa schema ngầm từ frontend.
- Schema/RPC/RLS thay đổi phải có SQL rõ ràng.
- Migration/upgrade: `supabase/migrations/`.
- Snapshot schema/RLS/policies: `supabase/schema/`.
- Policy SQL độc lập: `supabase/policies/`.
- Trước khi viết SQL mới phải kiểm migration mới nhất và schema hiện tại.
- Không tạo constraint/RPC trùng hoặc làm yếu RLS.
- Nếu migration mới thay thế migration cũ, phải ghi rõ migration nào không cần chạy nữa.
- Assessment backend version function hiện vẫn là `assessment_schema_version = 12.3.1` cho đến khi có migration chính thức thay version này.
- Migration additive/hardening có thể không đổi `assessment_schema_version`; phải ghi rõ điều đó trong file SQL và tài liệu.

Các migration Live hiện hành:

```text
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Hai migration này **không đổi `assessment_schema_version`**.

## 4. RLS và bảo mật

- Không bypass RLS bằng frontend.
- Không đưa service-role key vào frontend.
- Admin/Giảng viên/Sinh viên phải được kiểm quyền ở backend với dữ liệu nhạy cảm.
- RPC `security definer` phải kiểm quyền người gọi bên trong function.
- Ngân hàng đề thi bảo mật không được dùng sai mục đích cho bài luyện tập/online.
- Review bài, đáp án đúng, AI feedback và dữ liệu kết quả phải tuân permission của bài và vai trò.
- Query/feedback phải scope đúng `subject_id`, `question_bank_id`, `exam_id`, `attempt_id`, student liên quan.
- Teacher Live **không được nhận phương án A/B/C/D đang chọn** của attempt đang làm.
- Telemetry fullscreen/tab/window là **tín hiệu giám sát**, không được mô tả như bằng chứng chống gian lận tuyệt đối.

## 5. Kiến trúc frontend chung — single owner

- Ưu tiên chia JS theo domain/chức năng.
- Một behavior/domain quan trọng chỉ nên có **một owner runtime rõ ràng**.
- Child module nhận dependency qua context/API thay vì global ngầm khi có thể.
- Hạn chế gán global; nếu cần compatibility API thì owner chịu trách nhiệm công khai.
- Không monkey patch nếu có thể sửa đúng owner.
- Không tạo nhiều lớp vá JS/CSS chồng lên nhau.
- Không tạo hai event-listener/module cùng sở hữu một tương tác người dùng.
- Khi refactor phải bảo toàn behavior trước khi tối ưu thêm.

Ví dụ đã chốt ở Question Bank:

- `js/questions/hover-preview.js` là **owner duy nhất** của hover xem nhanh câu hỏi.
- `js/questions/matrix-panel.js` không được thêm lại hover “NỘI DUNG ĐẦY ĐỦ”.

Bản đồ thư mục và owner xem `ARCHITECTURE-AI-CLO.md`.

## 6. Assessment — single-owner runtime

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
   ├─ live-monitor.js
   └─ results.js
```

Module hỗ trợ:

```text
js/assessment/attempt-monitor.js
js/assessment/export-dropdown.js
js/exams/online-export.js
```

Quy tắc:

- `assessment.js` là owner/router/lifecycle public duy nhất.
- Child modules không tự gán owner public song song.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Dependency truyền qua context/API.
- Không monkey patch Assessment.
- Không thêm `MutationObserver` vào Assessment child modules để thay owner hiện có.
- Utility xuất đề online ở `js/exams/online-export.js`.
- Load order phải giữ child modules trước owner khi kiến trúc hiện tại yêu cầu.
- Trang Chi tiết bài kiểm tra phải mở đầy đủ chức năng ngay từ luồng danh sách; không được phụ thuộc F5/reload mới gắn action như LIVE.

## 7. Persistence / giữ màn hình

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
- restore sau **reload/discard thật sự**;
- registry chung của module.

### `form-persistence.js`

Phụ trách:

- form draft;
- input/textarea/select;
- checkbox/radio;
- matrix/form state.

### Contract browser-tab bắt buộc

> **Đổi sang browser tab khác rồi quay lại không phải navigation. Nếu DOM hiện tại còn sống thì phải giữ nguyên, không render lại.**

Do đó:

- không gọi `render()` chỉ vì `visibilitychange`, `pageshow`, `focus` hoặc auth event phát lại khi tab active;
- không render trang mẹ rồi vài phần mười giây sau mới restore trang con;
- giữ nguyên DOM, scroll, form, workspace, menu/panel đang sống nếu browser không reload/discard;
- reload/F5/discard thật sự mới dùng `AICLO_SUBPAGE_STATE` để restore;
- không xóa subpage state chỉ vì `visibilitychange`, `pagehide` hoặc browser tab switch.

### Contract sidebar bắt buộc

> **Click sidebar là navigation chủ động.**

- Khi nhấn menu sidebar, mở **trang mẹ** của menu đó.
- Không tự restore trang con cũ ngay sau click sidebar.
- Ví dụ đang Chi tiết bài kiểm tra → nhấn `Đánh giá` → Danh sách bài kiểm tra.

### Quy tắc chung

- Không tạo navigation persistence mới cho từng module nếu có thể đăng ký vào `AICLO_SUBPAGE_STATE`.
- UI persistence không thay thế dữ liệu chính thức ở Supabase.
- Chỉ xóa subpage state khi người dùng chủ động rời workflow hoặc workflow save/complete đã rời trang con.

## 8. Student Attempt

- Đáp án autosave lên Supabase.
- Có local recovery khi mạng lỗi.
- Khi mở lại: ưu tiên server, sau đó phủ pending local chưa sync.
- Deadline không được kéo dài bởi reload/tab switch.
- Deadline thực không lớn hơn deadline server.
- Local draft giữ `currentQuestionIndex` để khôi phục đúng câu.
- Sau submit thành công phải xóa local attempt draft.
- Student Attempt là full-width subpage trong `#content`.

### Hết giờ / stale open attempt

- Không chỉ dựa `submitted_at is null` để kết luận attempt còn mở.
- Frontend phải dùng `get_exam_attempt_payload.remaining_seconds` hoặc RPC server tương đương để reconcile.
- Nếu server xác nhận hết giờ, finalize theo backend hiện hành rồi refresh attempt list.
- Không dùng đồng hồ client làm nguồn quyết định quyền tạo lượt mới.
- Backend `start_exam_attempt` là guard cuối cùng cho max attempts và stale expired attempt.

Local attempt recovery không được biến thành navigation persistence thứ ba.

## 9. AI-CLO | LIVE / monitoring

### UI contract

- LIVE là **subpage trong `app.html`**, không tạo HTML riêng.
- Nút entry hiển thị đúng nhãn **AI-CLO | LIVE**.
- Nút nằm **cùng hàng với tên bài kiểm tra, canh phải** trên teacher/Admin Detail.
- Không đặt LIVE vào action bar chuẩn nếu yêu cầu UI này chưa thay đổi.
- Quay lại từ LIVE trở về đúng Chi tiết bài kiểm tra.

### Data contract

Teacher được xem:

- answered count / total;
- current question number;
- server remaining time;
- last heartbeat;
- fullscreen state;
- page visibility/away reason;
- violations/total away time;
- status warning/disconnected/expired/submitted;
- answered-number map, không có selected option value.

Teacher **không được xem A/B/C/D đang chọn**.

### Backend contract

`assessment-v12.6.34-live-monitoring.sql` tạo:

- `attempt_live_state` — snapshot/presence mỗi attempt;
- `attempt_monitor_events` — event history;
- RPC student update/start/finish monitor event;
- RPC teacher đọc Live snapshot/event history.

Runtime access cho telemetry phải qua RPC có permission guard; không mở table rộng cho authenticated.

`attempt_live_state.attempt_id` và `attempt_monitor_events.attempt_id` dùng `ON DELETE CASCADE` tới `exam_attempts`. Vì vậy contract hiện tại là:

> **Xóa một lượt làm = xóa cả Live state và monitor history của lượt đó.**

### iOS/mobile sync

Safari/iOS có thể freeze JS/network rất nhanh khi app đi nền. Do đó:

- event phải có `client_event_id` ổn định;
- khi quay lại phải sync/bù event;
- backend de-duplicate theo `(attempt_id, client_event_id)`;
- không tăng violations/total away hai lần cho cùng incident;
- heartbeat phải gửi lại sớm khi app active trở lại.

### Fullscreen limitation

- Web Fullscreen API cần thao tác người dùng và không phải kiosk mode.
- Không được ép người dùng cài trình duyệt khác trong scope hiện tại.
- Trình duyệt/OS có thể cho Esc, app switch, multi-monitor, thiết bị khác; hệ thống chỉ ghi nhận các tín hiệu API/browser cho phép.
- Trình duyệt không hỗ trợ fullscreen đầy đủ không được mặc định coi là vi phạm chỉ vì thiếu capability.

## 10. CSS ownership

### Core/UI

- `css/app.css`: token màu, typography/control base, field/input/button và form primitives.
- `css/app-brand.css`: **sole owner** logo/brand của login + sidebar.
- `css/ui/application.css`: app geometry/layout, content sizing, desktop shell geometry, boot guard.
- `css/ui/primitives.css`: stats, panel, toolbar, table, badge, row-actions, empty, toast, progress bar.
- `css/ui/shell.css`: sidebar/header/footer shell chrome + Drawer.
- `css/ui/dialogs.css`: native dialog/modal/confirm chrome.
- `css/ui/app-window.css`: AI-CLO app-window chrome/drag/resize/mobile.
- `css/ui/layout-system.css`: chỉ generic `.aiclo-kpi-grid`, `.aiclo-action-grid`, `.aiclo-filter-bar`.
- `css/ui/mobile-overrides.css`: mobile guards/fallback dùng chung còn cần thiết.

### Domain

- `css/courses/`: course catalog, class/member, Chương · Chủ đề · CLO.
- `css/questions/`: Question Bank, workspace, duplicate scan, matrix, quick edit, tools.
- `css/exams/`: Assessment/final/detail/attempt/export/builder/LIVE.
- `css/system/`: Dashboard, Notifications, Activity, Profile, system Question Banks.
- `css/students/`: student profile.
- `css/results/`: result-specific UI.

### Quy tắc CSS

- Không tạo lại `css/ui/final-layer.css`.
- Không đưa app layout trở lại `app.css`.
- Không đưa logo/brand ra khỏi `app-brand.css`.
- Không đưa selector module vào `layout-system.css`.
- Domain CSS phải tự cung cấp first-paint layout để JS tagging không gây flicker.
- `css/questions/bank.css` là owner canonical của Question Bank table/card/tab/scope và layout bảng.
- `css/questions/bank-layout.css` chỉ sở hữu enhancement toolbar/filter/chips/selection.
- `css/exams/live-monitor.css` sở hữu layout/chrome responsive của teacher Live.
- `css/exams/attempt-monitor.css` sở hữu cảnh báo/monitor UI phía sinh viên.
- `app.html` không load `css/public.css`.
- `css/legacy/` là archive only, không load runtime.
- Không gom source CSS thủ công chỉ để giảm số file. Nếu cần giảm request, ưu tiên build-time bundle.

## 11. UI interaction contract

- **Chi tiết/xem nhanh** → Drawer/panel khi phù hợp.
- **Sửa nhanh** → AI-CLO app-window.
- **Sửa đầy đủ/chỉnh cấu trúc lớn** → full-width subpage/workspace.
- Boolean bật/tắt → toggle switch khi phù hợp.
- Mobile không được có horizontal overflow ở shell/form chính.
- Bảng rất rộng phải scroll ngang **bên trong vùng bảng** hoặc chuyển card mode; không được kéo toàn app viewport tràn ngang.
- Khi sửa desktop phải kiểm lại mobile.
- Dropdown/popover phải đóng khi click ngoài; `Esc` đóng khi phù hợp và phải giữ focus/accessibility hợp lý.

## 12. Question Bank

Tách rõ:

- **Luyện tập – kiểm tra**.
- **Đề thi – bảo mật**.

Quy tắc:

- Online assessment không dùng câu chỉ thuộc bank bảo mật.
- Thi cuối kỳ dùng nguồn bảo mật theo workflow đã chốt.
- `display_code` phải ổn định và hiển thị đúng nơi nghiệp vụ cần.
- Mã câu do hệ thống sinh; người dùng không cần nhập mã trong Excel bulk import.
- UI có thể đệm 0 để hiển thị, ví dụ `000307`, nhưng ý nghĩa nghiệp vụ vẫn là sequence/số tự nhiên.
- Không để CSS/class nghiệp vụ của Question Bank, duplicate scan và Assessment dùng lẫn nhau.

### Provenance label

- Backend giữ giá trị kỹ thuật hiện có, ví dụ `origin_type = 'gemini'`.
- User-facing wording phải dùng **AI**, hiện tại là `✦ AI hỗ trợ`.
- Không đổi schema/data chỉ để đổi nhãn hiển thị.
- Danh sách và Chi tiết phải nhất quán cùng label.

### Hover preview

- Owner duy nhất: `js/questions/hover-preview.js`.
- Desktop hover nội dung → câu đầy đủ + A/B/C/D.
- Không đánh dấu đáp án đúng trong hover list.
- Lazy-load option khi cần, cache hợp lý.
- Mobile không phụ thuộc hover.
- `matrix-panel.js` không được gắn listener hover câu hỏi.

### Bulk import / Excel mẫu

Hai mode tạo câu:

```text
Tạo một câu | Tải hàng loạt
```

Workbook mẫu hiện dùng:

```text
Cau_hoi
Vi_du
Chuong_Chu_de
CLO
Danh_muc
Huong_dan
```

Importer phải ưu tiên sheet `Cau_hoi`. Dòng ví dụ phải nằm riêng ở `Vi_du` để tránh import nhầm.

Cột canonical:

```text
Chương | Chủ đề | CLO | Nội dung | A | B | C | D | Đáp án | Lời giải | Ngân hàng | Trạng thái
```

Không thêm cột Mã câu nếu hệ thống vẫn tự sinh mã.

## 13. Assessment product rules

Framework chung:

1. Mục 1 — Thông tin.
2. Mục 2 — Cấu trúc/Ma trận.
3. Mục 3 — Danh sách câu đã rút.
4. Mục 4 — Xuất với loại bài phù hợp.

Quy tắc quan trọng:

- Chọn phạm vi nội dung ở Mục 2, không đưa chọn Chương trở lại Mục 1.
- Tổng phân bổ ma trận phải bằng `total_questions` trước khi rút.
- Không tạo draft có `total_questions = 0`.
- Đổi câu phải giữ đúng cell cấu trúc/ngữ cảnh ban đầu.
- `max_attempts` được phép chỉnh sau khi có lượt làm.
- Giảm `max_attempts` không xóa/sửa lượt lịch sử; chỉ chặn lượt mới khi đã đạt giới hạn mới.
- Thi cuối kỳ không phát hành cho sinh viên làm online.

## 14. CLO / kết quả

- CLO không hard-code chỉ CLO1/2/3 nếu UI có thể hỗ trợ dynamic CLO.
- Bảng/Excel nên dùng cột CLO theo dữ liệu thực tế khi phù hợp.
- Ngưỡng đạt hiện dùng mốc 4/10 ở các nơi đã chốt.
- Không trộn AI feedback/kết quả giữa học phần.
- Scope query đúng subject/exam/student.

## 15. AI / Gemini

- AI chỉ gọi khi người dùng chủ động yêu cầu, trừ nơi đã chốt khác.
- Không gọi Gemini tự động mỗi lần render trang.
- Giảm request không cần thiết.
- Khi model/quota/fallback thay đổi phải đọc Function hiện tại trên GitHub trước.
- AI feedback phải kiểm permission/backend guard.
- Edge Function AI tiếp tục self-contained.
- User-facing wording ưu tiên **AI**; metadata kỹ thuật/backend có thể giữ tên model/provider hiện hữu nếu cần tương thích.

## 16. Excel / Office export

- Với Excel nghiệp vụ cần trình bày đẹp, ưu tiên ExcelJS.
- Office libs phải lazy-load nếu không cần lúc initial page load.
- File chính thức cần border/alignment/header/width/print setup hợp lý.
- Dropdown export phải có dismiss behavior rõ ràng.
- Excel Live/history không được làm lộ lựa chọn đáp án đang làm nếu product contract không cho phép.
- Excel đáp án+CLO phục vụ `/cham-thi-clo` phải giữ cấu trúc canonical đã thống nhất.
- `/cham-thi-clo` là công cụ public riêng, không trộn nghiệp vụ với Assessment online.

## 17. Math / LaTeX

- Nội dung toán trên web dùng MathJax/renderMath chung.
- Không tạo MathJax loader riêng ở từng module.
- MathJax nên lazy-load.
- Export TeX giữ source LaTeX càng nguyên vẹn càng tốt.
- Thay exporter phải static-check và nên compile thử với dữ liệu thật trước khi tuyên bố ổn định.

## 18. Hiệu năng

- Tránh reload toàn trang khi chỉ đổi view nội bộ.
- Ưu tiên cache/query cache nơi an toàn.
- Lazy-load MathJax, ExcelJS, JSZip và thư viện nặng.
- Hạn chế MutationObserver rộng toàn document.
- Observer nếu cần phải debounce/coalesce.
- Không polling dày nếu event-driven xử lý được.
- Teacher Live hiện dùng refresh khoảng **5 giây**, không dùng 500 ms server polling.
- Không ghi storage liên tục khi state không thay đổi.
- Không restore/render đè workspace đang sống chỉ vì tab browser thay đổi visibility.
- Hiện CSS source không lớn; nếu tối ưu request thì bundle ở build/deploy, không phá source ownership.

## 19. Git / quy trình thay đổi

Trước thay đổi có ý nghĩa:

1. Đọc `PROJECT-NOTES-AI-CLO.md`.
2. Đọc `ARCHITECTURE-AI-CLO.md` và file owner liên quan.
3. Đọc code mới nhất trên `main`.
4. Tạo backup branch.
5. Làm trên work branch khi thay đổi có rủi ro/ý nghĩa lớn.
6. So diff.
7. Smoke/static-check phù hợp.
8. Fast-forward `main` khi sạch.
9. Kiểm GitHub Pages.
10. Ghi rõ tác động Supabase.

Không force push trừ trường hợp thật sự cần và đã hiểu hậu quả.

Các file probe/noop/sentinel tạo nhầm phải được xóa ngay; không để file rác tồn tại trong tree.

## 20. Tài liệu — nguồn ưu tiên

Thứ tự đọc:

1. `PROJECT-NOTES-AI-CLO.md` — quyết định kỹ thuật/UI/nghiệp vụ ưu tiên.
2. `ARCHITECTURE-AI-CLO.md` — bản đồ kiến trúc hiện hành.
3. `TECHNICAL-AGREEMENTS.md` — quy tắc bắt buộc.
4. `PROJECT-STATUS-2026-09-08.md` — trạng thái hiện tại.
5. `PROJECT-PROGRESS-2026-09-08.md` — tiến trình chi tiết.
6. Code `main`.

Nếu code và tài liệu xung đột, xác minh code `main`, xác định tài liệu lỗi thời rồi cập nhật lại tài liệu.

---

Checkpoint quy tắc này tương ứng **V12.6.43**. Các điểm bắt buộc mới của 08/09/2026 là: browser tab switch phải đóng băng DOM đang sống; sidebar click về trang mẹ; LIVE không lộ A/B/C/D và không được coi là secure browser; iOS monitor phải sync/de-duplicate incident; Question Bank hover chỉ có một owner; provenance `gemini` ở backend hiển thị `AI hỗ trợ` ở UI.