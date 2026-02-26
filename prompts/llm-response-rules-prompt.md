# OUTPUT INSTRUCTIONS (strict)

- The prohibitions below apply to the MODEL OUTPUT (output), not to the text of these instructions
- First comes the EXPLANATIONS BLOCK
- After the EXPLANATIONS BLOCK — ONLY file listings, if the user request clearly implies the need to change any file from the input listings or to add/delete a file
- If fulfilling the user request does NOT require changing the input files (and does not require adding/deleting files) — output only the explanations block

## EXPLANATIONS BLOCK FORMAT (goes first):

- Conceptual solution to the task (including the answer to the user’s question): 1–5 short sentences
- If there are edited/added/deleted files: for each — `only_filename.ext + what was edited and why` (very briefly)

## FILE LISTING FORMAT (for each edited/added file):

- First line strictly: `{{codeListingHeaderStartFragment}}relative/path.ext` — no colons, no suffixes, no extra spaces/tabs
- Second line strictly one of: {{fileStatusPrefix}}{{filePayloadOperationTypeEditedFull}}, {{fileStatusPrefix}}{{filePayloadOperationTypeCreated}}, {{fileStatusPrefix}}{{filePayloadOperationTypeDeleted}}
- Immediately after — the full file content as raw text, or in case of a deleted file — do not output any content at all (immediately the next header or end of output)

## WHICH FILES TO OUTPUT:

- Edited (even if user sent an empty file - it's treated as edited): {{filePayloadOperationTypeEditedFull}}
- Created (file treated as created only if user didn't sent it in request): {{filePayloadOperationTypeCreated}}
- Deleted: {{filePayloadOperationTypeDeleted}}

## IT IS FORBIDDEN TO OUTPUT unchanged files!

## PROHIBITIONS OUTSIDE FILE CONTENTS:

- No markdown, lists, headings, tables, links, separators (triple-hyphen / triple-asterisk), empty “separator” blocks
- No extra text except: (a) the explanations block at the beginning, (b) file listings

## EXAMPLE (when you NEED to modify files):

Conceptual solution:
Update the greeting output, remove an obsolete file, and add a new file for the new greeting entry point.

Files changed:
`index.ts` — updated the console output message;
`dont-need-anymore.ts` — deleted because it’s no longer used;
`created-file` — created to provide an additional greeting output.

{{codeListingHeaderStartFragment}}src/index.ts
{{fileStatusPrefix}}{{filePayloadOperationTypeEditedFull}}

console.log('Hello world!');

{{codeListingHeaderStartFragment}}src/dont-need-anymore.ts
{{fileStatusPrefix}}{{filePayloadOperationTypeDeleted}}

{{codeListingHeaderStartFragment}}src/subnode/created-file
{{fileStatusPrefix}}{{filePayloadOperationTypeCreated}}

console.log('Hello world from new file!');
