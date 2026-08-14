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

// Hard-coding model ids is brittle: names differ between generations and accounts,
// and a retired id just returns 404. These are only a first guess — if they all fail
// the code asks the API which models this key can actually use (see discoverGeminiModels).
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

// Variants that answer to generateContent but are not general text models.
const NON_TEXT_MODEL = /(tts|video|audio|image|vision|embedding|imagen|veo)/i;
const CF_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/qwen/qwen1.5-14b-chat-awq',
  '@cf/google/gemma-7b-it',
];

// Cached per isolate so the model list is fetched at most once per worker instance.
let _discovered = null;

async function discoverGeminiModels(apiKey) {
  if (_discovered) return _discovered;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey)
    );
    if (!res.ok) return [];
    const data = await res.json();
    const names = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') > -1)
      .map(m => String(m.name || '').replace(/^models\//, ''))
      .filter(n => n && n.indexOf('gemini') === 0 && !NON_TEXT_MODEL.test(n));
    // Prefer the cheap fast tiers before the heavier ones.
    names.sort((a, b) => {
      const rank = n => (n.indexOf('flash') > -1 ? 0 : n.indexOf('pro') > -1 ? 1 : 2);
      return rank(a) - rank(b);
    });
    _discovered = names.slice(0, 4);
    return _discovered;
  } catch (_) {
    return [];
  }
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function callGeminiModel(apiKey, model, prompt, maxTokens, temperature) {
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
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const cand = data && data.candidates && data.candidates[0];
  const parts = cand && cand.content && cand.content.parts;
  const text = parts ? parts.map(p => p.text || '').join('') : '';
  if (!text.trim()) {
    throw new Error('empty' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
  }
  return text.trim();
}

async function runGemini(apiKey, prompt, maxTokens, temperature) {
  let lastError = null;
  const attempted = {};
  for (const model of GEMINI_MODELS) {
    attempted[model] = true;
    try {
      const text = await callGeminiModel(apiKey, model, prompt, maxTokens, temperature);
      return { text: text, model: model, provider: 'gemini' };
    } catch (err) {
      lastError = new Error(model + ': ' + ((err && err.message) || err));
    }
  }
  // None of the guesses worked — ask which models this key actually has.
  for (const model of await discoverGeminiModels(apiKey)) {
    if (attempted[model]) continue;
    try {
      const text = await callGeminiModel(apiKey, model, prompt, maxTokens, temperature);
      return { text: text, model: model, provider: 'gemini' };
    } catch (err) {
      lastError = new Error(model + ': ' + ((err && err.message) || err));
    }
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
  // Collect why each provider declined so a failure is diagnosable from the
  // response instead of vanishing. These strings are status text only, never the key.
  const tried = [];
  if (env.GEMINI_API_KEY) {
    try {
      return await runGemini(env.GEMINI_API_KEY, 'הנחיות: ' + system + '\n\n' + task, maxTokens, temperature);
    } catch (err) {
      tried.push('gemini: ' + ((err && err.message) || String(err)));
    }
  }
  if (env.AI) {
    try {
      return await runWorkersAi(env.AI, [
        { role: 'system', content: system },
        { role: 'user', content: task },
      ], maxTokens);
    } catch (err) {
      tried.push('workers-ai: ' + ((err && err.message) || String(err)));
    }
  }
  if (!tried.length) tried.push('no provider configured');
  const e = new Error(tried.join(' | '));
  e.detail = tried;
  throw e;
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
    // Generous ceiling: on current Gemini models the thinking tokens count against
    // maxOutputTokens, so a tight budget returns a truncated answer — or none at all.
    const r = await generate(env, system, task, 4096, 0.7);
    return json({ explanation: r.text, model: r.model, provider: r.provider });
  } catch (err) {
    return json({ error: 'ניתוח ה-AI אינו זמין כרגע', detail: (err && err.detail) || String((err && err.message) || err) });
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
    const r = await generate(env, system, task, 3072, 0.8);
    return json({ word: body.word, mnemonic: r.text, model: r.model, provider: r.provider });
  } catch (err) {
    return json({ error: 'יצירת האסוציאציה אינה זמינה כרגע', detail: (err && err.detail) || String((err && err.message) || err) });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/ai-health') return handleHealth(env);
    if (path === '/api/ai-models') {
      // Diagnostic: which models this key can actually reach. No secret is returned.
      if (!env.GEMINI_API_KEY) return json({ error: 'no GEMINI_API_KEY' });
      _discovered = null;
      return json({ tried: GEMINI_MODELS, available: await discoverGeminiModels(env.GEMINI_API_KEY) });
    }
    if (path === '/api/ai-tutor' && request.method === 'POST') return handleTutor(request, env);
    if (path === '/api/ai-mnemonic' && request.method === 'POST') return handleMnemonic(request, env);
    if (path.startsWith('/api/')) return json({ error: 'not found' });

    // Everything else is the static app.
    return env.ASSETS.fetch(request);
  },
};
