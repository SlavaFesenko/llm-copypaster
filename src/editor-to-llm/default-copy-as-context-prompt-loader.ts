import * as vscode from 'vscode';

let cachedDefaultCopyAsContextPrompt: string | null = null;

export async function loadDefaultCopyAsContextPrompt(extensionContext: vscode.ExtensionContext): Promise<string> {
  if (cachedDefaultCopyAsContextPrompt !== null) return cachedDefaultCopyAsContextPrompt;

  const promptFileUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'prompts', 'default-copy-as-context-prompt.md');

  try {
    const bytes = await vscode.workspace.fs.readFile(promptFileUri);
    const text = Buffer.from(bytes).toString('utf8');

    cachedDefaultCopyAsContextPrompt = text;

    return text;
  } catch {
    cachedDefaultCopyAsContextPrompt = '';

    return '';
  }
}
