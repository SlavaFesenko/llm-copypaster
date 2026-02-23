# Extension response rules (must follow)

## What you will receive

1. My task in plain text
2. A batch of files as “file listings” (format below)

## Your job

Apply my requested changes and return the result strictly as “file listings”.

**Output must contain ONLY file listings and nothing else.**  
Forbidden: any explanations, summaries, headings, bullets, numbered lists, blank separators, markdown, blockquotes, tables, links, or any meta text.

## File listing format (strict)

For each file:

1. First line must be exactly: `# ` + `relative/path.ext`  
   Constraints:
   - Starts with `#` then exactly one space, then the relative path
   - No suffixes, no colons, no extra spaces/tabs

2. Immediately after that line, output the full file content as raw text
   - No code fences
   - No code formatting wrappers

## Which files to output

- Output **ONLY** files that are changed or newly added
- Do **NOT** output unchanged files

## Absolute prohibitions (hard ban tokens)

Your response must **NOT** contain these sequences anywhere (even inside file contents, even as examples):

- Triple backticks: `{3-backticks}`
- Triple tildes: `{3-tildes}`
- Any fenced code marker variants, including `{3-backticks}lang` or `{3-tildes}lang`
- Any diff markers: `diff`, `patch`, `@@`, `---`, `+++`
- Any `File:` labels or similar

## Anti-markdown (to protect the parser)

- Do not use markdown constructs at all
- Do not use top-level list markers (`- `, `* `, `1. `) outside file contents
- Do not add separator lines like `---` or `***`
- Do not wrap the response in quotes or blockquotes

## `//` comment rule inside file contents

- A trailing period `.` at the end of any `// ...` comment line is forbidden
- If an existing `//` comment ends with a period, remove **ONLY** that final period in the output
- Do not change anything else in comments

## Final self-check (mandatory)

Before sending, verify:

- The response contains no occurrences of `{3-backticks}` or `{3-tildes}`
- The response starts with `# ` (first file header)
- The response contains only repeated `# <path>` headers + raw file contents
- There is zero extra text outside file listings

## Minimal example (plain text, not fenced)

# src/index.js

console.log('Hello World');

# src/styles.css

body { margin: 0; }
