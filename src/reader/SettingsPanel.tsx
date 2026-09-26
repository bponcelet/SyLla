import { useEffect, useRef, type ReactNode } from 'react';
import { FONTS, PALETTES, readingStyle, useSettings, type Settings } from '../settings';
import { getEngine } from '../syllables';
import { annotate, applyHelperMode } from '../syllables/annotate';
import { Sheet } from './Sheet';

const SAMPLE = 'Le petit chat joue avec la pelote de laine. Les oiseaux chantent au soleil.';

export function SettingsPanel({
  onClose,
  helperAvailable,
  language,
}: {
  onClose: () => void;
  helperAvailable: boolean;
  language?: string;
}) {
  const { settings: s, update } = useSettings();
  const previewRef = useRef<HTMLParagraphElement>(null);
  const { style, className } = readingStyle(s, s.theme === 'dark');

  useEffect(() => {
    const el = previewRef.current!;
    el.textContent = SAMPLE;
    annotate(el, getEngine('fr')!);
  }, []);
  useEffect(() => {
    applyHelperMode(previewRef.current!, s.enabled, s.helper === 'tap' ? 'all' : s.helper, s.minSyllables);
  }, [s.enabled, s.helper, s.minSyllables]);

  return (
    <Sheet title="Réglages" onClose={onClose}>
      <div className="preview">
        <p ref={previewRef} className={`content-text ${className}`} style={style} lang="fr" />
      </div>

      <Section title="Aide syllabes">
        {!helperAvailable && (
          <p className="hint">L'aide n'est pas encore disponible pour la langue de ce livre ({language}).</p>
        )}
        <Toggle label="Montrer les syllabes" checked={s.enabled} onChange={(v) => update({ enabled: v })} />
        <Choice<Settings['helper']>
          label="Pour quels mots ?"
          value={s.helper}
          onChange={(helper) => update({ helper })}
          options={[
            ['all', 'Tous'],
            ['long', 'Mots longs'],
            ['tap', 'Au toucher'],
          ]}
        />
        {s.helper === 'long' && (
          <Choice<Settings['minSyllables']>
            label="À partir de"
            value={s.minSyllables}
            onChange={(minSyllables) => update({ minSyllables })}
            options={[
              [2, '2 syllabes'],
              [3, '3 syllabes'],
            ]}
          />
        )}
        {s.helper === 'tap' && <p className="hint">Touche un mot pour voir ses syllabes, touche-le encore pour les cacher.</p>}
        <Toggle label="Couleurs" checked={s.colors} onChange={(v) => update({ colors: v })} />
        <Toggle label="Arcs sous les syllabes" checked={s.arcs} onChange={(v) => update({ arcs: v })} />
        <Toggle label="Lettres muettes en gris" checked={s.silent} onChange={(v) => update({ silent: v })} />
        <Choice<Settings['palette']>
          label="Couleurs"
          value={s.palette}
          onChange={(palette) => update({ palette })}
          options={Object.entries(PALETTES).map(([k, p]) => [
            k as Settings['palette'],
            <span className="swatch-pair" aria-label={p.label}>
              <i style={{ background: p.light[0] }} />
              <i style={{ background: p.light[1] }} />
            </span>,
          ])}
        />
      </Section>

      <Section title="Texte">
        <Choice<Settings['font']>
          label="Police"
          value={s.font}
          onChange={(font) => update({ font })}
          options={Object.entries(FONTS).map(([k, f]) => [
            k as Settings['font'],
            <span style={{ fontFamily: f.css }}>{f.label}</span>,
          ])}
        />
        <Slider label="Taille" min={16} max={44} step={1} value={s.fontSize} onChange={(fontSize) => update({ fontSize })} />
        <Slider label="Interligne" min={1.5} max={3} step={0.1} value={s.lineHeight} onChange={(lineHeight) => update({ lineHeight })} />
        <Slider label="Espace entre les lettres" min={0} max={0.2} step={0.01} value={s.letterSpacing} onChange={(letterSpacing) => update({ letterSpacing })} />
        <Slider label="Espace entre les mots" min={0} max={0.8} step={0.05} value={s.wordSpacing} onChange={(wordSpacing) => update({ wordSpacing })} />
      </Section>

      <Section title="Thème">
        <Choice<Settings['theme']>
          label="Fond"
          value={s.theme}
          onChange={(theme) => update({ theme })}
          options={[
            ['light', 'Clair'],
            ['sepia', 'Papier'],
            ['dark', 'Sombre'],
          ]}
        />
      </Section>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Choice<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, ReactNode][];
}) {
  return (
    <div className="choice">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(([v, content]) => (
          <button key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)}>
            {content}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  ...range
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} {...range} />
    </label>
  );
}
