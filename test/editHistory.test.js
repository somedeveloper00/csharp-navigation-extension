const assert = require('node:assert/strict');
const test = require('node:test');
const { EditHistory } = require('../dist/editHistory');

function location(uri, line, character = 0) {
  return { uri: { toString: () => uri }, range: { start: { line, character } } };
}

async function destination(history, current) {
  let result;
  const found = await history.revealPrevious(current, async value => { result = value; });
  return found ? `${result.uri}:${result.range.start.line}:${result.range.start.character}` : undefined;
}

test('reveals a single edit when it differs from the current location', async () => {
  const history = new EditHistory();
  history.record([location('file:///a.cs', 2, 4)]);
  assert.equal(await destination(history, location('file:///a.cs', 8)), 'file:///a.cs:2:4');
});

test('deduplicates repeated edits on one line at line granularity', async () => {
  const history = new EditHistory();
  history.record([location('file:///a.cs', 2, 1)]);
  history.record([location('file:///a.cs', 2, 9)]);
  assert.equal(await destination(history, location('file:///a.cs', 8)), 'file:///a.cs:2:1');
  assert.equal(await destination(history, location('file:///a.cs', 8)), undefined);
});

test('skips the current line and reveals the previous edited line', async () => {
  const history = new EditHistory();
  history.record([location('file:///a.cs', 2), location('file:///a.cs', 7)]);
  assert.equal(await destination(history, location('file:///a.cs', 7, 20)), 'file:///a.cs:2:0');
});

test('distinguishes edits on the same line in multiple files', async () => {
  const history = new EditHistory();
  history.record([location('file:///a.cs', 2), location('file:///b.cs', 2)]);
  assert.equal(await destination(history, location('file:///b.cs', 2)), 'file:///a.cs:2:0');
});

test('records every multi-cursor content-change location in order', async () => {
  const history = new EditHistory();
  history.record([location('file:///a.cs', 2, 3), location('file:///a.cs', 9, 5)]);
  assert.equal(await destination(history, location('file:///a.cs', 12)), 'file:///a.cs:9:5');
  assert.equal(await destination(history, location('file:///a.cs', 12)), 'file:///a.cs:2:3');
});

test('retains a candidate when revealing it fails', async () => {
  const history = new EditHistory();
  history.record([location('file:///a.cs', 2)]);
  await assert.rejects(history.revealPrevious(undefined, async () => { throw new Error('cannot reveal'); }));
  assert.equal(await destination(history, undefined), 'file:///a.cs:2:0');
});
