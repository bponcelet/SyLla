// Exception lists for the French engine. Entries are lowercase, singular/base forms
// (the final plural "s"/"x" is removed before lookup).

const set = (words: string) => new Set(words.trim().split(/\s+/));

/**
 * Whole-word overrides, written as syllables separated by "-" with silent letters in "()".
 * Use for words the rules cannot get right.
 */
export const OVERRIDES: Record<string, string> = {
  est: 'e(st)',
  et: 'e(t)',
  août: '(a)oû(t)',
  paon: 'p(a)on',
  faon: 'f(a)on',
  taon: 't(a)on',
  fils: 'fi(l)s',
  pouls: 'pou(ls)',
  sept: 'se(p)t',
  vingt: 'vin(gt)',
  doigt: 'doi(gt)',
  doigts: 'doi(gts)',
  respect: 'res-pe(ct)',
  aspect: 'as-pe(ct)',
  suspect: 'sus-pe(ct)',
  instinct: 'ins-tin(ct)',
  monsieur: 'mon-sieu(r)',
  messieurs: 'mes-sieu(rs)',
  oignon: 'o(i)-gnon',
  automne: 'au-to(m)n(e)',
  œufs: 'œu(fs)',
  oeufs: 'oeu(fs)',
  bœufs: 'bœu(fs)',
  boeufs: 'boeu(fs)',
  second: 'se-con(d)',
  seconde: 'se-cond(e)',
  ennemi: 'e-nne-mi',
  ennemis: 'e-nne-mi(s)',
  os: 'os',
};

/** Elided prefixes written before an apostrophe: l'école, qu'il, jusqu'à… */
export const ELISIONS = set('l d j m t s n c qu jusqu lorsqu puisqu quoiqu presqu');

/** Words after which a word ending in "-ent" is a verb (ils mangent, elles se lavent…). */
export const VERB_CONTEXT = set('ils elles qui ne se me te les leur lui nous vous s n m t');

/** Polysyllables ending in "-ent" where "ent" is pronounced (nouns, adjectives, adverbs). */
export const ENT_PRONOUNCED = set(`
  accident adolescent agent argent ardent absent accent apparent arpent auvent client compétent
  content couvent décent différent diligent éloquent équivalent évident excellent fréquent impatient
  imprudent incident indulgent innocent insolent intelligent intermittent occident orient parent
  patient permanent pertinent présent président prudent récent récipient régent résident serpent
  souvent talent torrent trident urgent violent paravent précédent négligent transparent onguent
  confident continent ingrédient quotient inconvénient coefficient expédient affluent confluent
  laurent vincent florent clément innocent omniprésent adjacent excédent
`);

export const S_PRONOUNCED = set(`
  bus autobus ours mars tennis cactus virus hélas atlas bis sens maïs jadis oasis iris lys vis
  terminus bonus campus cosmos rhinocéros albatros tournevis gratis papyrus pancréas prospectus
  lapsus chorus humus sinus thermos biceps forceps ananas fœtus vénus bis anis myosotis
`);

export const X_PRONOUNCED = set(`
  six dix index lynx box silex thorax larynx sphinx phénix onyx fax max relax latex lux duplex
  codex vortex
`);

export const T_PRONOUNCED = set(`
  net huit brut dot zut chut ouest but mat rapt concept compact correct direct strict tact intact
  contact abrupt transit kit scout short test toast yacht internet basket ticket cricket budget
  granit whist christ rut scorbut occiput azimut mazout yaourt exact infect
`);

export const D_PRONOUNCED = set('sud raid stand plaid caïd celluloïd bled david alfred madrid end pad');

export const P_PRONOUNCED = set(`
  cap cep hop stop top slip clip ketchup handicap gap scalp hip flop pop rap jeep sloop julep croup
`);

export const Z_PRONOUNCED = set('gaz quiz fez oz hertz quartz berlioz suez rodez');

/** Final "c" is silent in these words (other than after a nasal vowel, which is handled by rule). */
export const C_SILENT = set('tabac estomac porc caoutchouc croc accroc escroc marc clerc broc');

/** Final "c" after a nasal vowel that is still pronounced. */
export const C_PRONOUNCED_AFTER_NASAL = set('donc zinc');

export const F_SILENT = set('clef cerf nerf');

export const L_SILENT = set('gentil outil fusil sourcil persil nombril saoul soûl cul');

/** Words ending in "-er" where the "r" is pronounced (the default is infinitive-like "-er" = "é"). */
export const ER_PRONOUNCED = set(`
  hier fier hiver enfer super cancer laser hamster amer revolver poster mixer cuiller lucifer jupiter
  gangster starter leader bunker docker pullover reporter cocker joker poker scooter cutter charter
  cracker bulldozer geyser burger hamburger éther esther peter walter oliver jennifer tender sprinter
  partner magister
`);
