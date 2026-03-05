import * as vscode from 'vscode';

interface EnsureReadonlyVirtualMarkdownDocOpenedArgs {
  extensionContext: vscode.ExtensionContext;
  docId: string;
  markdownText: string;
  viewColumn?: vscode.ViewColumn;
}

const readonlyMarkdownScheme = 'llm-copypaster-readonly-markdown';

const docTextByUriStringMap = new Map<string, string>();

let isProviderRegistered = false;

let readonlyMarkdownProviderEmitter: vscode.EventEmitter<vscode.Uri> | null = null;

export async function ensureReadonlyVirtualMarkdownDocOpened(
  args: EnsureReadonlyVirtualMarkdownDocOpenedArgs
): Promise<void> {
  ensureProviderRegisteredOnce(args.extensionContext);

  const uri = buildReadonlyMarkdownDocUri({ docId: args.docId });

  docTextByUriStringMap.set(uri.toString(), args.markdownText);

  readonlyMarkdownProviderEmitter?.fire(uri);

  const document = await vscode.workspace.openTextDocument(uri);

  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    viewColumn: args.viewColumn ?? vscode.ViewColumn.Active,
  });
}

function ensureProviderRegisteredOnce(extensionContext: vscode.ExtensionContext): void {
  if (isProviderRegistered) return;

  readonlyMarkdownProviderEmitter = new vscode.EventEmitter<vscode.Uri>();

  const provider: vscode.TextDocumentContentProvider = {
    onDidChange: readonlyMarkdownProviderEmitter.event,
    provideTextDocumentContent: (uri: vscode.Uri) => docTextByUriStringMap.get(uri.toString()) ?? '',
  };

  const registration = vscode.workspace.registerTextDocumentContentProvider(readonlyMarkdownScheme, provider);

  extensionContext.subscriptions.push(registration);

  isProviderRegistered = true;
}

function buildReadonlyMarkdownDocUri(args: { docId: string }): vscode.Uri {
  return vscode.Uri.parse(`${readonlyMarkdownScheme}://preview/~TMP_${encodeURIComponent(args.docId)}.md`);
}
