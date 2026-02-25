LLM Copypaster: build + install local VSIX

# 1) In `package.json` increase `"version"` (semantic versioning), e.g. `0.0.1` -> `0.0.2`

# 2) npx vsce package -o Compiled/llm-copypaster-0.3.0.vsix

# 3) code --install-extension ./Compiled/llm-copypaster-0.3.0.vsix

# 4) Reload the window (`Developer: Reload Window`)
