# LLM Copypaster

**For developers who don’t want an AI agent to guess the context.**

LLM Copypaster is a lightweight VS Code extension for developers who want full control over their LLM workflow.

Instead of sending an unknown amount of project context to an AI agent, you explicitly choose which files, folders and project instructions should be included in the prompt. The extension then helps you copy that context to any LLM interface and apply structured responses back into your project.

It works with ChatGPT, Claude, Gemini, local models, raw APIs, or any other LLM tool that can accept text input.

**Bring your own LLM. Keep full control of context.**

TODO: gif/youtube with the basic copy-paste scenario: show `Copy This File` from editor and explorer, then selected folders and files.

## Why use it

Many AI coding tools are great at automating interaction with the model, but they often hide important details: which context was sent, which rules were added, and why the final answer looks the way it does.

LLM Copypaster focuses on a different workflow:

- helps you collect the exact context you need from the IDE
- automatically adds predefined instructions based on your configuration
- lets you reuse the same project-specific rules across different LLM interfaces
- gives the developer explicit control over what goes into the model and what comes back

This is especially useful when repeatability, transparency and project-specific rules matter more than a shiny “Ask AI” button.

## Why not just use Codex, Cursor or Claude Code?

Codex, Cursor, Claude Code and similar tools can be amazing for vibe coding, experiments, prototypes, PoCs and fast exploration.

But on mature projects, legacy systems or large codebases, fully agentic tools can easily produce pseudo-positive results: the generated code may look correct at first glance, but after a deeper review it often requires serious rework. In many cases, the problem is not the model itself, but the context: too much irrelevant code, missing project rules, hidden assumptions or automatically selected files that should not have been part of the prompt.

LLM Copypaster is built for a more explicit workflow.

Instead of asking an AI agent to guess the right context, you decide what should be included. You can keep using your favorite LLM, but with a predictable, transparent and repeatable context-building process.

TODO: add image/gif with a dump truck unloading garbage as a symbol of noisy automatic context collection.

## Core capabilities

### Context collection from IDE

The extension lets you quickly collect context from files and folders directly from VS Code using editor and explorer menu commands.

The basic scenarios include copying the current file, files from the current tab group, selected files or folders, and applying clipboard content back into the project. Other commands are close variations of the same workflow.

### LLM → IDE flow

The extension can take an LLM response from the clipboard and apply it back to project files using the `Paste Clipboard to Files` command.

The full cycle looks like this:

1. Collect context from the IDE
2. Automatically add project instructions
3. Send the prompt to any LLM
4. Receive a response in a predefined structured format
5. Apply the changes back into the project

This approach works well when speed, transparency and control over the exchange format are important.

### Project instructions as part of the flow

The key feature of the extension is not just copying files to the clipboard, but automatically adding project-specific instructions.

This is what makes the workflow genuinely useful:

- the model receives not only code, but also the relevant project rules
- each project can have its own instruction set
- the same extension remains useful across different teams, repositories and LLM tools

## Who it is for

LLM Copypaster is especially useful if you:

- work with raw APIs and want to control the prompt yourself
- use AI wrappers, but want to reduce dependency on their hidden logic
- work on several projects with different instruction sets
- need a simple and repeatable LLM workflow inside VS Code
- want to use personal LLM subscriptions for serious development work
- prefer explicit context over agentic guessing

## Main commands

To get started, you only need a few core commands:

- Editor context menu: `Copy This File` / `Copy Tab Group Files`
- Explorer: `Copy Selected File(s)`
- Ctrl+Alt+V: `Paste Clipboard to Files`

Other similar commands are also available for different context collection scenarios.

TODO: add link to `package.json` on the main branch.

## Workspace config

TODO: show an example `llm-copypaster.json` with simple overrides compared to the system config, and demonstrate how it affects the final generated prompt.

## TBD before Marketplace publish

- publisher id / `ext install ...`
- screenshot / gif
