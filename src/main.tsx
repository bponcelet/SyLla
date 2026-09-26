import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/andika/400.css';
import '@fontsource/andika/700.css';
import '@fontsource/lexend/400.css';
import '@fontsource/opendyslexic/400.css';
import './styles.css';
import { App } from './App';
import { SettingsProvider } from './settings';
import { requestPersistentStorage } from './library/db';
import { hideSplash } from './splash';

requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
);

// After the first paint of the app underneath.
requestAnimationFrame(() => requestAnimationFrame(hideSplash));
