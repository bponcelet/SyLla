// Builds public/books/les-malheurs-de-sophie.epub, the book added to the library on first launch.
//
// Source: "Les Malheurs de Sophie", Comtesse de Ségur (1858), public domain text downloaded from
// Project Gutenberg (#15058). Per the Project Gutenberg license, all Project Gutenberg material
// (header, license, name) is removed: what remains is a plain public-domain text. We rebuild it with
// one file per chapter (the source has the whole story in one file) and our own cover.
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://www.gutenberg.org/ebooks/15058.epub3.images';
const OUT = 'public/books/les-malheurs-de-sophie.epub';
const TITLE = 'Les Malheurs de Sophie';
const AUTHOR = 'Comtesse de Ségur';

// ---------- Extract the story ----------

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const source = await JSZip.loadAsync(await res.arrayBuffer());
const textFiles = Object.keys(source.files)
  .filter((f) => /\.txt\.xhtml$/.test(f))
  .sort();
let html = '';
for (const f of textFiles) html += await source.file(f).async('string');

const { document } = new JSDOM(html).window;
// The Project Gutenberg header and footer are marked with these classes/ids.
document.querySelectorAll('.pg-boilerplate, #pg-header, #pg-footer, section.pg-boilerplate').forEach((e) => e.remove());

const clean = (s) =>
  s
    .replace(/_/g, '') // italics markers left over from the plain-text edition
    .replace(/\s+/g, ' ')
    .trim();
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHAPTER = /^([IVXL]+)—(.+?)\.?$/;
const paragraphs = [...document.querySelectorAll('p, h4, h5')].map((p) => clean(p.textContent ?? ''));

// The table of contents at the top also lists "I—La poupée de cire." etc. on one paragraph with line
// breaks, so real chapter titles are the paragraphs that are only a chapter title.
const dedicationStart = paragraphs.findIndex((p) => p === 'À ma petite-fille');
const chapters = [];
let current;
// The story ends before the "End of Project Gutenberg's…" line.
const storyEnd = paragraphs.findIndex((p, i) => i > dedicationStart && /project gutenberg/i.test(p));
for (const p of paragraphs.slice(dedicationStart, storyEnd < 0 ? undefined : storyEnd)) {
  const m = CHAPTER.exec(p);
  if (m) {
    current = { title: `${m[1]}. ${m[2]}`, paragraphs: [] };
    chapters.push(current);
  } else if (current) {
    current.paragraphs.push(p);
  }
}
const dedication = paragraphs.slice(dedicationStart + 2, paragraphs.findIndex((p, i) => i > dedicationStart && CHAPTER.test(p)));
if (chapters.length !== 22) throw new Error(`Expected 22 chapters, found ${chapters.length}`);
if (/gutenberg/i.test(JSON.stringify(chapters) + dedication)) throw new Error('Project Gutenberg text left in the book');

// ---------- Cover ----------

const font = (file) => {
  const b = readFileSync(`node_modules/@fontsource/andika/files/${file}`);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const bold = font('andika-latin-700-normal.woff');
const regular = font('andika-latin-400-normal.woff');
const W = 1200;
const H = 1800;
const line = (f, text, size, y, color) => {
  const width = f.getAdvanceWidth(text, size);
  return `<path fill="${color}" d="${f.getPath(text, (W - width) / 2, y, size).toPathData(1)}"/>`;
};
const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fbf5e9"/>
  <rect x="50" y="50" width="${W - 100}" height="${H - 100}" rx="40" fill="none" stroke="#e0612b" stroke-width="16"/>
  ${line(bold, 'Les Malheurs', 150, 640, '#d62828')}
  ${line(bold, 'de Sophie', 150, 820, '#1d4ed8')}
  <path d="M430,900 C430,950 770,950 770,900" fill="none" stroke="#e0612b" stroke-width="12" stroke-linecap="round"/>
  ${line(regular, AUTHOR, 80, 1150, '#3b2f22')}
  ${line(regular, '1858', 60, 1270, '#86765f')}
</svg>`;
const cover = await sharp(Buffer.from(coverSvg)).jpeg({ quality: 85 }).toBuffer();

// ---------- EPUB ----------

const xhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><title>${escape(title)}</title></head>
<body>
${body}
</body>
</html>`;

const docs = [
  {
    id: 'dedicace',
    title: 'À ma petite-fille',
    body: `<h1>À ma petite-fille Élisabeth Fresneau</h1>\n${dedication.map((p) => `<p>${escape(p)}</p>`).join('\n')}`,
  },
  ...chapters.map((c, i) => ({
    id: `chap${String(i + 1).padStart(2, '0')}`,
    title: c.title,
    body: `<h1>${escape(c.title)}</h1>\n${c.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n')}`,
  })),
  {
    id: 'apropos',
    title: 'À propos de ce livre',
    body: `<h1>À propos de ce livre</h1>
<p>${TITLE}, de la Comtesse de Ségur, a été publié en 1858. Ce texte appartient au domaine public.</p>
<p>Cette édition a été préparée pour SyllaLire.</p>`,
  },
];

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
);
zip.file('OEBPS/cover.jpg', cover);
for (const d of docs) zip.file(`OEBPS/${d.id}.xhtml`, xhtml(d.title, d.body));
zip.file(
  'OEBPS/nav.xhtml',
  xhtml(
    'Table des matières',
    `<nav epub:type="toc"><h1>Table des matières</h1><ol>\n${docs.map((d) => `<li><a href="${d.id}.xhtml">${escape(d.title)}</a></li>`).join('\n')}\n</ol></nav>`,
  ),
);
zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">syllalire-les-malheurs-de-sophie</dc:identifier>
    <dc:title>${TITLE}</dc:title>
    <dc:creator>${AUTHOR}</dc:creator>
    <dc:language>fr</dc:language>
    <dc:date>1858</dc:date>
    <dc:rights>Domaine public</dc:rights>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
    ${docs.map((d) => `<item id="${d.id}" href="${d.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>${docs.map((d) => `<itemref idref="${d.id}"/>`).join('')}</spine>
</package>`,
);

mkdirSync('public/books', { recursive: true });
writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip', compression: 'DEFLATE' }));
const words = chapters.reduce((n, c) => n + c.paragraphs.join(' ').split(/\s+/).length, 0);
console.log(`${OUT} written: ${chapters.length} chapters, ~${words} words`);
