# llm-copypaster

VS Code extension that turns the “Editor ↔ LLM” loop into a predictable pipeline: copy code context as concatenated **file listings**, then take the LLM’s output from the clipboard, **validate → sanitize → apply** it back to your workspace (with guided retry direction and future output strategies).

## Why

If you’re already using:

- **collinc777.context-copy** to copy context
- **RonPark.paste-clipboard-to-files** to paste listings back into files

…this project aims to evolve that into a single configurable, robust workflow: fewer manual fixes, fewer “LLM junk” failures, more control over formats and rules.

## Core workflow

1. Editor → LLM (context)

- Collect files from VS Code (active file / open tabs / tab group / selected in Explorer)
- Deduplicate by workspace-relative path
- Output as concatenated file listings
- Optionally add a “response format prompt” that forces a strict, parseable reply format

2. LLM → Editor (apply)

- Read raw LLM output from clipboard
- Validate it into a structured “files payload”
- Sanitize: strip fences, remove wrapper text, fix common artifacts
- Apply changes through VS Code API (create/update; “delete” is baseline-defined as “mark for deletion”, exact policy is configurable / TBD)

## Features

### Clipboard payload validation

Recognizes typical “LLM listing” shapes (path headers + content, fenced blocks, multiple header variants), and reports parse errors clearly.

### Sanitization rules (regex) with exclusions

Sanitization is rule-based and ordered, and each rule can be disabled for:

- specific languages
- specific paths / path patterns

### Reliability-first behavior

Designed to avoid “all-or-nothing” where possible:

- tolerate missing/unreadable files (degrade instead of crashing)
- handle duplicates across tab groups via dedupe
- support partial success (apply what’s good, guide retry on what failed)

### Response strategies (formats)

Baseline is **full-output** (LLM returns full file contents). Future direction: replace-blocks (patch-ish, not git diff).

## Output formats

There are two important formats in the baseline spec: one for “context you send to the LLM”, and one for “response you want back”.

### 1) LLM context format (Editor → LLM)

Baseline context format is a concatenation of per-file fenced listings, each containing a path marker and then the raw file content.

Conceptual example:

```ts
// # src/app/app.component.ts
// (file content here)
```

(Exact language tag behavior is configurable.)

### 2) LLM response format (LLM → Editor)

The extension can optionally add a “response format prompt” so the LLM replies in a strict format. One supported direction is an **extension-response protocol**: a raw concatenation of file listings with headers of the form:

- `# relative/path.ext`
- followed immediately by the full file content

This is intentionally boring and strict, because it’s robust and easy to validate/sanitize/apply.

## Commands

Planned / baseline command set (names may evolve, concepts are stable):

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

## Configuration

This project targets:

- VS Code settings (short/simple knobs)
- plus a workspace config file for larger configs and prompts:
  - `.llm-copypaster.json`

Config areas include:

- sanitization rule list (regex + exclusions)
- response prompt templates
- behavior toggles for error handling / partial apply
- future: per-LLM overrides (different prompts/rules per selected LLM)

## Compatibility / integration

You can adopt this incrementally:

- Use llm-copypaster for validation + sanitization first
- Keep using RonPark / context-copy temporarily
- Gradually replace both with native modules (EditorToLlm + Files Patcher)

## Known limitations (baseline)

- “Delete” is baseline-described as “mark for deletion”; the concrete policy (hard delete vs marker vs move) is TBD / config-defined
- Guided retry is a core direction; early iterations may store limited context compared to the full envisioned flow

## Roadmap

1. Validation + Sanitization
2. Ship and run in a mixed pipeline with existing extensions
3. Implement native “apply via VS Code API”
4. Implement native “copy context with response prompt”
5. Add replace-blocks strategy + stronger guided retry and session/history store

## Contributing

If you want to contribute, align changes with the BL doc (baseline spec): modules, formats, invariants, and UX expectations should remain consistent.

## License

Apache License 2.0 (Apache-2.0)

See:

- LICENSE
- NOTICE

Copyright 2026 Viacheslav Fesenko
