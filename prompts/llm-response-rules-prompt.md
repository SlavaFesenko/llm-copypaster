# OUTPUT INSTRUCTIONS (strict)

- The prohibitions below apply to the MODEL OUTPUT (output), not to the text of these instructions
- First comes the `EXPLANATIONS BLOCK`
- After the `EXPLANATIONS BLOCK` — ONLY `FILE LISTING`, if the user request clearly implies the need to change any file from the input listings or to add/delete a file
- If fulfilling the user request does NOT require changing the input files (and does not require adding/deleting files) — output only the `EXPLANATIONS BLOCK`

## `EXPLANATIONS BLOCK` FORMAT (goes first):

- Conceptual solution to the task (including the answer to the user’s question): 1–5 short sentences
- If there are edited/added/deleted files: for each — `only_filename.ext + what was edited and why` (very briefly)
- If `web-git-prompt` is provided in the same request, include its required web access log in this `EXPLANATIONS BLOCK` (use the format defined by `web-git-prompt`)
- Markdown is allowed inside the `EXPLANATIONS BLOCK` (including markdown links) if it improves readability
- Emojis are allowed inside the `EXPLANATIONS BLOCK` only, and only from this fixed set:
  - File status: ✏️ edited, ➕ created, ➖ deleted
  - Web access status: 🌐 opened, ❌ failed, ⛔ blocked

## `FILE LISTING` FORMAT (for each edited/added file):

- First line strictly: `{{codeListingHeaderStartFragment}}relative/path.ext` — no colons, no suffixes, no extra spaces/tabs
- Second line strictly one of: {{fileStatusPrefix}}{{filePayloadOperationTypeEditedFull}}, {{fileStatusPrefix}}{{filePayloadOperationTypeCreated}}, {{fileStatusPrefix}}{{filePayloadOperationTypeDeleted}}
- Immediately after — the full file content as raw text, or in case of a deleted file — do not output any content at all (immediately the next header or end of output)

## WHICH FILES TO OUTPUT:

- Edited (even if user sent an empty file - it's treated as edited): {{filePayloadOperationTypeEditedFull}}
- Created (file treated as created only if user didn't sent it in request): {{filePayloadOperationTypeCreated}}
- Deleted: {{filePayloadOperationTypeDeleted}}

## IT IS FORBIDDEN TO OUTPUT unchanged files!

## PROHIBITIONS OUTSIDE FILE CONTENTS:

- No markdown, lists, headings, tables, links, separators (triple-hyphen / triple-asterisk), empty “separator” blocks outside the `EXPLANATIONS BLOCK` and file contents
- No extra text except: (a) the `EXPLANATIONS BLOCK` at the beginning, (b) `FILE LISTING`

## EXAMPLE (when you NEED to modify files):

Conceptual solution:
Update the greeting output, remove an obsolete file, and add a new file for the new greeting entry point.

Files changed:
✏️ `index.ts` — updated the console output message;
➖ `dont-need-anymore.ts` — deleted because it’s no longer used;
➕ `created-file` — created to provide an additional greeting output.

Web access log:
🌐 Opened: [package.json](https://github.com/SlavaFesenko/llm-copypaster/blob/master/package.json) — confirm existing commands
❌ Failed: [missing.ts](https://github.com/SlavaFesenko/llm-copypaster/blob/master/src/missing.ts) — 404 Not Found, needed to confirm referenced import

{{codeListingHeaderStartFragment}}src/index.ts
{{fileStatusPrefix}}{{filePayloadOperationTypeEditedFull}}

console.log('Hello world!');

{{codeListingHeaderStartFragment}}src/dont-need-anymore.ts
{{fileStatusPrefix}}{{filePayloadOperationTypeDeleted}}

{{codeListingHeaderStartFragment}}src/subnode/created-file
{{fileStatusPrefix}}{{filePayloadOperationTypeCreated}}

console.log('Hello world from new file!');
