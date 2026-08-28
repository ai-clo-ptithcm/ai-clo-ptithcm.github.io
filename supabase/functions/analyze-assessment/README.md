# analyze-assessment

Edge Function chỉ được gọi khi sinh viên/giảng viên chủ động nhấn nút AI. Function tổng hợp số liệu đã chấm sẵn, gửi **thống kê** cho Gemini và cache kết quả theo dấu vân tay dữ liệu để tránh gọi lại khi dữ liệu chưa thay đổi.

## Deploy

```bash
supabase functions deploy analyze-assessment
supabase secrets set GEMINI_API_KEY=YOUR_KEY
supabase secrets set GEMINI_MODEL=gemini-3.6-flash
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` được Supabase Edge Functions cung cấp trong môi trường project.
