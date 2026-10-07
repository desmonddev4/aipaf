import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
const loggedErrors = [];
const window = {};
vm.runInNewContext(source, {
  window,
  console: { error: (...args) => loggedErrors.push(args) },
});

test('readApiJson returns valid JSON responses', async () => {
  const expected = { ok: true };
  const result = await window.readApiJson({ json: async () => expected });
  assert.equal(result, expected);
});

test('readApiJson hides invalid JSON parser details from users', async () => {
  const response = { json: async () => { throw new SyntaxError(`Unexpected token 'A'`); } };

  await assert.rejects(
    window.readApiJson(response),
    { message: 'We could not complete your request right now. Please try again.' },
  );
  assert.equal(loggedErrors.length, 1);
});
