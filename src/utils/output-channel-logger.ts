
import * as vscode from 'vscode';

export class OutputChannelLogger {
private readonly _channel: vscode.OutputChannel;

public constructor(channelName: string) {
this._channel = vscode.window.createOutputChannel(channelName);
}

public info(message: string): void {
this._channel.appendLine(`[info] ${message}`);
}

public warn(message: string): void {
this._channel.appendLine(`[warn] ${message}`);
}

public debug(message: string): void {
this._channel.appendLine(`[debug] ${message}`);
}
}