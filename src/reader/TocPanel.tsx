import type { TocEntry } from '../epub/epub';
import { Sheet } from './Sheet';

export function TocPanel({
  toc,
  current,
  onSelect,
  onClose,
}: {
  toc: TocEntry[];
  current: string;
  onSelect: (href: string) => void;
  onClose: () => void;
}) {
  const render = (entries: TocEntry[]) => (
    <ul>
      {entries.map((e, i) => (
        <li key={`${e.href}-${i}`}>
          <button
            className={e.href.split('#')[0] === current ? 'current' : undefined}
            onClick={() => onSelect(e.href)}
            disabled={!e.href}
          >
            {e.label}
          </button>
          {!!e.children.length && render(e.children)}
        </li>
      ))}
    </ul>
  );
  return (
    <Sheet title="Table des matières" onClose={onClose}>
      <nav className="toc">{render(toc)}</nav>
    </Sheet>
  );
}
