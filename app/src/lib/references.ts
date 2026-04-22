/**
 * Client-side mirror of engine/src/references/library.json.
 *
 * Why duplicated: the engine needs the URL for server-side cloning; the app
 * needs the thumbnail path + label for tile rendering. Kept in lockstep by
 * hand — if you add a reference here, add it there too.
 */
export interface Reference {
  url: string
  label: string
  thumbnailPath: string
}

export const REFERENCES: Record<string, Reference[]> = {
  salon: [
    {
      url: 'https://serenityhairblaxland.com.au/',
      label: 'Serenity Hair',
      thumbnailPath: '/references/serenity-hair-salon.png',
    },
  ],
  barber: [],
  tattoo: [],
  groomer: [],
  trades: [],
  restaurant: [],
  gym: [],
  health: [],
  auto: [],
  daycare: [],
}

/**
 * Look up the references for a given vertical. Returns [] for null/unknown
 * verticals so Screen4Reference can render its empty state without branching.
 */
export function referencesFor(vertical: string | null): Reference[] {
  if (!vertical) return []
  return REFERENCES[vertical] ?? []
}
