import { describe, expect, it } from 'vitest';
import { extractItems } from './extractor';

const names = (text: string) => extractItems(text).map((i) => i.name);

describe('extractItems', () => {
  it('handles the examples from the product brief', () => {
    expect(names('We need to buy eggs, we are out of it.')).toEqual(['eggs']);
    expect(names('We ran out of noodles, we need to buy it.')).toEqual(['noodles']);
  });

  it('catches "out of" phrasings', () => {
    expect(names("We're out of milk")).toEqual(['milk']);
    expect(names('we are all out of bread')).toEqual(['bread']);
    expect(names("I'm almost out of coffee")).toEqual(['coffee']);
    expect(names('running low on olive oil')).toEqual(['olive oil']);
  });

  it('catches subject-first phrasings', () => {
    expect(names('The milk ran out')).toEqual(['milk']);
    expect(names('the eggs are gone')).toEqual(['eggs']);
    expect(names('our rice is almost gone')).toEqual(['rice']);
  });

  it('splits lists but keeps compound dishes whole', () => {
    expect(names('we need eggs, milk and bread')).toEqual(['eggs', 'milk', 'bread']);
    expect(names('we need to get mac and cheese')).toEqual(['mac and cheese']);
    expect(names('we need salt and pepper')).toEqual(['salt and pepper']);
  });

  it('parses quantities', () => {
    const [eggs] = extractItems('we need two dozen eggs');
    expect(eggs).toMatchObject({ name: 'eggs', quantity: 'two dozen' });
    const [milk] = extractItems('pick up a gallon of milk');
    expect(milk).toBeUndefined(); // no modal before "pick up"
    const [milk2] = extractItems('we should pick up a gallon of milk');
    expect(milk2).toMatchObject({ name: 'milk', quantity: 'a gallon' });
  });

  it('honours explicit list requests, even for unknown words', () => {
    expect(names('add dragonfruit to the grocery list')).toEqual(['dragonfruit']);
    expect(names('add eggs and butter to the shopping list')).toEqual(['eggs', 'butter']);
  });

  it('stops at the end of the item phrase', () => {
    expect(names('we need eggs for dinner tomorrow')).toEqual(['eggs']);
    expect(names("we're out of milk so I'll go later")).toEqual(['milk']);
    expect(names('we need to buy noodles from the store')).toEqual(['noodles']);
  });

  it('ignores negations', () => {
    expect(names("we don't need eggs")).toEqual([]);
    expect(names('no need to buy milk')).toEqual([]);
    expect(names('we already have plenty of rice')).toEqual([]);
    expect(names('I just bought bread')).toEqual([]);
  });

  it('ignores non-grocery chatter', () => {
    expect(names("we're out of time")).toEqual([]);
    expect(names('we need to go to the dentist')).toEqual([]);
    expect(names('we should buy a new car')).toEqual([]);
    expect(names("I'm out of ideas")).toEqual([]);
    expect(names('how was your day')).toEqual([]);
  });

  it('treats "don\'t have" as a need', () => {
    expect(names("we don't have any eggs")).toEqual(['eggs']);
  });

  it('collapses plural/singular duplicates inside one utterance', () => {
    expect(names('we need eggs and some more egg')).toEqual(['eggs']);
  });
});
