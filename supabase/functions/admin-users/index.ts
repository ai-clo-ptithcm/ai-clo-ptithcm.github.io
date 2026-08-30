import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type Role = "admin" | "teacher" | "student";
type Action = "create" | "update" | "reset_password" | "ban" | "unban" | "delete";

interface AccountInput {
  full_name?: string;
  email?: string;
  role?: Role;
  mssv?: string | null;
}

interface RequestPayload {
  action?: Action;
  users?: AccountInput[];
  user_id?: string;
  full_name?: string;
  email?: string;
  role?: Role;
  mssv?: string | null;
}

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function temporaryPassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) chars.push(all[bytes[i] % all.length]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Lỗi không xác định");
  if (/duplicate|already registered|already exists|unique/i.test(message)) {
    return "Email hoặc MSSV đã tồn tại.";
  }
  return message;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      if (req.method !== "POST") {
        return reply({ success: false, error: "Chỉ hỗ trợ phương thức POST." }, 405);
      }

      const callerId = ctx.userClaims?.sub || ctx.userClaims?.id;
      if (!callerId) return reply({ success: false, error: "Phiên đăng nhập không hợp lệ." }, 401);

      const { data: caller, error: callerError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", callerId)
        .single();

      if (callerError || !caller || caller.role !== "admin" || caller.is_active === false) {
        return reply({ success: false, error: "Chỉ Admin đang hoạt động mới được quản lý tài khoản." }, 403);
      }

      const body: RequestPayload = await req.json();
      // Tương thích giao diện cũ: nếu chỉ gửi users thì hiểu là tạo tài khoản.
      const action: Action = body.action || "create";

      if (action === "create") {
        const users = Array.isArray(body.users) ? body.users.slice(0, 100) : [];
        if (!users.length) return reply({ success: false, error: "Danh sách tài khoản đang trống." });

        const results: Record<string, unknown>[] = [];
        const emailsInRequest = new Set<string>();
        const mssvInRequest = new Set<string>();

        for (const raw of users) {
          const full_name = clean(raw.full_name);
          const email = normalizeEmail(raw.email);
          const role = clean(raw.role) as Role;
          const mssv = role === "student" ? clean(raw.mssv) : "";
          const base = { full_name, email, role, mssv: mssv || null };

          try {
            if (!full_name) throw new Error("Thiếu họ và tên.");
            if (!validEmail(email)) throw new Error("Email không hợp lệ.");
            if (role !== "teacher" && role !== "student") throw new Error("Vai trò chỉ được là teacher hoặc student.");
            if (role === "student" && !mssv) throw new Error("Sinh viên phải có MSSV.");
            if (emailsInRequest.has(email)) throw new Error("Email bị trùng trong file nhập.");
            if (mssv && mssvInRequest.has(mssv)) throw new Error("MSSV bị trùng trong file nhập.");

            emailsInRequest.add(email);
            if (mssv) mssvInRequest.add(mssv);

            const { data: sameEmail } = await ctx.supabaseAdmin
              .from("profiles").select("id").eq("email", email).maybeSingle();
            if (sameEmail) throw new Error("Email đã tồn tại; hệ thống đã bỏ qua, không ghi đè.");

            if (mssv) {
              const { data: sameMssv } = await ctx.supabaseAdmin
                .from("profiles").select("id").eq("mssv", mssv).maybeSingle();
              if (sameMssv) throw new Error("MSSV đã tồn tại; hệ thống đã bỏ qua, không ghi đè.");
            }

            const password = temporaryPassword();
            const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name, role, mssv: mssv || null },
            });
            if (createError || !created.user) throw createError || new Error("Không tạo được tài khoản Auth.");

            const { error: profileError } = await ctx.supabaseAdmin.from("profiles").upsert({
              id: created.user.id,
              full_name,
              email,
              role,
              mssv: mssv || null,
              is_active: true,
              locked_at: null,
              locked_by: null,
              updated_at: new Date().toISOString(),
            });

            if (profileError) {
              await ctx.supabaseAdmin.auth.admin.deleteUser(created.user.id);
              throw profileError;
            }

            results.push({ ...base, id: created.user.id, temporary_password: password, success: true });
          } catch (error) {
            results.push({ ...base, temporary_password: "", success: false, error: publicError(error) });
          }
        }

        return reply({ success: true, results });
      }

      const targetId = clean(body.user_id);
      if (!targetId) return reply({ success: false, error: "Thiếu user_id." });

      const { data: target, error: targetError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, role, mssv, is_active")
        .eq("id", targetId)
        .single();
      if (targetError || !target) return reply({ success: false, error: "Không tìm thấy tài khoản." }, 404);

      if (action === "update") {
        const full_name = clean(body.full_name);
        const email = normalizeEmail(body.email);
        const requestedRole = clean(body.role) as Role;
        const role: Role = target.role === "admin" ? "admin" : requestedRole;
        const mssv = role === "student" ? clean(body.mssv) : "";

        if (!full_name) return reply({ success: false, error: "Thiếu họ và tên." });
        if (!validEmail(email)) return reply({ success: false, error: "Email không hợp lệ." });
        if (role !== "admin" && role !== "teacher" && role !== "student") {
          return reply({ success: false, error: "Vai trò không hợp lệ." });
        }
        if (target.role !== "admin" && role === "admin") {
          return reply({ success: false, error: "Không hỗ trợ nâng tài khoản thành Admin tại đây." }, 403);
        }
        if (role === "student" && !mssv) return reply({ success: false, error: "Sinh viên phải có MSSV." });

        const { data: sameEmail } = await ctx.supabaseAdmin.from("profiles")
          .select("id").eq("email", email).neq("id", targetId).maybeSingle();
        if (sameEmail) return reply({ success: false, error: "Email đã được tài khoản khác sử dụng." });

        if (mssv) {
          const { data: sameMssv } = await ctx.supabaseAdmin.from("profiles")
            .select("id").eq("mssv", mssv).neq("id", targetId).maybeSingle();
          if (sameMssv) return reply({ success: false, error: "MSSV đã được sinh viên khác sử dụng." });
        }

        const { data: authRecord, error: getAuthError } = await ctx.supabaseAdmin.auth.admin.getUserById(targetId);
        if (getAuthError || !authRecord.user) return reply({ success: false, error: publicError(getAuthError) }, 400);

        const oldMetadata = authRecord.user.user_metadata || {};
        const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, {
          email,
          user_metadata: { ...oldMetadata, full_name, role, mssv: mssv || null },
        });
        if (authError) return reply({ success: false, error: publicError(authError) });

        const { error: profileError } = await ctx.supabaseAdmin.from("profiles").update({
          full_name,
          email,
          role,
          mssv: mssv || null,
          updated_at: new Date().toISOString(),
        }).eq("id", targetId);

        if (profileError) {
          await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, {
            email: target.email,
            user_metadata: oldMetadata,
          });
          return reply({ success: false, error: publicError(profileError) });
        }

        if (target.role !== role && role !== "admin") {
          const { error: memberError } = await ctx.supabaseAdmin.from("subject_members")
            .update({ role }).eq("user_id", targetId);
          if (memberError) return reply({
            success: false,
            error: "Đã sửa tài khoản nhưng chưa đồng bộ được vai trò trong học phần: " + publicError(memberError),
          });
        }

        return reply({ success: true, user: { id: targetId, full_name, email, role, mssv: mssv || null } });
      }

      if (action === "reset_password") {
        const password = temporaryPassword();
        const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, { password });
        if (error) return reply({ success: false, error: publicError(error) });
        return reply({ success: true, temporary_password: password });
      }

      if (action === "ban") {
        if (targetId === callerId) return reply({ success: false, error: "Admin không thể tự khóa tài khoản đang đăng nhập." }, 403);
        if (target.role === "admin") return reply({ success: false, error: "Không được khóa tài khoản Admin khác." }, 403);

        const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, {
          ban_duration: "876000h",
        });
        if (authError) return reply({ success: false, error: publicError(authError) });

        const { error: profileError } = await ctx.supabaseAdmin.from("profiles").update({
          is_active: false,
          locked_at: new Date().toISOString(),
          locked_by: callerId,
          updated_at: new Date().toISOString(),
        }).eq("id", targetId);
        if (profileError) {
          await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
          return reply({ success: false, error: publicError(profileError) });
        }
        return reply({ success: true });
      }

      if (action === "unban") {
        const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(targetId, {
          ban_duration: "none",
        });
        if (authError) return reply({ success: false, error: publicError(authError) });

        const { error: profileError } = await ctx.supabaseAdmin.from("profiles").update({
          is_active: true,
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        }).eq("id", targetId);
        if (profileError) return reply({ success: false, error: publicError(profileError) });
        return reply({ success: true });
      }

      if (action === "delete") {
        if (targetId === callerId) return reply({ success: false, error: "Admin không thể tự xóa tài khoản đang đăng nhập." }, 403);
        if (target.role === "admin") return reply({ success: false, error: "Không được xóa tài khoản Admin khác." }, 403);
        const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(targetId);
        if (error) return reply({ success: false, error: publicError(error) });
        return reply({ success: true });
      }

      return reply({ success: false, error: "Hành động không được hỗ trợ." }, 400);
    } catch (error) {
      return reply({ success: false, error: publicError(error) }, 500);
    }
  }),
};
