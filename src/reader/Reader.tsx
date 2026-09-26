import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { loadChapter, openEpub, type Chapter, type Epub, type TocEntry } from '../epub/epub';
import { addPageRead, getBook, getBookFile, markFinished, savePosition, type Book } from '../library/db';
import { MIN_READ_MS } from '../stats/stats';
import { getEngine } from '../syllables';
import { annotate, applyHelperMode } from '../syllables/annotate';
import { FONTS, readingStyle, useSettings } from '../settings';
import { SettingsPanel } from './SettingsPanel';
import { TocPanel } from './TocPanel';
import { paginate, useChapterPageCounts, waitForLayout } from './pagination';

type Target =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'fraction'; value: number }
  | { kind: 'fragment'; id: string }
  | { kind: 'anchor'; el: Element };

export function Reader({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { settings, update } = useSettings();
  const [book, setBook] = useState<Book>();
  const [epub, setEpub] = useState<Epub>();
  const [error, setError] = useState<string>();
  const [spineIndex, setSpineIndex] = useState<number>();
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [layoutId, setLayoutId] = useState(0);
  const [viewportSize, setViewportSize] = useState('');
  const [panel, setPanel] = useState<'settings' | 'toc'>();

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const chapterRef = useRef<Chapter>(undefined);
  const pendingTarget = useRef<Target>({ kind: 'start' });
  const anchorRef = useRef<Element>(undefined);
  const strideRef = useRef(1);
  const animateRef = useRef(false);
  // Latest values for event handlers.
  const nav = useRef({ page, pageCount, spineIndex, spineLength: 0 });
  nav.current = { page, pageCount, spineIndex, spineLength: epub?.spine.length ?? 0 };

  const engine = useMemo(() => (book ? getEngine(book.language) : undefined), [book]);
  const dark = settings.theme === 'dark';
  const { style, className } = readingStyle(settings, dark);

  // Open the book.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [b, file] = await Promise.all([getBook(bookId), getBookFile(bookId)]);
      if (!b || !file) throw new Error('Livre introuvable.');
      const e = await openEpub(file);
      if (cancelled) return;
      const pos = b.position;
      const start = pos && pos.spineIndex < e.spine.length ? pos : undefined;
      pendingTarget.current = start ? { kind: 'fraction', value: start.fraction } : { kind: 'start' };
      setBook(b);
      setEpub(e);
      setSpineIndex(start?.spineIndex ?? 0);
    })().catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => () => chapterRef.current?.dispose(), []);

  const pageOf = useCallback((el: Element) => {
    const content = contentRef.current!;
    const dx = el.getBoundingClientRect().left - content.getBoundingClientRect().left;
    return Math.max(0, Math.floor((dx + 2) / strideRef.current));
  }, []);

  /** First word (or block) visible on `p`, used to keep the reading position when the layout changes. */
  const firstVisible = useCallback(
    (p: number) => {
      const content = contentRef.current;
      if (!content) return undefined;
      let items = content.querySelectorAll('.sw');
      if (!items.length) items = content.querySelectorAll('p, h1, h2, h3, li, img, div');
      let lo = 0;
      let hi = items.length - 1;
      let found: Element | undefined;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (pageOf(items[mid]) >= p) {
          found = items[mid];
          hi = mid - 1;
        } else lo = mid + 1;
      }
      return found;
    },
    [pageOf],
  );

  /** Number of words on page `p` of the current chapter. */
  const wordsOnPage = useCallback(
    (p: number) => {
      const items = contentRef.current?.querySelectorAll('.sw');
      if (!items?.length) return 0;
      const firstIndexOnOrAfter = (target: number) => {
        let lo = 0;
        let hi = items.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (pageOf(items[mid]) >= target) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      };
      return firstIndexOnOrAfter(p + 1) - firstIndexOnOrAfter(p);
    },
    [pageOf],
  );

  // Statistics: time spent on each page. Saved when the page changes, the reader closes or the app goes to the background.
  const readRef = useRef<{ key: string; start: number; words: number }>(undefined);
  const finishRead = useCallback(() => {
    const r = readRef.current;
    readRef.current = undefined;
    if (!r) return;
    const ms = Date.now() - r.start;
    if (ms >= MIN_READ_MS) addPageRead({ bookId, at: r.start, ms, words: r.words });
  }, [bookId]);
  const startRead = useCallback(
    (key: string, words: number) => (readRef.current = { key, start: Date.now(), words }),
    [],
  );
  useEffect(() => {
    const onVisibility = () => {
      const current = readRef.current;
      if (document.visibilityState === 'hidden') {
        finishRead();
        // Remember which page was open so the timer restarts on return.
        if (current) readRef.current = { ...current, start: Number.NaN };
      } else if (current && Number.isNaN(current.start)) {
        startRead(current.key, current.words);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (readRef.current && !Number.isNaN(readRef.current.start)) finishRead();
    };
  }, [finishRead, startRead]);

  /** Measure the columns and move to `target`. */
  const layout = useCallback(
    (target: Target) => {
      const content = contentRef.current;
      if (!content) return;
      const { stride, count } = paginate(content);
      strideRef.current = stride;
      let p = 0;
      if (target.kind === 'end') p = count - 1;
      else if (target.kind === 'fraction') p = Math.round(target.value * (count - 1));
      else if (target.kind === 'fragment') {
        const el = content.querySelector(`[id="${CSS.escape(target.id)}"]`);
        if (el) p = pageOf(el);
      } else if (target.kind === 'anchor' && content.contains(target.el)) p = pageOf(target.el);
      p = Math.min(count - 1, Math.max(0, p));
      animateRef.current = false;
      setPageCount(count);
      setPage(p);
      setLayoutId((n) => n + 1);
    },
    [pageOf],
  );

  // Load, annotate and paginate the current chapter.
  useEffect(() => {
    if (!epub || spineIndex === undefined) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      const chapter = await loadChapter(epub, spineIndex);
      if (cancelled) return chapter.dispose();
      const content = contentRef.current!;
      content.replaceChildren(chapter.body);
      chapterRef.current?.dispose();
      chapterRef.current = chapter;
      if (engine) annotate(content, engine);
      await waitForLayout(content);
      if (cancelled) return;
      layout(pendingTarget.current);
      setReady(true);
    })().catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [epub, spineIndex, engine, layout]);

  // Helper on/off and mode.
  useEffect(() => {
    if (ready) applyHelperMode(contentRef.current!, settings.enabled, settings.helper, settings.minSyllables);
  }, [ready, settings.enabled, settings.helper, settings.minSyllables]);

  // Re-paginate when text settings or the window size change, keeping the first visible word.
  const relayout = useCallback(() => {
    if (ready) layout(anchorRef.current ? { kind: 'anchor', el: anchorRef.current } : { kind: 'start' });
  }, [ready, layout]);
  useEffect(() => {
    // Make sure a newly chosen font is loaded before measuring.
    document.fonts?.load(`${settings.fontSize}px ${FONTS[settings.font].css}`).catch(() => {}).finally(relayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.font, settings.fontSize, settings.lineHeight, settings.letterSpacing, settings.wordSpacing]);
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let width = vp.clientWidth;
    let height = vp.clientHeight;
    setViewportSize(`${width}x${height}`);
    const ro = new ResizeObserver(() => {
      if (vp.clientWidth === width && vp.clientHeight === height) return;
      width = vp.clientWidth;
      height = vp.clientHeight;
      setViewportSize(`${width}x${height}`);
      relayout();
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [relayout]);

  // Page numbers over the whole book: every chapter is measured in the background with the same layout.
  const chapterCounts = useChapterPageCounts(
    epub,
    measureRef,
    [settings.font, settings.fontSize, settings.lineHeight, settings.letterSpacing, settings.wordSpacing, viewportSize].join('|'),
  );
  const bookPages = useMemo(() => {
    if (!chapterCounts || spineIndex === undefined || chapterCounts.length !== epub?.spine.length) return undefined;
    // The visible chapter's live count wins over the background measurement.
    const counts = chapterCounts.map((c, i) => (i === spineIndex ? pageCount : c));
    const before = counts.slice(0, spineIndex).reduce((a, b) => a + b, 0);
    return { current: before + page + 1, total: counts.reduce((a, b) => a + b, 0) };
  }, [chapterCounts, spineIndex, page, pageCount, epub]);

  // Move to the current page, then remember the first visible word and save progress.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !ready || spineIndex === undefined || !epub) return;
    content.style.transition = animateRef.current ? 'transform 0.28s ease' : 'none';
    content.style.transform = `translateX(${-page * strideRef.current}px)`;
    anchorRef.current = firstVisible(page);
    const fraction = pageCount > 1 ? page / (pageCount - 1) : 0;
    const percent = bookPages
      ? bookPages.current / bookPages.total
      : (spineIndex + (page + 1) / pageCount) / epub.spine.length;
    savePosition(bookId, { spineIndex, fraction, percent });

    const key = `${spineIndex}:${page}`;
    if (readRef.current?.key !== key && document.visibilityState === 'visible') {
      finishRead();
      startRead(key, wordsOnPage(page));
    }
    if (spineIndex === epub.spine.length - 1 && page === pageCount - 1) markFinished(bookId);
  }, [page, pageCount, layoutId, ready, spineIndex, epub, bookId, firstVisible, bookPages, finishRead, startRead, wordsOnPage]);

  const next = useCallback(() => {
    const { page, pageCount, spineIndex, spineLength } = nav.current;
    if (spineIndex === undefined) return;
    if (page < pageCount - 1) {
      animateRef.current = true;
      setPage(page + 1);
    } else if (spineIndex < spineLength - 1) {
      pendingTarget.current = { kind: 'start' };
      setSpineIndex(spineIndex + 1);
    }
  }, []);

  const prev = useCallback(() => {
    const { page, spineIndex } = nav.current;
    if (spineIndex === undefined) return;
    if (page > 0) {
      animateRef.current = true;
      setPage(page - 1);
    } else if (spineIndex > 0) {
      pendingTarget.current = { kind: 'end' };
      setSpineIndex(spineIndex - 1);
    }
  }, []);

  const goTo = useCallback(
    (href: string) => {
      if (!epub) return;
      const [path, id] = href.split('#');
      const index = epub.spine.indexOf(path);
      if (index < 0) return;
      const target: Target = id ? { kind: 'fragment', id } : { kind: 'start' };
      setPanel(undefined);
      if (index === nav.current.spineIndex) layout(target);
      else {
        pendingTarget.current = target;
        setSpineIndex(index);
      }
    },
    [epub, layout],
  );

  // Keyboard (web / tablets with keyboards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) next();
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) prev();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, panel]);

  // Taps and swipes.
  const down = useRef<{ x: number; y: number } | undefined>(undefined);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 0) down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = down.current;
    down.current = undefined;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? next() : prev();
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;

    const target = e.target as Element;
    const link = target.closest('[data-href]');
    if (link) return goTo(link.getAttribute('data-href')!);
    const word = target.closest<HTMLElement>('.sw');
    if (word && settings.enabled && settings.helper === 'tap') {
      word.classList.toggle('on', word.classList.toggle('revealed'));
      return;
    }
    const rect = viewportRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.3) prev();
    else if (x > 0.7) next();
  };

  const chapterLabel = useMemo(() => {
    if (!epub || spineIndex === undefined) return '';
    const path = epub.spine[spineIndex];
    let label = '';
    const walk = (entries: TocEntry[]) =>
      entries.forEach((t) => {
        if (t.href.split('#')[0] === path && !label) label = t.label;
        walk(t.children);
      });
    walk(epub.toc);
    return label;
  }, [epub, spineIndex]);

  if (error) {
    return (
      <div className="reader-error">
        <p>{error}</p>
        <button className="primary" onClick={onClose}>
          Retour à la bibliothèque
        </button>
      </div>
    );
  }

  const atStart = page === 0 && spineIndex === 0;
  const atEnd = !!epub && page === pageCount - 1 && spineIndex === epub.spine.length - 1;

  return (
    <div className="reader">
      <header className="reader-top">
        <button className="icon-button" onClick={onClose} aria-label="Retour à la bibliothèque">
          <Icon d="M15 5l-7 7 7 7" />
        </button>
        <h1 className="chapter-line" title={book?.title}>
          <span className="chapter">{chapterLabel || book?.title}</span>
          <span className="chapter-page">
            {' · '}
            {page + 1} / {pageCount}
          </span>
        </h1>
        {!!epub?.toc.length && (
          <button className="icon-button" onClick={() => setPanel('toc')} aria-label="Table des matières">
            <Icon d="M4 6h16M4 12h16M4 18h10" />
          </button>
        )}
        <button className="icon-button text-button" onClick={() => setPanel('settings')} aria-label="Réglages">
          Aa
        </button>
      </header>

      <div
        ref={viewportRef}
        className="viewport"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (down.current = undefined)}
      >
        <div
          ref={contentRef}
          className={`content ${className}${settings.helper === 'tap' ? ' tap-mode' : ''}`}
          style={{ ...style, visibility: ready ? 'visible' : 'hidden' }}
          lang={book?.language || 'fr'}
        />
        <div ref={measureRef} className={`content measure ${className}`} style={style} aria-hidden="true" />
      </div>

      <footer className="reader-bottom">
        <button className="icon-button" onClick={prev} disabled={atStart} aria-label="Page précédente">
          <Icon d="M15 5l-7 7 7 7" />
        </button>
        <div className="where">
          <span>{bookPages ? `Page ${bookPages.current} / ${bookPages.total}` : 'Page …'}</span>
        </div>
        <button className="icon-button" onClick={next} disabled={atEnd} aria-label="Page suivante">
          <Icon d="M9 5l7 7-7 7" />
        </button>
      </footer>

      <button
        className="helper-fab"
        aria-pressed={settings.enabled}
        disabled={!engine}
        onClick={() => update({ enabled: !settings.enabled })}
        aria-label={settings.enabled ? 'Cacher les syllabes' : 'Montrer les syllabes'}
        title={engine ? 'Syllabes' : "L'aide n'est pas disponible pour la langue de ce livre"}
      >
        <span className="fab-a">sy</span>
        <span className="fab-b">lla</span>
      </button>

      {panel === 'settings' && (
        <SettingsPanel onClose={() => setPanel(undefined)} helperAvailable={!!engine} language={book?.language} />
      )}
      {panel === 'toc' && epub && (
        <TocPanel toc={epub.toc} current={epub.spine[spineIndex ?? 0]} onSelect={goTo} onClose={() => setPanel(undefined)} />
      )}
    </div>
  );
}

export const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
