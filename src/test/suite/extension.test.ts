import { suite, test } from 'mocha';
import assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('VS Code API is available', () => {
    assert.ok(vscode.workspace);
  });
});
