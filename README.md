# Persian AI Companion

یک اپلیکیشن آواتار هوشمند فارسی بساز که تجربه مکالمه طبیعی با یک انسان دیجیتال را ایجاد کند.

هدف اصلی:
ساخت یک اپلیکیشن که کاربر فقط با آواتار D-ID صحبت کند؛ سیستم صدای فارسی کاربر را دقیق بشنود، آن را به متن تبدیل کند، پاسخ هوش مصنوعی تولید شود و آواتار D-ID به صورت خودکار پاسخ دهد.

رابط کاربری اصلی (User Interface)

صفحه اصلی باید کاملاً مینیمال و تمام‌صفحه باشد.

تنها عنصر قابل مشاهده، آواتار D-ID باشد.

هیچ چت‌باکس، متن اضافی، فرم، منو یا دکمه ارسال نمایش داده نشود.

ظاهر برنامه باید شبیه یک انسان دیجیتال واقعی باشد.

آواتار در مرکز صفحه نمایش داده شود.

روند مکالمه

روند کار بدون دخالت کاربر:

کاربر با آواتار صحبت می‌کند.

سیستم صدای کاربر را از میکروفون دریافت می‌کند.

گفتار فارسی کاربر به متن تبدیل می‌شود.

متن بدون نیاز به دکمه ارسال پردازش می‌شود.

هوش مصنوعی پاسخ مناسب تولید می‌کند.

پاسخ به D-ID ارسال می‌شود.

آواتار D-ID پاسخ را با صدا و حرکت لب طبیعی اجرا می‌کند.

بعد از پایان پاسخ، سیستم دوباره آماده شنیدن صحبت کاربر می‌شود.

تشخیص صدای فارسی (Speech Recognition)

تمرکز اصلی سیستم روی شنیدن دقیق زبان فارسی باشد.

نیازمندی‌ها:

پشتیبانی کامل از زبان فارسی (fa-IR).

تشخیص دقیق گفتار طبیعی فارسی.

تبدیل صدای کاربر به متن با دقت بالا.

تشخیص خودکار شروع و پایان صحبت.

مدیریت مکث‌های طبیعی هنگام صحبت.

جلوگیری از قطع شدن جمله‌های طولانی.

کاهش نویز محیط.

بهبود کیفیت صدای ورودی.

اصلاح خطاهای رایج تبدیل گفتار فارسی به متن.

پشتیبانی از مکالمه چندمرحله‌ای.

اتصال D-ID

از D-ID برای آواتار و صحبت کردن استفاده شود.

سیستم باید امکان تنظیم اطلاعات D-ID را داشته باشد:

D-ID API

D-ID API Key

امکان ذخیره API Key

امکان تست اتصال API

نمایش وضعیت اتصال

D-ID Embed Agent

امکان وارد کردن و مدیریت اطلاعات Embed Agent:

Client Key

Agent ID

Embed Script URL

مقادیر Embed:

Mode

Name

Monitor

Light Mode

Orientation

Position

Open Mode

قابلیت‌ها:

ذخیره تنظیمات D-ID

تغییر Agent بدون تغییر کد

تست بارگذاری Agent

مدیریت اتصال D-ID

پنل ادمین

پنل ادمین در رابط اصلی دیده نشود.

دسترسی فقط از طریق یک آیکون چرخ‌دنده (⚙️) کوچک در گوشه صفحه باشد.

قوانین:

کاربر عادی هیچ منوی مدیریتی نبیند.

با کلیک روی چرخ‌دنده، صفحه ورود مدیر باز شود.

بعد از ورود موفق، پنل تنظیمات نمایش داده شود.

امنیت پنل ادمین

API Key و اطلاعات حساس فقط برای مدیر قابل مشاهده باشد.

کاربران عادی هیچ دسترسی به تنظیمات نداشته باشند.

اطلاعات حساس به صورت امن ذخیره شوند.

امکان تغییر تنظیمات بدون تغییر کد وجود داشته باشد.

تجربه نهایی کاربر

کاربر باید احساس کند با یک انسان دیجیتال واقعی صحبت می‌کند:

فقط آواتار را می‌بیند.

صحبت می‌کند.

سیستم خودش گوش می‌دهد.

خودش متوجه صحبت می‌شود.

خودش پاسخ می‌دهد.

هیچ دکمه ارسال یا تعامل اضافی وجود ندارد.

معماری کلی سیستم

Microphone
↓
Persian Speech Recognition
↓
AI Processing
↓
D-ID Agent / Avatar Response

هدف نهایی:
ساخت یک دستیار دیجیتال فارسی حرفه‌ای با آواتار D-ID که مکالمه صوتی طبیعی، خودکار و بدون نیاز به کلیک کاربر داشته باشد.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://persian-voice-companion.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5b68bbc4-0656-48ad-9405-d3eab8de6e17).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## استقرار روی لیارا (Liara)

پروژه با `Dockerfile` و `liara.json` برای پلتفرم Docker لیارا آماده است. در این حالت nitro به‌جای Cloudflare یک سرور Node.js می‌سازد و برنامه روی پورت `3000` اجرا می‌شود.

1. در کنسول لیارا یک برنامه از نوع **Docker** بسازید.
2. متغیرهای محیطی برنامه را تنظیم کنید:
   - `SUPABASE_URL` و `SUPABASE_PUBLISHABLE_KEY` (همان مقادیر فایل `.env`)
   - `SUPABASE_SERVICE_ROLE_KEY` (برای ذخیره تنظیمات از پنل مدیریت)
   - `OPENAI_API_KEY` (اختیاری؛ اگر کلید در پنل ذخیره نشده باشد استفاده می‌شود)
   - `DID_API_KEY` (اختیاری؛ برای «تست اتصال API» در پنل)
3. استقرار با Liara CLI:

   ```sh
   npm i -g @liara/cli
   liara login
   liara deploy --app <نام-برنامه>
   ```

   یا در کنسول لیارا گزینه **استقرار جدید** را بزنید و فایل zip پروژه (بدون `node_modules`) را آپلود کنید.
4. در پنل D-ID، بخش Allowed Domains، دامنه برنامه در لیارا را اضافه کنید.

آزمایش محلی همان image:

```sh
docker build -t did-app .
docker run -p 3000:3000 -e SUPABASE_URL=... -e SUPABASE_PUBLISHABLE_KEY=... -e SUPABASE_SERVICE_ROLE_KEY=... did-app
```
