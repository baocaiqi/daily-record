#!/usr/bin/env node
/**
 * Build script: parses words*.md → generates dictation.html
 * Usage: node build-dictation.js
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const WORDS_FILES = ['words1.md', 'words2.md', 'words3.md', 'words4.md', 'words5.md', 'words6.md', 'words7.md', 'words8.md', 'words9.md', 'words10.md'];

// ===== Parse markdown tables =====
function parseWordTable(md, fileIndex) {
  const lines = md.split('\n');
  const words = [];
  let inTable = false;

  // Peek ahead: is the next non-empty line a table row?
  const nextNonEmptyIsRow = (idx) => {
    for (let j = idx + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t) continue;
      return t.startsWith('|');
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect table start
    if (/^\| # \|/.test(trimmed)) { inTable = true; continue; }
    // Skip separator
    if (/^\|---/.test(trimmed) && inTable) continue;
    // A bare --- line: internal group separator if another row follows,
    // otherwise it ends the main table (sections like 词根小结 come after)
    if (inTable && /^---/.test(trimmed)) {
      if (nextNonEmptyIsRow(i)) continue;
      break;
    }
    if (!inTable) continue;
    // Must be a table row
    if (!trimmed.startsWith('|')) continue;

    const cols = trimmed.split('|');
    if (cols.length < 5) continue;

    // cols: ['', ' # ', ' **word** ', ' definition ', ' notes ', ...]
    const rawWord = (cols[2] || '').trim();
    const definition = (cols[3] || '').trim();
    const notes = (cols[4] || '').trim();

    // Skip empty / header rows
    if (!rawWord || !definition) continue;
    // Skip root-marker rows (🏷️)
    if (rawWord.includes('🏷️')) continue;
    // Skip cross-ref-only rows (like "见 #5")
    if (/^见\s*#/.test(definition)) continue;

    // Extract word: strip **bold** and any trailing emoji/symbols
    let word = rawWord.replace(/\*\*(.+?)\*\*/, (_, w) => w).trim();
    // Remove trailing emoji like 🔥
    word = word.replace(/[\u{1F300}-\u{1FAFF}].*$/u, '').trim();
    if (!word) continue;

    // Clean notes: strip backtick tags, keep content readable
    let note = notes
      .replace(/`\[[^\]]+\]`\s*/g, '')   // Remove `[词根]` style tags
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // Strip bold/italic
      .replace(/；+/g, '；')
      .replace(/^[；\s]+|[；\s]+$/g, '') // Trim leading/trailing separators
      .replace(/\\\|/g, '|')              // Unescape pipes
      .trim();

    words.push({
      w: word,
      m: definition,
      n: note,
      f: fileIndex + 1,
    });
  }

  return words;
}

// ===== Main =====
let allWords = [];

for (let i = 0; i < WORDS_FILES.length; i++) {
  const filePath = path.join(DIR, WORDS_FILES[i]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }
  const md = fs.readFileSync(filePath, 'utf-8');
  const words = parseWordTable(md, i);
  allWords = allWords.concat(words);
  console.log(`${WORDS_FILES[i]}: ${words.length} words parsed`);
}

console.log(`\nTotal: ${allWords.length} words`);

// Count empty notes
const emptyNotes = allWords.filter(w => !w.n).length;
console.log(`Empty notes: ${emptyNotes}`);
console.log(`With notes: ${allWords.length - emptyNotes}`);

// Generate the JavaScript data array
const wordsJSON = JSON.stringify(allWords, null, 2);

// Read the HTML template
const htmlPath = path.join(DIR, 'dictation.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// Replace the WORDS array in the HTML
// Find the pattern and replace everything from "const WORDS = [" to just before QUIZ section
const wordsStartMarker = 'const WORDS = [';
const wordsEndMarker = '\n\n// ===== KNOWLEDGE QUIZ QUESTIONS =====';

const startIdx = html.indexOf(wordsStartMarker);
const endIdx = html.indexOf(wordsEndMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find WORDS array markers in HTML template');
  process.exit(1);
}

// Build new words section (JSON.stringify already includes closing ])
const newWordsSection = 'const WORDS = ' + wordsJSON + ';';

// Replace: everything from startIdx to endIdx (exclusive of end marker)
html = html.slice(0, startIdx) + newWordsSection + html.slice(endIdx);

// Write output
const outPath = path.join(DIR, 'dictation.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log(`\n✓ Written ${html.length} bytes to ${outPath}`);

// Summary per file
for (let i = 1; i <= 10; i++) {
  const count = allWords.filter(w => w.f === i).length;
  console.log(`  words${i}: ${count} words`);
}
