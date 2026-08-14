# הפעלת ה-AI בחינם (Cloudflare Pages)

Cloudflare מארח את האתר ואת ה-API על אותו דומיין, בחינם. את המודל עצמו אפשר
לקבל משני מקורות, והקוד תומך בשניהם:

| ספק | מפתח נדרש | איכות העברית |
|---|---|---|
| **Gemini** (מומלץ) | כן — חינמי מ-AI Studio | טובה מאוד |
| Workers AI | לא | בינונית — מודלים קטנים |

**למה Gemini עדיף כאן:** כל הפלט של הפיצ'רים הוא בעברית — הסברים פסיכומטריים
ומשחקי מילים לאסוציאציות. המודלים החינמיים של Workers AI קטנים (7-8B) והעברית
שלהם חלשה יחסית. Gemini Flash חזק בהרבה בעברית, וגם הוא חינמי.

הפונקציות מנסות Gemini קודם אם קיים מפתח, ונופלות ל-Workers AI אם לא — כך
שהאפליקציה עובדת בשני המצבים.

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

בחר לפחות אחד מהשניים. אפשר גם את שניהם — Gemini ישמש כברירת מחדל
ו-Workers AI כגיבוי.

**א. Gemini (מומלץ — עברית טובה יותר)**

1. היכנס ל-`aistudio.google.com` → **Get API key** → צור מפתח (חינם).
2. בפרויקט ב-Cloudflare: **Settings** → **Variables and Secrets** → **Add**:
   - Type: **Secret** (לא Plaintext — כך המפתח לא נחשף)
   - Name: `GEMINI_API_KEY`
   - Value: המפתח שיצרת

**ב. Workers AI (בלי מפתח בכלל)**

**Settings** → **Bindings** → **Add binding**:
- Type: **Workers AI**
- Variable name: `AI`  ← חייב להיות בדיוק כך, באותיות גדולות

בסיום: **Deployments** → **Retry deployment** כדי שההגדרות ייכנסו לתוקף.

### 4. בדיקה

פתח `https://<השם-שלך>.pages.dev/api/ai-health`. אמור לחזור משהו כזה:

```json
{ "ok": true, "configured": true, "provider": "gemini",
  "providers": { "gemini": true, "workersAi": false } }
```

`provider` מראה מי בפועל יענה. אם `configured` הוא `false` — ההגדרות מסעיף 3
לא נשמרו או שלא הרצת פריסה מחדש.

עכשיו פתח את האתר עצמו: כפתורי ה-AI יופיעו מעצמם (האפליקציה בודקת את
`/api/ai-health` בעלייה ומסתירה אותם רק כשאין שרת).

## מה רץ איפה

| קובץ | סביבה | מודל |
|---|---|---|
| `functions/api/*.js` | Cloudflare Pages | Gemini אם יש מפתח, אחרת Workers AI |
| `server.js` | הרצה מקומית (`npm run dev`) | Gemini — דורש `GEMINI_API_KEY` |

שתי הסביבות חושפות את אותם נתיבים (`/api/ai-tutor`, `/api/ai-mnemonic`,
`/api/ai-health`), כך שהאפליקציה לא יודעת ולא אכפת לה מי עונה.

## החלפת המודל

`functions/_shared.js` מחזיק שתי רשימות — `GEMINI_MODELS` ו-`CF_MODELS` — שנוסות
לפי הסדר, כך שאם מזהה מודל אינו זמין בחשבון שלך, הבא בתור ייכנס אוטומטית.
אפשר לערוך את הרשימות שם.

## אזהרה אחת

אל תקרא ל-API של ספק AI ישירות מהדפדפן עם מפתח בקוד. כל מי שפותח את קוד המקור
רואה אותו ויכול לשרוף את המכסה שלך. לכן הקריאות עוברות דרך הפונקציות בצד השרת.
