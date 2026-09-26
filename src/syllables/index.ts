import { frenchEngine } from './fr';
import type { SyllableEngine } from './types';

export type { Syllable, SyllableEngine, SyllablePart } from './types';

const engines: Record<string, SyllableEngine> = {
  fr: frenchEngine,
};

/** Engine for a BCP 47 language tag ("fr", "fr-BE"…), or undefined if the language is not supported yet. */
export function getEngine(lang: string | undefined): SyllableEngine | undefined {
  const base = (lang || 'fr').toLowerCase().split(/[-_]/)[0];
  return engines[base];
}

export const supportedLanguages = () => Object.keys(engines);

/** Words: letters (with accents) and internal apostrophes. Hyphens split words ("grand-mère"). */
export const WORD_RE = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
