/* AMIRNET — Cloudflare Worker
 *
 * Serves the static app from the ASSETS binding and answers the three AI
 * endpoints. Everything is in this one file on purpose: a module-level failure
 * in a Worker returns 1101 for every request, so there are no cross-file
 * imports and nothing runs at load time.
 *
 * Providers, in order:
 *   1. Gemini     — used when the GEMINI_API_KEY secret is set. Much better Hebrew.
 *   2. Workers AI — the built-in AI binding. No key, but smaller models.
 * The key is read server-side only and never reaches the browser.
 */

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const CF_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function runGemini(apiKey, prompt, maxTokens, temperature) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
          model + ':generateContent?key=' + encodeURIComponent(apiKey),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: temperature },
          }),
        }
      );
      if (!res.ok) { lastError = new Error('Gemini HTTP ' + res.status); continue; }
      const data = await res.json();
      const parts = data && data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts;
      const text = parts ? parts.map(p => p.text || '').join('') : '';
      if (text.trim()) return { text: text.trim(), model: model, provider: 'gemini' };
      lastError = new Error('Gemini returned empty');
    } catch (err) { lastError = err; }
  }
  throw lastError || new Error('Gemini unavailable');
}

async function runWorkersAi(ai, messages, maxTokens) {
  let lastError = null;
  for (const model of CF_MODELS) {
    try {
      const out = await ai.run(model, { messages: messages, max_tokens: maxTokens });
      const text = (out && (out.response || out.result || out.text)) || '';
      if (String(text).trim()) {
        return { text: String(text).trim(), model: model, provider: 'workers-ai' };
      }
    } catch (err) { lastError = err; }
  }
  throw lastError || new Error('Workers AI unavailable');
}

async function generate(env, system, task, maxTokens, temperature) {
  if (env.GEMINI_API_KEY) {
    try {
      return await runGemini(env.GEMINI_API_KEY, 'הנחיות: ' + system + '\n\n' + task, maxTokens, temperature);
    } catch (err) {
      if (!env.AI) throw err;
    }
  }
  if (env.AI) {
    return runWorkersAi(env.AI, [
      { role: 'system', content: system },
      { role: 'user', content: task },
    ], maxTokens);
  }
  throw new Error('No AI provider configured');
}

async function readBody(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

function handleHealth(env) {
  const gemini = Boolean(env.GEMINI_API_KEY);
  const workersAi = Boolean(env.AI);
  return json({
    ok: true,
    configured: gemini || workersAi,
    provider: gemini ? 'gemini' : workersAi ? 'workers-ai' : 'none',
    providers: { gemini: gemini, workersAi: workersAi },
  });
}

async function handleTutor(request, env) {
  const body = await readBody(request);
  if (!body.question) return json({ error: 'חסרה שאלה לניתוח' });

  const options = body.options;
  const optionLines = Array.isArray(options)
    ? options.map((o, i) => String.fromCharCode(65 + i) + ') ' + o).join('\n')
    : Object.keys(options || {}).map(k => k + ') ' + options[k]).join('\n');

  const system =
    'אתה חונך מומחה לבחינת אמיר״ם/אמירנ״ט של מאל״ו. ענה בעברית בלבד, ' +
    'בתמציתיות ובדיוק. השתמש בכותרות קצרות ובתבליטים עם •.';

  const task =
    'סוג השאלה: ' + (body.type || 'תרגול') + '\n' +
    'השאלה: ' + body.question + '\n' +
    (body.passage ? 'קטע הקריאה:\n' + body.passage + '\n' : '') +
    'אפשרויות:\n' + optionLines + '\n' +
    'התשובה הנכונה: ' + (body.correctAnswer || '') + '\n' +
    'מה שהתלמיד ענה: ' + (body.userAnswer || '(לא נענה)') + '\n\n' +
    (body.customPrompt ||
      'הסבר מדוע התשובה הנכונה נכונה, ומה המלכודת בכל מסיח שגוי. הוסף פירוק תחבירי קצר.');

  try {
    const r = await generate(env, system, task, 800, 0.7);
    return json({ explanation: r.text, model: r.model, provider: r.provider });
  } catch (err) {
    return json({ error: 'ניתוח ה-AI אינו זמין כרגע' });
  }
}

async function handleMnemonic(request, env) {
  const body = await readBody(request);
  if (!body.word) return json({ error: 'חסרה מילה' });

  const system =
    'אתה פסיכולוג קוגניטיבי שמכין סטודנטים ישראלים לבחינת אמיר״ם. ' +
    'ענה בעברית בלבד, קצר וקולע, בתבליטים עם •.';

  const task =
    'המילה באנגלית: ' + body.word + '\n' +
    'תרגום: ' + (body.hebrewTranslation || '(לא ידוע)') + '\n' +
    (body.definition ? 'הגדרה: ' + body.definition + '\n' : '') +
    (body.example ? 'דוגמה: ' + body.example + '\n' : '') +
    '\nצור:\n' +
    '• אסוציאציית צליל בעברית (משחק מילים שנצמד לזיכרון)\n' +
    '• פירוק המילה לשורש/קידומת אם רלוונטי\n' +
    '• משפט דוגמה קצר ברמת אמיר״ם עם תרגום\n' +
    '• טיפ: איך המילה עשויה להופיע בהשלמת משפטים או בניסוח מחדש';

  try {
    const r = await generate(env, system, task, 600, 0.8);
    return json({ word: body.word, mnemonic: r.text, model: r.model, provider: r.provider });
  } catch (err) {
    return json({ error: 'יצירת האסוציאציה אינה זמינה כרגע' });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/ai-health') return handleHealth(env);
    if (path === '/api/ai-tutor' && request.method === 'POST') return handleTutor(request, env);
    if (path === '/api/ai-mnemonic' && request.method === 'POST') return handleMnemonic(request, env);
    if (path.startsWith('/api/')) return json({ error: 'not found' });

    // Everything else is the static app.
    return env.ASSETS.fetch(request);
  },
};
