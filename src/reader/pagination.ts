import { useEffect, useState, type RefObject } from 'react';
import { loadChapter, type Epub } from '../epub/epub';

/** Horizontal space between two pages (columns). */
export const GAP = 64;

/** Lay `el` out in page-wide columns and return the page count and the distance between pages. */
export function paginate(el: HTMLElement) {
  const width = el.clientWidth;
  el.style.columnWidth = `${width}px`;
  el.style.columnGap = `${GAP}px`;
  const stride = width + GAP;
  return { stride, count: Math.max(1, Math.round((el.scrollWidth + GAP) / stride)) };
}

/** Wait until fonts and images are ready, so measurements are right. */
export async function waitForLayout(root: HTMLElement) {
  await document.fonts?.ready;
  const images = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise((r) => {
            img.addEventListener('load', r, { once: true });
            img.addEventListener('error', r, { once: true });
          }),
      ),
    ),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
}

/**
 * Page count of every chapter, measured in the background in the hidden `measureRef` element
 * (same size and text styles as the visible page). Recomputed whenever `layoutKey` changes;
 * undefined while measuring.
 */
export function useChapterPageCounts(epub: Epub | undefined, measureRef: RefObject<HTMLElement | null>, layoutKey: string) {
  const [counts, setCounts] = useState<number[]>();
  useEffect(() => {
    if (!epub) return;
    let cancelled = false;
    setCounts(undefined);
    // Debounce: sliders and window resizes fire many changes in a row.
    const timer = setTimeout(async () => {
      const el = measureRef.current;
      if (!el) return;
      const result: number[] = [];
      for (let i = 0; i < epub.spine.length; i++) {
        const chapter = await loadChapter(epub, i);
        if (cancelled) return chapter.dispose();
        el.replaceChildren(chapter.body);
        await waitForLayout(el);
        if (cancelled) return chapter.dispose();
        result.push(paginate(el).count);
        el.replaceChildren();
        chapter.dispose();
        await new Promise((r) => setTimeout(r)); // keep the UI responsive
      }
      if (!cancelled) setCounts(result);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [epub, measureRef, layoutKey]);
  return counts;
}
