/**
 * Scripted conversations for demo mode. They are written like real Bee transcripts: several speakers,
 * small talk, corrections, things people already have, errands that are not groceries, and items that
 * are only implied ("we can buy it on the way home"). The extraction model reads them like any other
 * transcript, so what lands on the list is whatever it picks up, not a hard-coded list.
 *
 * This file has no imports on purpose: server/check-demo.ts loads it directly to test the model.
 */

/** What happened to a conversation's items after it was spoken. */
export type DemoFate =
  /** Bought on a shopping trip a few hours later: shows up under a past day in history. */
  | { kind: 'history' }
  /** Left over after a trip: waiting in the cart queue. */
  | { kind: 'queued' }
  /** Still on the list; the first few may already be checked off today. */
  | { kind: 'open'; boughtFirst?: number };

export interface DemoConversation {
  id: string;
  /** Local hour on a past day, or minutes before the demo was switched on for today's talk. */
  when: { daysAgo: number; hour: number } | { minutesAgo: number };
  fate: DemoFate;
  /** [speaker, text] in spoken order. */
  lines: [string, string][];
  /** Items a good reading should find (substring match on the item name). Used by tests and check-demo only. */
  expect: string[];
  /** Things said in the conversation that must NOT end up on the list. */
  avoid: string[];
}

export const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    id: 'kitchen-morning',
    when: { daysAgo: 5, hour: 8 },
    fate: { kind: 'history' },
    lines: [
      ['Speaker 1', 'Morning. Is there any coffee left or did I finish it yesterday?'],
      ['Speaker 2', 'That was the last scoop. Put coffee on the list.'],
      ['Speaker 1', 'Yeah. And the oat milk, the barista kind. Two cartons, they go fast.'],
      ['Speaker 2', 'Did you ever send those Q3 slides to Marcus?'],
      ['Speaker 1', 'Almost done, I will do it on the train. Oh, bananas. The kids ate every single one.'],
      ['Speaker 2', 'I am making pasta tomorrow, so we need spaghetti, a jar of marinara, and some parmesan.'],
      ['Speaker 1', 'Do we have garlic?'],
      ['Speaker 2', 'Yeah, plenty of garlic and olive oil, do not buy those again.'],
      ['Speaker 1', 'Okay. Kettle is boiling, I am out.'],
    ],
    expect: ['coffee', 'oat milk', 'banana', 'spaghetti', 'marinara', 'parmesan'],
    avoid: ['garlic', 'olive oil'],
  },
  {
    id: 'drive-home-call',
    when: { daysAgo: 4, hour: 17 },
    fate: { kind: 'history' },
    lines: [
      ['Speaker 1', 'Hey, can you grab a few things for dinner on your way home?'],
      ['Speaker 2', 'Sure. Traffic is terrible though. What do we need?'],
      ['Speaker 1', 'Chicken thighs, about two pounds, bone in. And some broccoli.'],
      ['Speaker 2', 'Got it. Anything for the weekend?'],
      ['Speaker 1', 'We said tacos on Thursday, so flour tortillas. Maybe the big pack.'],
      ['Speaker 2', 'Do we need sour cream? The one in the fridge looks sketchy.'],
      ['Speaker 1', 'Check the date. Yeah, it expired last week, toss it and get a new tub.'],
      ['Speaker 2', 'Okay. And limes for the tacos, I will get four.'],
      ['Speaker 1', 'Perfect. Also did you call the plumber back?'],
      ['Speaker 2', 'Tomorrow, I promise. Okay I am pulling into the lot, talk later.'],
    ],
    expect: ['chicken', 'broccoli', 'tortilla', 'sour cream', 'lime'],
    avoid: ['plumber'],
  },
  {
    id: 'brunch-planning',
    when: { daysAgo: 3, hour: 21 },
    fate: { kind: 'history' },
    lines: [
      ['Speaker 1', 'Priya and Dan are coming over Saturday for brunch, I told them eleven.'],
      ['Speaker 2', 'Nice. I will make shakshuka, it is the only thing I am good at.'],
      ['Speaker 1', 'Then we need a lot of eggs. Get two dozen, they eat like horses.'],
      ['Speaker 2', 'Canned tomatoes too, the crushed ones, and feta to crumble on top.'],
      ['Speaker 1', 'I will do pancakes as well. Do we have flour?'],
      ['Speaker 2', 'Half a bag, we are fine. But we are out of maple syrup.'],
      ['Speaker 1', 'Right, then just syrup. Pure maple, not the fake stuff.'],
      ['Speaker 2', 'Mimosas? Dan said he is bringing the sparkling wine.'],
      ['Speaker 1', 'Great, so we only need a big carton of orange juice.'],
      ['Speaker 2', 'Also we have to drop the dog off at the vet Friday morning.'],
      ['Speaker 1', 'Ugh, yes. Put it in the calendar.'],
    ],
    expect: ['egg', 'tomato', 'feta', 'maple syrup', 'orange juice'],
    avoid: ['flour', 'wine'],
  },
  {
    id: 'lunch-with-mom',
    when: { daysAgo: 2, hour: 12 },
    fate: { kind: 'queued' },
    lines: [
      ['Speaker 1', 'Mom says ginger tea is the thing for my cold, she swears by it.'],
      ['Speaker 2', 'Then buy ginger tea. And honey, we are nearly out of honey.'],
      ['Speaker 1', 'I will need lemons for the tea too.'],
      ['Speaker 2', 'Do you want me to make soup tonight? Chicken noodle?'],
      ['Speaker 1', 'Please. Do we have everything?'],
      ['Speaker 2', 'We have the noodles and the broth. Missing carrots and celery though.'],
      ['Speaker 1', 'Okay carrots and celery, I will pick them up after my meeting.'],
      ['Speaker 2', 'Take some vitamin C as well if you see it.'],
      ['Speaker 1', 'Maybe. Honestly I just want to sleep.'],
    ],
    expect: ['ginger tea', 'honey', 'lemon', 'carrot', 'celery'],
    avoid: [],
  },
  {
    id: 'morning-rush',
    when: { daysAgo: 1, hour: 7 },
    fate: { kind: 'history' },
    lines: [
      ['Speaker 1', 'We are out of cat litter, Biscuit was giving me the look this morning.'],
      ['Speaker 2', 'The unscented clumping one, the big jug. The scented one makes her sneeze.'],
      ['Speaker 1', 'Right. Also paper towels, we used the last roll for the spill.'],
      ['Speaker 2', 'And trash bags. The 13 gallon ones with the drawstring.'],
      ['Speaker 1', 'Have you seen my keys?'],
      ['Speaker 2', 'On the counter, under your jacket. Go, you will miss the bus.'],
    ],
    expect: ['cat litter', 'paper towel', 'trash bag'],
    avoid: [],
  },
  {
    id: 'ramen-night',
    when: { daysAgo: 1, hour: 20 },
    fate: { kind: 'open' },
    lines: [
      ['Speaker 1', 'I want to make that spicy miso ramen from the video tonight, or tomorrow at least.'],
      ['Speaker 2', 'Which video? The one with the egg that looks like jam?'],
      ['Speaker 1', 'Yes. So we need ramen noodles, the fresh kind if they have it, and miso paste.'],
      ['Speaker 2', 'And soft boiled eggs, so eggs again.'],
      ['Speaker 1', 'We still have a few from brunch. Just get a half dozen.'],
      ['Speaker 2', 'Scallions. And nori sheets, that is half the flavor.'],
      ['Speaker 1', 'Where do you even buy nori? The Asian market?'],
      ['Speaker 2', 'Whole Foods has it. We can buy it on the way home from the gym.'],
      ['Speaker 1', 'Fine. Did you finish the assignment for your class?'],
      ['Speaker 2', 'Not even close. Do not remind me.'],
    ],
    expect: ['ramen', 'miso', 'egg', 'scallion', 'nori'],
    avoid: ['assignment'],
  },
  {
    id: 'school-pickup',
    when: { minutesAgo: 210 },
    fate: { kind: 'open', boughtFirst: 1 },
    lines: [
      ['Speaker 1', 'Maya needs snacks for the field trip on Friday, I forgot to tell you.'],
      ['Speaker 2', 'What does she like? Goldfish?'],
      ['Speaker 1', 'Goldfish crackers and apple slices, the little individually packed ones.'],
      ['Speaker 2', 'And something to drink?'],
      ['Speaker 1', 'Juice boxes. Get the 12 pack, she will trade them for stickers.'],
      ['Speaker 2', 'Ha. Okay. Anything for your lunch too?'],
      ['Speaker 1', 'I am completely out of hummus, and pita bread.'],
      ['Speaker 2', 'Remind me to email the teacher about the permission slip.'],
      ['Speaker 1', 'You have until Wednesday. Here they come, the doors are open.'],
    ],
    expect: ['goldfish', 'apple', 'juice box', 'hummus', 'pita'],
    avoid: ['permission slip'],
  },
  {
    id: 'gym-call',
    when: { minutesAgo: 95 },
    fate: { kind: 'open' },
    lines: [
      ['Speaker 1', 'Hey, are you headed to the store later?'],
      ['Speaker 2', 'Yeah, text me what we need.'],
      ['Speaker 1', 'Okay, dish soap, the lemon one, and a pack of sponges.'],
      ['Speaker 2', 'We have dish soap, I saw a full bottle under the sink this morning.'],
      ['Speaker 1', 'Oh right. Then just the sponges.'],
      ['Speaker 2', 'Anything else?'],
      ['Speaker 1', 'The thing for breakfast. The Greek yogurt, plain, the big tub.'],
      ['Speaker 2', 'And granola?'],
      ['Speaker 1', 'Yes, granola. Do we need milk?'],
      ['Speaker 2', 'Completely out. We need a gallon of whole milk.'],
      ['Speaker 1', 'Okay that is it. I have a set to finish.'],
    ],
    expect: ['sponge', 'yogurt', 'granola', 'milk'],
    avoid: ['dish soap'],
  },
  {
    id: 'dinner-decision',
    when: { minutesAgo: 22 },
    fate: { kind: 'open' },
    lines: [
      ['Speaker 1', 'What are we doing for dinner tonight? Honestly I would do salmon.'],
      ['Speaker 2', 'We have nothing for that. Salmon fillets, four of them, and some asparagus.'],
      ['Speaker 1', 'Lemons, did we put lemons on the list?'],
      ['Speaker 2', 'They are already in the cart queue from the soup.'],
      ['Speaker 1', 'Good. Do we need rice with it?'],
      ['Speaker 2', 'No, we have a full bag of rice, I checked.'],
      ['Speaker 1', 'Dessert? I want ice cream.'],
      ['Speaker 2', 'Cookie dough, the pint, and I will get something for the kids too.'],
      ['Speaker 1', 'Perfect. Let us leave at six.'],
    ],
    expect: ['salmon', 'asparagus', 'ice cream'],
    avoid: ['rice'],
  },
];
