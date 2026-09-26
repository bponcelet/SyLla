import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { openEpub, readBlob } from '../epub/epub';

export interface ReadingPosition {
  spineIndex: number;
  /** Position inside the chapter, 0..1. */
  fraction: number;
  /** Overall progress, 0..1 (approximate). */
  percent: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  language?: string;
  cover?: Blob;
  size: number;
  addedAt: number;
  lastReadAt?: number;
  position?: ReadingPosition;
  /** When the last page was first reached. */
  finishedAt?: number;
}

/** One page shown in the reader, used for statistics. */
export interface PageRead {
  id?: number;
  bookId: string;
  /** When the page appeared (ms since epoch). */
  at: number;
  /** Time the page was actually visible (app in background excluded). */
  ms: number;
  /** Words on the page (0 when the language has no syllable engine). */
  words: number;
}

interface LibraryDB extends DBSchema {
  books: { key: string; value: Book };
  files: { key: string; value: Blob };
  reads: { key: number; value: PageRead; indexes: { at: number; bookId: string } };
}

let dbPromise: Promise<IDBPDatabase<LibraryDB>> | undefined;

function db() {
  dbPromise ??= openDB<LibraryDB>('sylla-read', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('books', { keyPath: 'id' });
        d.createObjectStore('files');
      }
      if (oldVersion < 2) {
        const reads = d.createObjectStore('reads', { keyPath: 'id', autoIncrement: true });
        reads.createIndex('at', 'at');
        reads.createIndex('bookId', 'bookId');
      }
    },
  });
  return dbPromise;
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export async function listBooks(): Promise<Book[]> {
  return (await db()).getAll('books');
}

export async function getBook(id: string) {
  return (await db()).get('books', id);
}

export async function getBookFile(id: string) {
  return (await db()).get('files', id);
}

export async function importEpub(file: File): Promise<Book> {
  const epub = await openEpub(file);
  const existing = (await listBooks()).find(
    (b) => b.title === epub.metadata.title && b.author === epub.metadata.author && b.size === file.size,
  );
  if (existing) return existing;

  const book: Book = {
    id: newId(),
    title: epub.metadata.title,
    author: epub.metadata.author,
    language: epub.metadata.language,
    cover: epub.coverPath ? await readBlob(epub, epub.coverPath) : undefined,
    size: file.size,
    addedAt: Date.now(),
  };
  const d = await db();
  const tx = d.transaction(['books', 'files'], 'readwrite');
  await Promise.all([tx.objectStore('files').put(file, book.id), tx.objectStore('books').put(book), tx.done]);
  return book;
}

export async function savePosition(id: string, position: ReadingPosition) {
  // One readwrite transaction per save: IndexedDB runs them in order, so rapid saves never overwrite a newer position.
  const tx = (await db()).transaction('books', 'readwrite');
  const book = await tx.store.get(id);
  if (book) await tx.store.put({ ...book, position, lastReadAt: Date.now() });
  await tx.done;
}

export async function markFinished(id: string) {
  const tx = (await db()).transaction('books', 'readwrite');
  const book = await tx.store.get(id);
  if (book && !book.finishedAt) await tx.store.put({ ...book, finishedAt: Date.now() });
  await tx.done;
}

export async function addPageRead(read: PageRead) {
  await (await db()).add('reads', read);
}

export async function listPageReads(): Promise<PageRead[]> {
  return (await db()).getAllFromIndex('reads', 'at');
}

export async function clearStatistics() {
  const d = await db();
  await d.clear('reads');
  const tx = d.transaction('books', 'readwrite');
  for (const book of await tx.store.getAll()) {
    if (book.finishedAt) await tx.store.put({ ...book, finishedAt: undefined });
  }
  await tx.done;
}

export async function deleteBook(id: string) {
  const d = await db();
  const tx = d.transaction(['books', 'files'], 'readwrite');
  await Promise.all([tx.objectStore('books').delete(id), tx.objectStore('files').delete(id), tx.done]);
}

/** Books bundled with the app (in public/books/), added to the library on first launch. */
const DEFAULT_BOOKS = ['books/les-malheurs-de-sophie.epub'];
const SEEDED_KEY = 'sylla-read.default-books-added';
let seeding: Promise<boolean> | undefined;

/**
 * Add the bundled books once. Resolves to true when books were added. A book the user deletes
 * later is not added back.
 */
export function addDefaultBooks(): Promise<boolean> {
  seeding ??= (async () => {
    try {
      if (localStorage.getItem(SEEDED_KEY)) return false;
    } catch {
      // Without storage we cannot remember; only seed an empty library.
      if ((await listBooks()).length) return false;
    }
    let added = false;
    for (const path of DEFAULT_BOOKS) {
      try {
        const res = await fetch(path);
        if (!res.ok) continue;
        const name = path.split('/').pop()!;
        await importEpub(new File([await res.blob()], name, { type: 'application/epub+zip' }));
        added = true;
      } catch {
        // A missing bundled book must not break the library.
      }
    }
    try {
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {
      // Ignore.
    }
    return added;
  })();
  return seeding;
}

/** Ask the browser not to evict the library when storage is low. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
