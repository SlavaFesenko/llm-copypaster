import * as vscode from 'vscode';

export interface ReadonlyTextView {
  open: (nextText: string) => Promise<void>;
}

export function createReadonlyTextView(
  context: vscode.ExtensionContext,
  scheme: string,
  virtualFileName: string,
  languageId?: string
): ReadonlyTextView {
  const virtualDocumentUri = vscode.Uri.parse(`${scheme}:/${virtualFileName}`);

  let currentText = '';
  const didChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(scheme, {
      onDidChange: didChangeEmitter.event,
      provideTextDocumentContent: () => currentText,
    })
  );

  return {
    open: async (nextText: string) => {
      currentText = nextText;
      didChangeEmitter.fire(virtualDocumentUri);

      const document = await vscode.workspace.openTextDocument(virtualDocumentUri);

      if (languageId) await vscode.languages.setTextDocumentLanguage(document, languageId);

      await vscode.window.showTextDocument(document, { preview: true });
    },
  };
}
