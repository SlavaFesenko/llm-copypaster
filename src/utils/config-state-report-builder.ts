import { ConfigService, CoreSettingsConfig, OverrideOptionMetadata } from '../config-service';
import { LlmCopypasterUserConfig } from '../contracts/user-config';
import { GLOB_CONSTS } from '../global-constants';
import { mergeConfigs } from './config-helpers/config-mergers';
import { readUserJsonConfigFile } from './config-helpers/config-tech-helpers';
import { OutputChannelLogger } from './output-channel-logger';

const NORMALIZED_CONFIG_STATUS = '[NORMALIZED CONFIG]';
const RAW_CONFIG_BEFORE_NORMALIZATION_STATUS = '[RAW CONFIG BEFORE NORMALIZATION]';
const JSON_DIFF_STATUS = '[JSON DIFF]';

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
      reportText += `## ${NORMALIZED_CONFIG_STATUS} Base Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME} + ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}\n\n`;
      reportText += 'Base Config is applied by default (when no override manually selected)\n\n';
      reportText += this._buildJsonCodeBlock(basePublicConfig.coreSettings);

      reportText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} User Config: ${GLOB_CONSTS.USER_CONFIG_FILE_NAME}\n\n`;
      reportText += this._buildJsonCodeBlock(userConfig.coreSettings);
    } else {
      reportText += `## No User Config was found (${GLOB_CONSTS.USER_CONFIG_FILE_NAME})\n\n`;
    }

    reportText += `## ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} System Config: ${GLOB_CONSTS.SYS_CONFIG_FILE_NAME}\n\n`;
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

    sectionText += `## ${NORMALIZED_CONFIG_STATUS} Override: ${args.overrideOption.id}\n\n`;

    sectionText += `### ${RAW_CONFIG_BEFORE_NORMALIZATION_STATUS} Override Diffs\n\n`;
    sectionText += this._buildJsonCodeBlock(args.rawMergedOverrideCoreSettingsConfig);

    sectionText += `### ${JSON_DIFF_STATUS} Normalized Override vs Base Config\n\n`;
    sectionText += this._buildJsonCodeBlock(overrideDiffHumanReadable);

    if (args.overrideOption.description || args.overrideOption.version) {
      const versionPrefix = args.overrideOption.version ? `v${args.overrideOption.version}` : '';
      const descriptionSuffix = args.overrideOption.description ? `${args.overrideOption.description}` : '';
      const detailsText = [versionPrefix, descriptionSuffix].filter(Boolean).join(' — ');

      if (detailsText) sectionText += `${detailsText}\n\n`;
    }

    sectionText += `### ${NORMALIZED_CONFIG_STATUS} Override\n\n`;
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
