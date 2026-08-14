// Shared helpers for the Cloudflare Pages Functions that back the AI features.
// No API key is involved: Workers AI runs the model inside Cloudflare's free tier,
// reached through the `AI` binding you add in the Pages project settings.

// Tried in order — if the account or region lacks one, the next is attempted.
export const MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
];

export async function runModel(env, messages, { maxTokens = 700 } = {}) {
  if (!env || !env.AI) throw new Error('AI binding is not configured');
  let lastError = null;
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, { messages, max_tokens: maxTokens });
      const text = (out && (out.response || out.result || out.text)) || '';
      if (text && String(text).trim()) return { text: String(text).trim(), model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No model produced a response');
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
