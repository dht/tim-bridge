import { buildHaikuDailyContext } from './prompt.haiku.context.js';

export const HAIKU_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['line1', 'line2', 'line3'],
  properties: {
    line1: { type: 'string', minLength: 2, maxLength: 80 },
    line2: { type: 'string', minLength: 2, maxLength: 80 },
    line3: { type: 'string', minLength: 2, maxLength: 80 },
  },
};

export function buildHaikuPrompt(args = {}) {
  const {
    nowIso,
    installationName = 'המפעל',
    city = 'ירושלים',
    timeZone = 'Asia/Jerusalem',
    extraContext = '',
  } = args;
  const dailyContext = buildHaikuDailyContext({ nowIso, timeZone, extraContext });

  return `
כתוב הייקו מקורי אחד בן שלוש שורות עבור מיצב אמנות בשם "תחנת הייקו יומי".

הקשר:
- הקול הדובר: בניין האבן הוותיק עצמו, מתבונן בשקט.
- מקום: ${installationName}, ${city}.
- מצב רוח: טון תיעודי, שקט, מעט מרוחק.
- להתמקד ברגעים קטנים וחולפים: אור על אבן, תנועה במסדרון, שאריות יצירה, קולות עיר מרחוק, זכרונות חלל.
- לא לפנות ישירות לקורא.
- להימנע מקלישאות והצהרות גדולות.

הקשר יומי למשיכה רעיונית:
${dailyContext}

מגבלות פלט:
- החזר JSON בלבד, תואם לסכימה.
- בדיוק 3 שורות: line1, line2, line3.
- כל שורה קצרה ומוחשית (בערך 4 עד 9 מילים).
- עברית בלבד.
- בלי ניקוד.
- בלי מרכאות בתוך השורות.

חותמת זמן להקשר: ${nowIso}
אזור זמן להקשר: ${timeZone}
`.trim();
}
