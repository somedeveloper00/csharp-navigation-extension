import * as vscode from 'vscode';

export type ContextGroup = 'all' | 'method' | 'type' | 'variable';

const methodKinds = new Set([vscode.SymbolKind.Method, vscode.SymbolKind.Constructor, vscode.SymbolKind.Function]);
const typeKinds = new Set([vscode.SymbolKind.Class, vscode.SymbolKind.Interface, vscode.SymbolKind.Struct, vscode.SymbolKind.Enum, vscode.SymbolKind.Namespace]);
const variableKinds = new Set([vscode.SymbolKind.Variable, vscode.SymbolKind.Field, vscode.SymbolKind.Property, vscode.SymbolKind.Constant, vscode.SymbolKind.Event]);

export interface ContextSymbol {
  readonly name: string;
  readonly detail: string;
  readonly kind: vscode.SymbolKind;
  readonly range: vscode.Range;
  readonly selectionRange: vscode.Range;
  readonly depth: number;
}

export function flattenSymbols(symbols: readonly vscode.DocumentSymbol[], depth = 0): ContextSymbol[] {
  const result: ContextSymbol[] = [];
  for (const symbol of symbols) {
    result.push({ name: symbol.name, detail: symbol.detail, kind: symbol.kind, range: symbol.range, selectionRange: symbol.selectionRange, depth });
    result.push(...flattenSymbols(symbol.children, depth + 1));
  }
  return result;
}

export function belongsToGroup(symbol: ContextSymbol, group: ContextGroup, includeLocals: boolean): boolean {
  if (group === 'method') return methodKinds.has(symbol.kind);
  if (group === 'type') return typeKinds.has(symbol.kind);
  if (group === 'variable') return variableKinds.has(symbol.kind) && (includeLocals || symbol.kind !== vscode.SymbolKind.Variable);
  return methodKinds.has(symbol.kind) || typeKinds.has(symbol.kind) || variableKinds.has(symbol.kind) && (includeLocals || symbol.kind !== vscode.SymbolKind.Variable);
}

export function nextIndex(positions: readonly vscode.Position[], cursor: vscode.Position, direction: 1 | -1, wrap: boolean): number | undefined {
  if (!positions.length) return undefined;
  if (direction === 1) {
    const index = positions.findIndex(position => position.isAfter(cursor));
    return index >= 0 ? index : wrap ? 0 : undefined;
  }
  for (let index = positions.length - 1; index >= 0; index--) {
    if (positions[index].isBefore(cursor)) return index;
  }
  return wrap ? positions.length - 1 : undefined;
}

export function containingSymbol(symbols: readonly ContextSymbol[], cursor: vscode.Position): ContextSymbol | undefined {
  return symbols
    .filter(symbol => symbol.range.contains(cursor) && !symbol.selectionRange.contains(cursor))
    .sort((a, b) => b.depth - a.depth)[0];
}

export function symbolKindName(kind: vscode.SymbolKind): string {
  return vscode.SymbolKind[kind] ?? 'Symbol';
}
