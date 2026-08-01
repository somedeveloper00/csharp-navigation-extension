const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

class Position {
  constructor(line, character) { this.line = line; this.character = character; }
  isEqual(other) { return this.line === other.line && this.character === other.character; }
  compareTo(other) { return this.line - other.line || this.character - other.character; }
}
class Range {
  constructor(start, end = start) { this.start = start; this.end = end; }
  contains(position) { return this.start.compareTo(position) <= 0 && this.end.compareTo(position) >= 0; }
}
class Location { constructor(uri, range) { this.uri = uri; this.range = range instanceof Position ? new Range(range) : range; } }
class Selection extends Range { get active() { return this.end; } }
class DocumentSymbol {}

const state = { activeEditor: undefined, execute: async () => [], open: async uri => document(uri), status: [] };
const uri = value => ({ toString: () => value });
const document = value => ({ uri: typeof value === 'string' ? uri(value) : value, languageId: 'csharp' });
const editor = (value, line = 0) => ({
  document: document(value), selection: new Selection(new Position(line, 0), new Position(line, 0)),
  revealRange() {}
});
const vscode = {
  Position, Range, Location, Selection, DocumentSymbol, SymbolInformation: class {},
  SymbolKind: { Method: 0, Function: 1, Constructor: 2, Class: 3, Interface: 4, Struct: 5, Variable: 6, Field: 7, Constant: 8 },
  TextEditorRevealType: { InCenter: 0, AtTop: 1, Default: 2 },
  commands: { executeCommand: (...args) => state.execute(...args), registerCommand() { return {}; } },
  workspace: {
    openTextDocument: value => state.open(value),
    getConfiguration: () => ({ get: (_name, fallback) => fallback }),
    onDidChangeTextDocument() { return {}; }
  },
  window: {
    get activeTextEditor() { return state.activeEditor; },
    set activeTextEditor(value) { state.activeEditor = value; },
    showTextDocument: async doc => { const next = editor(doc.uri); state.activeEditor = next; return next; },
    setStatusBarMessage: message => { state.status.push(message); return { dispose() {} }; },
    createOutputChannel() { return output(); }
  }
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') return vscode;
  return originalLoad.call(this, request, parent, isMain);
};
const { Navigator } = require('../dist/extension');
Module._load = originalLoad;

function output() {
  const lines = [];
  return { lines, appendLine(line) { lines.push(line); }, dispose() {} };
}
function reset() {
  state.activeEditor = editor('file:///a.cs');
  state.execute = async () => [];
  state.open = async value => document(value);
  state.status = [];
}

test('reports rejected symbol and reference providers without rejecting commands', async () => {
  reset();
  const channel = output();
  const navigator = new Navigator(channel);
  state.execute = async command => { throw new Error(`${command} unavailable`); };

  await navigator.move('all', 1);
  await navigator.usage(1);

  assert.deepEqual(state.status, ['C# symbol provider is not ready.', 'C# usage provider is not ready.']);
  assert.match(channel.lines.join('\n'), /Document symbol provider failed.*executeDocumentSymbolProvider unavailable/s);
  assert.match(channel.lines.join('\n'), /Reference provider failed.*executeReferenceProvider unavailable/s);
});

test('failed document opens leave navigation history unchanged and reset navigating', async () => {
  reset();
  const channel = output();
  const navigator = new Navigator(channel);
  const at = value => new Location(uri(value), new Position(0, 0));

  await navigator.go(at('file:///b.cs'));
  await navigator.history('back');
  assert.equal(state.activeEditor.document.uri.toString(), 'file:///a.cs');

  state.open = async () => { throw new Error('permission denied'); };
  await navigator.go(at('file:///c.cs'));
  assert.equal(navigator.navigating, false);
  await navigator.history('forward');
  assert.equal(navigator.forwardStack.length, 1);

  state.open = async value => document(value);
  await navigator.history('forward');
  assert.equal(state.activeEditor.document.uri.toString(), 'file:///b.cs');
  assert.equal(navigator.forwardStack.length, 0);
  assert.match(channel.lines.join('\n'), /Unable to open or reveal the navigation target\./);
  assert.match(channel.lines.join('\n'), /Navigation failed for file:\/\/\/c\.cs:.*permission denied/s);
});
