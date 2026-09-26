// Generates samples/le-petit-renard.epub, a small French story used to try the reader.
import JSZip from 'jszip';
import { writeFileSync } from 'node:fs';

const chapters = [
  {
    title: 'Chapitre 1 – La forêt',
    paragraphs: [
      "Il était une fois un petit renard qui habitait dans une grande forêt. Il avait une queue rousse et des yeux brillants.",
      "Chaque matin, il sortait de son terrier pour regarder le soleil se lever derrière les montagnes.",
      "Les oiseaux chantaient dans les arbres et les lapins jouaient dans l'herbe mouillée.",
      "« Aujourd'hui, je vais trouver un trésor ! » dit le petit renard. Il était très curieux et un peu gourmand.",
      "Il marcha longtemps, longtemps, entre les chênes et les sapins. Les feuilles craquaient sous ses pattes.",
    ],
  },
  {
    title: 'Chapitre 2 – La rivière',
    paragraphs: [
      "Au bord de la rivière, le renard rencontra une grenouille verte assise sur un caillou.",
      "« Bonjour, grenouille ! Sais-tu où je peux trouver un trésor ? » demanda-t-il poliment.",
      "La grenouille réfléchit un instant. « Les trésors ne brillent pas toujours, répondit-elle. Parfois, ils sont cachés dans le cœur de nos amis. »",
      "Le renard ne comprit pas tout de suite. Il remercia la grenouille et continua son chemin.",
      "Plus loin, deux écureuils se disputaient une noisette. Ils criaient si fort que tout le monde les entendait.",
      "Le renard leur proposa de partager la noisette en deux morceaux. Les écureuils trouvèrent l'idée excellente.",
    ],
  },
  {
    title: 'Chapitre 3 – Le trésor',
    paragraphs: [
      "Le soir arriva. Le ciel devint orange, puis violet, puis tout noir, rempli d'étoiles.",
      "Le petit renard était fatigué. Il s'assit sous un vieux chêne et regarda autour de lui.",
      "La grenouille, les écureuils et même un hibou étaient venus s'asseoir à côté de lui.",
      "« Tu nous as aidés aujourd'hui, dirent-ils. Nous voulons être tes amis. »",
      "Alors le renard sourit. Il avait enfin trouvé son trésor : des amis fidèles et gentils.",
      "Fin.",
    ],
  },
];

const xhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><title>${title}</title><link rel="stylesheet" href="style.css"/></head>
<body>${body}</body>
</html>`;

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
);
zip.file('OEBPS/style.css', 'body { font-family: serif; color: purple; }');
chapters.forEach((c, i) =>
  zip.file(
    `OEBPS/chap${i + 1}.xhtml`,
    xhtml(c.title, `<h1 id="c${i + 1}">${c.title}</h1>\n${c.paragraphs.map((p) => `<p>${p}</p>`).join('\n')}`),
  ),
);
zip.file(
  'OEBPS/nav.xhtml',
  xhtml(
    'Sommaire',
    `<nav epub:type="toc"><ol>${chapters.map((c, i) => `<li><a href="chap${i + 1}.xhtml">${c.title}</a></li>`).join('')}</ol></nav>`,
  ),
);
zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">sylla-read-sample-renard</dc:identifier>
    <dc:title>Le petit renard</dc:title>
    <dc:creator>SyllaLire</dc:creator>
    <dc:language>fr</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${chapters.map((_, i) => `<item id="c${i + 1}" href="chap${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>${chapters.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('')}</spine>
</package>`,
);

const buf = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
writeFileSync('samples/le-petit-renard.epub', buf);
console.log('samples/le-petit-renard.epub written');
