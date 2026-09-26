import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addDefaultBooks, deleteBook, importEpub, listBooks, type Book } from './db';

type Sort = 'recent' | 'title';

export function Library({ onOpen, onStats }: { onOpen: (id: string) => void; onStats: () => void }) {
  const [books, setBooks] = useState<Book[]>();
  const [sort, setSort] = useState<Sort>('recent');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => listBooks().then(setBooks), []);
  useEffect(() => {
    // First launch: add the example book, then show the library.
    addDefaultBooks().finally(refresh);
  }, [refresh]);

  const sorted = useMemo(() => {
    const list = [...(books ?? [])];
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    else list.sort((a, b) => (b.lastReadAt ?? b.addedAt) - (a.lastReadAt ?? a.addedAt));
    return list;
  }, [books, sort]);

  const importFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /\.epub$/i.test(f.name) || f.type === 'application/epub+zip');
    if (!list.length) {
      setMessage('Choisis un fichier EPUB (.epub).');
      return;
    }
    setBusy(true);
    setMessage(undefined);
    const errors: string[] = [];
    for (const file of list) {
      try {
        await importEpub(file);
      } catch (e) {
        errors.push(`${file.name} : ${e instanceof Error ? e.message : 'fichier illisible'}`);
      }
    }
    setBusy(false);
    if (errors.length) setMessage(errors.join('\n'));
    refresh();
  };

  const remove = async (book: Book) => {
    if (!confirm(`Supprimer « ${book.title} » de la bibliothèque ?`)) return;
    await deleteBook(book.id);
    refresh();
  };

  return (
    <div
      className={`library${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        importFiles(e.dataTransfer.files);
      }}
    >
      <header className="library-header">
        <h1>Ma bibliothèque</h1>
        <div className="library-actions">
          {!!books?.length && (
            <div className="segmented" role="group" aria-label="Trier">
              <button aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>
                Récents
              </button>
              <button aria-pressed={sort === 'title'} onClick={() => setSort('title')}>
                A → Z
              </button>
            </div>
          )}
          <button className="secondary" onClick={onStats}>
            <ChartIcon /> Statistiques
          </button>
          <button className="primary" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? 'Import…' : '+ Ajouter un livre'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".epub,application/epub+zip"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) importFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {message && (
        <p className="notice" role="alert" onClick={() => setMessage(undefined)}>
          {message}
        </p>
      )}

      {books && !books.length && <EmptyState />}

      <ul className="book-grid">
        {sorted.map((b) => (
          <li key={b.id}>
            <BookCard book={b} onOpen={() => onOpen(b.id)} onDelete={() => remove(b)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookCard({ book, onOpen, onDelete }: { book: Book; onOpen: () => void; onDelete: () => void }) {
  const coverUrl = useMemo(() => (book.cover ? URL.createObjectURL(book.cover) : undefined), [book.cover]);
  useEffect(
    () => () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    },
    [coverUrl],
  );
  const percent = Math.round((book.position?.percent ?? 0) * 100);

  return (
    <article className="book-card">
      <button className="book-open" onClick={onOpen} aria-label={`Lire ${book.title}`}>
        {coverUrl ? (
          <img className="cover" src={coverUrl} alt="" />
        ) : (
          <div className="cover generated" style={{ '--hue': hue(book.title) } as CSSProperties}>
            <span>{book.title}</span>
          </div>
        )}
        {percent > 0 && (
          <div className="progress" aria-label={`${percent} % lu`}>
            <div style={{ width: `${percent}%` }} />
          </div>
        )}
      </button>
      <div className="book-meta">
        <div>
          <h2>{book.title}</h2>
          {book.author && <p>{book.author}</p>}
        </div>
        <button className="icon-button" onClick={onDelete} aria-label={`Supprimer ${book.title}`} title="Supprimer">
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <h2>Ta bibliothèque est vide</h2>
      <p>
        Ajoute un livre au format <strong>EPUB sans DRM</strong> avec le bouton « Ajouter un livre »
        {matchMedia('(pointer: fine)').matches && ' ou en le glissant ici'}.
      </p>
      <p>Des livres gratuits en français :</p>
      <ul>
        <li>
          <a href="https://www.ebooksgratuits.com" target="_blank" rel="noreferrer">
            Ebooks libres et gratuits
          </a>
        </li>
        <li>
          <a href="https://www.bibebook.com" target="_blank" rel="noreferrer">
            Bibebook
          </a>
        </li>
        <li>
          <a href="https://www.gutenberg.org/ebooks/search/?query=l.fr" target="_blank" rel="noreferrer">
            Projet Gutenberg (français)
          </a>
        </li>
        <li>
          <a href="https://fr.wikisource.org" target="_blank" rel="noreferrer">
            Wikisource
          </a>
        </li>
      </ul>
    </div>
  );
}

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M5 20V11M12 20V5M19 20v-6" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
    />
  </svg>
);
