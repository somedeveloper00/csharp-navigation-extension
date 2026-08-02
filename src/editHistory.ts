import type * as vscode from 'vscode';

/** Edit locations are intentionally grouped at line granularity. */
export function sameEditLine(left: vscode.Location, right: vscode.Location): boolean {
  return left.uri.toString() === right.uri.toString() && left.range.start.line === right.range.start.line;
}

export class EditHistory {
  private readonly entries: vscode.Location[] = [];

  constructor(private readonly limit = 100) {}

  record(locations: readonly vscode.Location[]): void {
    for (const location of locations) {
      const last = this.entries.at(-1);
      if (!last || !sameEditLine(last, location)) this.entries.push(location);
    }
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
  }

  async revealPrevious(current: vscode.Location | undefined, reveal: (location: vscode.Location) => Promise<void>): Promise<boolean> {
    let index = this.entries.length - 1;
    while (index >= 0 && current && sameEditLine(this.entries[index], current)) index--;
    if (index < 0) return false;

    // Retain both the destination and skipped entries if revealing fails.
    await reveal(this.entries[index]);
    this.entries.splice(index);
    return true;
  }
}
