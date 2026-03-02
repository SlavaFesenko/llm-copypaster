import * as vscode from 'vscode';

import { LlmCopypasterConfig, ProfileSettingsConfig } from '../../../config-service';
import { CollectedFileItem } from '../../../types/files-payload';
import { buildLlmContextText } from '../utils/llm-context-formatter';
import { buildPromptWithSizeStats } from '../utils/prompt-size-helper';
import { LLM_RESPONSE_RULES_PROMPT_ID, TechPromptBuilder, WEB_GIT_PROMPT_ID } from '../utils/tech-prompt-builder';
import {
  PromptWorkbenchOutlineModel,
  PromptWorkbenchProfileItemModel,
  PromptWorkbenchStateModel,
} from './prompt-workbench.types';

export interface BuildWorkbenchStateArgs {
  extensionContext: vscode.ExtensionContext;
  config: LlmCopypasterConfig;
  lastCopiedContext: { includeTechPrompt: boolean; fileItems: CollectedFileItem[]; commandName: string } | null;
  selectedProfileId: string | null;
  isInstructionsErased: boolean;
  isCodeListingsErased: boolean;
}

export interface RebuildWorkbenchPromptResult {
  promptText: string;
  state: PromptWorkbenchStateModel;
}

export async function buildWorkbenchState(args: BuildWorkbenchStateArgs): Promise<PromptWorkbenchStateModel> {
  const profiles: PromptWorkbenchProfileItemModel[] = buildProfiles(args.config);

  if (!args.lastCopiedContext) {
    return {
      isReady: true,
      isEmpty: true,
      profiles,
      selectedProfileId: args.selectedProfileId,
      isInstructionsErased: args.isInstructionsErased,
      isCodeListingsErased: args.isCodeListingsErased,
      canEraseInstructions: false,
      canEraseCodeListings: false,
      outline: { instructionSections: [], filePaths: [] },
    };
  }

  const configForPrompt = tryBuildConfigForProfile(args.config, args.selectedProfileId);

  const canEraseInstructions =
    args.lastCopiedContext.includeTechPrompt && configForPrompt.baseSettings.skipTechPrompt !== true;
  const canEraseCodeListings =
    configForPrompt.baseSettings.skipCodeListings !== true && args.lastCopiedContext.fileItems.length > 0;

  const includeTechPrompt =
    args.lastCopiedContext.includeTechPrompt &&
    !args.isInstructionsErased &&
    configForPrompt.baseSettings.skipTechPrompt !== true;
  const includeCodeListings = !args.isCodeListingsErased && configForPrompt.baseSettings.skipCodeListings !== true;

  const outline = buildOutline(configForPrompt, {
    includeTechPrompt,
    includeCodeListings,
    fileItems: args.lastCopiedContext.fileItems,
  });

  const promptText = await buildPromptText(args.extensionContext, configForPrompt, {
    includeTechPrompt,
    includeCodeListings,
    fileItems: args.lastCopiedContext.fileItems,
  });

  const promptStats = buildPromptWithSizeStats({ promptText, config: configForPrompt });

  return {
    isReady: true,
    isEmpty: false,
    lastCommandName: args.lastCopiedContext.commandName,
    profiles,
    selectedProfileId: args.selectedProfileId,
    isInstructionsErased: args.isInstructionsErased,
    isCodeListingsErased: args.isCodeListingsErased,
    canEraseInstructions,
    canEraseCodeListings,
    outline,
    stats: {
      linesCount: promptStats.linesCount,
      approxTokensCount: promptStats.approxTokensCount,
      maxLinesCountInContext: promptStats.maxLinesCountInContext,
      maxTokensCountInContext: promptStats.maxTokensCountInContext,
      isExceeded: promptStats.isExceeded,
      exceededBy: promptStats.exceededBy.map(x => String(x)),
    },
  };
}

export async function rebuildPromptAndState(args: BuildWorkbenchStateArgs): Promise<RebuildWorkbenchPromptResult> {
  const state = await buildWorkbenchState(args);

  if (state.isEmpty) return { promptText: '', state };

  const configForPrompt = tryBuildConfigForProfile(args.config, args.selectedProfileId);

  const includeTechPrompt =
    Boolean(args.lastCopiedContext?.includeTechPrompt) &&
    !args.isInstructionsErased &&
    configForPrompt.baseSettings.skipTechPrompt !== true;

  const includeCodeListings =
    Boolean(args.lastCopiedContext?.fileItems.length) &&
    !args.isCodeListingsErased &&
    configForPrompt.baseSettings.skipCodeListings !== true;

  const promptText = await buildPromptText(args.extensionContext, configForPrompt, {
    includeTechPrompt,
    includeCodeListings,
    fileItems: args.lastCopiedContext?.fileItems ?? [],
  });

  return { promptText, state };
}

function buildProfiles(config: LlmCopypasterConfig): PromptWorkbenchProfileItemModel[] {
  const profilesById = config.profilesById ?? {};
  const profileIds = Object.keys(profilesById);

  const items: PromptWorkbenchProfileItemModel[] = [{ id: null, description: 'Default profile' }];

  for (const profileId of profileIds) {
    const profile = profilesById[profileId];
    if (!profile) continue;

    items.push({
      id: profileId,
      description: profile.description,
      version: profile.version,
    });
  }

  return items;
}

async function buildPromptText(
  extensionContext: vscode.ExtensionContext,
  configForPrompt: LlmCopypasterConfig,
  args: { includeTechPrompt: boolean; includeCodeListings: boolean; fileItems: CollectedFileItem[] }
): Promise<string> {
  const techPromptText = args.includeTechPrompt
    ? await new TechPromptBuilder(extensionContext, configForPrompt).build()
    : '';

  const fileItems = args.includeCodeListings ? args.fileItems : [];

  return buildLlmContextText({
    fileItems,
    includeTechPrompt: args.includeTechPrompt,
    config: configForPrompt,
    techPromptText,
  });
}

function buildOutline(
  configForPrompt: LlmCopypasterConfig,
  args: { includeTechPrompt: boolean; includeCodeListings: boolean; fileItems: CollectedFileItem[] }
): PromptWorkbenchOutlineModel {
  const instructionSections: string[] = [];

  if (args.includeTechPrompt) {
    const subInstructionsById = configForPrompt.baseSettings.promptInstructionConfig.subInstructionsById ?? {};
    const responseRulesCfg = subInstructionsById[LLM_RESPONSE_RULES_PROMPT_ID];
    if (responseRulesCfg && responseRulesCfg.ignore !== true) instructionSections.push('Response Format Instruction');

    const webGitCfg = subInstructionsById[WEB_GIT_PROMPT_ID];
    if (webGitCfg && webGitCfg.ignore !== true) instructionSections.push('Web Git Instruction');
  }

  const filePaths = args.includeCodeListings ? args.fileItems.map(x => x.path) : [];

  return { instructionSections, filePaths };
}

function tryBuildConfigForProfile(config: LlmCopypasterConfig, selectedProfileId: string | null): LlmCopypasterConfig {
  if (!selectedProfileId) return config;

  const profilesById = config.profilesById ?? {};
  const profile = profilesById[selectedProfileId];

  if (!profile) return config;

  const profileSettingsConfig = profile.profileSettingsConfig as ProfileSettingsConfig | undefined;
  if (!profileSettingsConfig) return config;

  const mergedBaseSettings: ProfileSettingsConfig = { ...config.baseSettings, ...profileSettingsConfig };

  return { ...config, baseSettings: mergedBaseSettings };
}
