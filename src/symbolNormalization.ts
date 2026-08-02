export interface ComparablePosition {
  readonly line: number;
  readonly character: number;
}

export interface ComparableRange {
  readonly start: ComparablePosition;
  readonly end: ComparablePosition;
}

export interface NormalizableSymbol {
  readonly name: string;
  readonly kind: number;
  readonly depth: number;
  readonly selectionRange: ComparableRange;
  readonly uri?: { toString(): string };
}

function comparePosition(left: ComparablePosition, right: ComparablePosition): number {
  return left.line - right.line || left.character - right.character;
}

/** Return a copy in the canonical order used by structural navigation. */
export function normalizeSymbols<T extends NormalizableSymbol>(symbols: readonly T[]): T[] {
  return [...symbols].sort((left, right) =>
    (left.uri?.toString() ?? '').localeCompare(right.uri?.toString() ?? '')
    || comparePosition(left.selectionRange.start, right.selectionRange.start)
    || comparePosition(left.selectionRange.end, right.selectionRange.end)
    || left.depth - right.depth
    || left.kind - right.kind
    || left.name.localeCompare(right.name)
  );
}
