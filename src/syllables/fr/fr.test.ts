import { describe, expect, it } from 'vitest';
import { frenchEngine } from './index';
import type { Syllable } from '../types';

/** "pe-tit(e)": syllables joined by "-", silent letters in parentheses. */
const format = (syllables: Syllable[]) =>
  syllables.map((s) => s.parts.map((p) => (p.silent ? `(${p.text})` : p.text)).join('')).join('-');

const cases: [string, string, string?][] = [
  // [word, expected, previous word]
  ['chat', 'cha(t)'],
  ['chats', 'cha(ts)'],
  ['petite', 'pe-tit(e)'],
  ['maison', 'mai-son'],
  ['école', 'é-col(e)'],
  ["l'école", "l'é-col(e)"],
  ['papillon', 'pa-pi-llon'],
  ['fille', 'fill(e)'],
  ['soleil', 'so-leil'],
  ['travail', 'tra-vail'],
  ['grenouille', 'gre-nouill(e)'],
  ['paille', 'paill(e)'],
  ['table', 'tabl(e)'],
  ['chocolat', 'cho-co-la(t)'],
  ['mangent', 'mang(ent)', 'ils'],
  ['moment', 'mo-men(t)'],
  ['aiment', 'aim(ent)', 'ils'],
  ['enfant', 'en-fan(t)'],
  ['éléphant', 'é-lé-phan(t)'],
  ['ballon', 'ba-llon'],
  ['instruit', 'ins-trui(t)'],
  ['piano', 'pia-no'],
  ['crier', 'cri-e(r)'],
  ['manger', 'man-ge(r)'],
  ['hiver', '(h)i-ver'],
  ['mer', 'mer'],
  ['homme', '(h)omm(e)'],
  ['cahier', 'ca-(h)ie(r)'],
  ["aujourd'hui", "au-jour-d'(h)ui"],
  ['oiseau', 'oi-seau'],
  ['bonbon', 'bon-bon'],
  ['chien', 'chien'],
  ['action', 'ac-tion'],
  ['crayon', 'cra-yon'],
  ['fruit', 'frui(t)'],
  ['nuit', 'nui(t)'],
  ['les', 'le(s)'],
  ['et', 'e(t)'],
  ['est', 'e(st)'],
  ['grand', 'gran(d)'],
  ['temps', 'tem(ps)'],
  ['bus', 'bus'],
  ['as', 'a(s)'],
  ['fils', 'fi(l)s'],
  ['mangeons', 'man-g(e)on(s)'],
  ['année', 'a-nné(e)'],
  ['une', 'un(e)'],
  ['que', 'que'],
  ['chaque', 'chaqu(e)'],
  ['langue', 'langu(e)'],
  ['femme', 'femm(e)'],
  ['maïs', 'ma-ïs'],
  ['Noël', 'No-ël'],
  ['oui', 'oui'],
  ['jouer', 'jou-e(r)'],
  ['orgueil', 'or-gueil'],
  ['accueil', 'a-ccueil'],
  ['ennui', 'en-nui'],
  ['mangeaient', 'man-g(e)ai(ent)'],
  ['viennent', 'vienn(ent)'],
  ['parents', 'pa-ren(ts)'],
  ['blanc', 'blan(c)'],
  ['pied', 'pie(d)'],
  ['nez', 'ne(z)'],
  ['œil', 'œil'],
  ['yeux', 'yeu(x)'],
  ['Papa', 'Pa-pa'],
  ['stylo', 'sty-lo'],
  ['deux', 'deu(x)'],
  ['vent', 'ven(t)'],
  ['souvent', 'sou-ven(t)'],
  ['oublient', 'ou-bli(ent)'],
  ['livre', 'livr(e)'],
  ['question', 'ques-tion'],
  ['escargot', 'es-car-go(t)'],
  ['garçon', 'gar-çon'],
  ['poisson', 'poi-sson'],
  ['guitare', 'gui-tar(e)'],
  ['dehors', 'de-(h)or(s)'],
  ['inhabité', 'i-n(h)a-bi-té'],
  ['obstiné', 'obs-ti-né'],
  ['lapin', 'la-pin'],
  ['princesse', 'prin-cess(e)'],
  ['château', 'châ-teau'],
  ['sorcière', 'sor-cièr(e)'],
  ['dragon', 'dra-gon'],
  ['arbres', 'arbr(es)'],
  ["qu'il", "qu'il"],
  ["s'aiment", "s'aim(ent)"],
  ["l'argent", "l'ar-gen(t)"],
  ['Georges', 'G(e)org(es)'],
  ['beaucoup', 'beau-cou(p)'],
  ['vieille', 'vieill(e)'],
  ['aiguille', 'ai-guill(e)'],
  ['camion', 'ca-mion'],
  ['maintenant', 'main-te-nan(t)'],
  ['longtemps', 'lon(g)-tem(ps)'],
  ['ongle', 'ongl(e)'],
  ['anglais', 'an-glai(s)'],
];

describe('French spoken syllables', () => {
  it.each(cases)('%s → %s', (word, expected, previous) => {
    expect(format(frenchEngine.syllabify(word, previous))).toBe(expected);
  });

  it('keeps original casing and all letters', () => {
    for (const [word, , prev] of cases) {
      const joined = frenchEngine
        .syllabify(word, prev)
        .flatMap((s) => s.parts.map((p) => p.text))
        .join('');
      expect(joined).toBe(word);
    }
  });
});
