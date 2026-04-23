// app/src/lib/references.ts
// Hand-maintained mirror of engine/src/references/library.json
// When you edit one, edit the other.

import type { Vertical } from './store';

export type ReferenceVertical = Vertical | 'general';

export interface Reference {
  id: string;
  label: string;
  url: string;
  imageUrl?: string;
  vertical: ReferenceVertical;
}

export const REFERENCES: Reference[] = [
  // ─── SALON ──────────────────────────────────────────
  { id: 'serenity-hair', label: 'Serenity Hair Blaxland', url: 'https://serenityhairblaxland.com.au/', vertical: 'salon' },

  // ─── GENERAL ────────────────────────────────────────
  { id: 'luzen-temlis', label: 'Luzen Temlis', url: 'https://luzen-temlis.webflow.io/', vertical: 'general' },
  { id: 'kero-ai', label: 'Kero AI', url: 'https://kero-ai.framer.website/', vertical: 'general' },
  { id: 'ovo-serenya', label: 'Ovo Serenya', url: 'https://ovo-serenya.webflow.io/', vertical: 'general' },
  { id: 'grodz', label: 'Grodz', url: 'https://www.grodz.co/', vertical: 'general' },
  { id: 'rhetorich', label: 'Rhetorich AI', url: 'https://www.rhetorich.ai/', vertical: 'general' },
  { id: 'bedouins-daughter', label: "Bedouin's Daughter", url: 'https://bedouinsdaughter.com/', vertical: 'general' },
  { id: 'stodio', label: 'Stodio', url: 'https://stodio.webflow.io/', vertical: 'general' },
  { id: 'riwa-template', label: 'Riwa', url: 'https://riwatemplate.framer.website/', vertical: 'general' },
  { id: 'tidescape', label: 'Tidescape', url: 'https://tidescape.framer.ai/', vertical: 'general' },
  { id: 'autajon', label: 'Autajon', url: 'https://www.autajon.com/fr/', vertical: 'general' },
  {
    id: 'general-dribbble-1',
    label: 'Mixed Layout Inspiration A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/47475692/file/fd0b48eb0d4dee4aa46de4995a621e82.jpg?resize=1600x1200&vertical=center',
    vertical: 'general',
  },
  {
    id: 'general-dribbble-2',
    label: 'Mixed Layout Inspiration B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/45487899/file/b7bd5acbe1f47189858d1aa517360086.jpg?resize=1600x1200&vertical=center',
    vertical: 'general',
  },
  // hotel refs re-tagged as general (no hotel vertical exists)
  { id: 'the-drake', label: 'The Drake Hotel', url: 'https://thedrake.ca/', vertical: 'general' },
  { id: 'domek-w-brzozach', label: 'Domek w Brzozach', url: 'https://www.domekwbrzozach.pl/', vertical: 'general' },
  {
    id: 'hotel-dribbble-mp4',
    label: 'Boutique Hotel Concept',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/5290081/file/original-87c7d2fa21fb0ced7076eda4b38998cb.mp4',
    vertical: 'general',
  },
  {
    id: 'hotel-dribbble-still',
    label: 'Hotel Editorial Concept',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/18134274/file/original-61ce82d34e7805f3dc374f584eaac0a6.png?resize=752x&vertical=center',
    vertical: 'general',
  },

  // ─── RESTAURANT (incl. cafes) ───────────────────────
  { id: 'bistora', label: 'Bistora', url: 'https://bistora.webflow.io/', vertical: 'restaurant' },
  { id: 'paput-menorca', label: 'Paput Menorca', url: 'https://www.paputmenorca.com/', vertical: 'restaurant' },
  {
    id: 'restaurant-dribbble-mp4',
    label: 'Restaurant Showcase Concept',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/5416929/file/original-a507991ada7e53b527452064d39ca532.mp4',
    vertical: 'restaurant',
  },
  // cafe refs folded into restaurant
  {
    id: 'cafe-dribbble-mp4',
    label: 'Cafe Concept Animated',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/32324128/file/large-820618381dd9961b35d71ef94c927c35.mp4',
    vertical: 'restaurant',
  },
  {
    id: 'cafe-dribbble-longscroll',
    label: 'Cafe Long-Form Layout',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/43410812/file/original-6546cc9b09972807da1a729bc0ca173c.jpg?resize=1024x3530&vertical=center',
    vertical: 'restaurant',
  },

  // ─── HEALTH (incl. dentist) ─────────────────────────
  { id: 'clinova', label: 'Clinova Dental', url: 'https://clinova-template.webflow.io/', vertical: 'health' },
  {
    id: 'dentist-dribbble-1',
    label: 'Modern Clinic Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/4176948/file/original-a678629b03c3e97d0359ffd872eea363.png?resize=752x&vertical=center',
    vertical: 'health',
  },
  {
    id: 'dentist-dribbble-2',
    label: 'Modern Clinic Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/40655745/file/original-6b5cf6013e0b8344d6d252d4faa56b25.png?resize=752x&vertical=center',
    vertical: 'health',
  },
  {
    id: 'dentist-dribbble-3',
    label: 'Modern Clinic Concept C',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/43418746/file/original-dbb5ea977cc9e9b67474cc8bb0bc4f24.jpg?resize=752x&vertical=center',
    vertical: 'health',
  },
  { id: 'absolute-collagen', label: 'Absolute Collagen', url: 'https://www.absolutecollagen.com/', vertical: 'health' },
  {
    id: 'health-dribbble-1',
    label: 'Wellness Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/45977862/file/a4e6fef333211ee0506fd8d66000d3e5.png?resize=752x&vertical=center',
    vertical: 'health',
  },

  // ─── TRADES ─────────────────────────────────────────
  { id: 'artisan-roofing', label: 'Artisan Roofing', url: 'https://artisanroofing.ca/', vertical: 'trades' },
  {
    id: 'trades-dribbble-1',
    label: 'Trades Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/43542558/file/original-8b0294674dafe368c3f16addcbd71754.jpg?resize=1600x1200&vertical=center',
    vertical: 'trades',
  },
  {
    id: 'trades-dribbble-2',
    label: 'Trades Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/44660455/file/957a28c01646142e2fc67e72138314c1.png?resize=1600x1200&vertical=center',
    vertical: 'trades',
  },
  {
    id: 'trades-dribbble-3',
    label: 'Trades Concept C',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/41103384/file/original-4d085906fad91c84e596dd6eef4b3012.jpg?resize=752x&vertical=center',
    vertical: 'trades',
  },
  {
    id: 'trades-dribbble-4',
    label: 'Trades Concept D',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/7726860/file/original-8b928e2d9c78b2d52a1c63a0d8c8e093.png?resize=752x&vertical=center',
    vertical: 'trades',
  },
  {
    id: 'trades-dribbble-5',
    label: 'Trades Concept E',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/43136075/file/original-69a74aa40a99eae118bb2375b2245552.png?resize=752x&vertical=center',
    vertical: 'trades',
  },
  {
    id: 'trades-dribbble-6',
    label: 'Trades Concept F',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/13724341/file/original-a438885e2a2ab65c14849bb84b3e87bd.jpg?resize=752x&vertical=center',
    vertical: 'trades',
  },
  {
    id: 'trades-dribbble-7',
    label: 'Trades Concept G',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/44566619/file/fc5ab26f76d72af99666f646194a33d4.png?resize=1600x1200&vertical=center',
    vertical: 'trades',
  },

  // ─── BARBER ─────────────────────────────────────────
  {
    id: 'barber-dribbble-1',
    label: 'Barber Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/17333810/file/original-0692f8469050b2dd8e79ca30db568473.png?resize=1600x1200&vertical=center',
    vertical: 'barber',
  },
  {
    id: 'barber-dribbble-2',
    label: 'Barber Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/46605984/file/22c276cdb13821a9e699b5e93b35124e.png?resize=1600x1200&vertical=center',
    vertical: 'barber',
  },
  {
    id: 'barber-dribbble-3',
    label: 'Barber Concept C',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/14667702/file/original-f7b93d9742a89c83ccca7f3673177b35.jpg?resize=1600x1200&vertical=center',
    vertical: 'barber',
  },

  // ─── GYM ────────────────────────────────────────────
  {
    id: 'gym-dribbble-1',
    label: 'Gym Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/6459862/file/original-c3bd76a3ed4deb4d968f8aa4f74d8520.png?resize=1600x1200&vertical=center',
    vertical: 'gym',
  },

  // ─── DAYCARE ────────────────────────────────────────
  {
    id: 'daycare-dribbble-1',
    label: 'Daycare Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/43353146/file/original-dd8a823a4bd87eedde08f7db01ad0dd9.jpg?resize=1600x1138&vertical=center',
    vertical: 'daycare',
  },
  {
    id: 'daycare-dribbble-2',
    label: 'Daycare Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/3272435/file/original-8e42aedfced0e4160491fada9abf1134.png?resize=1600x1200&vertical=center',
    vertical: 'daycare',
  },

  // ─── GROOMER ────────────────────────────────────────
  {
    id: 'groomer-dribbble-1',
    label: 'Pet Grooming Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/45246915/file/63dbf00ff8c764eb2e041d56411395a0.webp?resize=752x&vertical=center',
    vertical: 'groomer',
  },
  {
    id: 'groomer-dribbble-2',
    label: 'Pet Grooming Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/47207870/file/92fe2403bb27f55a2934485de143a2d0.jpg?resize=1600x1202&vertical=center',
    vertical: 'groomer',
  },
  {
    id: 'groomer-dribbble-3',
    label: 'Pet Grooming Concept C',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/46827065/file/202cbf35ece638883a05df13e282cc5d.png?resize=752x&vertical=center',
    vertical: 'groomer',
  },

  // ─── BUSINESS ───────────────────────────────────────
  {
    id: 'business-dribbble-1',
    label: 'B2B Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/12869325/file/original-0ff6d003df2b1b274be577510ecb3626.jpg?resize=752x&vertical=center',
    vertical: 'business',
  },
  {
    id: 'business-dribbble-2',
    label: 'B2B Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/44881306/file/383620d9b6fb763d88cb339859810647.png?resize=752x&vertical=center',
    vertical: 'business',
  },

  // ─── GOLF ───────────────────────────────────────────
  { id: 'arabella-golf', label: 'Arabella Golf Mallorca', url: 'https://arabellagolfmallorca.com/', vertical: 'golf' },
  { id: 'golf-club-128', label: 'Golf Club 128', url: 'https://golf-club-128.webflow.io/', vertical: 'golf' },
  { id: 'cabot', label: 'Cabot Cape Breton', url: 'https://cabot.com/', vertical: 'golf' },
  {
    id: 'golf-dribbble-1',
    label: 'Golf Concept A',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/15262584/file/original-e9491dca8cfb98573ea3888afcef8839.jpg?resize=752x&vertical=center',
    vertical: 'golf',
  },
  {
    id: 'golf-dribbble-2',
    label: 'Golf Concept B',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/47012499/file/520271d981968c245e9747a30355ae5c.png?resize=752x&vertical=center',
    vertical: 'golf',
  },
  {
    id: 'golf-dribbble-3',
    label: 'Golf Concept C',
    url: 'https://dribbble.com/',
    imageUrl: 'https://cdn.dribbble.com/userupload/47012495/file/d3a1a7ba5f2a2f35cd8af8ffe9350c07.png?resize=752x&vertical=center',
    vertical: 'golf',
  },
  {
    id: 'golf-awwwards',
    label: 'Award-Winning Golf Concept',
    url: 'https://awwwards.com/',
    imageUrl: 'https://assets.awwwards.com/awards/element/2025/10/68f4fd1e6de74458481089.jpg',
    vertical: 'golf',
  },
];

export function referencesFor(vertical: Vertical): Reference[] {
  return REFERENCES.filter(
    (r) => r.vertical === vertical || r.vertical === 'general'
  );
}
