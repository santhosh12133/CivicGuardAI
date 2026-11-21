const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  computePHash,
  hammingDistance,
  calculateSimilarity,
  findSimilarImages,
} = require('../../src/utils/phash');

const fixture = (name) => path.join(__dirname, '..', 'fixtures', name);

test('hammingDistance counts differing bits', () => {
  assert.equal(hammingDistance('0000', '0000'), 0);
  assert.equal(hammingDistance('000f', '0000'), 4);
  assert.equal(hammingDistance('ffffffffffffffff', '0000000000000000'), 64);
});

test('hammingDistance treats missing or mismatched hashes as maximally different', () => {
  assert.equal(hammingDistance(null, 'abcd'), 64);
  assert.equal(hammingDistance('abcd', ''), 64);
  assert.equal(hammingDistance('abcd', 'abcdef'), 64);
});

test('calculateSimilarity converts distance to a percentage of 64 bits', () => {
  assert.equal(calculateSimilarity('ffffffffffffffff', 'ffffffffffffffff'), 100);
  assert.equal(calculateSimilarity('ffffffffffffffff', '0000000000000000'), 0);
  // 6 differing bits -> (1 - 6/64) * 100 = 90.625 -> 90.6
  assert.equal(calculateSimilarity('ffffffffffffffff', 'ffffffffffffffc0'), 90.6);
});

test('findSimilarImages returns records at or above the threshold', () => {
  const base = 'ffffffffffffffff';
  const records = [
    { id: 'same', phash: base },
    { id: 'close', phash: 'ffffffffffffffc0' }, // 90.6%
    { id: 'far', phash: '0000000000000000' },
    { id: 'none', phash: null },
  ];
  const ids = findSimilarImages(base, records, 90).map((r) => r.id);
  assert.deepEqual(ids, ['same', 'close']);
});

test('findSimilarImages handles empty input', () => {
  assert.deepEqual(findSimilarImages(null, [{ id: 'a', phash: 'ff' }]), []);
  assert.deepEqual(findSimilarImages('ff', []), []);
});

test('computePHash is deterministic and separates different scenes', async () => {
  const pothole = await computePHash(fixture('pothole.jpg'));
  const again = await computePHash(fixture('pothole.jpg'));
  const streetlight = await computePHash(fixture('streetlight.jpg'));

  assert.match(pothole, /^[0-9a-f]{16}$/);
  assert.equal(pothole, again);
  assert.ok(
    calculateSimilarity(pothole, streetlight) < 90,
    `different scenes scored ${calculateSimilarity(pothole, streetlight)}% similar`
  );
});

test('computePHash rejects a missing file', async (t) => {
  t.mock.method(console, 'error', () => {});
  await assert.rejects(computePHash(fixture('does-not-exist.jpg')));
});
