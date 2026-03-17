export const HAIKU_MODES = [
  'התמקדות באור',
  'התמקדות בצליל',
  'התמקדות בנוכחות אנושית',
  'התמקדות בהיעדר',
  'התמקדות בפחד',
  'התמקדות בפרט קטן',
  'התמקדות בזיכרון',
  'התמקדות במתח בין פנים לחוץ',
];

export const HAIKU_MOODS = ['שקט', 'מתוח', 'עייף', 'מתבונן', 'זר', 'עמוס', 'ריק'];

export const CONTEXT_FRAGMENTS_POOL = [
  'אזעקה',
  'חניון קומה מינוס שלוש',
  'עגלה חורקת',
  'חייל עם קסדה',
  'לובי מואר מדי',
  'טלפון מצלצל',
  'ריח בטון קר',
  'קולות עיר רחוקים',
  'מעלית נפתחת ונסגרת',
  'אור פלורסנט מהבהב',
];

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomSubset(arr, count = 3) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
