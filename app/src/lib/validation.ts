import { useQuiz } from './store'

export function useCanContinue(step: number): boolean {
  const state = useQuiz()
  switch (step) {
    case 1: return state.vertical !== null
    case 2: return state.business.name.trim() !== ''
             && state.business.address.trim() !== ''
             && state.business.phone.trim() !== ''
             && state.business.hours.trim() !== ''
    case 3: return true
    case 4: return state.reference !== null
    case 5:
      // All three uploads AND both photo orientations tagged AND all three
      // brand-palette slots populated. Orientation is a deliberate tap from
      // the user, not a default — we force the choice here so the engine
      // never guesses and mis-places a portrait into a wide hero. Palette is
      // similarly forced: any empty slot means untouched, and the engine
      // would 400 on submit anyway. We gate on all three independently
      // because per-slot manual overrides can leave one set while others
      // are still empty, and an incomplete palette is never valid.
      return (
        state.assets.logo !== null &&
        state.assets.photo1 !== null &&
        state.assets.photo2 !== null &&
        state.assets.photo1Orientation !== null &&
        state.assets.photo2Orientation !== null &&
        state.assets.palette.primary !== '' &&
        state.assets.palette.secondary !== '' &&
        state.assets.palette.accent !== ''
      )
    case 6: return true
    case 7: return true
    default: return false
  }
}
