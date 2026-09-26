import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("بررسی دسترسی مدیر ناموفق بود");
  if (!data) throw new Error("دسترسی مدیر ندارید");
}

export const getDidKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const key = process.env["DID_API_KEY"];
    return { configured: Boolean(key && key.length > 0) };
  });

export const testDidConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const key = process.env["DID_API_KEY"];
    if (!key) {
      return { ok: false, message: "کلید API ذخیره نشده است." };
    }
    const auth = key.startsWith("Basic ") || key.startsWith("Bearer ") ? key : `Basic ${key}`;
    try {
      const res = await fetch("https://api.d-id.com/credits", {
        headers: { Authorization: auth, Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, message: `اتصال ناموفق (${res.status}): ${text.slice(0, 200)}` };
      }
      let remaining: number | null = null;
      try {
        const body = JSON.parse(text);
        remaining = body?.remaining ?? body?.total ?? null;
      } catch {
        remaining = null;
      }
      return {
        ok: true,
        message:
          remaining === null
            ? "اتصال به D-ID برقرار است."
            : `اتصال برقرار است. اعتبار باقی‌مانده: ${remaining}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: `خطا در تماس با D-ID: ${(error as Error).message}`,
      };
    }
  });
