// Renders the source images @capacitor/assets needs (app icon + splash, light and dark) from src/assets/logo.svg.
// Then run: npx capacitor-assets generate
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const logo = readFileSync('src/assets/logo.svg', 'utf8');
const darkLogo = logo
  .replace('fill="#fbf5e9"', 'fill="#22252b"')
  .replaceAll('#d62828', '#ff7b7b')
  .replaceAll('#1d4ed8', '#7aa7ff');

const PAPER = '#fbf5e9';
const DARK = '#16181c';

/** Logo of `logoSize` px centred on a `size` px square (transparent when no background). */
async function render(file, size, logoSize, background, svg = logo) {
  const layers = [];
  if (logoSize) {
    const png = await sharp(Buffer.from(svg), { density: 72 * (logoSize / 512) * 2 })
      .resize(logoSize, logoSize)
      .png()
      .toBuffer();
    layers.push({ input: png, gravity: 'centre' });
  }
  await sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toFile(`assets/${file}`);
  console.log(`assets/${file}`);
}

mkdirSync('assets', { recursive: true });
await render('icon-only.png', 1024, 900, PAPER);
// Android adaptive icon: the launcher crops the outer third, so the logo stays in the safe zone.
await render('icon-foreground.png', 1024, 640);
await render('icon-background.png', 1024, 0, PAPER);
await render('splash.png', 2732, 620, PAPER);
await render('splash-dark.png', 2732, 620, DARK, darkLogo);
