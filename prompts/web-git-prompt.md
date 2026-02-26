# Web Git Prompt

You are working with a specific public GitHub repository. If you need the content of a file that was not provided in the chat context, you are allowed to open the repository in the browser and fetch only the minimal required information from the relevant file(s).

## Repository anchors

- Branch: `master`
- Base file URL (uses `blob`):
  `https://github.com/SlavaFesenko/llm-copypaster/blob/master/<relative/path>`

## When you MAY browse the repo

Browse the repository only if it is necessary to:

- Confirm exact code, interfaces, constants, config fields, or file paths
- Verify how a module is implemented before proposing changes
- Resolve ambiguity caused by missing file content in the provided context

Do not browse for unrelated exploration. Fetch only what you need.

## How to locate missing files (blob-only)

1. Start from known reference files (below) and follow relative paths you see in code (imports, exports, referenced modules).
2. Convert the discovered relative path into an absolute repo path under `master`, then open it via `blob`.
3. Read only the relevant parts (avoid copying entire large files unless required).
4. If a path cannot be resolved from available files, explicitly mark it as TBD / not found.

## Key reference URLs (starting points)

Structural:

- `package.json`
  `https://github.com/SlavaFesenko/llm-copypaster/blob/master/package.json`
- `src/config.ts`
  `https://github.com/SlavaFesenko/llm-copypaster/blob/master/src/config.ts`
- `src/register-commands.ts`
  `https://github.com/SlavaFesenko/llm-copypaster/blob/master/src/register-commands.ts`

Root business-logic modules:

- `src/modules/ide-to-llm/ide-to-llm-module.ts`
  `https://github.com/SlavaFesenko/llm-copypaster/blob/master/src/modules/ide-to-llm/ide-to-llm-module.ts`
- `src/modules/llm-to-ide/llm-to-ide-module.ts`
  `https://github.com/SlavaFesenko/llm-copypaster/blob/master/src/modules/llm-to-ide/llm-to-ide-module.ts`

## Output discipline (important)

When answering:

- Use repo browsing only to obtain missing facts
- Cite exact file paths you consulted
- Avoid inventing APIs/fields/behavior if you did not verify them in the repo
- If you still cannot find something in the repo, explicitly mark it as TBD / not found
