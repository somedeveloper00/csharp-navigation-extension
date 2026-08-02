const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeSymbols } = require('../dist/symbolNormalization');

const position = (line, character) => ({ line, character });
const symbol = (name, line, character, options = {}) => ({
  name,
  kind: 11,
  depth: 0,
  selectionRange: { start: position(line, character), end: position(line, character + 1) },
  ...options
});

test('normalizes intentionally shuffled symbols by URI and start position', () => {
  const actual = normalizeSymbols([
    symbol('later', 8, 0, { uri: new URL('file:///b.cs') }),
    symbol('second', 3, 4, { uri: new URL('file:///a.cs') }),
    symbol('first', 1, 2, { uri: new URL('file:///a.cs') })
  ]);

  assert.deepEqual(actual.map(item => item.name), ['first', 'second', 'later']);
});

test('uses end, depth, kind, and name to order symbols at the same start', () => {
  const start = position(4, 2);
  const actual = normalizeSymbols([
    symbol('zeta', 4, 2, { kind: 12, depth: 2, selectionRange: { start, end: position(4, 8) } }),
    symbol('beta', 4, 2, { kind: 11, depth: 1, selectionRange: { start, end: position(4, 8) } }),
    symbol('alpha', 4, 2, { kind: 11, depth: 1, selectionRange: { start, end: position(4, 8) } }),
    symbol('short', 4, 2, { selectionRange: { start, end: position(4, 5) } })
  ]);

  assert.deepEqual(actual.map(item => item.name), ['short', 'alpha', 'beta', 'zeta']);
});
