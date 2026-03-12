const DEFAULT_MODEL = 'gpt-5.2';

const PRICE_INPUT = 1.25 / 1_000_000; // $1.25 per 1M tokens
const PRICE_CACHED = 0.125 / 1_000_000; // $0.125 per 1M tokens
const PRICE_OUTPUT = 10 / 1_000_000; // $10 per 1M tokens

let openAiClient = null;
let openAiCtorPromise = null;

async function getOpenAiCtor() {
  if (!openAiCtorPromise) {
    openAiCtorPromise = import('openai')
      .then((mod) => mod.default ?? mod)
      .catch((error) => {
        openAiCtorPromise = null;
        const reason = error?.message || String(error);
        throw new Error(
          `Failed loading openai package (${reason}). Install it in tim-bridge before using generateLlm.`
        );
      });
  }

  return openAiCtorPromise;
}

async function getOpenAiClient() {
  if (openAiClient) return openAiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment.');
  }

  const OpenAI = await getOpenAiCtor();
  openAiClient = new OpenAI({ apiKey });
  return openAiClient;
}

function usageToCost(usage = {}) {
  const inputTokens = Number(usage.input_tokens ?? 0);
  const cachedTokens = Number(usage.input_tokens_details?.cached_tokens ?? 0);
  const billedInputTokens = Math.max(0, inputTokens - cachedTokens);
  const outputTokens = Number(usage.output_tokens ?? 0);

  const inputCost = billedInputTokens * PRICE_INPUT;
  const cachedInputCost = cachedTokens * PRICE_CACHED;
  const outputCost = outputTokens * PRICE_OUTPUT;

  return {
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost: inputCost + cachedInputCost + outputCost,
    breakdown: {
      inputTokens,
      cachedTokens,
      billedInputTokens,
      outputTokens,
      audioTokens: 0,
    },
  };
}

export async function generateLlm(args = {}) {
  const { model = DEFAULT_MODEL, prompt, schema } = args;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('generateLlm: "prompt" is required in settings.');
  }

  const ai = await getOpenAiClient();

  const request = {
    model,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
  };

  if (schema) {
    request.text = {
      format: {
        name: 'schema',
        type: 'json_schema',
        schema,
      },
    };
  }

  const response = await ai.responses.create(request);
  const rawText = response?.output_text ?? response?.output?.[0]?.content?.[0]?.text;

  if (!rawText) {
    throw new Error('llm: Empty text response from model.');
  }

  let output;
  try {
    output = JSON.parse(rawText);
  } catch (_error) {
    throw new Error('llm: Failed to parse JSON output.');
  }

  const cost = usageToCost(response?.usage ?? {});
  return { output, cost };
}
