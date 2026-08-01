const assert = require('node:assert/strict');
const test = require('node:test');
const { VersionedCache } = require('../dist/symbolCache');

test('repeated navigation loads symbols once per document version and refreshes after an edit', async () => {
  const cache = new VersionedCache();
  let providerQueries = 0;
  const queryProvider = async () => [{ name: `result-${++providerQueries}` }];

  const first = await cache.get('file:///Program.cs', 1, queryProvider);
  const repeated = await cache.get('file:///Program.cs', 1, queryProvider);
  assert.strictEqual(repeated, first);
  assert.equal(providerQueries, 1);

  cache.delete('file:///Program.cs'); // onDidChangeTextDocument
  const edited = await cache.get('file:///Program.cs', 2, queryProvider);
  assert.notStrictEqual(edited, first);
  assert.equal(providerQueries, 2);
});

test('transient empty and failed provider responses are not retained', async () => {
  const cache = new VersionedCache();
  let providerQueries = 0;
  const emptyProvider = async () => { providerQueries++; return []; };

  await cache.get('file:///Program.cs', 1, emptyProvider, symbols => symbols.length > 0);
  await cache.get('file:///Program.cs', 1, emptyProvider, symbols => symbols.length > 0);
  assert.equal(providerQueries, 2);

  await assert.rejects(cache.get('file:///Other.cs', 1, async () => {
    providerQueries++;
    throw new Error('server starting');
  }));
  await cache.get('file:///Other.cs', 1, async () => { providerQueries++; return ['ready']; });
  assert.equal(providerQueries, 4);
});
