// Cloudflare Pages Function — POST /api/ai-mnemonic
// Builds Hebrew memory hooks for an English word.
import { runModel, readJson, fail } from '../_shared.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const { word, hebrewTranslation, definition, example } = body;

  if (!word) return fail('חסרה מילה');

  const messages = [
    {
      role: 'system',
      content:
        'אתה פסיכולוג קוגניטיבי שמכין סטודנטים ישראלים לבחינת אמיר״ם. ' +
        'אתה עונה בעברית בלבד, קצר וקולע, בתבליטים עם •.',
    },
    {
      role: 'user',
      content:
        `המילה באנגלית: ${word}\n` +
        `תרגום: ${hebrewTranslation || '(לא ידוע)'}\n` +
        (definition ? `הגדרה: ${definition}\n` : '') +
        (example ? `דוגמה: ${example}\n` : '') +
        '\nצור:\n' +
        '• אסוציאציית צליל בעברית (משחק מילים שנצמד לזיכרון)\n' +
        '• פירוק המילה לשורש/קידומת אם רלוונטי\n' +
        '• משפט דוגמה קצר ברמת אמיר״ם עם תרגום\n' +
        '• טיפ: איך המילה עשויה להופיע בהשלמת משפטים או בניסוח מחדש',
    },
  ];

  try {
    const { text, model } = await runModel(context.env, messages, { maxTokens: 600 });
    return Response.json({ word, mnemonic: text, model });
  } catch (err) {
    return fail('יצירת האסוציאציה אינה זמינה כרגע');
  }
}
