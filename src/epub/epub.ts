import JSZip from 'jszip';

export interface TocEntry {
  label: string;
  href: string; // resolved zip path, optionally with #fragment
  children: TocEntry[];
}

export interface EpubMetadata {
  title: string;
  author: string;
  language?: string;
}

export interface Epub {
  metadata: EpubMetadata;
  /** Zip paths of the reading-order documents. */
  spine: string[];
  toc: TocEntry[];
  coverPath?: string;
  zip: JSZip;
}

const DC = 'http://purl.org/dc/elements/1.1/';

/** Resolve `href` relative to the zip path `from`, dropping any #fragment. */
export function resolvePath(from: string, href: string): string {
  const url = new URL(href, `https://epub.invalid/${from}`);
  return decodeURIComponent(url.pathname.slice(1));
}

function resolveHref(from: string, href: string): string {
  const hash = href.indexOf('#');
  const path = resolvePath(from, hash >= 0 ? href.slice(0, hash) || from.split('/').pop()! : href);
  return hash >= 0 ? `${path}${href.slice(hash)}` : path;
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Fichier manquant dans l'EPUB : ${path}`);
  return file.async('string');
}

const byLocalName = (root: Document | Element, name: string) =>
  Array.from(root.getElementsByTagName('*')).filter((e) => e.localName === name);

export async function openEpub(data: Blob | ArrayBuffer): Promise<Epub> {
  const zip = await JSZip.loadAsync(data);
  if (zip.file('META-INF/encryption.xml')) {
    const enc = await readText(zip, 'META-INF/encryption.xml');
    // Font obfuscation is fine; anything else means DRM.
    if (/EncryptedData/.test(enc) && !/http:\/\/www\.idpf\.org\/2008\/embedding|http:\/\/ns\.adobe\.com\/pdf\/enc#RC/.test(enc)) {
      throw new Error('Ce livre est protégé par DRM et ne peut pas être ouvert.');
    }
  }

  const container = parseXml(await readText(zip, 'META-INF/container.xml'));
  const opfPath = byLocalName(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!opfPath) throw new Error('EPUB invalide : pas de fichier OPF.');
  const opf = parseXml(await readText(zip, opfPath));

  const dcText = (name: string) => opf.getElementsByTagNameNS(DC, name)[0]?.textContent?.trim() ?? '';
  const metadata: EpubMetadata = {
    title: dcText('title') || 'Sans titre',
    author: dcText('creator'),
    language: dcText('language') || undefined,
  };

  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const item of byLocalName(opf, 'item')) {
    manifest.set(item.getAttribute('id') ?? '', {
      href: resolvePath(opfPath, item.getAttribute('href') ?? ''),
      type: item.getAttribute('media-type') ?? '',
      props: item.getAttribute('properties') ?? '',
    });
  }

  const spineEl = byLocalName(opf, 'spine')[0];
  const spine = byLocalName(opf, 'itemref')
    .filter((ref) => ref.getAttribute('linear') !== 'no')
    .map((ref) => manifest.get(ref.getAttribute('idref') ?? '')?.href)
    .filter((h): h is string => !!h);
  if (!spine.length) throw new Error('EPUB invalide : le livre est vide.');

  // Cover: EPUB 3 "cover-image", EPUB 2 <meta name="cover">, then any image named "cover".
  const items = [...manifest.values()];
  const coverMeta = byLocalName(opf, 'meta').find((m) => m.getAttribute('name') === 'cover');
  const coverPath =
    items.find((i) => i.props.split(/\s+/).includes('cover-image'))?.href ??
    manifest.get(coverMeta?.getAttribute('content') ?? '')?.href ??
    items.find((i) => i.type.startsWith('image/') && /cover|couverture/i.test(i.href))?.href;

  let toc: TocEntry[] = [];
  try {
    const nav = items.find((i) => i.props.split(/\s+/).includes('nav'));
    const ncx = manifest.get(spineEl?.getAttribute('toc') ?? '') ?? items.find((i) => i.type === 'application/x-dtbncx+xml');
    if (nav) toc = parseNav(parseXml(await readText(zip, nav.href)), nav.href);
    if (!toc.length && ncx) toc = parseNcx(parseXml(await readText(zip, ncx.href)), ncx.href);
  } catch {
    // A broken table of contents should not prevent reading.
  }

  return { metadata, spine, toc, coverPath, zip };
}

function parseNav(doc: Document, navPath: string): TocEntry[] {
  const navs = byLocalName(doc, 'nav');
  const tocNav = navs.find((n) => /toc/.test(n.getAttribute('epub:type') ?? n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '')) ?? navs[0];
  const ol = tocNav && byLocalName(tocNav, 'ol')[0];
  const walk = (list: Element): TocEntry[] =>
    Array.from(list.children)
      .filter((li) => li.localName === 'li')
      .map((li) => {
        const a = Array.from(li.children).find((c) => c.localName === 'a' || c.localName === 'span');
        const sub = Array.from(li.children).find((c) => c.localName === 'ol');
        return {
          label: a?.textContent?.trim() ?? '',
          href: a?.getAttribute('href') ? resolveHref(navPath, a.getAttribute('href')!) : '',
          children: sub ? walk(sub) : [],
        };
      })
      .filter((e) => e.label);
  return ol ? walk(ol) : [];
}

function parseNcx(doc: Document, ncxPath: string): TocEntry[] {
  const walk = (parent: Element): TocEntry[] =>
    Array.from(parent.children)
      .filter((c) => c.localName === 'navPoint')
      .map((np) => ({
        label: byLocalName(np, 'text')[0]?.textContent?.trim() ?? '',
        href: resolveHref(ncxPath, byLocalName(np, 'content')[0]?.getAttribute('src') ?? ''),
        children: walk(np),
      }))
      .filter((e) => e.label);
  const navMap = byLocalName(doc, 'navMap')[0];
  return navMap ? walk(navMap) : [];
}

export async function readBlob(epub: Epub, path: string): Promise<Blob | undefined> {
  const file = epub.zip.file(path);
  if (!file) return undefined;
  const type = /\.png$/i.test(path) ? 'image/png' : /\.svg$/i.test(path) ? 'image/svg+xml' : /\.gif$/i.test(path) ? 'image/gif' : /\.webp$/i.test(path) ? 'image/webp' : 'image/jpeg';
  return new Blob([await file.async('arraybuffer')], { type });
}

export interface Chapter {
  /** Sanitised body content, ready to be inserted into the page. */
  body: DocumentFragment;
  /** Revoke the object URLs created for images. */
  dispose: () => void;
}

const DROP = new Set(['script', 'style', 'link', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'audio', 'video', 'meta', 'title', 'base']);

/**
 * Load one spine document and turn it into safe DOM for our own reader:
 * publisher CSS and scripts are dropped (we control fonts and spacing),
 * images become blob URLs, internal links become `data-href`.
 */
export async function loadChapter(epub: Epub, index: number): Promise<Chapter> {
  const path = epub.spine[index];
  const text = await readText(epub.zip, path);
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(text, 'text/html');

  const urls: string[] = [];
  const blobUrl = async (src: string) => {
    const blob = await readBlob(epub, resolvePath(path, src));
    if (!blob) return '';
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return url;
  };

  const body = doc.getElementsByTagName('body')[0] ?? doc.documentElement;
  const all = Array.from(body.getElementsByTagName('*'));
  for (const el of all) {
    const name = el.localName.toLowerCase();
    if (DROP.has(name)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on') || n === 'style' || n === 'class' || n === 'srcset') el.removeAttribute(attr.name);
    }
    if (name === 'img') {
      const src = el.getAttribute('src');
      el.setAttribute('src', src ? await blobUrl(src) : '');
    } else if (name === 'image') {
      const href = el.getAttribute('href') ?? el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (href) el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', await blobUrl(href));
      el.removeAttribute('href');
    } else if (name === 'a') {
      const href = el.getAttribute('href');
      el.removeAttribute('href');
      if (href && !/^[a-z]+:/i.test(href)) el.setAttribute('data-href', resolveHref(path, href));
      else if (href && /^https?:/i.test(href)) el.setAttribute('data-external', href);
    }
  }

  const frag = document.createDocumentFragment();
  for (const child of Array.from(body.childNodes)) frag.append(document.importNode(child, true));
  return { body: frag, dispose: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}
