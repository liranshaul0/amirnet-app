// Cloudflare Pages Function — POST /api/ai-tutor
// Explains an answered question in Hebrew: why the right answer is right and
// what trap each distractor was setting.
import { runModel, readJson, fail } from '../_shared.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { question, passage, options, correctAnswer, userAnswer, type, customPrompt } = body;

  if (!question) return fail('חסרה שאלה לניתוח');

  const optionLines = Array.isArray(options)
    ? options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')
    : Object.entries(options || {}).map(([k, v]) => `${k}) ${v}`).join('\n');

  const messages = [
    {
      role: 'system',
      content:
        'אתה חונך מומחה לבחינת אמיר״ם/אמירנ״ט של מאל״ו. אתה עונה בעברית בלבד, ' +
        'בתמציתיות ובדיוק, בלי סימני עיצוב מיותרים. השתמש בכותרות קצרות ובתבליטים עם •.',
    },
    {
      role: 'user',
      content:
        `סוג השאלה: ${type || 'תרגול'}\n` +
        `השאלה: ${question}\n` +
        (passage ? `קטע הקריאה:\n${passage}\n` : '') +
        `אפשרויות:\n${optionLines}\n` +
        `התשובה הנכונה: ${correctAnswer || ''}\n` +
        `מה שהתלמיד ענה: ${userAnswer || '(לא נענה)'}\n\n` +
        (customPrompt || 'הסבר מדוע התשובה הנכונה נכונה, ומה המלכודת בכל מסיח שגוי. הוסף פירוק תחבירי קצר של המשפט.'),
    },
  ];

  try {
    const { text, model } = await runModel(context.env, messages, { maxTokens: 800 });
    return Response.json({ explanation: text, model });
  } catch (err) {
    return fail('ניתוח ה-AI אינו זמין כרגע');
  }
}
