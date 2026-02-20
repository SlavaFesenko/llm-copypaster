LLM Copypaster extension: quick start (Dev Host)

1. Launch the extension

- In the extension project VS Code window press F5
- A new window opens: Extension Development Host
- That Dev Host window is the one where your extension actually runs

2. Open your extension logs

- In Dev Host open: View -> Output
- In the Output dropdown pick: LLM Copypaster
- You should see "Extension activated" after your extension loads

3. Run LlmToEditor commands manually

- In Dev Host open Command Palette: Ctrl+Shift+P
- Type: LLM Copypaster
- Use:
  - LLM Copypaster: Apply Clipboard to Files
  - LLM Copypaster: Validate Clipboard Payload
  - LLM Copypaster: Sanitize Clipboard Payload

4. Keyboard shortcuts

- The default keybindings in this repo:
  - Apply Clipboard to Files: Alt+1
  - Validate Clipboard Payload: Alt+2

- You can override them in Dev Host:
  - File -> Preferences -> Keyboard Shortcuts
  - Search by command name: Apply Clipboard to Files
  - Change the binding there

5. Debugging tips (minimal)

- Set breakpoints in src/llm-to-editor/llm-to-editor-module.ts
- Ensure the extension is built (compile) and source maps are enabled by the default VS Code extension template
- In Dev Host: Help -> Toggle Developer Tools to see extension host console logs
- In the original VS Code window: Debug Console shows extension host debug output while you run commands in Dev Host
