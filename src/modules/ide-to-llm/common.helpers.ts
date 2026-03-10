import * as vscode from 'vscode';

import { ConfigService, OverrideOptionMetadata } from '../../config-service';
import { CollectedFileItem } from '../../contracts/files-payload';
import { ConfigStateReportBuilder } from '../../utils/config-state-report-builder';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../utils/editor-virtual-doc-helpers';
import { OutputChannelLogger } from '../../utils/output-channel-logger';
import { PromptBuilder } from './liquid-builder/prompt-builder';
import { buildLlmContextText } from './utils/llm-context-formatter';
import { buildPromptSizeStatsSuffix, buildTextSizeStats } from './utils/prompt-size-helper';

export interface EditorToLlmModulePrivateHelpersDependencies {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export interface ReadUrisAsFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
}

export interface TabBasedFileItemsResult {
  fileItems: CollectedFileItem[];
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
}

export interface EditorToLlmPromptSizeStats {
  linesCount: number;
  approxTokensCount: number;
  maxLinesCountInContext: number;
  maxTokensCountInContext: number;
  isExceeded: boolean;
  exceededBy: string[];
}

export interface ShowCopyResultNotificationArgs {
  commandName: string;
  includeTechPrompt: boolean;
  copiedFilesCount: number;
  totalFilesCount: number;
  deletedFileUris: vscode.Uri[];
  unresolvedTabs: vscode.Tab[];
  promptText: string;
  fileItems: CollectedFileItem[];
  promptSizeStats?: EditorToLlmPromptSizeStats;
}

export function tryGetUriFromTab(tab: vscode.Tab): vscode.Uri | null {
  if (tab.input instanceof vscode.TabInputText) {
    return tab.input.uri;
  }

  const anyInput = tab.input as unknown as { uri?: vscode.Uri };
  if (anyInput?.uri instanceof vscode.Uri) {
    return anyInput.uri;
  }

  return null;
}

export function buildUriKey(uri: vscode.Uri): string {
  if (uri.scheme === 'file' && uri.fsPath) return uri.fsPath;

  return uri.toString();
}

export async function readUrisAsFileItems(uris: vscode.Uri[]): Promise<ReadUrisAsFileItemsResult> {
  const dedupedByPathMap = new Map<string, vscode.Uri>();

  for (const uri of uris) {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    if (!relativePath) continue;

    if (!dedupedByPathMap.has(relativePath)) dedupedByPathMap.set(relativePath, uri);
  }

  const fileItems: CollectedFileItem[] = [];
  const deletedFileUris: vscode.Uri[] = [];

  for (const [relativePath, uri] of dedupedByPathMap.entries()) {
    const readResult = await tryReadFileAsText(uri);

    if (readResult.isFileNotFound) {
      deletedFileUris.push(uri);
      continue;
    }

    fileItems.push({
      path: relativePath,
      content: readResult.text,
      languageId: readResult.languageId,
      readError: readResult.readError,
    });
  }

  return { fileItems, deletedFileUris };
}

export async function showCopyResultNotification(
  deps: EditorToLlmModulePrivateHelpersDependencies,
  args: ShowCopyResultNotificationArgs
): Promise<void> {
  const unavailableFilesCount = args.totalFilesCount - args.copiedFilesCount;

  const overrideOptions = deps.configService.overrideOptions;
  const hasProfiles = overrideOptions.length > 0;

  const openPromptInEditor = 'Open Prompt in Editor';
  const eraseInstructions = 'Erase Instructions';

  let selectedProfileIds: string[] = [];
  let currentPromptText = args.promptText;
  let isTechPromptErased = false;

  while (true) {
    const effectiveConfig = await deps.configService.getMergedConfigByOverrideIds(selectedProfileIds);

    const promptStatsResult = buildTextSizeStats({
      promptText: currentPromptText,
      contextConfig: effectiveConfig.coreSettings.ideToLlmContextConfig,
    });

    const shouldShowPromptSizeStats =
      effectiveConfig.coreSettings.ideToLlmContextConfig.skipPromptSizeStatsInCopyNotification !== true;

    const baseMessage =
      unavailableFilesCount === 0
        ? `Copied ${args.copiedFilesCount} file(s)`
        : `Copied ${args.copiedFilesCount}/${args.totalFilesCount} available file(s)`;

    const promptSizeStatsSuffix = shouldShowPromptSizeStats ? buildPromptSizeStatsSuffix(promptStatsResult) : '';

    const message = promptSizeStatsSuffix ? `${baseMessage} | ${promptSizeStatsSuffix}` : baseMessage;

    const shouldWarn = shouldShowPromptSizeStats ? Boolean(promptStatsResult.isExceeded) : false;

    const hasNoSelectedProfiles = selectedProfileIds.length === 0;

    const applyOrChangeProfilesLabel = hasNoSelectedProfiles ? 'Apply Profiles' : 'Change Profiles';

    const actionLabels = [
      openPromptInEditor,
      ...(isTechPromptErased ? [] : [eraseInstructions]),
      ...(hasProfiles ? [applyOrChangeProfilesLabel] : []),
    ];

    let selectedAction: string | undefined;

    if (actionLabels.length > 0) {
      if (shouldWarn) selectedAction = await vscode.window.showWarningMessage(message, ...actionLabels);
      else selectedAction = await vscode.window.showInformationMessage(message, ...actionLabels);
    } else {
      if (shouldWarn) selectedAction = await vscode.window.showWarningMessage(message);
      else selectedAction = await vscode.window.showInformationMessage(message);
    }

    if (!selectedAction) return;

    if (selectedAction === openPromptInEditor) {
      await openPromptTextInEditor(deps.extensionContext, currentPromptText);
      return;
    }

    if (selectedAction === eraseInstructions) {
      isTechPromptErased = true;

      const rebuiltPrompt = await buildLlmPromptTextForProfiles({
        extensionContext: deps.extensionContext,
        configService: deps.configService,
        profileIds: selectedProfileIds,
        includeTechPromptFromCommand: args.includeTechPrompt,
        fileItems: args.fileItems,
        forceSkipTechPrompt: true,
      });

      currentPromptText = rebuiltPrompt;

      await vscode.env.clipboard.writeText(currentPromptText);

      continue;
    }

    if (selectedAction === applyOrChangeProfilesLabel) {
      const nextPickResult = await pickProfileIds({ overrideOptions, selectedProfileIds });
      if (!nextPickResult) return;

      selectedProfileIds = nextPickResult.profileIds;

      const rebuiltPrompt = await buildLlmPromptTextForProfiles({
        extensionContext: deps.extensionContext,
        configService: deps.configService,
        profileIds: selectedProfileIds,
        includeTechPromptFromCommand: args.includeTechPrompt,
        fileItems: args.fileItems,
        forceSkipTechPrompt: isTechPromptErased,
      });

      currentPromptText = rebuiltPrompt;

      await vscode.env.clipboard.writeText(currentPromptText);

      if (nextPickResult.shouldAdditionallyOpenMergedConfigInEditor) {
        await new ConfigStateReportBuilder({
          extensionContext: deps.extensionContext,
          configService: deps.configService,
          activeOverrideIds: selectedProfileIds,
        }).displayOverridesAppliedReport(selectedProfileIds);
      }

      continue;
    }
  }
}

async function tryReadFileAsText(
  uri: vscode.Uri
): Promise<{ text: string | null; languageId?: string; readError?: string; isFileNotFound: boolean }> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);

    return { text: document.getText(), languageId: document.languageId, isFileNotFound: false };
  } catch (error) {
    const message = String(error);

    return { text: null, readError: message, isFileNotFound: isFileNotFoundError(error) };
  }
}

function isFileNotFoundError(error: unknown): boolean {
  const anyError = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = String(anyError?.code ?? '');
  if (code === 'FileNotFound') return true;

  const message = String(anyError?.message ?? error ?? '');

  if (message.includes('FileNotFound')) return true;
  if (message.includes('ENOENT')) return true;
  if (message.includes('no such file or directory')) return true;

  const name = String(anyError?.name ?? '');
  if (name.includes('FileNotFound')) return true;

  return false;
}

interface ApplyProfileQuickPickItem extends vscode.QuickPickItem {
  profileId?: string;
  isAdditionallyOpenMergedConfigInEditorOption?: boolean;
}

interface PickProfileIdsResult {
  profileIds: string[];
  shouldAdditionallyOpenMergedConfigInEditor: boolean;
}

async function pickProfileIds(args: {
  overrideOptions: OverrideOptionMetadata[];
  selectedProfileIds: string[];
}): Promise<PickProfileIdsResult | null> {
  const selectedProfileIdsSet = new Set(args.selectedProfileIds);

  const items: ApplyProfileQuickPickItem[] = [
    {
      isAdditionallyOpenMergedConfigInEditorOption: true,
      label: '[DEBUG OPTION] Afterwards open merged config in Editor',
      detail: 'Profiles are merged into base settings (order matters: last wins)',
      picked: false,
    },
  ];

  for (const overrideOption of args.overrideOptions) {
    const descriptionSuffix = overrideOption.description ? `${overrideOption.description}` : '';
    const version = overrideOption.version ? `v${overrideOption.version}: ` : '';

    items.push({
      profileId: overrideOption.id,
      label: overrideOption.id,
      detail: `${version}${descriptionSuffix}`,
      picked: selectedProfileIdsSet.has(overrideOption.id),
    });
  }

  const selectedItems = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select profiles to merge and apply to prompt (empty selection = base only)',
    canPickMany: true,
  });

  if (!selectedItems) return null;

  const shouldAdditionallyOpenMergedConfigInEditor = selectedItems.some(
    selectedItem => selectedItem.isAdditionallyOpenMergedConfigInEditorOption === true
  );

  const profileIds = selectedItems
    .map(selectedItem => selectedItem.profileId)
    .filter((profileId): profileId is string => Boolean(profileId));

  return { profileIds, shouldAdditionallyOpenMergedConfigInEditor };
}

async function buildLlmPromptTextForProfiles(args: {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  profileIds: string[];
  includeTechPromptFromCommand: boolean;
  fileItems: CollectedFileItem[];
  forceSkipTechPrompt?: boolean;
}): Promise<string> {
  const effectiveConfig = await args.configService.getMergedConfigByOverrideIds(args.profileIds);

  const shouldIncludeTechPrompt =
    args.includeTechPromptFromCommand &&
    args.forceSkipTechPrompt !== true &&
    effectiveConfig.coreSettings.skipInstructions !== true;

  const effectiveFileItems = effectiveConfig.coreSettings.skipCodeListings === true ? [] : args.fileItems;

  const techPromptText = shouldIncludeTechPrompt
    ? await new PromptBuilder(args.extensionContext, effectiveConfig).build()
    : '';

  return buildLlmContextText({
    fileItems: effectiveFileItems,
    ignorePromptInstructions: !shouldIncludeTechPrompt,
    config: effectiveConfig,
    techPromptText,
  });
}

async function openPromptTextInEditor(extensionContext: vscode.ExtensionContext, promptText: string): Promise<void> {
  await ensureReadonlyVirtualMarkdownDocOpened({ extensionContext, docId: 'prompt', markdownText: promptText });
}
