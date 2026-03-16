import { readFileSync } from 'node:fs';

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

const PROMPT_TEMPLATE = readFileSync(new URL('./prompt.haiku.md', import.meta.url), 'utf8');
const CONTEXT_TEMPLATE = readFileSync(new URL('./prompt.haiku.context.md', import.meta.url), 'utf8');

function renderTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in values)) {
      return match;
    }

    return String(values[key]);
  });
}

export function buildHaikuPrompt(args = {}) {
  const {
    nowIso,
    installationName = 'המפעל',
    city = 'ירושלים',
    timeZone = 'Asia/Jerusalem',
  } = args;
  const contextNowIso = nowIso || new Date().toISOString();
  const dailyContext = CONTEXT_TEMPLATE.trim();

  return renderTemplate(PROMPT_TEMPLATE, {
    INSTALLATION_NAME: installationName,
    CITY: city,
    DAILY_CONTEXT: dailyContext,
    NOW_ISO: contextNowIso,
    TIME_ZONE: timeZone,
  }).trim();
}
