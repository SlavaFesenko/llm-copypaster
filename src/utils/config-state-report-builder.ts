import * as vscode from 'vscode';

import { ConfigService, MergedConfigDebugData } from '../config-service';
import { buildLsConfigReportText } from './config-helpers/reporters/ls-config-reporter';
import { buildOverridesAppliedReportText } from './config-helpers/reporters/overrides-apply-reporter';
import { ensureReadonlyVirtualMarkdownDocOpened } from './editor-virtual-doc-helpers';

export interface ConfigStateReportBuilderArgs {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  activeOverrideIds?: string[];
}

export class ConfigStateReportBuilder {
  public constructor(private readonly _args: ConfigStateReportBuilderArgs) {}

  public async displayLsConfigReport(): Promise<void> {
    const reportText = await buildLsConfigReportText({
      configService: this._args.configService,
      activeOverrideIds: this._args.activeOverrideIds,
    });

    await this._openReportInEditor({ docId: 'full-config', reportText });
  }

  public async displayOverridesAppliedReportFromData(debugData: MergedConfigDebugData): Promise<void> {
    const reportText = await buildOverridesAppliedReportText(debugData);

    await this._openReportInEditor({ docId: 'overrides-config', reportText });
  }

  private async _openReportInEditor(args: { docId: string; reportText: string }): Promise<void> {
    await ensureReadonlyVirtualMarkdownDocOpened({
      extensionContext: this._args.extensionContext,
      docId: args.docId,
      markdownText: args.reportText,
    });
  }
}
