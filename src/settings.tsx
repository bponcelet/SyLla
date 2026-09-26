import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import type { HelperMode } from './syllables/annotate';

export interface Settings {
  /** Master switch for the syllable helper (the big button in the reader). */
  enabled: boolean;
  helper: HelperMode;
  /** For the "long" helper mode: minimum number of syllables to decorate a word. */
  minSyllables: 2 | 3;
  colors: boolean;
  arcs: boolean;
  silent: boolean;
  palette: keyof typeof PALETTES;
  font: keyof typeof FONTS;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  theme: 'light' | 'sepia' | 'dark';
}

export const PALETTES = {
  'rouge-bleu': { label: 'Rouge / Bleu', light: ['#d62828', '#1d4ed8'], dark: ['#ff7b7b', '#7aa7ff'] },
  'bleu-vert': { label: 'Bleu / Vert', light: ['#1d4ed8', '#15803d'], dark: ['#7aa7ff', '#6ee7a0'] },
  'violet-orange': { label: 'Violet / Orange', light: ['#7e22ce', '#c2410c'], dark: ['#d8a6ff', '#ffab76'] },
} as const;

export const FONTS = {
  andika: { label: 'Andika', css: "'Andika', sans-serif" },
  lexend: { label: 'Lexend', css: "'Lexend', sans-serif" },
  opendyslexic: { label: 'OpenDyslexic', css: "'OpenDyslexic', sans-serif" },
  serif: { label: 'Classique', css: "Georgia, 'Times New Roman', serif" },
} as const;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  helper: 'all',
  minSyllables: 2,
  colors: true,
  arcs: true,
  silent: true,
  palette: 'rouge-bleu',
  font: 'andika',
  fontSize: 26,
  lineHeight: 2,
  letterSpacing: 0.02,
  wordSpacing: 0.15,
  theme: 'sepia',
};

const KEY = 'sylla-read.settings';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable: use defaults.
  }
  return DEFAULT_SETTINGS;
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Not persisted, still applied for this session.
      }
      return next;
    });
  }, []);
  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}

/** CSS variables and classes that apply the reading settings to a container. */
export function readingStyle(s: Settings, dark: boolean) {
  const [a, b] = PALETTES[s.palette][dark ? 'dark' : 'light'];
  return {
    style: {
      '--syl-a': a,
      '--syl-b': b,
      '--read-font': FONTS[s.font].css,
      '--read-size': `${s.fontSize}px`,
      '--read-line': String(s.lineHeight),
      '--read-letter': `${s.letterSpacing}em`,
      '--read-word': `${s.wordSpacing}em`,
    } as CSSProperties,
    className: [s.colors && 'show-colors', s.arcs && 'show-arcs', s.silent && 'show-silent'].filter(Boolean).join(' '),
  };
}
