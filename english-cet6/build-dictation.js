#!/usr/bin/env node
/**
 * Build script: parses words*.md (new block format) → generates dictation.html
 * Usage: node build-dictation.js
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const WORDS_FILES = [
  'words1.md', 'words2.md', 'words3.md', 'words4.md', 'words5.md',
  'words6.md', 'words7.md', 'words8.md', 'words9.md', 'words10.md',
  'words11.md', 'words12.md', 'words13.md', 'words14.md', 'words15.md',
  'words16.md', 'words17.md', 'words18.md', 'words19.md', 'words20.md',
  'words21.md',
];

// ===== Parse new block format =====
// Each entry looks like:
//   ### 1. **outskirts** — 市郊，郊区，边缘地带
//   **核心**：城市的**外围/边缘**，常搭配 **on the outskirts of**
//   **搭配**：on the outskirts of the city 在城郊 / industrial outskirts
//   **辨析**：⚠️ outskirts（外围）≠ suburb（住宅区）≠ downtown
//   **词根**：...
// Group headers: "## 一、组名"; trailing sections: "## 📌 词根小结" etc.
function parseWordBlocks(md, fileIndex) {
  const lines = md.split('\n');
  const words = [];
  let current = null;

  // Labels to collect as notes (in priority order), stripped of their label
  const NOTE_LABELS = ['核心', '搭配', '辨析', '词根', '记忆', '场景', '惯用', '考点', '参考', '例句'];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Stop at the trailing summary sections
    if (/^## (📌|⚠️|🎯)/.test(line)) break;
    // Skip group headers ("## 一、...") and separators
    if (/^## /.test(line) || /^---/.test(line)) continue;

    // New entry: "### N. **word** — 释义"
    const entry = line.match(/^### \d+\. \*\*(.+?)\*\*\s*—\s*(.+)$/);
    if (entry) {
      if (current) words.push(current);
      let word = entry[1].trim();
      // Remove trailing emoji like 🔥 (kept from legacy notes)
      word = word.replace(/[\u{1F300}-\u{1FAFF}].*$/u, '').trim();
      let meaning = entry[2].trim();
      // Skip root-marker entries like "card(i)- — 心脏（词根）"
      if (meaning.includes('（词根）')) {
        current = null;
        continue;
      }
      // Skip cross-ref-only rows like "见 #6（诱惑）" (duplicate of the real entry)
      if (/^见\s*#/.test(meaning)) {
        current = null;
        continue;
      }
      current = { w: word, m: meaning, n: '', f: fileIndex + 1 };
      continue;
    }

    // Note lines: "**核心**：...", "**搭配**：..." etc.
    if (current) {
      const note = line.match(/^\*\*(核心|搭配|辨析|词根|记忆|场景|惯用|考点|参考|例句)\*\*[：:]\s*(.+)$/);
      if (note && NOTE_LABELS.includes(note[1])) {
        let text = note[2]
          .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // Strip bold/italic
          .replace(/；+/g, '；')
          .replace(/^[；\s]+|[；\s]+$/g, '')
          .trim();
        if (text) {
          current.n += (current.n ? '；' : '') + text;
        }
      }
    }
  }
  if (current) words.push(current);

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
  const words = parseWordBlocks(md, i);
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
for (let i = 1; i <= WORDS_FILES.length; i++) {
  const count = allWords.filter(w => w.f === i).length;
  console.log(`  words${i}: ${count} words`);
}
