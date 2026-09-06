# AI-CLO PTITHCM — THỐNG NHẤT KỸ THUẬT CHUNG

> Tài liệu này ghi các **quy tắc bắt buộc** khi tiếp tục phát triển AI-CLO PTITHCM. Bản đồ kiến trúc xem tại `ARCHITECTURE-AI-CLO.md`; các quyết định UI/nghiệp vụ ưu tiên xem tại `PROJECT-NOTES-AI-CLO.md`.

Cập nhật: **06/09/2026 — checkpoint V12.4.24**

## 1. Nguồn mã và môi trường chạy

### Frontend

- Repository chính: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`.
- Frontend chạy trên GitHub Pages.
- Nhánh chuẩn để đọc code hiện hành: `main`.
- Trước khi sửa phải đọc code mới nhất trên `main`, không suy đoán từ ZIP/chat/version cũ.

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
- Logic Gemini/model fallback nếu Function cần phải nằm trong chính Function hoặc theo cấu trúc vẫn deploy độc lập được.

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
- Assessment backend checkpoint hiện tại: `assessment_schema_version = 12.3.1` cho đến khi có migration chính thức mới.

## 4. RLS và bảo mật

- Không bypass RLS bằng frontend.
- Không đưa service-role key vào frontend.
- Admin/Giảng viên/Sinh viên phải được kiểm quyền ở backend với dữ liệu nhạy cảm.
- RPC `security definer` phải kiểm quyền người gọi bên trong function.
- Ngân hàng đề thi bảo mật không được dùng sai mục đích cho bài luyện tập/online.
- Review bài, đáp án đúng, AI feedback và dữ liệu kết quả phải tuân permission của bài và vai trò.
- Query/feedback phải scope đúng `subject_id`, `exam_id`, `attempt_id`, student liên quan.

## 5. Kiến trúc frontend chung

- Ưu tiên chia JS theo domain/chức năng.
- Một domain quan trọng chỉ nên có **một owner runtime rõ ràng**.
- Child module nhận dependency qua context/API thay vì global ngầm khi có thể.
- Hạn chế gán global; nếu cần compatibility API thì owner chịu trách nhiệm công khai.
- Không monkey patch nếu có thể sửa đúng owner.
- Không tạo nhiều lớp vá JS/CSS chồng lên nhau.
- Khi refactor phải bảo toàn behavior trước khi tối ưu thêm.

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
- restore sau reload/discard/pageshow;
- registry chung của module.

### `form-persistence.js`

Phụ trách:

- form draft;
- input/textarea/select;
- checkbox/radio;
- matrix/form state.

### Quy tắc

- Không tạo navigation persistence mới cho từng module nếu có thể đăng ký vào `AICLO_SUBPAGE_STATE`.
- UI persistence không thay thế dữ liệu chính thức ở Supabase.
- Chỉ xóa subpage state khi người dùng chủ động rời workflow hoặc workflow save/complete đã rời trang con.
- Không xóa chỉ vì `visibilitychange`, `pagehide` hoặc browser tab switch.

## 8. Student Attempt

- Đáp án autosave lên Supabase.
- Có local recovery khi mạng lỗi.
- Khi mở lại: ưu tiên server, sau đó phủ pending local chưa sync.
- Deadline không được kéo dài bởi reload/tab switch.
- Deadline thực không lớn hơn deadline server.
- Local draft giữ `currentQuestionIndex` để khôi phục đúng câu.
- Sau submit thành công phải xóa local attempt draft.
- Student Attempt là full-width subpage trong `#content`.

Local attempt recovery không được biến thành navigation persistence thứ ba.

## 9. CSS ownership V12.4.24

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
- `css/exams/`: Assessment/final/detail/attempt/export/builder.
- `css/system/`: Dashboard, Notifications, Activity, Profile, system Question Banks.
- `css/students/`: student profile.
- `css/results/`: result-specific UI.

### Quy tắc CSS

- Không tạo lại `css/ui/final-layer.css`.
- Không đưa app layout trở lại `app.css`.
- Không đưa logo/brand ra khỏi `app-brand.css`.
- Không đưa selector module vào `layout-system.css`.
- Domain CSS phải tự cung cấp first-paint layout để JS tagging không gây flicker.
- `questions/bank.css` là owner canonical của Question Bank table/card/tab/scope; không thêm lại tầng V10.5/V10.5.3 override.
- `app.html` không load `css/public.css`.
- `css/legacy/` là archive only, không load runtime.
- Không gom source CSS thủ công chỉ để giảm số file. Nếu cần giảm request, ưu tiên build-time bundle.

## 10. UI interaction contract

- **Chi tiết/xem nhanh** → Drawer/panel khi phù hợp.
- **Sửa nhanh** → AI-CLO app-window.
- **Sửa đầy đủ/chỉnh cấu trúc lớn** → full-width subpage/workspace.
- Boolean bật/tắt → toggle switch khi phù hợp.
- Mobile không được có horizontal overflow ở shell/form chính.
- Bảng rất rộng có thể dùng scroll ngang có chủ đích hoặc card mode theo nghiệp vụ.
- Khi sửa desktop phải kiểm lại mobile.

## 11. Question Bank

Tách rõ:

- **Luyện tập – kiểm tra**.
- **Đề thi – bảo mật**.

Quy tắc:

- Online assessment không dùng câu chỉ thuộc bank bảo mật.
- Thi cuối kỳ dùng nguồn bảo mật theo workflow đã chốt.
- `display_code` phải ổn định và hiển thị đúng nơi nghiệp vụ cần.
- Không để CSS/class nghiệp vụ của Question Bank, duplicate scan và Assessment dùng lẫn nhau.

## 12. Assessment product rules

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

## 13. CLO / kết quả

- CLO không hard-code chỉ CLO1/2/3 nếu UI có thể hỗ trợ dynamic CLO.
- Bảng/Excel nên dùng cột CLO theo dữ liệu thực tế khi phù hợp.
- Ngưỡng đạt hiện dùng mốc 4/10 ở các nơi đã chốt.
- Không trộn AI feedback/kết quả giữa học phần.
- Scope query đúng subject/exam/student.

## 14. AI / Gemini

- AI chỉ gọi khi người dùng chủ động yêu cầu, trừ nơi đã chốt khác.
- Không gọi Gemini tự động mỗi lần render trang.
- Giảm request không cần thiết.
- Khi model/quota/fallback thay đổi phải đọc Function hiện tại trên GitHub trước.
- AI feedback phải kiểm permission/backend guard.
- Edge Function AI tiếp tục self-contained.

## 15. Excel / Office export

- Với Excel nghiệp vụ cần trình bày đẹp, ưu tiên ExcelJS.
- Office libs phải lazy-load nếu không cần lúc initial page load.
- File chính thức cần border/alignment/header/width/print setup hợp lý.
- Excel đáp án+CLO phục vụ `/cham-thi-clo` phải giữ cấu trúc canonical đã thống nhất.
- `/cham-thi-clo` là công cụ public riêng, không trộn nghiệp vụ với Assessment online.

## 16. Math / LaTeX

- Nội dung toán trên web dùng MathJax/renderMath chung.
- Không tạo MathJax loader riêng ở từng module.
- MathJax nên lazy-load.
- Export TeX giữ source LaTeX càng nguyên vẹn càng tốt.
- Thay exporter phải static-check và nên compile thử với dữ liệu thật trước khi tuyên bố ổn định.

## 17. Hiệu năng

- Tránh reload toàn trang khi chỉ đổi view nội bộ.
- Ưu tiên cache/query cache nơi an toàn.
- Lazy-load MathJax, ExcelJS, JSZip và thư viện nặng.
- Hạn chế MutationObserver rộng toàn document.
- Observer nếu cần phải debounce/coalesce.
- Không polling dày nếu event-driven xử lý được.
- Không ghi storage liên tục khi state không thay đổi.
- Không restore/render đè workspace đang sống chỉ vì tab browser thay đổi visibility.
- Hiện CSS source không lớn; nếu tối ưu request thì bundle ở build/deploy, không phá source ownership.

## 18. Git / quy trình thay đổi

Trước thay đổi có ý nghĩa:

1. Đọc `PROJECT-NOTES-AI-CLO.md`.
2. Đọc `ARCHITECTURE-AI-CLO.md` và file owner liên quan.
3. Đọc code mới nhất trên `main`.
4. Tạo backup branch.
5. Làm trên work branch.
6. So diff.
7. Smoke/static-check phù hợp.
8. Fast-forward `main` khi sạch.
9. Kiểm GitHub Pages.
10. Ghi rõ tác động Supabase.

Không force push trừ trường hợp thật sự cần và đã hiểu hậu quả.

## 19. Tài liệu — nguồn ưu tiên

Thứ tự đọc:

1. `PROJECT-NOTES-AI-CLO.md` — quyết định kỹ thuật/UI/nghiệp vụ ưu tiên.
2. `ARCHITECTURE-AI-CLO.md` — bản đồ kiến trúc hiện hành.
3. `TECHNICAL-AGREEMENTS.md` — quy tắc bắt buộc.
4. `PROJECT-STATUS-2026-09-06.md` — trạng thái hiện tại.
5. `PROJECT-PROGRESS-2026-09-06.md` — tiến trình chi tiết.
6. Code `main`.

Nếu code và tài liệu xung đột, xác minh code `main`, xác định tài liệu lỗi thời rồi cập nhật lại tài liệu.

---

Checkpoint quy tắc này tương ứng **V12.4.24**, sau khi hoàn tất đợt CSS ownership/refactor lớn. Giai đoạn kế tiếp ưu tiên smoke test UI/nghiệp vụ thực tế hơn là tiếp tục tách CSS chỉ để làm sạch mã.
