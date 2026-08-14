# הפעלת ה-AI בחינם (Cloudflare Pages + Workers AI)

המסלול הזה לא דורש מפתח API, לא דורש כרטיס אשראי ולא דורש שרת משלך.
המודל רץ אצל Cloudflare, והאתר וה-API יושבים על אותו דומיין — כך שהקוד באפליקציה
עובד בדיוק כמו שהוא.

## למה לא GitHub Pages

GitHub Pages מגיש קבצים סטטיים בלבד ולא מריץ שום קוד צד-שרת. לכן כפתורי ה-AI
מוסתרים שם אוטומטית. Cloudflare Pages מגיש את אותם קבצים **וגם** מריץ את
הפונקציות שבתיקיית `functions/`.

## שלבים

### 1. חשבון

היכנס ל-`dash.cloudflare.com` והירשם (חינם).

### 2. חיבור הריפו

בתפריט: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** →
בחר את `amirnet-app`.

בהגדרות הבנייה:

| שדה | ערך |
|---|---|
| Framework preset | None |
| Build command | *(השאר ריק)* |
| Build output directory | `/` |

לחץ **Save and Deploy**. אחרי דקה תקבל כתובת כמו `amirnet-app.pages.dev`.

### 3. חיבור המודל (הצעד היחיד שקל לפספס)

בפרויקט שנוצר: **Settings** → **Bindings** → **Add binding**:

- Type: **Workers AI**
- Variable name: `AI`  ← חייב להיות בדיוק כך, באותיות גדולות

שמור, ואז **Deployments** → **Retry deployment** כדי שהחיבור ייכנס לתוקף.

### 4. בדיקה

פתח `https://<השם-שלך>.pages.dev/api/ai-health`. אמור לחזור:

```json
{ "ok": true, "configured": true, "provider": "cloudflare-workers-ai" }
```

אם `configured` הוא `false` — החיבור מסעיף 3 לא נשמר או שלא הרצת פריסה מחדש.

עכשיו פתח את האתר עצמו: כפתורי ה-AI יופיעו מעצמם (האפליקציה בודקת את
`/api/ai-health` בעלייה ומסתירה אותם רק כשאין שרת).

## מה רץ איפה

| קובץ | סביבה | מודל |
|---|---|---|
| `functions/api/*.js` | Cloudflare Pages | Workers AI — בלי מפתח |
| `server.js` | הרצה מקומית (`npm run dev`) | Gemini — דורש `GEMINI_API_KEY` |

שתי הסביבות חושפות את אותם נתיבים (`/api/ai-tutor`, `/api/ai-mnemonic`,
`/api/ai-health`), כך שהאפליקציה לא יודעת ולא אכפת לה מי עונה.

## החלפת המודל

`functions/_shared.js` מחזיק רשימת מודלים שנוסים לפי הסדר, כדי שאם אחד לא זמין
בחשבון שלך — הבא בתור ייכנס. אפשר לערוך את הרשימה שם.

## אזהרה אחת

אל תקרא ל-API של ספק AI ישירות מהדפדפן עם מפתח בקוד. כל מי שפותח את קוד המקור
רואה אותו ויכול לשרוף את המכסה שלך. לכן הקריאות עוברות דרך הפונקציות בצד השרת.
