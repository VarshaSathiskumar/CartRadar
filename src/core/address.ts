/** "123 Main St, Golden, CO 80401" from whatever OpenStreetMap address tags exist, or undefined. */
export function buildAddress(tags: Record<string, string | undefined> = {}): string | undefined {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const region = [tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(' ');
  const full = [street, tags['addr:city'], region].filter(Boolean).join(', ');
  return full || undefined;
}
