const DAILY_CONTEXT = {
  israelNews: [
    'כותרות ארציות מדברות על מתח ושגרה יחד באותו בוקר.',
    'ברקע הארצי נשמעים דיונים על ביטחון, חינוך ויוקר מחיה.',
    'היום הציבורי בישראל מרגיש בין דריכות לבין עייפות שקטה.',
    'יש תחושה של חדשות מתחלפות מהר, והרחוב ממשיך לנשום.',
  ],
  jerusalemNews: [
    'בירושלים בוקר קריר, תנועה דקה בין סמטאות ואבן ישנה.',
    'בעיר מורגשת תערובת של תיירים, עובדים ותלמידים בדרך.',
    'ברחובות ירושלים יש מעבר בין שקט פתאומי לרעש קצר.',
    'אור ירושלמי חד נכנס בין בניינים ומאיר אבק באוויר.',
  ],
  hamifalNews: [
    'בהמפעל נשארו עקבות מפרויקט מאתמול: כיסא זז מעט וצבע יבש.',
    'במסדרון של המפעל הדלת נפתחת ונסגרת בקצב לא מתוכנן.',
    'חלל העבודה בהמפעל מחליף קולות: חזרה, שיחה, דממה.',
    'יש תחושה שעבודה חדשה כמעט מוכנה אבל עוד לא נחתמה.',
  ],
  nightEvents: [
    'בלילה הקירות שמעו צעדים בודדים ושקט ארוך אחריהם.',
    'שעות הלילה שמרו הדים דקים של דלת ומפתח.',
    'אחרי חצות נשאר אור חלש במסדרון ואז כבה.',
    'לילה בהמפעל השאיר ריח קל של נייר וצבע באוויר.',
  ],
  excitingEvents: [
    'יש דיבור על פתיחה קרובה או אירוע שמושך סקרנות.',
    'מישהו הזכיר רעיון חדש שמסעיר את צוות המקום.',
    'מבקר נכנס לרגע והשאיר שאלה שנשארה תלויה בחלל.',
    'שמועה קטנה על שיתוף פעולה חדש עוברת בין החדרים.',
  ],
};

function hashString(value) {
  let hash = 0;
  const text = String(value ?? '');

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function pickBySeed(items, seed) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  return items[seed % items.length];
}

function getDateKey(nowIso, timeZone) {
  const date = nowIso ? new Date(nowIso) : new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

export function buildHaikuDailyContext(args = {}) {
  const { nowIso, timeZone = 'Asia/Jerusalem', extraContext = '' } = args;

  const dateKey = getDateKey(nowIso, timeZone);
  const seedBase = hashString(dateKey);

  const israel = pickBySeed(DAILY_CONTEXT.israelNews, seedBase + 11);
  const jerusalem = pickBySeed(DAILY_CONTEXT.jerusalemNews, seedBase + 23);
  const hamifal = pickBySeed(DAILY_CONTEXT.hamifalNews, seedBase + 37);
  const night = pickBySeed(DAILY_CONTEXT.nightEvents, seedBase + 41);
  const exciting = pickBySeed(DAILY_CONTEXT.excitingEvents, seedBase + 53);
  const manual = String(extraContext ?? '').trim();

  const lines = [
    `- ישראל: ${israel}`,
    `- ירושלים: ${jerusalem}`,
    `- המפעל: ${hamifal}`,
    `- לילה: ${night}`,
    `- אירוע/התרגשות: ${exciting}`,
  ];

  if (manual) {
    lines.push(`- תוספת יומית ידנית: ${manual}`);
  }

  lines.push('- השתמש/י בהקשרים כרמז עדין בלבד, לא כדיווח חדשותי.');

  return lines.join('\n');
}
