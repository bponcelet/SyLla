import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearStatistics, listBooks, listPageReads, type Book, type PageRead } from '../library/db';
import { Icon } from '../reader/Reader';
import { BarChart, LineChart, type Point } from './charts';
import { between, finishedPerMonth, perBook, perDay, perWeek, readingMs, streak, weekStart, wordsPerMinute } from './stats';

const DAY = 86_400_000;

export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric' });
const dayLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dateShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

export function Stats({ onClose }: { onClose: () => void }) {
  const [reads, setReads] = useState<PageRead[]>();
  const [books, setBooks] = useState<Book[]>([]);

  const load = useCallback(() => {
    Promise.all([listPageReads(), listBooks()]).then(([r, b]) => {
      setReads(r);
      setBooks(b);
    });
  }, []);
  useEffect(load, [load]);

  const now = Date.now();
  const s = useMemo(() => {
    if (!reads) return undefined;
    const midnight = new Date(now).setHours(0, 0, 0, 0);
    const today = between(reads, midnight, now + 1);
    const week = between(reads, weekStart(now), now + 1);
    const last7 = between(reads, now - 7 * DAY, now + 1);
    const prev7 = between(reads, now - 14 * DAY, now - 7 * DAY);
    const month = finishedPerMonth(books, 12, now);
    return {
      todayMin: today.reduce((a, r) => a + readingMs(r), 0) / 60_000,
      todayPages: today.length,
      weekMin: week.reduce((a, r) => a + readingMs(r), 0) / 60_000,
      weekPages: week.length,
      wpm: wordsPerMinute(last7),
      wpmPrev: wordsPerMinute(prev7),
      streak: streak(reads, now),
      finishedThisMonth: month[month.length - 1].books.length,
      finishedTotal: books.filter((b) => b.finishedAt).length,
      days: perDay(reads, 14, now),
      weeks: perWeek(reads, 12, now),
      months: month,
      byBook: perBook(reads),
    };
    // `now` changes every render; recompute only when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reads, books]);

  const reset = async () => {
    if (!confirm('Effacer toutes les statistiques de lecture ? Les livres et les pages en cours sont gardés.')) return;
    await clearStatistics();
    load();
  };

  const bookTitle = (id: string) => books.find((b) => b.id === id)?.title ?? 'Livre supprimé';

  return (
    <div className="stats">
      <header className="stats-header">
        <button className="icon-button" onClick={onClose} aria-label="Retour à la bibliothèque">
          <Icon d="M15 5l-7 7 7 7" />
        </button>
        <h1>Statistiques</h1>
      </header>

      {s && !reads!.length && (
        <p className="empty">Pas encore de statistiques. Elles apparaîtront ici dès les premières pages lues.</p>
      )}

      {s && !!reads!.length && (
        <>
          <section className="tiles">
            <Tile label="Aujourd'hui" value={formatMinutes(s.todayMin)} sub={plural(s.todayPages, 'page lue', 'pages lues')} />
            <Tile label="Cette semaine" value={formatMinutes(s.weekMin)} sub={plural(s.weekPages, 'page lue', 'pages lues')} />
            <Tile
              label="Vitesse de lecture"
              value={s.wpm === undefined ? '—' : `${s.wpm}`}
              unit={s.wpm === undefined ? undefined : 'mots / min'}
              sub={speedDelta(s.wpm, s.wpmPrev)}
            />
            <Tile label="Série" value={`${s.streak}`} unit={s.streak > 1 ? 'jours' : 'jour'} sub="de lecture d'affilée" />
            <Tile
              label="Livres terminés"
              value={`${s.finishedThisMonth}`}
              unit="ce mois-ci"
              sub={`${s.finishedTotal} au total`}
            />
          </section>

          <section className="chart-card">
            <h2>Pages lues par jour</h2>
            <BarChart
              title="Pages lues par jour"
              unit="pages"
              data={s.days.map<Point>((d) => ({
                key: d.day,
                label: dayLabel.format(d.date),
                value: d.pages,
                tip: (
                  <>
                    <strong>{dayLong.format(d.date)}</strong>
                    <br />
                    {plural(d.pages, 'page', 'pages')} · {formatMinutes(d.minutes)}
                  </>
                ),
              }))}
            />
          </section>

          <section className="chart-card">
            <h2>Vitesse de lecture</h2>
            <p className="chart-sub">Mots lus par minute, chaque semaine</p>
            <LineChart
              title="Vitesse de lecture"
              unit="mots par minute"
              data={s.weeks.map<Point>((w) => ({
                key: String(w.start),
                label: dayLabel.format(w.start),
                value: w.wpm,
                tip: (
                  <>
                    <strong>Semaine du {dateShort.format(w.start)}</strong>
                    <br />
                    {w.wpm === undefined ? 'Pas assez de lecture' : `${w.wpm} mots / min`} · {formatMinutes(w.minutes)}
                  </>
                ),
              }))}
            />
          </section>

          <section className="chart-card">
            <h2>Livres terminés par mois</h2>
            <BarChart
              title="Livres terminés par mois"
              unit="livres"
              data={s.months.map<Point>((m) => ({
                key: m.month,
                label: monthLabel.format(m.date).replace('.', ''),
                value: m.books.length,
                tip: (
                  <>
                    <strong>{monthLong.format(m.date)}</strong>
                    <br />
                    {m.books.length ? m.books.map((b) => b.title).join(', ') : 'Aucun livre terminé'}
                  </>
                ),
              }))}
            />
          </section>

          <section className="chart-card">
            <h2>Par livre</h2>
            <ul className="book-stats">
              {s.byBook.map((b) => {
                const book = books.find((x) => x.id === b.bookId);
                return (
                  <li key={b.bookId}>
                    <div className="book-stats-title">
                      <strong>{bookTitle(b.bookId)}</strong>
                      {book?.finishedAt && <span className="badge">Terminé le {dateShort.format(book.finishedAt)}</span>}
                    </div>
                    <div className="book-stats-values">
                      <span>{plural(b.pages, 'page', 'pages')}</span>
                      <span>{formatMinutes(b.minutes)}</span>
                      {b.wpm !== undefined && <span>{b.wpm} mots / min</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="stats-note">
            La vitesse compte seulement les pages lues entre 5 secondes et 5 minutes, pour ne pas tenir compte des
            pages feuilletées ou laissées ouvertes.
          </p>
          <button className="link-button" onClick={reset}>
            Effacer les statistiques
          </button>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">
        {value}
        {unit && <small> {unit}</small>}
      </span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function speedDelta(wpm?: number, prev?: number) {
  if (wpm === undefined) return '7 derniers jours';
  if (prev === undefined) return '7 derniers jours';
  const d = wpm - prev;
  if (d === 0) return 'comme la semaine d’avant';
  return `${d > 0 ? '▲ +' : '▼ '}${d} par rapport à la semaine d’avant`;
}
