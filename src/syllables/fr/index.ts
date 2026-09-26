import type { Syllable, SyllableEngine, SyllablePart } from '../types';
import {
  C_PRONOUNCED_AFTER_NASAL,
  C_SILENT,
  D_PRONOUNCED,
  ELISIONS,
  ENT_PRONOUNCED,
  ER_PRONOUNCED,
  F_SILENT,
  L_SILENT,
  OVERRIDES,
  P_PRONOUNCED,
  S_PRONOUNCED,
  T_PRONOUNCED,
  VERB_CONTEXT,
  X_PRONOUNCED,
  Z_PRONOUNCED,
} from './lexicon';

/**
 * French spoken-syllable engine.
 *
 * Pipeline: segment the word into graphemes (one sound each: "ch", "eau", "an", "ill"…),
 * mark silent graphemes (final e/s/t, verb "-ent", h…), turn i/u/ou before a vowel into
 * glides, then split between vowel nuclei using the usual French consonant rules.
 * Final mute "e" is not a nucleus, so "petite" gives "pe-tite" (spoken syllables).
 */

type Kind = 'vowel' | 'consonant' | 'glide' | 'silent';

interface Grapheme {
  start: number;
  end: number;
  kind: Kind;
}

const VOWELS = new Set('aeiouyàâäéèêëîïôöùûüœæ');
const isVowel = (c: string | undefined) => c !== undefined && VOWELS.has(c);
const FRONT = new Set('eiyéèê');
const BACK = new Set('aouâô');

const VOWEL_TRIGRAPHS = ['eau', 'oeu'];
const VOWEL_DIGRAPHS = ['œu', 'ou', 'où', 'oû', 'oi', 'oî', 'ai', 'aî', 'ei', 'au', 'eu', 'eû', 'ey'];
const NASALIZABLE = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ai', 'ei', 'oi']);
const DOUBLES = new Set('bcdfgklmnprstvz');
const ONSET_FIRST = new Set(['b', 'c', 'd', 'f', 'g', 'k', 'p', 't', 'v', 'ch', 'ph', 'th', 'gu']);
const ONSET_SECOND = new Set(['l', 'r']);

/** "il"/"ill" at position k reads as the [j] sound (soleil, paille, travail). */
function ilFollows(w: string, k: number): number {
  if (w[k] !== 'i' || w[k + 1] !== 'l') return 0;
  if (w[k + 2] === 'l') return 3;
  if (k + 2 === w.length || (w[k + 2] === 's' && k + 3 === w.length)) return 2;
  return 0;
}

function isNasal(w: string, j: number): boolean {
  const nm = w[j];
  if (nm !== 'n' && nm !== 'm') return false;
  const next = w[j + 1];
  if (next === undefined) return true;
  if (isVowel(next)) return false;
  if (next === 'h' && isVowel(w[j + 2])) return false;
  // ennui, emmener: word-initial "enn"/"emm" is nasal; bonne, pomme are not.
  if (next === nm) return j === 1 && w[0] === 'e';
  if (nm === 'm' && next === 'n') return false;
  return true;
}

function segment(w: string): Grapheme[] {
  const out: Grapheme[] = [];
  const push = (start: number, end: number, kind: Kind) => out.push({ start, end, kind });
  let i = 0;
  while (i < w.length) {
    const c = w[i];
    const prev = out[out.length - 1];

    // Vowel + "il"/"ill" → the [j] consonant (paille, soleil, grenouille).
    if (c === 'i' && prev?.kind === 'vowel') {
      const len = ilFollows(w, i);
      if (len) {
        push(i, i + len, 'consonant');
        i += len;
        continue;
      }
    }

    if (isVowel(c)) {
      if (c === 'y' && ((i === 0 && isVowel(w[1])) || (isVowel(w[i - 1]) && isVowel(w[i + 1])))) {
        push(i, i + 1, 'consonant'); // yeux, crayon
        i++;
        continue;
      }
      let len = 1;
      if (c === 'u' && w[i - 1] === 'c' && w.startsWith('ueil', i)) {
        len = 2; // accueil, cueillir
      } else {
        const tri = w.slice(i, i + 3);
        const di = w.slice(i, i + 2);
        if (VOWEL_TRIGRAPHS.includes(tri)) len = 3;
        else if (VOWEL_DIGRAPHS.includes(di)) {
          const endsInI = di[1] === 'i' || di[1] === 'î';
          if (di === 'ey' && isVowel(w[i + 2])) len = 1;
          else if (endsInI && ilFollows(w, i + 1)) len = 1; // paille: "a" + "ill"
          else len = 2;
        }
      }
      const text = w.slice(i, i + len);
      if (NASALIZABLE.has(text) && isNasal(w, i + len) && !w.startsWith('ennemi', i)) len++;
      push(i, i + len, 'vowel');
      i += len;
      continue;
    }

    const n1 = w[i + 1];
    const n2 = w[i + 2];
    if (c === 'h') {
      push(i, i + 1, 'silent');
      i++;
      continue;
    }
    if ((c === 'c' || c === 'p' || c === 't' || c === 's') && n1 === 'h') {
      push(i, i + 2, 'consonant');
      i += 2;
      continue;
    }
    if (c === 'g' && n1 === 'n') {
      push(i, i + 2, 'consonant');
      i += 2;
      continue;
    }
    if (c === 'q' && n1 === 'u') {
      push(i, i + 2, 'consonant');
      i += 2;
      continue;
    }
    if (c === 'g' && n1 === 'u' && FRONT.has(n2 ?? '')) {
      push(i, i + 2, 'consonant'); // guitare, langue
      i += 2;
      continue;
    }
    if (c === 'g' && n1 === 'e' && BACK.has(n2 ?? '')) {
      push(i, i + 1, 'consonant'); // mangeons, geai: the "e" only softens the g
      push(i + 1, i + 2, 'silent');
      i += 2;
      continue;
    }
    if (c === 's' && n1 === 'c' && FRONT.has(n2 ?? '')) {
      push(i, i + 2, 'consonant'); // piscine, science
      i += 2;
      continue;
    }
    if (n1 === c && DOUBLES.has(c) && !((c === 'c' || c === 'g') && FRONT.has(n2 ?? ''))) {
      push(i, i + 2, 'consonant'); // ballon, pomme (but ac-cident, sug-gérer)
      i += 2;
      continue;
    }
    push(i, i + 1, 'consonant');
    i++;
  }
  return out;
}

const text = (w: string, g: Grapheme) => w.slice(g.start, g.end);

function hasVowelBefore(g: Grapheme[], idx: number) {
  for (let k = 0; k < idx; k++) if (g[k].kind === 'vowel') return true;
  return false;
}

function isSilentEnt(word: string, previous: string | undefined) {
  if (previous && VERB_CONTEXT.has(previous)) return true;
  if (ENT_PRONOUNCED.has(word)) return false;
  return !word.endsWith('ment');
}

function isSilentFinalConsonant(w: string, base: string, g: Grapheme[], idx: number): boolean {
  const t = text(w, g[idx]);
  const before = g[idx - 1];
  const afterNasal = before?.kind === 'vowel' && /[nm]$/.test(text(w, before));
  switch (t) {
    case 't':
      return !T_PRONOUNCED.has(base);
    case 'd':
      return !D_PRONOUNCED.has(base);
    case 'p':
      return !P_PRONOUNCED.has(base);
    case 'z':
      return !Z_PRONOUNCED.has(base);
    case 'g':
      return afterNasal && !base.endsWith('ing');
    case 'c':
      return C_SILENT.has(base) || (afterNasal && !C_PRONOUNCED_AFTER_NASAL.has(base));
    case 'f':
      return F_SILENT.has(base);
    case 'l':
      return L_SILENT.has(base);
    case 'r':
      return (
        before !== undefined &&
        text(w, before) === 'e' &&
        hasVowelBefore(g, idx - 1) &&
        !ER_PRONOUNCED.has(base)
      );
    default:
      return false;
  }
}

function markSilent(w: string, g: Grapheme[], previous: string | undefined) {
  // "g" after a nasal vowel and before another consonant: longtemps, sangsue (but ongle, angry).
  for (let k = 1; k < g.length - 1; k++) {
    const prevText = text(w, g[k - 1]);
    if (
      text(w, g[k]) === 'g' &&
      g[k - 1].kind === 'vowel' &&
      /[nm]$/.test(prevText) &&
      g[k + 1].kind === 'consonant' &&
      !ONSET_SECOND.has(text(w, g[k + 1]))
    ) {
      g[k].kind = 'silent';
    }
  }

  let end = g.length;
  const last = g[end - 1];
  const beforeLast = g[end - 2];

  // Verb plural "-ent": ils mangent, elles jouent.
  if (
    end >= 3 &&
    text(w, last) === 't' &&
    beforeLast.kind === 'vowel' &&
    text(w, beforeLast) === 'en' &&
    w.endsWith('ent') &&
    hasVowelBefore(g, end - 2) &&
    isSilentEnt(w, previous)
  ) {
    last.kind = 'silent';
    beforeLast.kind = 'silent';
    return;
  }

  let base = w;
  const lastText = text(w, last);
  if ((lastText === 's' && !S_PRONOUNCED.has(w)) || (lastText === 'x' && !X_PRONOUNCED.has(w))) {
    last.kind = 'silent';
    end--;
    base = w.slice(0, -1);
  }
  if (end === 0) return;

  const fin = g[end - 1];
  if (fin.kind === 'vowel' && text(w, fin) === 'e' && hasVowelBefore(g, end - 1)) {
    fin.kind = 'silent'; // e muet: table, petite, joues
    return;
  }
  if (fin.kind === 'consonant' && isSilentFinalConsonant(w, base, g, end - 1)) {
    fin.kind = 'silent';
  }
}

function markGlides(w: string, g: Grapheme[]) {
  for (let k = 0; k < g.length - 1; k++) {
    const cur = g[k];
    const next = g[k + 1];
    if (cur.kind !== 'vowel' || next.kind !== 'vowel') continue;
    const t = text(w, cur);
    const nextStartsWithI = w[next.start] === 'i';
    if (t === 'i' || t === 'y') {
      // cri-er, ou-bli-er: after consonant + l/r the i stays a full vowel.
      const p1 = g[k - 1];
      const p2 = g[k - 2];
      const cluster =
        p1?.kind === 'consonant' && ONSET_SECOND.has(text(w, p1)) && p2?.kind === 'consonant';
      if (!cluster) cur.kind = 'glide';
    } else if ((t === 'u' || t === 'ou') && nextStartsWithI) {
      cur.kind = 'glide'; // nuit, oui
    }
  }
}

function isOnset(w: string, a: Grapheme, b: Grapheme) {
  return ONSET_FIRST.has(text(w, a)) && ONSET_SECOND.has(text(w, b));
}

/** Returns the grapheme index where each syllable starts. */
function syllableStarts(w: string, g: Grapheme[]): number[] {
  const nuclei: number[] = [];
  g.forEach((x, k) => x.kind === 'vowel' && nuclei.push(k));
  const starts = [0];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const a = nuclei[n];
    const b = nuclei[n + 1];
    const cons: number[] = [];
    for (let k = a + 1; k < b; k++) if (g[k].kind === 'consonant') cons.push(k);
    let cut: number;
    if (cons.length === 0) cut = a + 1;
    else if (cons.length === 1) cut = cons[0];
    else {
      const c1 = cons[cons.length - 2];
      const c2 = cons[cons.length - 1];
      cut = isOnset(w, g[c1], g[c2]) ? c1 : c2;
    }
    starts.push(cut);
  }
  return starts;
}

function toSyllables(original: string, g: Grapheme[], starts: number[]): Syllable[] {
  return starts.map((s, idx) => {
    const e = idx + 1 < starts.length ? starts[idx + 1] : g.length;
    const parts: SyllablePart[] = [];
    for (let k = s; k < e; k++) {
      const silent = g[k].kind === 'silent';
      const t = original.slice(g[k].start, g[k].end);
      const last = parts[parts.length - 1];
      if (last && last.silent === silent) last.text += t;
      else parts.push({ text: t, silent });
    }
    return { parts };
  });
}

/** Parse an override like "pe-tit(e)" and re-apply the original casing. */
function fromOverride(original: string, pattern: string): Syllable[] {
  let pos = 0;
  return pattern.split('-').map((chunk) => {
    const parts: SyllablePart[] = [];
    for (const m of chunk.matchAll(/\(([^)]*)\)|([^()]+)/g)) {
      const silent = m[1] !== undefined;
      const len = (m[1] ?? m[2]).length;
      parts.push({ text: original.slice(pos, pos + len), silent });
      pos += len;
    }
    return { parts };
  });
}

function syllabifyPlain(original: string, previous: string | undefined): Syllable[] {
  const w = original.toLowerCase();
  if (w.length !== original.length) return [{ parts: [{ text: original, silent: false }] }];

  const override = OVERRIDES[w];
  if (override) return fromOverride(original, override);

  const g = segment(w);
  markSilent(w, g, previous);
  markGlides(w, g);
  return toSyllables(original, g, syllableStarts(w, g));
}

const APOSTROPHE = /['’]/;

function syllabify(word: string, previousWord?: string): Syllable[] {
  const previous = previousWord?.toLowerCase();
  const m = APOSTROPHE.exec(word);
  if (!m) return syllabifyPlain(word, previous);

  const prefix = word.slice(0, m.index);
  const rest = word.slice(m.index + 1);
  if (ELISIONS.has(prefix.toLowerCase()) && rest) {
    // l'école → "l'" joins the first syllable of "école"; s'aiment → verb context.
    const syllables = syllabifyPlain(rest, prefix.toLowerCase());
    const first = syllables[0].parts;
    if (!first[0].silent) first[0].text = prefix + m[0] + first[0].text;
    else first.unshift({ text: prefix + m[0], silent: false });
    return syllables;
  }

  // aujourd'hui: syllabify without the apostrophe, then put it back.
  const syllables = syllabifyPlain(prefix + rest, previous);
  let pos = 0;
  for (const s of syllables) {
    for (const p of s.parts) {
      if (pos + p.text.length >= prefix.length) {
        const cut = prefix.length - pos;
        p.text = p.text.slice(0, cut) + m[0] + p.text.slice(cut);
        return syllables;
      }
      pos += p.text.length;
    }
  }
  return syllables;
}

export const frenchEngine: SyllableEngine = { lang: 'fr', syllabify };
