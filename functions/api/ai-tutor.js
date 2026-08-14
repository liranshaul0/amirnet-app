// Cloudflare Pages Function — POST /api/ai-tutor
// Explains an answered question in Hebrew: why the right answer is right and
// what trap each distractor was setting.
//
// Self-contained by design (no cross-file imports, no newer-runtime helpers):
// a module-level error in a Pages Function returns 1101 for every route on the
// site, so these files avoid anything that could fail at load time.

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

async function runGemini(apiKey, prompt, maxTokens) {
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
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
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

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (_) { body = {}; }

  const question = body.question;
  if (!question) return json({ error: 'חסרה שאלה לניתוח' });

  const options = body.options;
  const optionLines = Array.isArray(options)
    ? options.map((o, i) => String.fromCharCode(65 + i) + ') ' + o).join('\n')
    : Object.keys(options || {}).map(k => k + ') ' + options[k]).join('\n');

  const system =
    'אתה חונך מומחה לבחינת אמיר״ם/אמירנ״ט של מאל״ו. ענה בעברית בלבד, ' +
    'בתמציתיות ובדיוק. השתמש בכותרות קצרות ובתבליטים עם •.';

  const task =
    'סוג השאלה: ' + (body.type || 'תרגול') + '\n' +
    'השאלה: ' + question + '\n' +
    (body.passage ? 'קטע הקריאה:\n' + body.passage + '\n' : '') +
    'אפשרויות:\n' + optionLines + '\n' +
    'התשובה הנכונה: ' + (body.correctAnswer || '') + '\n' +
    'מה שהתלמיד ענה: ' + (body.userAnswer || '(לא נענה)') + '\n\n' +
    (body.customPrompt ||
      'הסבר מדוע התשובה הנכונה נכונה, ומה המלכודת בכל מסיח שגוי. הוסף פירוק תחבירי קצר.');

  const env = context.env || {};
  try {
    if (env.GEMINI_API_KEY) {
      try {
        const r = await runGemini(env.GEMINI_API_KEY, 'הנחיות: ' + system + '\n\n' + task, 800);
        return json({ explanation: r.text, model: r.model, provider: r.provider });
      } catch (err) {
        if (!env.AI) throw err;
      }
    }
    if (env.AI) {
      const r = await runWorkersAi(env.AI, [
        { role: 'system', content: system },
        { role: 'user', content: task },
      ], 800);
      return json({ explanation: r.text, model: r.model, provider: r.provider });
    }
    return json({ error: 'לא הוגדר ספק AI' });
  } catch (err) {
    return json({ error: 'ניתוח ה-AI אינו זמין כרגע' });
  }
}
