import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized GoogleGenAI client
let _aiClient = null;
function getGenAI() {
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _aiClient;
}

// Resilient helper with retry and fallback across candidate models
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-pro-preview'];

async function executeGeminiWithFallback(ai, { prompt, preferredModel = 'gemini-3.1-flash-lite', config = undefined, maxRetries = 1 }) {
  const modelsToTry = [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)];
  let lastError = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          ...(config ? { config } : {}),
        });
        if (response && response.text) {
          return { text: response.text, modelUsed: model };
        }
      } catch (err) {
        lastError = err;
        const errStr = String(err?.message || err || '');
        // If 404 (model deprecated/not found), skip retrying this model immediately
        if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('no longer available')) {
          break;
        }
        // If 503 (high demand) or 429 (rate limit), pause briefly before retry
        const isTransient = errStr.includes('503') || errStr.includes('429') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
        if (isTransient && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error('All AI models temporarily unavailable');
}

// Fallback rule-based mnemonic generator for emergency offline situations
function createLocalMnemonic(word, hebrewTranslation, definition, example) {
  const w = (word || '').trim();
  const he = (hebrewTranslation || '').trim();
  return `🧠 **מנמוניקה ואסוציאציית זיכרון עבור "${w}"**:
• **תרגום לעברית:** ${he || 'מילת מפתח חשובה'}
• **אסוציאציית צליל ורמז:** שימו לב לצליל הפותח של "${w}". חברו אותו לדימוי חזותי קבוע או מילה מוכרת כדי לקבע את המשמעות בזיכרון לטווח ארוך.
${definition ? `• **הגדרה באנגלית:** ${definition}` : ''}
${example ? `• **משפט לדוגמה:** "${example}"` : `• **דוגמה אקדמית:** The professor asked us to carefully consider the concept of "${w}".`}
• **טיפ מאל"ו לאמירנ"ט:** בהשלמת משפטים וניסוח מחדש, בדקו אם מילה זו נושאת מטען חיובי/שלילי או מביעה סיבה/תוצאה ביחס לחלקי המשפט האחרים.`;
}

// Fallback rule-based tutor explanation
function createLocalTutorExplanation(question, correctAnswer, userAnswer) {
  return `💡 **הסבר ממוקד לשאלה:**
• **התשובה הנכונה:** "${correctAnswer || 'מסומנת בירוק'}"
• **ניתוח המשפט:** המשפט מציג קשר לוגי ישיר הדורש התאמה מדויקת של אוצר המילים ומשמעות ההקשר.
• **טיפ אסטרטגי לאמירנ"ט:** קראו תמיד את כל 4 האפשרויות לפני הבחירה. שימו לב למסיחים המשתמשים במילים בעלות צליל דומה אך משמעות שונה לחלוטין.`;
}

// Health probe — the static frontend calls this to decide whether to show AI buttons
app.get('/api/ai-health', (req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.GEMINI_API_KEY) });
});
// AI Mnemonic & Association Generator
app.post('/api/ai-mnemonic', async (req, res) => {
  try {
    const { word, hebrewTranslation, definition, example } = req.body || {};
    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const ai = getGenAI();
    const prompt = `אתה מומחה פדגוגי ופסיכולוג קוגניטיבי המכין סטודנטים ישראלים לבחינת אמירנ"ט/אמיר"ם (מבחן מיון באנגלית לאקדמיה).
עליך ליצור אסוציאציות זיכרון (Mnemonics) קליטות, חדות ומבריקות בעברית עבור המילה הבאה באנגלית:

מילה באנגלית: "${word}"
תרגום מוכר: "${hebrewTranslation || ''}"
הגדרה באנגלית: "${definition || ''}"
דוגמה קיימת: "${example || ''}"

הנחיות:
1. צור 2 אסוציאציות שונות וזכירות:
   - אסוציאציה 1 (צליל/חריזה/משחק מילים בעברית): קישור הצליל של המילה באנגלית למילה או ביטוי בעברית עם סיפורון משעשע.
   - אסוציאציה 2 (שורש לטיני/הקשר הגיוני/מבנה מילה): פירוק המילה לחלקים (קידומת/שורש/סיומת) או הקשר מעולם האקדמיה/יומיום.
2. משפט דוגמה קצר ברמת אמירנ"ט עם תרגום מיידי לעברית.
3. טיפ מאל"ו (איך המילה מופיעה בשאלות השלמת משפטים או ניסוח מחדש).

החזר תשובה מעוצבת, קריאה ויפה בעברית עם אימוג'ים מועילים בלבד (ללא בולשיט, תמציתי וממוקד לנבחנים).`;

    let mnemonicText = '';
    try {
      const result = await executeGeminiWithFallback(ai, {
        prompt,
        preferredModel: 'gemini-3.1-flash-lite',
      });
      mnemonicText = result.text;
    } catch (genError) {
      console.warn('[AI Mnemonic] Upstream Gemini error, generating smart fallback:', genError.message || genError);
      mnemonicText = createLocalMnemonic(word, hebrewTranslation, definition, example);
    }

    res.json({
      word,
      mnemonic: mnemonicText || createLocalMnemonic(word, hebrewTranslation, definition, example),
    });
  } catch (error) {
    console.error('Error generating mnemonic:', error);
    const { word, hebrewTranslation, definition, example } = req.body || {};
    res.json({
      word: word || '',
      mnemonic: createLocalMnemonic(word, hebrewTranslation, definition, example),
    });
  }
});

// AI Tutor / Question Inspector (supports High Thinking reasoning for difficult questions)
app.post('/api/ai-tutor', async (req, res) => {
  try {
    const { question, passage, options, correctAnswer, userAnswer, type, customPrompt, useHighThinking } = req.body || {};
    
    const ai = getGenAI();
    let prompt = `אתה חונך מומחה לבחינת אמירנ"ט (אמיר"ם) של המרכז הארצי לבחינות ולהערכה (מאל"ו).
התלמיד מבקש ניתוח ממוקד בעברית.

סוג השאלה: ${type || 'תרגול'}
טקסט השאלה/משפט: "${question || ''}"
${passage ? `קטע קריאה:\n${passage}\n` : ''}
אפשרויות תשובה:
${Array.isArray(options) ? options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n') : JSON.stringify(options || {})}
תשובה נכונה: "${correctAnswer || ''}"
תשובת התלמיד: "${userAnswer || ''}"

בקשת התלמיד / מצב ניתוח: "${customPrompt || type || 'הסבר כללי ומלכודות מסיחים'}"

הנחיות:
1. הסבר תמציתי וברור בעברית מדוע התשובה הנכונה נכונה.
2. אם התלמיד טעה או שאל על מסיחים: הסבר מה המלכודת של מאל"ו בכל מסיח שגוי (למשל היפוך משמעות, שינוי זמנים, מילים דומות מטעות).
3. פירוק תחבירי קצר של משפט המקור (מילות קישור קריטיות ותרגום חופשי).
הגש את ההסבר בצורה נעימה, מעודדת ומדויקת לבחינה.`;

    const preferredModel = useHighThinking ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite';
    const config = useHighThinking
      ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
      : undefined;

    let explanationText = '';
    try {
      const result = await executeGeminiWithFallback(ai, {
        prompt,
        preferredModel,
        config,
      });
      explanationText = result.text;
    } catch (genError) {
      console.warn('[AI Tutor] Upstream Gemini error, generating smart fallback:', genError.message || genError);
      explanationText = createLocalTutorExplanation(question, correctAnswer, userAnswer);
    }

    res.json({
      explanation: explanationText || createLocalTutorExplanation(question, correctAnswer, userAnswer),
    });
  } catch (error) {
    console.error('Error in AI Tutor:', error);
    const { question, correctAnswer, userAnswer } = req.body || {};
    res.json({
      explanation: createLocalTutorExplanation(question, correctAnswer, userAnswer),
    });
  }
});

// Serve static assets from project root
app.use(express.static(__dirname));

// SPA fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AMIRNET server running on http://0.0.0.0:${PORT}`);
});

