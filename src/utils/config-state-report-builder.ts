import { ConfigService, CoreSettingsConfig, OverrideOptionMetadata } from '../config-service';
import { LlmCopypasterUserConfig } from '../contracts/user-config';
import { mergeConfigs } from './config-helpers/config-mergers';
import { readUserJsonConfigFile } from './config-helpers/config-tech-helpers';
import { OutputChannelLogger } from './output-channel-logger';

export interface ConfigStateReportBuilderArgs {
  configService: ConfigService;
  logger: OutputChannelLogger;
}

export class ConfigStateReportBuilder {
  public constructor(private readonly _args: ConfigStateReportBuilderArgs) {}

  public async build(): Promise<string> {
    const systemConfig = await this._args.configService.getSystemConfig();
    const userConfig = await readUserJsonConfigFile<LlmCopypasterUserConfig>(this._args.logger);
    const rawMergedConfig = mergeConfigs(systemConfig, userConfig, { normalizeOverrides: false });
    const basePublicConfig = await this._args.configService.getLlmCopypasterPublicConfig();
    const overrideOptions = this._args.configService.overrideOptions;

    let reportText = '';

    if (userConfig) {
      reportText += '# Config Report\n\n';
      reportText += '## Base Config: sys-config.jsonc + llm-copypaster.jsonc (Normalized Config) \n\n';
      reportText += 'Base Config applied by default (when no override manually selected)\n\n';
      reportText += this._buildJsonCodeBlock(basePublicConfig.coreSettings);

      reportText += '## User Config: llm-copypaster.jsonc (Raw Config Before Normalization)\n\n';
      reportText += this._buildJsonCodeBlock(userConfig.coreSettings);
    } else {
      reportText += '## No User Config was found (llm-copypaster.jsonc)\n\n';
    }

    reportText += '## System Config: sys-config.jsonc (Raw Config Before Normalization)\n\n';
    reportText += this._buildJsonCodeBlock(systemConfig.coreSettings);

    for (const overrideOption of overrideOptions) {
      reportText += await this._buildOverrideSectionMarkdown({
        overrideOption,
        baseCoreSettingsConfig: basePublicConfig.coreSettings,
        rawMergedOverrideCoreSettingsConfig: rawMergedConfig.overridesById?.[overrideOption.id]?.coreSettings ?? null,
      });
    }

    return reportText.trimEnd();
  }

  private async _buildOverrideSectionMarkdown(args: {
    overrideOption: OverrideOptionMetadata;
    baseCoreSettingsConfig: CoreSettingsConfig;
    rawMergedOverrideCoreSettingsConfig: unknown;
  }): Promise<string> {
    const overridePublicConfig = await this._args.configService.getLlmCopypasterPublicConfig(args.overrideOption.id);
    const overrideDiffChangeset = await this._buildJsonDiffChangeset(
      args.baseCoreSettingsConfig,
      overridePublicConfig.coreSettings
    );

    const overrideDiffHumanReadable = this._buildHumanReadableJsonDiffChangeset(overrideDiffChangeset);

    let sectionText = '';

    sectionText += `## Override: ${args.overrideOption.id} (Normalized Config)\n\n`;

    sectionText += '### Override Diffs (Raw Config Before Normalization)\n\n';
    sectionText += this._buildJsonCodeBlock(args.rawMergedOverrideCoreSettingsConfig);

    sectionText += '### Json Diff: Normalized Override vs Base Config\n\n';
    sectionText += this._buildJsonCodeBlock(overrideDiffHumanReadable);

    if (args.overrideOption.description || args.overrideOption.version) {
      const versionPrefix = args.overrideOption.version ? `v${args.overrideOption.version}` : '';
      const descriptionSuffix = args.overrideOption.description ? `${args.overrideOption.description}` : '';
      const detailsText = [versionPrefix, descriptionSuffix].filter(Boolean).join(' — ');

      if (detailsText) sectionText += `${detailsText}\n\n`;
    }

    sectionText += '### Normalized Override\n\n';
    sectionText += this._buildJsonCodeBlock(overridePublicConfig.coreSettings);

    return sectionText;
  }

  private async _buildJsonDiffChangeset(previousValue: unknown, nextValue: unknown): Promise<unknown> {
    const { diff } = await import('json-diff-ts');

    return diff(previousValue, nextValue);
  }

  private _buildJsonCodeBlock(value: unknown): string {
    const tripleTicks = '`' + '``';

    return `${tripleTicks}json\n${JSON.stringify(value, null, 2)}\n${tripleTicks}\n\n`;
  }

  private _buildHumanReadableJsonDiffChangeset(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this._buildHumanReadableJsonDiffChangeset(item));

    if (!value || typeof value !== 'object') return value;

    const anyObject = value as Record<string, unknown>;
    const nextObject: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(anyObject)) {
      if (key === 'type') continue;

      let nextKey = key;

      switch (key) {
        case 'key':
          nextKey = 'fieldOrSectionName';
          break;

        case 'changes':
          nextKey = 'diff';
          break;

        case 'value':
        case 'newValue':
          nextKey = 'nextConfigValue';
          break;

        case 'oldValue':
          nextKey = 'previousConfigValue';
          break;

        default:
          nextKey = key;
          break;
      }

      nextObject[nextKey] = this._buildHumanReadableJsonDiffChangeset(childValue);
    }

    return nextObject;
  }
}
