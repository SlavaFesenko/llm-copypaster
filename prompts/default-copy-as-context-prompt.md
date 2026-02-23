# Extension response rules (must follow)

## What you receive in this prompt

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

## Allowed code fences (explicitly allowed)

You may wrap code fragments inside the raw file content using code fences.

Rules:

- Code fences are allowed **only inside file contents**, never outside file listings
- Do not add any other markdown constructs outside file contents
- Prefer code fences only when necessary (e.g., files that intentionally contain markdown with fences, or when the target format requires them)

## Which files to output

- Output **ONLY** files that are changed or newly added
- Do **NOT** output unchanged files

## Absolute prohibitions (hard ban tokens)

Your response must **NOT** contain these sequences anywhere (even inside file contents, even as examples):

- Any diff markers: `diff`, `patch`, `@@`, `---`, `+++`
- Any `File:` labels or similar

## Anti-markdown (outside file contents)

Outside file contents:

- Do not use markdown constructs at all
- Do not use top-level list markers (`- `, `* `, `1. `)
- Do not add separator lines like `---` or `***`
- Do not wrap the response in quotes or blockquotes

Inside file contents:

- Only code fences are explicitly allowed; otherwise avoid adding markdown unless the file format requires it

## `//` comment rule inside file contents

- A trailing period `.` at the end of any `// ...` comment line is forbidden
- If an existing `//` comment ends with a period, remove **ONLY** that final period in the output
- Do not change anything else in comments

## Final self-check (mandatory)

Before sending, verify:

- The response starts with `# ` (first file header)
- The response contains only repeated `# <path>` headers + raw file contents
- There is zero extra text outside file listings

## Minimal example (plain text, fences allowed inside contents)

# src/index.js

```ts
console.log('Hello fenced snippet');
```

# docs/example.css

```css
body {
  font-size: 14px;
}
```
