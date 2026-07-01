# LLM Copypaster

**Lightweight extension for developers who don’t want an AI agent to guess the context.**

Instead of sending an unknown amount of project context to an AI agent, you explicitly choose which files, folders and project instructions should be included in the prompt. The extension then helps you copy that context to any LLM interface and apply structured responses back into your project.

![`LLM Copypaster` control flow](resources/images/control_flow.png)

It works with ChatGPT, Claude, Gemini, local models, raw APIs, or any other LLM tool that can accept text input.

## Why not just use Codex, Cursor or Claude Code?

Codex, Cursor, Claude Code and similar tools can be amazing for projects with low to medium codebase complexity, vibe coding, experiments, prototypes, PoCs and fast exploration.

But on mature projects, legacy systems or large codebases, fully agentic tools can easily produce pseudo-positive results: the generated code may look correct at first glance, but after a deeper review it often requires serious rework. In many cases, the problem is not the model itself, but the context: too much irrelevant code, missing project rules, hidden assumptions or automatically selected files that should not have been part of the prompt.

![Noisy automatic context collection](resources/images/auto_context_collection.png)

**`LLM Copypaster` is built for a more explicit workflow.**

Instead of asking an AI agent to guess the right context, you decide what should be included. You can keep using your favorite LLM, but with a predictable, transparent and repeatable context-building process.

![Explicit context collection with `LLM Copypaster`](resources/images/explicit_context_collection.png)

## Core capabilities

TODO: gif/youtube with the basic copy-paste scenario: show `Copy This File` from editor and explorer, then selected folders and files.

### IDE ←→ LLM Flow

The extension lets you quickly collect context from files and folders directly from VS Code using editor and explorer menu commands.

The basic scenarios include copying the current file, files from the current tab group, selected files or folders, and applying clipboard content back into the project. Other commands are close variations of the same workflow.

The extension can take an LLM response from the clipboard and apply it back to project files using the `Paste Clipboard to Files` command.

### Highly Extensible Config

TODO: show an example `llm-copypaster.json` with simple overrides compared to the system config, and demonstrate how it affects the final generated prompt.

### Liquid Instructions (aka Commands/Skills)

The key feature of the extension is not just copying files to the clipboard, but automatically adding project-specific instructions.

This is what makes the workflow genuinely useful:

- the model receives not only code, but also the relevant project rules
- each project can have its own instruction set
- the same extension remains useful across different teams, repositories and LLM tools
