// Builds src/assets/logo.svg: "sylla" in Andika Bold turned into vector paths, "sy" red and "lla" blue,
// each syllable underlined with an arc, inside the orange ring of the reader's helper button.
// Paths (not text) so the logo looks the same before any font has loaded.
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';

const fontFile = readFileSync('node_modules/@fontsource/andika/files/andika-latin-700-normal.woff');
const font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength));

const SIZE = 512; // viewBox
const FONT_SIZE = 150;
const syllables = [
  { text: 'sy', cls: 'logo-a', color: '#d62828' },
  { text: 'lla', cls: 'logo-b', color: '#1d4ed8' },
];

// Lay the two syllables out on one baseline, as one word (with kerning between them).
const word = syllables.map((s) => s.text).join('');
const full = font.getPath(word, 0, 0, FONT_SIZE, { kerning: true });
const box = full.getBoundingBox();
const width = box.x2 - box.x1;
const x0 = (SIZE - width) / 2 - box.x1;
const baseline = SIZE / 2 + FONT_SIZE * 0.12;

let x = x0;
const parts = [];
for (const s of syllables) {
  const path = font.getPath(s.text, x, baseline, FONT_SIZE, { kerning: true });
  const b = path.getBoundingBox();
  // Arc under the syllable, same shape as the reader's CSS arcs (a "U").
  const pad = 6;
  const top = baseline + 28;
  const depth = 34;
  const arc = `M${(b.x1 + pad).toFixed(1)},${top} C${(b.x1 + pad).toFixed(1)},${top + depth} ${(b.x2 - pad).toFixed(1)},${top + depth} ${(b.x2 - pad).toFixed(1)},${top}`;
  parts.push(
    `  <g class="${s.cls}" fill="${s.color}" stroke="${s.color}">\n` +
      `    <path stroke="none" d="${path.toPathData(1)}"/>\n` +
      `    <path class="logo-arc" fill="none" stroke-width="10" stroke-linecap="round" pathLength="1" d="${arc}"/>\n` +
      `  </g>`,
  );
  x += font.getAdvanceWidth(s.text, FONT_SIZE, { kerning: true });
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" class="logo" role="img" aria-label="Sylla">
  <circle class="logo-ring" cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 20}" fill="#fbf5e9" stroke="#e0612b" stroke-width="22"/>
${parts.join('\n')}
</svg>
`;
writeFileSync('src/assets/logo.svg', svg);
console.log('src/assets/logo.svg written');
