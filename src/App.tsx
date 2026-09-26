import { useEffect, useState } from 'react';
import { Library } from './library/Library';
import { Reader } from './reader/Reader';
import { Stats } from './stats/StatsScreen';
import { useSettings } from './settings';

/** Minimal hash routing so the Android back button and browser history work. */
function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onHash = () => setHash(location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const m = /^#\/lire\/(.+)$/.exec(hash);
  return { bookId: m ? decodeURIComponent(m[1]) : undefined, stats: hash === '#/stats' };
}

let openedFromLibrary = false;

export function App() {
  const { bookId, stats } = useRoute();
  const { settings } = useSettings();

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const go = (hash: string) => {
    openedFromLibrary = true;
    location.hash = hash;
  };
  // Go back in history when we came from the library, so the back button does not return to the book.
  const close = () => (openedFromLibrary ? history.back() : (location.hash = ''));

  if (bookId) return <Reader key={bookId} bookId={bookId} onClose={close} />;
  if (stats) return <Stats onClose={close} />;
  return <Library onOpen={(id) => go(`#/lire/${encodeURIComponent(id)}`)} onStats={() => go('#/stats')} />;
}
