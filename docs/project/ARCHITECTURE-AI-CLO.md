# AI-CLO PTITHCM — KIẾN TRÚC HỆ THỐNG

> Tài liệu này mô tả **kiến trúc hiện hành và kiến trúc đích** của AI-CLO PTITHCM. Mục tiêu chính là giúp mọi lần sửa sau tìm đúng owner, giữ UI thống nhất và tránh tiếp tục tích lũy các lớp compatibility/override/monkey-patch chồng lên nhau.

Cập nhật: **07/09/2026 — chuẩn hóa tài liệu V12.6.17**.

## 1. Mốc tham chiếu

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chuẩn: `main`
- Frontend hiện hành: nhánh V12.6.x; checkpoint tài liệu này được cập nhật sau V12.6.16.
- Backend Assessment checkpoint: `assessment_schema_version = 12.3.1` cho đến khi có migration chính thức mới.
- Supabase là backend chạy thực tế; GitHub là nguồn mã/version-control.
- Khi tài liệu và code mâu thuẫn: kiểm code `main`, xác định thay đổi mới nhất, sau đó cập nhật tài liệu ngay trong cùng đợt thay đổi.

## 2. Sơ đồ tổng thể

```text
Người dùng
   │
   ├─ Trang công khai
   │   ├─ index.html
   │   ├─ huong-dan.html
   │   └─ /cham-thi-clo/
   │
   └─ Ứng dụng đăng nhập
       └─ app.html
           ├─ CSS core + domain owner
           ├─ JS core + UI + domain modules
           ├─ Supabase JS client
           └─ Math/Office libs lazy-load khi cần

Frontend ───────────────► Supabase
                         ├─ PostgreSQL
                         ├─ Auth
                         ├─ Storage
                         ├─ RLS / RPC
                         └─ Edge Functions self-contained
                                  │
                                  └─ AI/Gemini theo thao tác chủ động
```

Nguyên tắc nguồn dữ liệu:

- **Supabase là nguồn dữ liệu nghiệp vụ chính thức.**
- `sessionStorage` / `localStorage` chỉ giữ UI state, draft và recovery.
- Frontend không bypass RLS và không chứa service-role key.
- Snapshot nghiệp vụ của bài kiểm tra không được xem như bản sao thay thế cho ngân hàng câu hỏi; snapshot có lifecycle riêng.

## 3. Entrypoint và các không gian UI

### Public

- `index.html`: landing page.
- `huong-dan.html`: hướng dẫn sử dụng.
- `cham-thi-clo/`: công cụ Chấm thi CLO công khai, không yêu cầu đăng nhập và có CSS/JS riêng.
- Public không dùng chung CSS nghiệp vụ của app nếu không có lý do rõ ràng.
- `app.html` không load `css/public.css`.

### App

- `app.html`: shell ứng dụng có Auth, sidebar, header, content, footer, Drawer và modal/dialog.
- `#content`: host chính cho dashboard, học phần, ngân hàng câu hỏi, Assessment, kết quả, profile và workspace full-width.
- Drawer dùng cho xem nhanh/chi tiết phụ trợ; không dùng cho chỉnh cấu trúc lớn.
- Quick Edit dùng AI-CLO app-window thống nhất.
- Full create/edit workflow ưu tiên subpage/workspace trong `#content`.

## 4. Kiến trúc JavaScript

Cấu trúc cấp cao:

```text
js/
├─ app.js                    # app/bootstrap/legacy core orchestration
├─ assessment.js             # owner runtime Assessment duy nhất
├─ assessment/               # child modules Assessment
├─ core/                     # performance, loader, Office, cache...
├─ ui/                       # shell, navigation, persistence, app-window...
├─ system/                   # users, notifications, profile, activity...
├─ courses/                  # course/member/data/overview...
├─ questions/                # question bank/workspace/tools...
├─ exams/                    # export/final/detail helpers
├─ students/                 # student/profile flows
├─ results/                  # result helpers
└─ ai/ + ai-chat.js          # AI UI/domain helpers
```

Quy tắc nền tảng:

- Chia module theo domain/chức năng.
- Một domain quan trọng chỉ có **một owner runtime rõ ràng**.
- Child module nhận dependency qua context/API thay vì global ngầm khi có thể.
- Không tạo late monkey-patch chỉ để sửa một module đã có owner.
- Không tạo một file “fix”, “patch”, “override”, “final-layer” mới nếu owner hiện hữu có thể sửa trực tiếp.
- Compatibility wrapper chỉ là giải pháp chuyển tiếp; phải được ghi rõ lý do và kế hoạch loại bỏ.

### 4.1. Owner map — màn hình/chức năng chính

| Khu vực | Owner chính | Ghi chú |
|---|---|---|
| App bootstrap/navigation | `js/app.js`, `js/ui/navigation.js`, `js/ui/shell.js` | Không đưa logic nghiệp vụ domain vào shell |
| Học phần/cấu trúc | `js/courses/` | Member, catalog, overview, data theo file domain |
| Ngân hàng câu hỏi | `js/questions/` | Bank/list/detail/form/tool phải quy về owner trong domain Questions |
| Nguồn câu hỏi | `js/questions/origin.js` | Chỉ sở hữu provenance/origin; không sở hữu toàn bank |
| Quick edit câu hỏi | `js/questions/quick-edit.js` + app-window UI chung | Business save thuộc Questions, window chrome thuộc UI |
| Assessment online | `js/assessment.js` + `js/assessment/*` | Single-owner runtime |
| Xuất bài online | `js/exams/online-export.js` | Chỉ export; không sở hữu Builder |
| Bài thi cuối kỳ | `js/assessment/final-exam.js` + CSS exams tương ứng | Không trộn với online attempt |
| Student attempt | `js/assessment/student-attempt.js` | Sole owner luồng làm bài sinh viên |
| Kết quả CLO | `js/assessment/results.js` + `css/results/` | Scope đúng subject/exam/student |
| Người dùng hệ thống | `js/system/users.js` | Quyền backend vẫn phải enforce ở Function/RLS |
| Thành viên học phần | `js/courses/members.js` | Không biến khóa theo lớp thành global ban nếu nghiệp vụ yêu cầu per-course |
| Persistence subpage | `js/ui/subpage-state.js` | Registry chung |
| Persistence form | `js/ui/form-persistence.js` | Draft/input state chung |

### 4.2. Assessment

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

- `assessment.js` là owner/router/lifecycle public duy nhất.
- Child module đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Không tạo owner Assessment thứ hai.
- Không thêm `MutationObserver` vào child module Assessment.
- `online-lifecycle.js` sở hữu lifecycle bài online phía giảng viên/Admin.
- `online-builder.js` sở hữu thiết kế/ma trận/rút câu/thay câu/AI generation theo ngữ cảnh Builder.
- `student-attempt.js` sở hữu danh sách bài sinh viên → Chi tiết bài → workspace làm bài → kết quả/xem câu hỏi.
- Utility xuất đề online ở `js/exams/online-export.js`.

### 4.3. Known compatibility debt cần quét

Các lớp sau không mặc định được xem là kiến trúc đích dù hiện đang chạy:

- wrapper kiểu `const oldX = window.x; window.x = ...`;
- adapter chặn sự kiện để thay behavior của owner khác;
- `MutationObserver` dùng để sửa DOM sau khi owner đã render;
- CSS selector versioned chỉ để ghi đè selector cũ;
- file UI chung chứa business logic domain;
- runtime text replacement để đổi nhãn thay vì sửa owner tạo markup.

Các trường hợp đang tồn tại phải được đánh dấu là **compatibility debt**, không được dùng làm mẫu cho code mới. Khi chạm vào chức năng đó ở đợt refactor, ưu tiên chuyển logic về owner thật.

## 5. Persistence và recovery

Hai lớp persistence dùng chung:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

### `subpage-state.js`

Nhớ:

- system/course/view;
- workspace/subpage;
- entity đang mở;
- mode;
- scroll position;
- restore sau reload/discard/browser lifecycle.

Assessment đăng ký các kind chính:

- `assessment-detail`;
- `assessment-student-detail`;
- `assessment-attempt`;
- `assessment-attempt-result`;
- `assessment-builder`;
- `assessment-export`;
- `assessment-results`.

### `form-persistence.js`

Nhớ:

- input / textarea / select;
- checkbox / radio;
- form draft;
- matrix/form state.

### Student Attempt recovery

`js/assessment/student-attempt.js` có local recovery chuyên biệt cho:

- pending answer chưa sync;
- deadline local an toàn;
- `currentQuestionIndex`.

Local recovery này không phải navigation persistence thứ ba. Workspace Attempt vẫn do `AICLO_SUBPAGE_STATE` quản lý.

## 6. Kiến trúc CSS

Định hướng chuẩn là **owner-based CSS**: core primitives dùng chung + domain CSS tự sở hữu selector nghiệp vụ.

### 6.1. Core UI owners

| File | Owner |
|---|---|
| `css/app.css` | token màu, typography/control base, field/input/button, form primitives |
| `css/app-brand.css` | sole owner logo/brand login + sidebar |
| `css/ui/application.css` | app geometry/layout, content sizing, boot guard |
| `css/ui/primitives.css` | stats, panel, toolbar, table, badge, empty, toast, progress |
| `css/ui/shell.css` | sidebar/header/footer + Drawer chrome |
| `css/ui/dialogs.css` | native dialog/modal/confirm chrome |
| `css/ui/app-window.css` | AI-CLO app-window chrome, drag/resize/mobile |
| `css/ui/layout-system.css` | generic-only reusable layout classes |
| `css/ui/mobile-overrides.css` | guard/fallback mobile dùng chung còn cần thiết |

### 6.2. Domain owners

#### Courses

```text
css/courses/
├─ catalog.css
├─ class-list.css
└─ structure.css
```

#### Questions

```text
css/questions/
├─ bank.css
├─ bank-layout.css
├─ analysis.css
├─ tools.css
├─ workspace.css
├─ create-form-layout.css
├─ duplicate-scan.css
├─ matrix-panel.css
├─ pagination.css
└─ quick-edit.css
```

`bank.css` là owner canonical cho tab/scope/table/card mobile của Ngân hàng câu hỏi. Không thêm lại tầng versioned override chỉ để thắng specificity.

#### Assessment / Exams

Các owner nổi bật:

- `assessment-shared.css` — primitives/chrome chung của Assessment;
- `student-attempt.css` — sole owner UI student assessment/attempt;
- `unified-builder.css` — Builder;
- `detail-enhancements.css` — detail/attempt table giảng viên/Admin;
- `final-workflow.css` — workflow đề cuối kỳ;
- `assessment-window.css` — window nghiệp vụ Assessment;
- `assessment-form-compact.css` — form compact;
- `online-export.css` — export center;
- `create-wizard.css` — wizard;
- `final-matrix-compact.css` — final matrix.

#### System / Student / Result

- `css/system/`: dashboard, notifications, activity, profile, question-banks.
- `css/students/profile.css`: hồ sơ sinh viên.
- `css/results/ai-state.css`: trạng thái/khối AI và kết quả.

### 6.3. CSS ownership rules

- Không tạo lại `css/ui/final-layer.css`.
- Không đưa selector domain vào `layout-system.css`.
- Không dùng `!important` để giải quyết xung đột owner trừ trường hợp guard đặc biệt có giải thích.
- Nếu hai file cùng sở hữu một component, phải chọn một owner và di chuyển selector về đó.
- File domain phải có first-paint layout đủ đúng; không chờ JS thêm class mới để “sửa lại” giao diện sau render.
- `css/legacy/` là archive only, không load runtime.
- Nếu giảm request, bundle ở build/deploy; không phá source ownership.

## 7. UI design contract — chuẩn bắt buộc để các trang cùng một hệ thống

### 7.1. Page header chuẩn

Trang con/full-width nên theo thứ tự:

```text
EYEBROW (đỏ, uppercase, ngắn)
TITLE (h1/h2 lớn)
DESCRIPTION (muted, 1–2 dòng)
ACTIONS / STATUS (nếu có)
CONTENT
```

- Không có trang dùng title card kiểu A, trang khác dùng title nằm trong toolbar nếu cùng cấp điều hướng.
- Nút Quay lại đặt riêng, rõ quan hệ điều hướng; không trộn vào nhóm action nghiệp vụ chính.
- Header chung của app không thay đổi chỉ để phục vụ một trang con.

### 7.2. List page chuẩn

Thứ tự ưu tiên:

```text
Page header
Primary actions
Search + Filters
Active filter chips / summary
Table hoặc card list
Pagination / count
Empty / loading / error state
```

- Primary action nằm cùng vị trí tương đối giữa các trang.
- Filter không rải nhiều hàng nếu có thể gom panel/drawer.
- Mobile chuyển table thành card hoặc scroll có chủ đích, không để overflow ngẫu nhiên.

### 7.3. Detail page chuẩn

```text
Page header
Status + primary actions
Info grid / summary
Main detail sections
History/audit/secondary data
```

- Không lặp lại title trong panel đầu tiên nếu header đã có title.
- Info grid dùng cùng khoảng cách, border, label/value hierarchy.
- Danger actions tách khỏi primary actions.

### 7.4. Create/Edit page chuẩn

- Full edit lớn → subpage/workspace.
- Quick edit nhỏ → app-window.
- Form dùng `.field`, form grid/primitives chung.
- Save/Cancel luôn ở footer/action row ổn định.
- Validation hiển thị gần field hoặc summary rõ ràng; không chỉ toast nếu người dùng cần sửa nhiều trường.

### 7.5. Modal / app-window / Drawer

- Native modal: xác nhận hoặc form ngắn.
- AI-CLO app-window: quick edit/AI workflow cần thao tác tập trung, có thể drag/resize desktop.
- Drawer: xem nhanh/chi tiết phụ trợ; không dùng cho cấu trúc dài nhiều bước.
- Dấu X phải đóng sạch state UI; không để button bên ngoài stuck loading.

### 7.6. Button taxonomy

- `primary`: thao tác chính duy nhất trong ngữ cảnh.
- `secondary`: thao tác phụ/trung tính.
- `danger`: xóa/hủy dữ liệu/rủi ro.
- `ai-btn`: thao tác chủ động gọi AI.
- Không tạo màu/nút mới cho cùng một semantic.
- Nhãn chức năng dùng **AI** (`AI hỗ trợ`, `AI sinh câu hỏi`, `AI phân tích`); tên model thực tế chỉ hiện ở metadata/result khi cần.

### 7.7. Badge/status taxonomy

- Badge chỉ dùng cho metadata/status ngắn.
- Màu phải mang ý nghĩa nhất quán: success/active/approved; warning/pending; danger/error/locked.
- Không dùng cùng màu cho hai nghĩa đối lập.

### 7.8. Spacing/compactness

- Ưu tiên giao diện gọn, giảm cuộn dọc nhưng không nén đến mức khó đọc.
- Cùng loại component phải dùng cùng spacing token/primitives thay vì margin riêng theo từng version.
- Không hard-code chiều cao để “khớp” component bên cạnh nếu nội dung là dynamic.

## 8. Question Bank contract

Hai nhóm câu hỏi:

1. **Luyện tập – kiểm tra**.
2. **Đề thi – bảo mật**.

Quy tắc:

- Online Assessment không dùng câu chỉ thuộc ngân hàng bảo mật.
- Thi cuối kỳ dùng nguồn bảo mật theo workflow đã chốt.
- `display_code` là mã hiển thị ổn định của câu.
- Nguồn câu AI hiện có thể lưu kỹ thuật dưới `origin_type='gemini'` để tương thích dữ liệu, nhưng UI hiển thị là **AI hỗ trợ**.
- “Sửa nhanh” từ Builder được hiểu là sửa lỗi câu gốc khi nghiệp vụ đã chốt như vậy; phải cập nhật source question và đồng bộ working snapshot đúng cách.
- “AI sinh câu hỏi” tạo câu mới; chỉ khi giảng viên chấp nhận thì mới insert vào ngân hàng và nhận ID/mã riêng.

## 9. Assessment product contract

Framework chung:

1. Mục 1 — Thông tin.
2. Mục 2 — Cấu trúc/Ma trận.
3. Mục 3 — Danh sách câu/rules theo chế độ.
4. Mục 4 — Xuất, chỉ với loại bài phù hợp.

### 9.1. Chế độ câu hỏi

Các mode hiện hành gồm:

- `common_fixed` — đề chung cố định;
- `student_fixed` — đề riêng cố định theo sinh viên;
- `attempt_random` — rút lại mỗi lần làm;
- `mixed_fixed_random` — câu cố định trước + phần còn lại rút ngẫu nhiên.

UI phải mô tả đúng behavior; không hiển thị câu cụ thể trong mode random thuần khi chưa có attempt.

### 9.2. Question identity và snapshot

Phân biệt bắt buộc:

- `questions.id` / `display_code`: identity của câu nguồn trong ngân hàng.
- `exam_question_pool`: snapshot/frozen pool của bài.
- `exam_questions`: mapping câu cố định/đã chọn của bài tùy workflow.
- attempt/student answers: dữ liệu lịch sử làm bài.

Nguyên tắc:

- Sửa ngân hàng không được tự động làm thay đổi lịch sử attempt đã nộp.
- Bài đã có attempt phải khóa những thay đổi cấu trúc có thể làm mất tính công bằng/lịch sử.
- Nếu sửa câu nguồn từ Builder trước khi phát hành hoặc khi workflow cho phép, phải đồng bộ working snapshot rõ ràng.
- Không để snapshot cũ ghi ngược trở lại source question.
- Không dùng cùng một trường dữ liệu cho cả source và snapshot nếu semantics khác nhau.

### 9.3. Locking khi đã có lượt làm

Cần phân loại setting:

- **Structural**: ma trận, nguồn câu, câu cố định, chapter/topic/CLO, mode rút câu → khóa khi đã có attempt nếu thay đổi có thể ảnh hưởng tính tương đương.
- **Operational**: thời gian mở/đóng, số lượt tối đa, review/answer visibility… → chỉ cho sửa nếu nghiệp vụ đã định nghĩa rõ hậu quả.

Mọi thay đổi sau attempt phải bảo toàn lịch sử đã có.

## 10. Supabase architecture

```text
supabase/
├─ README.md
├─ migrations/
├─ schema/
├─ policies/
├─ functions/
└─ docs/
```

### Edge Functions

- self-contained;
- không phụ thuộc `_shared` giữa các Function;
- có thể copy/deploy từng Function độc lập từ Supabase Dashboard;
- sửa source GitHub không đồng nghĩa đã redeploy Supabase;
- mỗi thay đổi Function phải ghi rõ Function cần redeploy.

### Database / RLS

- Schema/RPC/RLS thay đổi phải có migration rõ ràng.
- Không sửa schema ngầm từ frontend.
- Không bypass RLS bằng frontend.
- Dữ liệu nhạy cảm phải được kiểm quyền ở backend.
- Global account lock và per-course membership lock là hai nghiệp vụ khác nhau; không dùng một cái thay cái kia nếu yêu cầu là khóa trong học phần.

## 11. AI architecture

- AI chỉ gọi khi người dùng chủ động yêu cầu, trừ nơi đã chốt khác.
- UI dùng tên chung **AI**; provider/model cụ thể là metadata kỹ thuật.
- Gemini hiện là backend AI chính; không hard-code thương hiệu Gemini vào tên chức năng mới.
- Khi model/quota/fallback thay đổi phải đọc Function hiện tại trên `main`.
- AI generation phải có trạng thái request rõ ràng: idle → generating → preview → accepted/cancelled/error.
- Đóng window phải kết thúc sạch UI state; response đến muộn không được tự insert dữ liệu nếu người dùng đã bỏ workflow.

## 12. Hiệu năng

- lazy-load Office/Math libs khi phù hợp;
- query/cache hợp lý;
- giảm reload toàn view;
- không observer toàn document nếu có thể event-driven;
- không polling dày;
- không ghi storage liên tục khi state không đổi;
- không dùng DOM post-processing để sửa layout nếu owner có thể render đúng ngay từ đầu.

Nếu cần giảm số CSS/JS request, ưu tiên build-time bundle trong khi giữ source theo domain.

## 13. Kiểm thử kiến trúc tối thiểu

Mỗi đợt refactor owner/UI phải kiểm ít nhất:

- desktop + mobile;
- reload / browser tab switch / restore;
- list → detail → back giữ đúng context;
- create/edit/save/cancel;
- loading/error/empty state;
- role Admin/Teacher/Student nếu chức năng có phân quyền;
- Assessment: create → draw → save → edit → attempt → submit → result;
- Question: create → quick edit → AI create → accept → list/detail;
- không phát sinh horizontal overflow ngoài nơi chủ đích.

## 14. Tài liệu và thứ tự đọc trước khi sửa

1. `docs/project/PROJECT-NOTES-AI-CLO.md` — quyết định UI/nghiệp vụ đã chốt.
2. `docs/project/ARCHITECTURE-AI-CLO.md` — owner map + architecture contract.
3. `docs/project/TECHNICAL-AGREEMENTS.md` — quy tắc bắt buộc khi viết/sửa code.
4. `docs/project/PROJECT-STATUS-YYYY-MM-DD.md` mới nhất.
5. `docs/project/PROJECT-PROGRESS-YYYY-MM-DD.md` mới nhất.
6. Code mới nhất trên `main`.

Nếu tài liệu và code xung đột, phải xác minh code `main` rồi cập nhật tài liệu trong cùng phiên làm việc.

## 15. Quy tắc thay đổi repo

- Backup branch trước thay đổi có ý nghĩa.
- Tìm owner trước khi viết.
- Sửa owner trực tiếp nếu có thể.
- So diff sau thay đổi.
- Không force push nếu không có lý do đặc biệt.
- Refactor phải bảo toàn behavior trước khi tối ưu thêm.
- Frontend-only → nói rõ Supabase không thay đổi.
- SQL/Edge Function → tách riêng và ghi rõ thao tác Supabase cần thực hiện.
- Sau thay đổi kiến trúc/owner phải cập nhật lại hai file kiến trúc/kỹ thuật nếu quy tắc hoặc owner map thay đổi.

## 16. Mục tiêu chuẩn hóa V12.7

Đợt chuẩn hóa kế tiếp nên ưu tiên **không thêm chức năng lớn**, mà quét toàn hệ thống theo các tiêu chí:

1. Mỗi màn hình/chức năng có owner JS rõ ràng.
2. Mỗi component giao diện có owner CSS rõ ràng.
3. Loại dần monkey-patch/wrapper/observer chỉ dùng để vá.
4. Thống nhất page header, list page, detail page, form, modal/window, Drawer, button và badge.
5. Giữ nguyên behavior nghiệp vụ đã ổn định.
6. Sau refactor, số file có tên/logic compatibility không tăng.
7. Mỗi thay đổi mới phải dễ tìm bằng owner map, không cần nhớ lịch sử các lớp vá.

---

**Kiến trúc đích:** AI-CLO phải phát triển theo mô hình **single owner + shared primitives + domain modules + explicit data lifecycle**. Một fix tốt là fix ngay tại owner; một compatibility patch chỉ được xem là tạm thời, không phải kiến trúc chuẩn.