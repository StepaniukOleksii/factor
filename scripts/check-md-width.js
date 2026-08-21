#!/usr/bin/env node
'use strict';

// PostToolUse hook: verifies a markdown file is wrapped at 120 columns.
// Reads the hook payload on stdin; exits 2 with an explanation when the file
// is either over the limit or wrapped short of it.

const fs = require('fs');
const path = require('path');

const LIMIT = 120;
const MAX_REPORTED = 15;

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const file =
  (payload.tool_response && payload.tool_response.filePath) ||
  (payload.tool_input && payload.tool_input.file_path);
if (!file || !/\.md$/i.test(file)) process.exit(0);

let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch {
  process.exit(0);
}

const lines = text.replace(/\r\n/g, '\n').split('\n');

// Structural lines are exempt: wrapping them changes what they mean.
const exempt = new Array(lines.length).fill(false);
let inFrontmatter = false;
let inFence = false;
let inComment = false;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (i === 0 && l === '---') { inFrontmatter = true; exempt[i] = true; continue; }
  if (inFrontmatter) { exempt[i] = true; if (l === '---') inFrontmatter = false; continue; }
  if (inFence) { exempt[i] = true; if (/^\s*```/.test(l)) inFence = false; continue; }
  if (inComment) { exempt[i] = true; if (/-->/.test(l)) inComment = false; continue; }
  if (/^\s*```/.test(l)) { exempt[i] = true; inFence = true; continue; }
  if (/<!--/.test(l)) { exempt[i] = true; if (!/-->/.test(l)) inComment = true; continue; }
  if (/^\s*\|/.test(l)) { exempt[i] = true; continue; }
}

const isStructural = (l) =>
  /^\s*(#{1,6}\s|>)/.test(l) ||
  /^\s*([*+-]|\d+[.)])\s/.test(l) ||
  /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l);

const over = [];
const short = [];

for (let i = 0; i < lines.length; i++) {
  if (exempt[i]) continue;
  const l = lines[i];

  // Over the limit — but only when it can actually be wrapped. A single URL or
  // path longer than the limit has no break point and is left alone.
  if (l.length > LIMIT) {
    const indent = l.match(/^\s*/)[0].length;
    if (l.slice(0, LIMIT + 1).lastIndexOf(' ') > indent) over.push(i + 1);
  }

  // Wrapped short — the next line's first word would still have fitted.
  const next = lines[i + 1];
  if (next === undefined || exempt[i + 1]) continue;
  if (!l.trim() || !next.trim()) continue;
  if (/^\s*(#{1,6}\s|>)/.test(l)) continue;
  if (isStructural(next)) continue;
  const word = next.trim().split(/\s+/)[0];
  if (word && l.length + 1 + word.length <= LIMIT) short.push(i + 1);
}

if (!over.length && !short.length) process.exit(0);

const list = (a) =>
  a.slice(0, MAX_REPORTED).join(', ') + (a.length > MAX_REPORTED ? `, +${a.length - MAX_REPORTED} more` : '');

const rel = path.relative(process.cwd(), file) || file;
const out = [`${rel} is not wrapped at ${LIMIT} columns.`];
if (over.length) out.push(`  Over ${LIMIT}: line ${list(over)}`);
if (short.length) out.push(`  Wrapped short (next line's first word still fits): line ${list(short)}`);
out.push(`  Rewrap the affected paragraphs to fill ${LIMIT} columns.`);
out.push(`  Exempt: table rows, fenced code, YAML frontmatter, HTML comments, unbreakable URLs.`);

process.stderr.write(out.join('\n') + '\n');
process.exit(2);
