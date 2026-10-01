import assert from 'node:assert/strict';
import {
  extractJsonText,
  parseJsonFromLlm,
  repairLlmJson,
} from './parse-json.js';

describe('parseJsonFromLlm', () => {
  it('parses valid JSON', () => {
    const parsed = parseJsonFromLlm<{ total: number }>('{"total": 1463}');
    assert.equal(parsed.total, 1463);
  });

  it('repairs thousand separators in unquoted numbers', () => {
    const raw = `{
  "totals": {
    "total": 1,463.00
  }
}`;
    const parsed = parseJsonFromLlm<{ totals: { total: number } }>(raw);
    assert.equal(parsed.totals.total, 1463);
  });

  it('repairs multiple comma-separated amounts', () => {
    const repaired = repairLlmJson(
      '{"fees": 1,041.46, "expenses": 234.08, "total": 1,463.00}',
    );
    const parsed = JSON.parse(repaired) as {
      fees: number;
      expenses: number;
      total: number;
    };
    assert.equal(parsed.fees, 1041.46);
    assert.equal(parsed.expenses, 234.08);
    assert.equal(parsed.total, 1463);
  });

  it('strips markdown fences', () => {
    const parsed = parseJsonFromLlm<{ ok: boolean }>(
      '```json\n{"ok": true}\n```',
    );
    assert.equal(parsed.ok, true);
  });

  it('extracts JSON from prose and markdown wrappers', () => {
    const parsed = parseJsonFromLlm<{ total: number }>(
      'Here is the extracted data:\n```json\n{"total": 1,463.00}\n```\nDone.',
    );
    assert.equal(parsed.total, 1463);
  });

  it('repairs unquoted string values', () => {
    const parsed = parseJsonFromLlm<{ isInvoice: boolean; reason: string }>(`{
  "isInvoice": false,
  "confidence": 0.9,
  "reason": Employment agreement
}`);
    assert.equal(parsed.isInvoice, false);
    assert.equal(parsed.reason, 'Employment agreement');
  });

  it('parses Hebrew vendor names with embedded quotes', () => {
    const parsed = parseJsonFromLlm<{ vendor: { name: string } }>(
      '{"vendor":{"name":"חברה בע\\"מ"}}',
    );
    assert.equal(parsed.vendor.name, 'חברה בע"מ');
  });

  it('extractJsonText returns the outermost object', () => {
    assert.equal(extractJsonText('prefix {"a": 1} suffix'), '{"a": 1}');
  });
});
