# הפעלת ה-AI בחינם (Cloudflare Worker)

Cloudflare מארח את האתר ואת ה-API על אותו דומיין, בחינם. את המודל עצמו אפשר
לקבל משני מקורות, והקוד תומך בשניהם:

| ספק | מפתח נדרש | איכות העברית |
|---|---|---|
| **Gemini** (מומלץ) | כן — חינמי מ-AI Studio | טובה מאוד |
| Workers AI | לא | בינונית — מודלים קטנים |

**למה Gemini עדיף כאן:** כל הפלט הוא בעברית — הסברים פסיכומטריים ומשחקי מילים.
המודלים החינמיים של Workers AI קטנים (7-8B) והעברית שלהם חלשה יחסית. Gemini Flash
חזק בהרבה, וגם הוא חינמי.

ה-Worker מנסה Gemini קודם אם קיים מפתח, ונופל ל-Workers AI אם לא — כך שהאפליקציה
עובדת בשני המצבים.

## איך זה בנוי

| קובץ | תפקיד |
|---|---|
| `worker.js` | מגיש את האתר ועונה על `/api/ai-health`, `/api/ai-tutor`, `/api/ai-mnemonic` |
| `wrangler.toml` | הגדרות הפריסה והחיבורים (assets + AI) |
| `.assetsignore` | מונע העלאת `node_modules` וקוד צד-שרת כקבצים סטטיים |
| `server.js` | חלופה להרצה מקומית עם Gemini (`npm run dev`) |

**חשוב:** החיבורים מוגדרים ב-`wrangler.toml`. פריסה עם wrangler **דורסת** הגדרות
שנעשו ידנית בלוח הבקרה, ולכן binding שתוסיף שם בלבד יימחק בפריסה הבאה.
סודות (`GEMINI_API_KEY`) הם היוצא מן הכלל — הם נשמרים בנפרד ולא נדרסים.

## הוספת מפתח Gemini

1. `aistudio.google.com` → **Get API key** → **Create API key**. תקבל מחרוזת
   שמתחילה ב-`AIza`. חינם, בלי כרטיס אשראי.
2. בלוח הבקרה של Cloudflare: **Workers & Pages** → `amirnet-app` →
   **Settings** → **Variables and Secrets** → **Add**:
   - Type: **Secret** ← לא Plaintext
   - Name: `GEMINI_API_KEY`
   - Value: המפתח
3. **Deployments** → **Retry build** (או דחיפה חדשה ל-GitHub).

אם תדלג על השלב הזה — האפליקציה עדיין תעבוד, דרך Workers AI.

## בדיקה

פתח `https://amirnet.pages.dev/api/ai-health`:

```json
{ "ok": true, "configured": true, "provider": "gemini",
  "providers": { "gemini": true, "workersAi": true } }
```

`provider` מראה מי בפועל יענה. כפתורי ה-AI באפליקציה מופיעים לבד כש-`configured`
הוא `true`.

## תקלות שכבר נתקלנו בהן

**`Error 1101 — Worker threw exception` בכל הנתיבים**
ה-Worker קורס בטעינה, ואז גם האתר הסטטי לא עולה. לכן כל הקוד יושב ב-`worker.js`
אחד בלי ייבוא בין קבצים ובלי שום פעולה ברמת המודול.

**`Asset too large — workerd 144 MiB`**
הפריסה ניסתה להעלות את `node_modules` כקבצים סטטיים. `.assetsignore` פותר את זה;
בפועל מועלים ארבעה קבצים בלבד: `index.html`, `app.css`, `sw.js`, `manifest.webmanifest`.

**`We identified a functions directory... Using fallback value: no`**
תיקיית `functions/` גרמה ל-wrangler לשאול אם זו פריסת Pages, ובריצה אוטומטית הוא
ענה "לא" והתעלם ממנה. התיקייה הוסרה — ה-Worker מטפל בנתיבים בעצמו.

## החלפת מודל

`worker.js` מחזיק שתי רשימות — `GEMINI_MODELS` ו-`CF_MODELS` — שנוסות לפי הסדר,
כך שאם מזהה מודל אינו זמין בחשבון שלך, הבא בתור ייכנס אוטומטית.

## אזהרה

אל תקרא ל-API של ספק AI ישירות מהדפדפן עם מפתח בקוד. כל מי שפותח את קוד המקור
רואה אותו. לכן הקריאות עוברות דרך ה-Worker בצד השרת.
