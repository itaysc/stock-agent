// Ported from foozool-initiatives (server/src/llm/parseJson.ts).
import { jsonrepair } from 'jsonrepair';

/**
 * Repair common LLM JSON mistakes before parsing.
 * - Thousand separators in unquoted numbers (e.g. 1,463.00)
 * - Trailing commas before } or ]
 */
export function repairLlmJson(text: string): string {
  let repaired = text;

  repaired = repaired.replace(
    /(:[\s]*)(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)(\s*[,}\]])/g,
    (_, prefix: string, number: string, suffix: string) =>
      `${prefix}${number.replace(/,/g, '')}${suffix}`,
  );

  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  return repaired;
}

/** Normalize curly/smart quotes that break JSON.parse. */
function normalizeJsonQuotes(text: string): string {
  return text
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'");
}

/**
 * Pull a JSON object/array out of markdown fences or surrounding prose.
 */
export function extractJsonText(raw: string): string {
  let text = raw.trim();
  if (!text) {
    return text;
  }

  const fenced = text.match(
    /```(?:json|jsonc|javascript|js)?\s*([\s\S]*?)```/i,
  );
  if (fenced) {
    text = fenced[1].trim();
  }

  const start = text.search(/[{[]/);
  if (start === -1) {
    return text;
  }

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start).trim();
}

function tryParseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

/**
 * Parse JSON from LLM text (handles markdown fences, prose wrappers, and common LLM mistakes).
 */
export function parseJsonFromLlm<T = unknown>(raw: string): T {
  const text = normalizeJsonQuotes(extractJsonText(raw));
  const attempts = [
    () => tryParseJson<T>(text),
    () => tryParseJson<T>(repairLlmJson(text)),
    () => tryParseJson<T>(jsonrepair(text)),
    () => tryParseJson<T>(jsonrepair(repairLlmJson(text))),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to parse LLM JSON');
}
