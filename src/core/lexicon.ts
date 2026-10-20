/**
 * Words that mark a phrase as something you buy at a grocery store.
 * The extractor only accepts an item if one of its words is in here (unless the
 * user said "add X to the list"), which keeps "we're out of time" off the list.
 */
const WORDS = `
egg milk butter cheese yogurt yoghurt cream creamer cheddar mozzarella parmesan feta ricotta
bread bagel bun roll tortilla wrap pita naan baguette toast muffin croissant donut cake cookie cracker pretzel
rice pasta noodle ramen spaghetti macaroni penne lasagna couscous quinoa oat oatmeal cereal granola flour sugar salt pepper
oil vinegar sauce ketchup mustard mayo mayonnaise salsa dressing syrup honey jam jelly nutella
chicken beef pork turkey bacon sausage ham steak salmon tuna fish shrimp tofu tempeh meat patty hotdog
apple banana orange lemon lime grape strawberry blueberry raspberry blackberry berry cherry peach pear plum mango pineapple watermelon melon kiwi avocado coconut
tomato onion garlic potato carrot lettuce spinach kale broccoli cauliflower cucumber pepper zucchini squash mushroom celery corn pea bean lentil chickpea cabbage asparagus eggplant ginger cilantro parsley basil herb salad produce veggie vegetable fruit
coffee tea juice soda water seltzer beer wine cola lemonade kombucha smoothie
chip popcorn nut almond peanut cashew walnut snack candy chocolate icecream gelato
soup broth stock hummus pickle olive
cumin cinnamon paprika spice seasoning
formula diaper wipe
detergent soap shampoo conditioner toothpaste toothbrush deodorant sponge napkin tissue towel foil wrap bag trash cleaner bleach softener
tp
`
  .split(/\s+/)
  .filter(Boolean);

/** Multi-word phrases that don't contain a lexicon word on their own. */
const PHRASES = ['ice cream', 'half and half', 'mac and cheese', 'dog food', 'cat food', 'cat litter', 'pet food'];

const WORD_SET = new Set(WORDS);

/** Crude singulariser; good enough to compare "eggs" with "egg". */
export function singular(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith('ies')) return WORD_SET.has(w.slice(0, -1)) ? w.slice(0, -1) : w.slice(0, -3) + 'y';
  if (/(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function looksLikeGrocery(name: string): boolean {
  const lower = name.toLowerCase();
  if (PHRASES.some((p) => lower.includes(p))) return true;
  return lower
    .split(/[^a-z]+/)
    .filter(Boolean)
    .some((w) => WORD_SET.has(singular(w)) || WORD_SET.has(w));
}

export function canonicalName(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular)
    .join(' ');
}
