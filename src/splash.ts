import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

/** Long enough for the arc animation to finish, short enough not to feel slow. */
const MIN_VISIBLE_MS = 1200;

/**
 * Hand over from the native splash (Android/iOS) to the identical HTML one, then fade the HTML one
 * out once the app has rendered and its fonts are ready.
 */
export async function hideSplash() {
  if (Capacitor.isNativePlatform()) SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});

  await document.fonts?.ready;
  await new Promise((r) => setTimeout(r, Math.max(0, MIN_VISIBLE_MS - performance.now())));
  const el = document.getElementById('splash');
  if (!el) return;
  el.classList.add('hide');
  const remove = () => el.remove();
  el.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 600); // in case transitions are disabled
}
