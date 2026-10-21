import { canonicalName, looksLikeGrocery } from './lexicon';

export interface ExtractedItem {
  name: string;
  canonical: string;
  quantity?: string;
  /** The clause of the conversation that produced this item. */
  sourceText: string;
  /** True when the speakers said this no longer needs buying; such items are never added to the list. */
  notNeeded?: boolean;
}

/** Compound names that contain "and" and must not be split into two items. */
const COMPOUNDS = ['mac and cheese', 'half and half', 'salt and pepper', 'peanut butter and jelly', 'fish and chips'];

/** Phrases that mean the speaker does NOT want the item. */
const NEGATED = [
  /\b(?:don't|do not|doesn't|does not|didn't|did not|won't|no longer|never)\s+(?:really\s+|actually\s+)?need\b/,
  /\bno\s+need\b/,
  /\bnot\s+(?:going\s+to\s+)?need\b/,
  /\balready\s+(?:have|has|got|bought|picked|ordered)\b/,
  /\b(?:just|already)\s+(?:bought|got|picked up|ordered)\b/,
  /\b(?:have|got)\s+(?:plenty|enough|lots|a lot)\b/,
];

const MODAL = String.raw`(?:should|have\s+to|has\s+to|gotta|got\s+to|must|remember\s+to|(?:don't|do\s+not)\s+forget\s+to|let's|let\s+us|going\s+to|gonna|will|can\s+you|could\s+you|would\s+you|please|remind\s+me\s+to|need\s+to|needs\s+to|want\s+to|wanna)`;

interface Trigger {
  re: RegExp;
  /** Index of the capture group holding the item phrase. */
  group: number;
  /** Explicit "add to list" requests skip the grocery-word check. */
  explicit?: boolean;
}

const TRIGGERS: Trigger[] = [
  { re: /\badd\s+(.+?)\s+to\s+(?:the\s+|my\s+|our\s+)?(?:shopping|grocery|groceries|shopping\s+list|grocery\s+list|list|cart)\b/, group: 1, explicit: true },
  { re: /\bout\s+of\s+(.+)/, group: 1 },
  { re: /\b(?:ran|run|running)\s+out\s+of\s+(.+)/, group: 1 },
  { re: /\blow\s+on\s+(.+)/, group: 1 },
  { re: /\b(?:short\s+on|missing)\s+(.+)/, group: 1 },
  { re: /\bno\s+more\s+(.+)/, group: 1 },
  { re: /\b(?:don't|do\s+not)\s+have\s+(?:any\s+|enough\s+)?(.+)/, group: 1 },
  { re: /\b(?:have|got)\s+no\s+(.+)/, group: 1 },
  { re: /\bneed\s+(?:to\s+(?:buy|get|grab|pick\s*up|order|stock\s*up\s+on|restock)\s+|more\s+|some\s+|another\s+)?(.+)/, group: 1 },
  { re: new RegExp(String.raw`\b${MODAL}\s+(?:buy|grab|get|pick\s*up|order|stock\s*up\s+on|restock)\s+(.+)`), group: 1 },
  // "the milk ran out", "eggs are gone", "the bread is finished"
  { re: /^(?:the\s+|our\s+|my\s+)?(.+?)\s+(?:ran\s+out|is\s+gone|are\s+gone|is\s+finished|are\s+finished|is\s+empty|are\s+empty|is\s+all\s+gone|are\s+all\s+gone|is\s+running\s+low|are\s+running\s+low|is\s+almost\s+gone|are\s+almost\s+gone)\b/, group: 1 },
];

/** Where an item phrase stops and the rest of the sentence begins. */
const STOP = new RegExp(
  String.raw`\b(?:so|because|since|but|before|when|if|then|while|though|although|which|that|for\s+(?:the|our|my|dinner|lunch|breakfast|tonight|tomorrow|this|a)|at\s+the|from\s+the|from\s+(?:costco|walmart|target|kroger|trader|whole|aldi|safeway|publix)|tomorrow|today|tonight|later|this\s+(?:week|weekend|morning|evening|afternoon)|next\s+week|soon|asap|right\s+now|again|too|as\s+well|please|or\s+something|or\s+so|i\s+think|you\s+know|on\s+the\s+way|after\s+work)\b`,
);

const NOT_ITEMS = new Set(['it', 'them', 'that', 'those', 'this', 'these', 'some', 'more', 'any', 'one', 'ones', 'stuff', 'things', 'thing', 'something', 'anything', 'everything', 'time', 'ideas', 'idea']);

const UNIT = String.raw`(?:lbs?|pounds?|oz|ounces?|kg|g|dozen|gallons?|liters?|litres?|packs?|packages?|boxes|box|bags?|cartons?|loaves|loaf|bottles?|jars?|cans?|bunch(?:es)?|cases?)`;
const QTY = new RegExp(
  String.raw`^(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|a\s+dozen|half\s+a\s+dozen|dozen|a\s+couple(?:\s+of)?|a\s+few|a\s+bunch\s+of|a\s+pack\s+of|a\s+box\s+of|a\s+bag\s+of|a\s+carton\s+of|a\s+loaf\s+of|a\s+gallon\s+of|a\s+bottle\s+of|a\s+jar\s+of|a\s+can\s+of|a\s+pound\s+of|a\s+case\s+of)\b\s*(${UNIT}\b\s*(?:of\s+)?)?`,
);
const DETERMINERS = /^(?:(?:some|more|any|another|a|an|the|our|my|these|those|that|this|of|extra|fresh)\s+)+/;
/** Like DETERMINERS but leaves "a"/"an" so "a gallon of milk" still reads as a quantity. */
const LEADING_FILLER = /^(?:(?:some|more|any|another|the|our|my|these|those|that|this|extra|fresh)\s+)+/;

export function extractItems(text: string): ExtractedItem[] {
  const found: ExtractedItem[] = [];
  const seen = new Set<string>();

  for (const clause of splitClauses(text)) {
    const lower = clause.toLowerCase().trim();
    if (!lower || NEGATED.some((re) => re.test(lower))) continue;

    for (const trigger of TRIGGERS) {
      const match = trigger.re.exec(lower);
      if (!match) continue;
      for (const item of parseItems(match[trigger.group], trigger.explicit ?? false)) {
        if (seen.has(item.canonical)) continue;
        seen.add(item.canonical);
        found.push({ ...item, sourceText: clause.trim() });
      }
      // The first trigger that yields items wins; later ones would re-read the same words.
      if (found.some((f) => f.sourceText === clause.trim())) break;
    }
  }
  return found;
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.!?;\n]+/)
    .flatMap((sentence) => sentence.split(/,\s*(?=(?:and\s+|but\s+|so\s+)?(?:we|i|you|they|he|she|the|our|my)\b)/i))
    .map((c) => c.replace(/^\s*(?:and|but|so|also|oh|um|uh|yeah|okay|ok|well)\s+/i, '').trim())
    .filter(Boolean);
}

function parseItems(phrase: string, explicit: boolean): Omit<ExtractedItem, 'sourceText'>[] {
  let rest = phrase;
  COMPOUNDS.forEach((c, i) => {
    rest = rest.split(c).join(`\u0000${i}\u0000`);
  });

  const stop = STOP.exec(rest);
  if (stop) rest = rest.slice(0, stop.index);

  const pieces = rest.split(/\s*(?:,|&|\band\b|\bplus\b|\bas\s+well\s+as\b|\balong\s+with\b|\bor\b)\s*/);
  const items: Omit<ExtractedItem, 'sourceText'>[] = [];

  for (const raw of pieces) {
    let piece = raw.replace(/\u0000(\d+)\u0000/g, (_, i) => COMPOUNDS[Number(i)]).trim();
    piece = piece.replace(LEADING_FILLER, '');
    let quantity: string | undefined;
    const q = QTY.exec(piece);
    if (q) {
      quantity = q[0].trim().replace(/\s+of$/, '');
      piece = piece.slice(q[0].length);
    }
    piece = piece.replace(DETERMINERS, '').replace(/[^a-z0-9' -]/g, '').trim();

    const words = piece.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) continue;
    if (words.every((w) => NOT_ITEMS.has(w))) continue;
    if (!explicit && !looksLikeGrocery(piece)) continue;

    items.push({ name: piece, canonical: canonicalName(piece), quantity });
  }
  return items;
}
