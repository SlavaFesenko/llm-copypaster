# llm-copypaster

VS Code extension that turns the “Editor ↔ LLM” loop into a predictable pipeline: copy code context as **file listings**, then take the LLM’s output from the clipboard, **validate → sanitize → apply** it back to your workspace (with room for guided retry and future patch-like strategies).

## Why

If you’re already using:

- **collinc777.context-copy** to copy context
- **RonPark.paste-clipboard-to-files** to paste listings back into files

…this project aims to evolve that into a single configurable, robust workflow: fewer manual fixes, fewer “LLM junk” failures, more control over formats and rules.

## Core workflow

1. **Editor → LLM (context)**

- Collect files from VS Code (active file / open tabs / tab group / selected in Explorer)
- Deduplicate by workspace-relative path
- Output as concatenated file listings (optionally with a “response format prompt”)

2. **LLM → Editor (apply)**

- Read raw LLM output from clipboard
- **Validate** it into a structured “files payload”
- **Sanitize**: strip fences, remove wrapper text, fix common artifacts
- **Apply** changes through VS Code API (create/update; “delete” can be a marker strategy in baseline)

## Features

### Clipboard payload validation

Recognizes typical “LLM listing” shapes (headers + content, fenced blocks, multiple header variants), and reports parse errors clearly.

### Sanitization rules (regex) with exclusions

Sanitization is rule-based, ordered, and each rule can be disabled for:

- specific languages
- specific paths / path patterns

### Reliability-first behavior

Designed to avoid “all-or-nothing” where possible:

- tolerate missing/unreadable files (degrade instead of crashing)
- handle duplicates across tab groups via dedupe
- support partial success (apply what’s good, guide retry on what failed)

### Response strategies (formats)

Baseline strategy is **full-output**: LLM returns full file contents as concatenated listings (easy to parse and apply). Future: replace-blocks (patch-ish, not git diff).

## Commands

Planned / baseline command set (names may evolve, but the concepts are stable):

- Copy context:
  - Copy Active File as LLM Context
  - Copy All Open Files as LLM Context
  - Copy Tab Group Files as LLM Context
  - Copy Selected Explorer Files as LLM Context
  - Copy LLM Context (with / without Response Format Prompt)

- Apply from LLM:
  - Apply Clipboard to Files
  - Validate Clipboard Payload
  - Sanitize Clipboard Payload
  - Copy Guided Retry Prompt (Last Error)

## Output formats (what the LLM should return)

### Baseline: full file listings

The LLM should return a raw concatenation of file listings where each file begins with a path header and then the full content.

Example (conceptual):

- `# relative/path.ext`
- followed by the full file content

This is the “most boring” format — and that’s the point: it’s robust.

## Configuration

This project targets:

- VS Code settings (short/simple knobs)
- plus a workspace config file (for longer prompts / large rule sets), e.g.:
  - `.llm-copypaster.json`

Config areas include:

- sanitization rule list (regex + exclusions)
- response prompt templates
- behavior toggles for error handling / partial apply
- future: per-LLM overrides (different prompts/rules per selected LLM)

## Compatibility / integration

You can adopt this incrementally:

- Use llm-copypaster for **validation + sanitization** first
- Keep using RonPark / context-copy temporarily
- Gradually replace both with native modules (EditorToLlm + Files Patcher)

## Known limitations (baseline)

- “Delete” is not necessarily a hard delete in baseline; it can be implemented as a marker/comment or “move to trash folder”, depending on config/iteration.
- Guided retry is a core direction; early iterations may store limited context compared to the full envisioned flow.

## Roadmap

1. Validation + Sanitization
2. Ship and run in a mixed pipeline with existing extensions
3. Implement native “apply via VS Code API”
4. Implement native “copy context with response prompt”
5. Add replace-blocks strategy + stronger guided retry and session/history store

## Contributing

If you want to contribute, align changes with the project BL doc (baseline spec): modules, formats, invariants, and UX expectations should remain consistent.
