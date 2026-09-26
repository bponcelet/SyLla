# SyllaLire

E-book reader for children learning to read. It shows **spoken syllables** under words
(alternating colours, arcs, grey silent letters) to help kids read more fluently.
It runs on Android, iOS and the web from one TypeScript codebase (React + Vite + Capacitor).

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # syllable engine tests
npm run sample     # regenerates samples/le-petit-renard.epub (a small test book)
npm run logo       # rebuilds src/assets/logo.svg and the Android/iOS icons + splash screens
npm run default-book  # rebuilds public/books/les-malheurs-de-sophie.epub (the example book)
```

On first launch the library contains *Les Malheurs de Sophie* (Comtesse de Ségur, 1858, public
domain), bundled in `public/books/`. It is added once: if it is deleted, it does not come back.
The text comes from Project Gutenberg (#15058) with all Project Gutenberg material removed, as its
license allows, and is split into one file per chapter with our own cover.

`samples/le-petit-renard.epub` is a very short test story you can import with "Ajouter un livre".

### Android / iOS

```bash
npm run cap:sync        # build the web app and copy it into android/ and ios/
npx cap open android    # needs Android Studio
npx cap open ios        # on a Mac, needs Xcode
```

## How it works

| Folder | Role |
| --- | --- |
| `src/syllables/` | Language-independent API (`SyllableEngine`), text annotation, helper modes |
| `src/syllables/fr/` | French engine: graphemes → silent letters → glides → spoken syllables, plus an exception lexicon |
| `src/epub/` | EPUB parsing (JSZip): metadata, cover, spine, table of contents, sanitised chapters |
| `src/library/` | Library UI and IndexedDB storage (books + files + reading position) |
| `src/reader/` | Paginated reader (CSS columns), gestures, settings and table of contents |
| `src/stats/` | Reading statistics: pure calculations (`stats.ts`, tested), SVG charts and the statistics screen |

**Adding a language:** implement `SyllableEngine` in `src/syllables/<lang>/` and register it in
`src/syllables/index.ts`. A book uses the engine for its `dc:language` (default: French).

**French engine:** it splits words into spoken syllables ("pe-ti**te**", the final mute e is
not a syllable). To fix a word, add it to `src/syllables/fr/lexicon.ts` (use `OVERRIDES` for
one-off words) and add a case to `fr.test.ts`.

**Reader choices:** the publisher's CSS is ignored so fonts, spacing and colours stay under our
control. The syllable markup is added once per chapter; the helper settings only toggle CSS classes.

## Known limits / next steps

- DRM-protected books cannot be opened (detected and reported on import).
- The file picker on some Android devices may grey out `.epub` files; if so, relax the `accept` filter.
- Ideas: two-page spread on landscape tablets, child profiles + parent lock, read-aloud (TTS),
  browsing free catalogues (OPDS) from the app, a word dictionary for custom corrections.
