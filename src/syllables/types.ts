/** A run of letters inside a syllable, either pronounced or silent. */
export interface SyllablePart {
  text: string;
  silent: boolean;
}

export interface Syllable {
  parts: SyllablePart[];
}

/**
 * A language-specific syllabification engine.
 * Add a new language by implementing this interface and registering it in `./index.ts`.
 */
export interface SyllableEngine {
  /** ISO 639-1 code, e.g. "fr". */
  lang: string;
  /**
   * Split a single word (letters and internal apostrophes only) into spoken syllables.
   * `previousWord` gives a little context, e.g. to know that "mangent" follows "ils".
   */
  syllabify(word: string, previousWord?: string): Syllable[];
}

export const syllableText = (s: Syllable) => s.parts.map((p) => p.text).join('');
