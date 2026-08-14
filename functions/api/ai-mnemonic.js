// Cloudflare Pages Function — POST /api/ai-mnemonic
// Builds Hebrew memory hooks for an English word.
// Self-contained by design — see the note in ai-tutor.js.

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
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
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

  const word = body.word;
  if (!word) return json({ error: 'חסרה מילה' });

  const system =
    'אתה פסיכולוג קוגניטיבי שמכין סטודנטים ישראלים לבחינת אמיר״ם. ' +
    'ענה בעברית בלבד, קצר וקולע, בתבליטים עם •.';

  const task =
    'המילה באנגלית: ' + word + '\n' +
    'תרגום: ' + (body.hebrewTranslation || '(לא ידוע)') + '\n' +
    (body.definition ? 'הגדרה: ' + body.definition + '\n' : '') +
    (body.example ? 'דוגמה: ' + body.example + '\n' : '') +
    '\nצור:\n' +
    '• אסוציאציית צליל בעברית (משחק מילים שנצמד לזיכרון)\n' +
    '• פירוק המילה לשורש/קידומת אם רלוונטי\n' +
    '• משפט דוגמה קצר ברמת אמיר״ם עם תרגום\n' +
    '• טיפ: איך המילה עשויה להופיע בהשלמת משפטים או בניסוח מחדש';

  const env = context.env || {};
  try {
    if (env.GEMINI_API_KEY) {
      try {
        const r = await runGemini(env.GEMINI_API_KEY, 'הנחיות: ' + system + '\n\n' + task, 600);
        return json({ word: word, mnemonic: r.text, model: r.model, provider: r.provider });
      } catch (err) {
        if (!env.AI) throw err;
      }
    }
    if (env.AI) {
      const r = await runWorkersAi(env.AI, [
        { role: 'system', content: system },
        { role: 'user', content: task },
      ], 600);
      return json({ word: word, mnemonic: r.text, model: r.model, provider: r.provider });
    }
    return json({ error: 'לא הוגדר ספק AI' });
  } catch (err) {
    return json({ error: 'יצירת האסוציאציה אינה זמינה כרגע' });
  }
}
