import * as vscode from 'vscode';

import { ConfigService, MergedConfigDebugData } from '../../../config/config-service';
import { ensureReadonlyVirtualMarkdownDocOpened } from '../../editor-virtual-doc-helpers';
import { buildLsConfigReportText } from './ls-config-reporter';
import { buildOverridesAppliedReportText } from './overrides-apply-reporter';

export interface ConfigReportFacadeArgs {
  extensionContext: vscode.ExtensionContext;
  configService: ConfigService;
  activeOverrideIds?: string[];
}

export class ConfigReportFacade {
  public constructor(private readonly _args: ConfigReportFacadeArgs) {}

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
