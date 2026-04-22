/**
 * Per-vertical terminology hints injected into Claude's user message at build time.
 *
 * These are STARTING defaults — tune them as real pitches reveal what wording
 * lands. Version-controlled in code (not config) because they materially shape
 * the clone and deserve git discipline.
 *
 * Kept out of the system prompt so the system prompt stays cacheable across
 * builds; the terminology is the only truly per-vertical bit.
 */
export const VERTICAL_TERMS: Record<string, string> = {
  salon:
    'Use "Book an appointment" for the primary CTA. Refer to staff as "stylists" or "team."',
  barber:
    'Use "Walk-ins welcome" or "Book a chair" for the primary CTA. Refer to staff as "barbers." Avoid the word "salon."',
  tattoo:
    'Use "Book a consultation" for the primary CTA. Refer to staff as "artists" not "stylists." Mention portfolio prominently.',
  groomer:
    'This is a pet groomer. Refer to clients as "pets" or "your dog/cat." Use "Book grooming" for the primary CTA.',
  trades:
    'This is a trades business (electrician, plumber, carpenter, etc.). Use "Get a quote" or "Request service" for the primary CTA. Emphasize licensing and emergency availability if relevant.',
  restaurant:
    'Use "Make a reservation" or "Order online" for the primary CTA. Show menu prominently. Refer to staff as "kitchen" or "team."',
  gym:
    'Use "Start your trial" or "Join now" for the primary CTA. Emphasize energy and results. Refer to staff as "trainers" or "coaches."',
  health:
    'This is a health/wellness practitioner. Use "Book a session" or "Schedule appointment" for primary CTA. Use calm professional tone. Avoid hype language.',
  auto:
    'This is an auto shop. Use "Get a quote" or "Schedule service" for primary CTA. Mention specialties (mechanical, body work, detailing). Refer to staff as "mechanics" or "technicians."',
  daycare:
    'This is a childcare/daycare business. Use "Schedule a tour" for primary CTA. Use warm, family-focused tone. Mention licensing/safety prominently.',
}

/**
 * Look up the terminology string for a given vertical. Returns '' for
 * null/unknown verticals so the caller can unconditionally interpolate it
 * without branching — the cloner's user message omits the block when empty.
 */
export function termsFor(vertical: string): string {
  return VERTICAL_TERMS[vertical] ?? ''
}
