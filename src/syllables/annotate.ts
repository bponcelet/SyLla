import { WORD_RE } from './index';
import type { Syllable, SyllableEngine } from './types';

const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'MATH', 'CODE', 'PRE']);

/**
 * Wrap every word under `root` in syllable markup:
 *
 *   <span class="sw" data-n="2">
 *     <span class="sy sa">pe</span><span class="sy sb">tit<span class="sl">e</span></span>
 *   </span>
 *
 * Syllables alternate `sa`/`sb` across the whole text; silent letters get `sl`.
 * The markup is inert until the reader turns words "on" (see `applyHelperMode`).
 */
export function annotate(root: HTMLElement, engine: SyllableEngine) {
  const cache = new Map<string, Syllable[]>();
  const syllabify = (word: string, prev: string | undefined) => {
    // Only "-ent" words depend on the previous word (ils mangent / le moment).
    const key = word.endsWith('ent') ? `${prev}|${word}` : word;
    let s = cache.get(key);
    if (!s) {
      s = engine.syllabify(word, prev);
      cache.set(key, s);
    }
    return s;
  };

  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let p = node.parentElement; p && p !== root; p = p.parentElement) {
        if (SKIP.has(p.tagName.toUpperCase()) || p.classList.contains('sw')) return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue && /\p{L}/u.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  let prev: string | undefined;
  let alt = 0;
  for (const node of nodes) {
    const value = node.nodeValue!;
    const frag = doc.createDocumentFragment();
    let last = 0;
    for (const m of value.matchAll(WORD_RE)) {
      if (m.index > last) frag.append(value.slice(last, m.index));
      const word = m[0];
      const syllables = syllabify(word, prev);
      prev = word.toLowerCase();

      const w = doc.createElement('span');
      w.className = 'sw';
      w.dataset.n = String(syllables.length);
      for (const s of syllables) {
        const sy = doc.createElement('span');
        sy.className = alt++ % 2 ? 'sy sb' : 'sy sa';
        for (const part of s.parts) {
          if (part.silent) {
            const sl = doc.createElement('span');
            sl.className = 'sl';
            sl.textContent = part.text;
            sy.append(sl);
          } else {
            sy.append(part.text);
          }
        }
        w.append(sy);
      }
      frag.append(w);
      last = m.index + word.length;
    }
    if (last < value.length) frag.append(value.slice(last));
    node.replaceWith(frag);
  }
}

export type HelperMode = 'all' | 'long' | 'tap';

/** Turn the helper on for the right words. Cheap enough to re-run on every settings change. */
export function applyHelperMode(root: HTMLElement, enabled: boolean, mode: HelperMode, minSyllables: number) {
  for (const w of root.querySelectorAll<HTMLElement>('.sw')) {
    const n = Number(w.dataset.n);
    const on =
      enabled &&
      (mode === 'all' ||
      (mode === 'long' && n >= minSyllables) ||
      (mode === 'tap' && w.classList.contains('revealed')));
    w.classList.toggle('on', on);
  }
}
