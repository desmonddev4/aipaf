import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeCmsInput, validateCmsContent } from '../src/server/handlers/api/member-core.mjs';

test('CMS submissions accept only supported content types and valid statuses', () => {
  const result = sanitizeCmsInput({
    type: 'news',
    slug: '  test-story  ',
    title: 'Test story',
    summary: '<script>alert(1)</script>Safe summary',
    body: '<p>Allowed</p>',
  });

  assert.equal(result.type, 'news');
  assert.equal(result.slug, 'test-story');
  assert.equal(result.summary, 'Safe summary');

  const invalidType = validateCmsContent({ type: 'invalid', slug: 'bad', title: 'Bad' });
  assert.equal(invalidType.ok, false);
  assert.match(invalidType.message, /content type/i);

  const validStatus = validateCmsContent({ type: 'page', slug: 'status-test', title: 'Status test', status: 'published' });
  assert.equal(validStatus.ok, true);
});
