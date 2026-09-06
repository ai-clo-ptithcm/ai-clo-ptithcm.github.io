# AI-CLO PTITHCM — THỐNG NHẤT KỸ THUẬT CHUNG

> Đây là tài liệu kỹ thuật sống của dự án. Mục đích là để ChatGPT hoặc người phát triển quay lại dự án sau này có thể đọc một file duy nhất để hiểu các nguyên tắc kỹ thuật đã thống nhất. Khi có quy ước kiến trúc/kỹ thuật mới, ưu tiên **cập nhật file này** thay vì tạo thêm nhiều tài liệu rời rạc.

## 1. Nguồn mã và nơi hệ thống chạy

### Frontend

- Repository chính: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`.
- Frontend được phục vụ qua GitHub Pages.
- Nhánh chuẩn để đọc mã hiện hành là `main`.
- Trước khi chỉnh bất kỳ chức năng nào, phải đọc mã hiện tại trên `main`, không suy đoán từ phiên bản cũ hoặc trí nhớ.

### Supabase

Supabase là backend đang chạy thực tế của hệ thống:

- PostgreSQL database.
- Auth.
- Storage.
- RPC / SQL functions.
- Row Level Security.
- Edge Functions.

### Quy tắc rất quan trọng về Edge Functions

**GitHub đang lưu bản mã nguồn Edge Function hiện hành đang được dùng/deploy trên Supabase.**

Vì vậy:

1. Khi cần xem một Edge Function hiện tại, phải mở trực tiếp:

   `supabase/functions/<function-name>/index.ts`

   trên nhánh `main` của GitHub.

2. Không được dựa vào file Function người dùng từng gửi ở chat cũ, ZIP cũ, `_shared` cũ hoặc trí nhớ.

3. GitHub là **nguồn mã hiện hành để đọc/chỉnh/đối chiếu Function**.

4. Supabase là **nơi Function chạy thực tế**.

5. Khi sửa Function trên GitHub, người dùng vẫn phải deploy/redeploy Function đó lên Supabase Dashboard nếu thay đổi cần chạy thật.

6. Khi trả lời người dùng về Function hiện tại, phải đọc bản trong GitHub trước nếu câu hỏi phụ thuộc code thực tế.

Các thư mục Function hiện đang có trong repo tại thời điểm lập tài liệu:

```text
supabase/functions/
├─ admin-users/
├─ ai_clo_chat/
├─ analyze-assessment/
├─ analyze-question-similarity/
├─ analyze-student-clo/
├─ generate-one-question/
├─ generate-questions/
└─ scan-question-duplicates/
```

Danh sách này có thể thay đổi. Khi cần biết chính xác Function hiện tại, phải liệt kê lại thư mục `supabase/functions/` trên `main`.

## 2. Nguyên tắc Edge Function

- Mỗi Edge Function phải **self-contained**.
- Không phụ thuộc thư mục `_shared` giữa các Function.
- Không giả định người dùng deploy toàn bộ project bằng CLI.
- Người dùng thường copy/deploy từng Function trực tiếp trên Supabase Dashboard.
- Nếu một Function cần logic Gemini/model fallback thì logic cần nằm trong chính Function đó hoặc được tổ chức theo cách vẫn deploy độc lập được.
- Không thêm dependency liên-Function khiến một Function không thể copy/deploy riêng.
- Khi sửa Function phải nói rõ cho người dùng Function nào cần redeploy.
- Nếu chỉ sửa frontend và không cần backend, phải nói rõ: **không cần thao tác Supabase**.

## 3. Database / SQL / migration

- Supabase database là nguồn dữ liệu chính thức.
- Không sửa schema ngầm từ frontend.
- Mọi thay đổi schema/RPC/RLS phải có SQL rõ ràng.
- SQL migration/reference được lưu trong repo, chủ yếu tại `docs/` hoặc `supabase/` tùy giai đoạn.
- Trước khi viết SQL mới, phải kiểm tra migration mới nhất và schema hiện tại để tránh tạo constraint/RPC trùng hoặc làm mất RLS.
- Không giả định migration cũ chưa/chắc đã chạy; nếu cần xác minh phải hỏi hoặc đọc trạng thái mà người dùng cung cấp.
- Nếu một migration mới supersede migration cũ, phải nói rõ migration nào không cần chạy nữa.
- Với Assessment, backend schema checkpoint gần nhất được dùng là `assessment_schema_version = 12.3.1` cho đến khi có migration mới chính thức.

## 4. RLS và bảo mật

- Không bypass RLS bằng frontend.
- Quyền Admin/Giảng viên/Sinh viên phải được xác thực ở backend đối với dữ liệu nhạy cảm.
- Các RPC nhạy cảm có thể dùng `security definer`, nhưng phải kiểm tra quyền người gọi bên trong function.
- Ngân hàng đề thi bảo mật không được dùng cho bài luyện tập trực tuyến.
- Các thao tác xem kết quả, xem đáp án, AI feedback phải tuân theo permission của bài kiểm tra và vai trò người dùng.
- Không đưa service-role key vào frontend.
- Frontend chỉ dùng publishable/anon key phù hợp.

## 5. Kiến trúc frontend chung

- Ưu tiên chia JS theo domain/chức năng, không gom mọi thứ vào một file lớn.
- Một domain chỉ nên có một owner runtime rõ ràng.
- Child module nhận dependency qua context/API thay vì phụ thuộc biến global ngầm.
- Hạn chế gán global; nếu cần global compatibility thì owner chịu trách nhiệm công khai API.
- Không monkey patch nếu có thể sửa kiến trúc gốc.
- Không tạo nhiều lớp vá JS chồng lên nhau.
- Khi refactor, giữ backward compatibility nếu các phần khác đang dùng API cũ.

## 6. Kiến trúc Assessment đã chốt

Assessment frontend giữ đúng cấu trúc owner/module:

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

Nguyên tắc:

- `assessment.js` là owner/router/lifecycle public runtime duy nhất.
- Child modules không tự gán `window.exams`, `window.results`.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Dependency truyền qua `ctx`.
- Không MutationObserver trong Assessment modules.
- Không monkey patch trong Assessment.
- Utility xuất đề Online đặt ngoài owner modules, hiện tại là `js/exams/online-export.js`.
- Thứ tự load Assessment phải giữ owner cuối cùng sau các child module.

## 7. Persistence / giữ màn hình toàn web

Chỉ giữ **hai file persistence dùng chung**:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

### `subpage-state.js`

Phụ trách:

- workspace/subpage hiện tại;
- context system/course/view;
- entity đang mở;
- scroll position;
- restore sau lifecycle trình duyệt;
- tránh restore đè lên workspace đang sống.

### `form-persistence.js`

Phụ trách:

- form draft;
- input/textarea/select;
- checkbox/radio;
- matrix/form state;
- khôi phục dữ liệu đang nhập.

### Quy ước bắt buộc

- Không tạo thêm persistence file riêng cho từng module nếu có thể đăng ký vào hai file trên.
- Workspace mới phải dùng API/register của `subpage-state.js`.
- Form/draft mới phải dùng `form-persistence.js` hoặc API của nó.
- UI persistence không thay thế dữ liệu chính thức ở Supabase.
- `sessionStorage/localStorage` chỉ là UI state/local recovery.
- Dữ liệu chính thức luôn lấy Supabase làm nguồn chuẩn.

## 8. Sinh viên làm bài

- Đáp án phải autosave lên Supabase.
- Có local recovery khi mạng lỗi.
- Khi mở lại: ưu tiên server, rồi phủ phần local pending chưa sync.
- Deadline không được reset bởi reload/tab switch.
- Deadline thực phải không lớn hơn deadline server.
- Sau submit thành công phải xóa local draft của attempt.
- Không tự động mất đáp án chỉ vì đổi tab Chrome.
- Mục tiêu lâu dài: restore đúng câu SV đang xem sau reload/discard.

## 9. Tạo/chỉnh sửa dữ liệu

- Không để người dùng mất dữ liệu đang nhập khi chuyển tab/view nếu chưa chủ động Hủy/Quay lại.
- Khi người dùng chủ động Hủy/Quay lại thì draft tương ứng được phép xóa.
- Sau khi save thành công, local draft phải được dọn để tránh restore dữ liệu cũ.
- Với dữ liệu nghiệp vụ quan trọng, lưu chính thức phải atomic hoặc có transaction/RPC phù hợp.

## 10. AI / Gemini

- AI chỉ được gọi khi người dùng chủ động yêu cầu, trừ nơi đã được chốt rõ khác đi.
- Không gọi Gemini tự động mỗi lần render trang.
- Ưu tiên giảm request không cần thiết.
- Edge Function phải có model fallback hợp lý khi Function đó sử dụng Gemini.
- Khi model/quota thay đổi, kiểm tra code Function hiện tại trong GitHub trước.
- Không suy đoán model mặc định từ trí nhớ.
- AI feedback phải kiểm tra permission/backend guard trước khi trả dữ liệu.

## 11. Ngân hàng câu hỏi

- Tách rõ:
  - Luyện tập – kiểm tra.
  - Đề thi – bảo mật.
- Bài kiểm tra online không được lấy câu chỉ thuộc ngân hàng đề thi bảo mật.
- Một câu có thể được phân loại theo quy tắc đã hỗ trợ của hệ thống, nhưng luồng sử dụng phải tôn trọng security group.
- Mã câu (`display_code`) cần được giữ ổn định và hiển thị rõ trong các luồng quản lý/đề thi khi phù hợp.

## 12. CLO / đánh giá

- CLO là dữ liệu theo học phần/ngân hàng cấu trúc, không hard-code chỉ CLO1/2/3 nếu phần giao diện có thể hỗ trợ dynamic CLO.
- Các bảng kết quả/Excel nên dùng cột CLO động theo dữ liệu thực tế.
- Ngưỡng đạt hiện dùng mốc 4/10 ở các nơi đã chốt.
- Không trộn dữ liệu AI feedback giữa các học phần.
- Mọi query/feedback phải scope đúng `subject_id`/exam/student liên quan.

## 13. Excel / Office export

- Với file Excel nghiệp vụ cần trình bày đẹp, ưu tiên ExcelJS.
- Lazy-load thư viện Office để không làm chậm app lúc mở.
- File báo cáo chính thức nên:
  - Times New Roman 12 khi phù hợp yêu cầu hiện tại;
  - border rõ;
  - alignment hợp lý;
  - header bold;
  - column width hợp lý;
  - print setup phù hợp.
- Không dùng thư viện Office nặng ngay ở initial load nếu có thể lazy-load.
- Với Excel đáp án+CLO phục vụ `/cham-thi-clo`, phải giữ đúng cấu trúc canonical đã thống nhất.

## 14. Math / LaTeX

- Nội dung toán trên web dùng `window.renderMath`/MathJax chung.
- Không tạo loader MathJax riêng ở từng module.
- MathJax nên lazy-load.
- Export TeX phải giữ source LaTeX càng nguyên vẹn càng tốt.
- Khi thay đổi exporter phải static-check JS và nên compile thử TeX với dữ liệu thật trước khi tuyên bố hoàn toàn ổn định.

## 15. Hiệu năng

- Tránh reload toàn trang khi chỉ đổi view nội bộ.
- Ưu tiên cache/query cache nơi an toàn.
- Lazy-load thư viện nặng như MathJax, ExcelJS, JSZip.
- Hạn chế MutationObserver rộng toàn document.
- Nếu dùng observer phải debounce/coalesce.
- Không ghi storage liên tục khi state không thay đổi.
- Không tạo polling dày nếu event-driven xử lý được.
- Khi tab vẫn còn workspace sống, không restore/render đè chỉ vì `visibilitychange`.

## 16. Mobile / responsive

- Không chấp nhận horizontal overflow ở nav, bảng hoặc form chính.
- Các bảng/ma trận lớn cần có responsive layout/card mode thay vì chỉ thêm thanh cuộn ngang nếu có thể.
- Nút quan trọng không được bị đẩy ra khỏi viewport.
- Form login không được gây zoom/scroll bất thường trên mobile.
- Khi chỉnh desktop phải kiểm lại mobile.

## 17. UI interaction

- Ưu tiên mở subpage trong app cho workflow lớn.
- Drawer dùng cho chi tiết nhanh/admin phụ trợ, không lạm dụng cho màn hình làm việc dài.
- Modal chỉ dùng cho xác nhận hoặc thao tác ngắn.
- Không mở cửa sổ/tab mới cho workflow nội bộ nếu không thật sự cần.
- Các thao tác nguy hiểm cần confirm: xóa, nộp bài, phát hành/đóng, thay đổi cấu trúc quan trọng.

## 18. Quy trình sửa code

Khi ChatGPT được yêu cầu sửa code thực tế:

1. Đọc code hiện tại trên GitHub `main`.
2. Tạo backup branch trước thay đổi rủi ro.
3. Tạo branch riêng cho batch thay đổi.
4. Sửa theo batch nhỏ, dễ kiểm soát.
5. Static check các file JS liên quan (`node --check`, lint phù hợp nếu có).
6. So sánh diff với `main`.
7. Chỉ merge khi diff đúng phạm vi dự kiến.
8. Không force push.
9. Sau merge, theo dõi GitHub Pages build/deploy đến khi success/failure rõ ràng.
10. Nếu có SQL/Edge Function thay đổi, nói rõ người dùng phải làm gì trên Supabase.

## 19. Backup / versioning

- Trước đợt thay đổi lớn nên tạo branch dạng:

  `backup/<version>-before-<feature>`

- Feature branch nên có tên rõ mục đích.
- Không dùng version frontend để giả định backend schema version.
- Cache-busting version của JS/CSS và `assessment_schema_version` là hai khái niệm độc lập.

## 20. Không được nhầm giữa GitHub và Supabase

Đây là quy tắc cần đọc lại mỗi lần quay lại dự án:

- **Frontend source** → GitHub.
- **SQL/migration reference** → GitHub.
- **Edge Function source hiện hành** → GitHub `supabase/functions/`.
- **Frontend runtime** → GitHub Pages.
- **Database/Auth/Storage/RPC runtime** → Supabase.
- **Edge Function runtime** → Supabase.

Khi cần biết Function hiện tại đang dùng code gì, **vào GitHub xem `supabase/functions/<name>/index.ts` trước**. Không yêu cầu người dùng gửi lại Function nếu repo đã có bản hiện hành.

## 21. Cách dùng tài liệu này về sau

- Khi bắt đầu một phiên làm việc kỹ thuật mới, đọc file này trước khi đề xuất kiến trúc.
- Nếu có quy ước mới được người dùng chốt, cập nhật file này.
- Nếu quy ước cũ bị thay thế, sửa nội dung cũ thay vì chỉ append mâu thuẫn ở cuối.
- `PROJECT-PROGRESS-YYYY-MM-DD.md` dùng để ghi checkpoint tiến độ theo thời điểm.
- `TECHNICAL-AGREEMENTS.md` dùng để ghi **các quy ước kỹ thuật bền vững** của toàn dự án.

---

Cập nhật lần đầu: 05/09/2026.
