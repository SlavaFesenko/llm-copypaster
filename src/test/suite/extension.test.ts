// ! DO NOT remove this test it's vital for all other tests.

// not sure why, but to make tests displayed in UI, this "import { suite, test } from 'mocha';" should be placed in ONE file
// but this exact file will be invisible for "UI Test Runner" extension for some magic reason.
// Tried a couple of workarounds, but all them failed, this is the only stable way, at least for local test run.

// IT'S EXPECTED and acceptable that the exact test above won't be displayed in the "UI Test Runner" extension, but CLI still treats it.

import { suite, test } from 'mocha';
import assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('VS Code API is available', () => {
    assert.ok(vscode.workspace);
  });
});
