import * as vscode from 'vscode';
import { belongsToGroup, containingSymbol, ContextGroup, ContextSymbol, flattenSymbols, nextIndex, symbolKindName } from './navigation';
import { EditHistory } from './editHistory';
import { normalizeSymbols } from './symbolNormalization';

export class Navigator {
  private readonly backStack: vscode.Location[] = [];
  private readonly forwardStack: vscode.Location[] = [];
  private readonly edits = new EditHistory();
  private navigating = false;

  constructor(private readonly output: vscode.OutputChannel) {}

  recordEdit(event: vscode.TextDocumentChangeEvent): void {
    if (this.navigating || event.document.languageId !== 'csharp' || !event.contentChanges.length) return;
    this.edits.record(event.contentChanges.map(change => new vscode.Location(event.document.uri, change.range.start)));
  }

  async move(group: ContextGroup, direction: 1 | -1): Promise<void> {
    const editor = this.csharpEditor();
    if (!editor) return;
    const provided = await this.symbols(editor.document);
    if (!provided) return;
    const symbols = provided.filter(symbol => belongsToGroup(symbol, group, this.config().get('includeLocalVariables', true)));
    const index = nextIndex(symbols.map(symbol => symbol.selectionRange.start), editor.selection.active, direction, this.config().get('wrapAround', true));
    if (index === undefined) return this.inform(`No ${group === 'all' ? 'context' : group} ${direction > 0 ? 'below' : 'above'} the cursor.`);
    await this.go(new vscode.Location(editor.document.uri, symbols[index].selectionRange));
  }

  async containing(): Promise<void> {
    const editor = this.csharpEditor();
    if (!editor) return;
    const symbols = await this.symbols(editor.document);
    if (!symbols) return;
    const target = containingSymbol(symbols, editor.selection.active);
    if (!target) return this.inform('No containing C# context found.');
    await this.go(new vscode.Location(editor.document.uri, target.selectionRange));
  }

  async pick(): Promise<void> {
    const editor = this.csharpEditor();
    if (!editor) return;
    const provided = await this.symbols(editor.document);
    if (!provided) return;
    const symbols = provided.filter(symbol => belongsToGroup(symbol, 'all', this.config().get('includeLocalVariables', true)));
    const picked = await vscode.window.showQuickPick(symbols.map(symbol => ({
      label: `$(${this.icon(symbol.kind)}) ${symbol.name}`,
      description: `${symbolKindName(symbol.kind)} · line ${symbol.selectionRange.start.line + 1}`,
      detail: `${'  '.repeat(symbol.depth)}${symbol.detail}`,
      symbol
    })), { placeHolder: 'Search methods, types, properties, fields, and variables', matchOnDescription: true, matchOnDetail: true });
    if (picked) await this.go(new vscode.Location(editor.document.uri, picked.symbol.selectionRange));
  }

  async usage(direction: 1 | -1): Promise<void> {
    const editor = this.csharpEditor();
    if (!editor) return;
    let references: vscode.Location[];
    try {
      references = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', editor.document.uri, editor.selection.active) ?? [];
    } catch (error) {
      this.failure('C# usage provider is not ready.', 'Reference provider failed', error);
      return;
    }
    const unique = references.filter((location, index, all) => all.findIndex(other => other.uri.toString() === location.uri.toString() && other.range.start.isEqual(location.range.start)) === index);
    if (!unique.length) return this.inform('No usages found. Ensure the C# language server is ready.');
    unique.sort((a, b) => a.uri.toString().localeCompare(b.uri.toString()) || a.range.start.compareTo(b.range.start));
    const here = unique.findIndex(location => location.uri.toString() === editor.document.uri.toString() && location.range.contains(editor.selection.active));
    const index = here < 0 ? (direction > 0 ? 0 : unique.length - 1) : (here + direction + unique.length) % unique.length;
    await this.go(unique[index]);
    void vscode.window.setStatusBarMessage(`Usage ${index + 1} of ${unique.length}`, 2500);
  }

  async lastEdit(): Promise<void> {
    const revealed = await this.edits.revealPrevious(this.currentLocation(), target => this.go(target));
    if (!revealed) this.inform('No previous C# edit location in this session.');
  }

  async history(direction: 'back' | 'forward'): Promise<void> {
    const source = direction === 'back' ? this.backStack : this.forwardStack;
    const target = source.at(-1);
    if (!target) return this.inform(`Navigation ${direction} history is empty.`);
    const current = this.currentLocation();
    if (!await this.reveal(target)) return;
    source.pop();
    if (current) (direction === 'back' ? this.forwardStack : this.backStack).push(current);
  }

  private async symbols(document: vscode.TextDocument): Promise<ContextSymbol[] | undefined> {
    let result: (vscode.DocumentSymbol | vscode.SymbolInformation)[] | undefined;
    try {
      result = await vscode.commands.executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[]>('vscode.executeDocumentSymbolProvider', document.uri);
    } catch (error) {
      this.failure('C# symbol provider is not ready.', `Document symbol provider failed for ${document.uri.toString()}`, error);
      return undefined;
    }
    if (!result?.length) { this.inform('No C# symbols found. Ensure the C# language server is installed and ready.'); return []; }
    if (result[0] instanceof vscode.DocumentSymbol) return normalizeSymbols(flattenSymbols(result as vscode.DocumentSymbol[]));

    const documentUri = document.uri.toString();
    const symbols = (result as vscode.SymbolInformation[])
      .filter(symbol => symbol.location.uri.toString() === documentUri)
      .map(symbol => ({
        name: symbol.name,
        detail: symbol.containerName,
        kind: symbol.kind,
        range: symbol.location.range,
        selectionRange: symbol.location.range,
        // SymbolInformation has no parent/child relationship or enclosing range.
        // Keeping it flat avoids presenting an invented hierarchy.
        depth: 0,
        uri: symbol.location.uri
      }));
    return normalizeSymbols(symbols);
  }

  private async go(target: vscode.Location): Promise<void> {
    const current = this.currentLocation();
    if (!await this.reveal(target)) return;
    if (current && (current.uri.toString() !== target.uri.toString() || !current.range.start.isEqual(target.range.start))) this.backStack.push(current);
    this.forwardStack.length = 0;
  }

  private async reveal(target: vscode.Location): Promise<boolean> {
    this.navigating = true;
    try {
      const document = await vscode.workspace.openTextDocument(target.uri);
      const editor = await vscode.window.showTextDocument(document);
      editor.selection = new vscode.Selection(target.range.start, target.range.start);
      const mode = this.config().get<'center' | 'top' | 'default'>('revealPosition', 'center');
      const reveal = mode === 'center' ? vscode.TextEditorRevealType.InCenter : mode === 'top' ? vscode.TextEditorRevealType.AtTop : vscode.TextEditorRevealType.Default;
      editor.revealRange(target.range, reveal);
      return true;
    } catch (error) {
      this.failure('Unable to open or reveal the navigation target.', `Navigation failed for ${target.uri.toString()}`, error);
      return false;
    } finally { this.navigating = false; }
  }

  private currentLocation(): vscode.Location | undefined {
    const editor = vscode.window.activeTextEditor;
    return editor ? new vscode.Location(editor.document.uri, editor.selection.active) : undefined;
  }
  private csharpEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'csharp') { this.inform('Open a C# file to use C# Extended Navigation.'); return undefined; }
    return editor;
  }
  private config(): vscode.WorkspaceConfiguration { return vscode.workspace.getConfiguration('csharpExtendedNavigation'); }
  private inform(message: string): void { this.output.appendLine(message); void vscode.window.setStatusBarMessage(message, 3000); }
  private failure(message: string, context: string, error: unknown): void {
    this.inform(message);
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    this.output.appendLine(`${context}: ${detail}`);
  }
  private icon(kind: vscode.SymbolKind): string {
    if ([vscode.SymbolKind.Method, vscode.SymbolKind.Function, vscode.SymbolKind.Constructor].includes(kind)) return 'symbol-method';
    if ([vscode.SymbolKind.Class, vscode.SymbolKind.Interface, vscode.SymbolKind.Struct].includes(kind)) return 'symbol-class';
    if ([vscode.SymbolKind.Variable, vscode.SymbolKind.Field, vscode.SymbolKind.Constant].includes(kind)) return 'symbol-variable';
    return 'symbol-property';
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('C# Extended Navigation');
  const navigator = new Navigator(output);
  const commands: Record<string, () => void | Promise<void>> = {
    nextContext: () => navigator.move('all', 1), previousContext: () => navigator.move('all', -1),
    nextMethod: () => navigator.move('method', 1), previousMethod: () => navigator.move('method', -1),
    nextType: () => navigator.move('type', 1), previousType: () => navigator.move('type', -1),
    nextVariable: () => navigator.move('variable', 1), previousVariable: () => navigator.move('variable', -1),
    containingContext: () => navigator.containing(), contextPicker: () => navigator.pick(),
    nextUsage: () => navigator.usage(1), previousUsage: () => navigator.usage(-1), lastEdit: () => navigator.lastEdit(),
    navigateBack: () => navigator.history('back'), navigateForward: () => navigator.history('forward')
  };
  for (const [name, handler] of Object.entries(commands)) context.subscriptions.push(vscode.commands.registerCommand(`csharpExtendedNavigation.${name}`, handler));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => navigator.recordEdit(event)), output);
}

export function deactivate(): void {}
