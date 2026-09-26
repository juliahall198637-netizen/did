import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { DidAgent } from "@/components/DidAgent";
import { PersianSpeechNotes } from "@/components/PersianSpeechNotes";
import { DID_SETTINGS_QUERY_KEY, fetchDidSettings } from "@/lib/did-settings";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "دستیار آواتار فارسی" },
      {
        name: "description",
        content: "با یک انسان دیجیتال فارسی‌زبان به صورت صوتی و طبیعی گفتگو کنید.",
      },
      { property: "og:title", content: "دستیار آواتار فارسی" },
      {
        property: "og:description",
        content: "با یک انسان دیجیتال فارسی‌زبان به صورت صوتی و طبیعی گفتگو کنید.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const { data, isLoading } = useQuery({
    queryKey: DID_SETTINGS_QUERY_KEY,
    queryFn: fetchDidSettings,
  });

  const configured = Boolean(data?.client_key && data?.agent_id);

  return (
    <main dir="rtl" className="relative h-screen w-screen overflow-hidden bg-background">
      <div className="absolute inset-0 flex h-full w-full items-center justify-center [&>div]:h-full [&>div]:w-full">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">در حال آماده‌سازی…</p>
        ) : configured && data ? (
          <DidAgent settings={data} />
        ) : (
          <div className="mx-auto max-w-sm px-6 text-center">
            <h1 className="text-xl font-semibold text-foreground">آواتار هنوز تنظیم نشده است</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              برای نمایش آواتار، وارد پنل مدیریت شوید و «Client Key» و «Agent ID» ایجنت D-ID خود را
              ذخیره کنید. اگر هنوز حساب مدیر نساخته‌اید، اولین حسابی که ثبت‌نام کند مدیر می‌شود.
            </p>
            <Link
              to="/admin/login"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              ورود به پنل مدیریت
            </Link>
          </div>
        )}

      </div>

      {configured && <PersianSpeechNotes />}

      <Link
        to="/admin/login"
        aria-label="تنظیمات"
        className="absolute left-4 top-4 z-20 rounded-full p-2 text-muted-foreground/30 transition-colors hover:text-muted-foreground"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </main>
  );
}
