// Shared helpers for the Pages Functions that back the AI features.
//
// Two providers, tried in this order:
//   1. Gemini  — used when the GEMINI_API_KEY secret is set. Much stronger Hebrew,
//                which is what these features actually produce. Free tier is fine.
//   2. Workers AI — the built-in Cloudflare binding. No key at all, but the free
//                models are small and their Hebrew is noticeably weaker.
// Either way the key never reaches the browser.

export const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

export const CF_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

// Collapse a chat-style message list into the single prompt Gemini's REST API wants.
function toGeminiPrompt(messages) {
  return messages
    .map(m => (m.role === 'system' ? `הנחיות: ${m.content}` : m.content))
    .join('\n\n');
}

async function runGemini(apiKey, messages, maxTokens) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: toGeminiPrompt(messages) }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
          }),
        }
      );
      if (!res.ok) {
        // 404 means this model id is not available — move on to the next one.
        lastError = new Error(`Gemini HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      if (text.trim()) return { text: text.trim(), model, provider: 'gemini' };
      lastError = new Error('Gemini returned an empty response');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Gemini unavailable');
}

async function runWorkersAi(ai, messages, maxTokens) {
  let lastError = null;
  for (const model of CF_MODELS) {
    try {
      const out = await ai.run(model, { messages, max_tokens: maxTokens });
      const text = (out && (out.response || out.result || out.text)) || '';
      if (String(text).trim()) {
        return { text: String(text).trim(), model, provider: 'workers-ai' };
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Workers AI unavailable');
}

export async function runModel(env, messages, { maxTokens = 700 } = {}) {
  const key = env && env.GEMINI_API_KEY;
  if (key) {
    try {
      return await runGemini(key, messages, maxTokens);
    } catch (err) {
      // Key present but the call failed — fall through to Workers AI if bound.
      if (!(env && env.AI)) throw err;
    }
  }
  if (env && env.AI) return runWorkersAi(env.AI, messages, maxTokens);
  throw new Error('No AI provider configured');
}

export function providerStatus(env) {
  return {
    gemini: Boolean(env && env.GEMINI_API_KEY),
    workersAi: Boolean(env && env.AI),
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

export function fail(message, status = 200) {
  // 200 with an error field keeps the client's graceful path simple.
  return Response.json({ error: message }, { status });
}
