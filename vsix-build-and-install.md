LLM Copypaster: build + install local VSIX

# 1) In `package.json` increase `"version"` (semantic versioning), e.g. `0.0.1` -> `0.0.2`

# 2) npx vsce package -o Compiled/llm-copypaster-0.10.0.vsix

# 3) code --install-extension ./Compiled/llm-copypaster-0.10.0.vsix

      Known Issue: if instead of installing it just open new window - do UI-install: Extension Tab -> ... > Install from .VSIX

# 4) Ctrl + Shift + P: `Developer: Reload Window`
