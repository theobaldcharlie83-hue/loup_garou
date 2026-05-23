import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CATEGORIES = {
  museum:     { label: 'Musées',      emoji: '🏛️', gradient: 'linear-gradient(145deg,#667EEA,#764BA2)' },
  restaurant: { label: 'Restaurants', emoji: '🍽️', gradient: 'linear-gradient(145deg,#FF6B6B,#FFE66D)' },
  nature:     { label: 'Nature',      emoji: '🌿', gradient: 'linear-gradient(145deg,#11998E,#38EF7D)' },
  show:       { label: 'Spectacles',  emoji: '🎭', gradient: 'linear-gradient(145deg,#4FACFE,#00F2FE)' },
  amusement:  { label: 'Loisirs',     emoji: '🎢', gradient: 'linear-gradient(145deg,#FA709A,#FEE140)' },
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const useExplorerStore = create(
  persist(
    (set, get) => ({
      city: '',
      displayCity: '',
      coordinates: null,
      radius: 3,

      activities: [],
      currentIndex: 0,
      isLoading: false,
      error: null,

      favorites: [],
      selectedCategories: Object.keys(CATEGORIES),

      setCity: (city) => set({ city }),
      setDisplayCity: (displayCity) => set({ displayCity }),
      setCoordinates: (coordinates) => set({ coordinates }),
      setRadius: (radius) => set({ radius }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      loadActivities: (activities) =>
        set({ activities: shuffle(activities), currentIndex: 0 }),

      swipeNo: () => set((s) => ({ currentIndex: s.currentIndex + 1 })),

      swipeYes: () =>
        set((s) => {
          const activity = s.activities[s.currentIndex]
          if (!activity) return {}
          const already = s.favorites.some((f) => f.id === activity.id)
          return {
            currentIndex: s.currentIndex + 1,
            favorites: already ? s.favorites : [activity, ...s.favorites],
          }
        }),

      toggleCategory: (cat) =>
        set((s) => ({
          selectedCategories: s.selectedCategories.includes(cat)
            ? s.selectedCategories.filter((c) => c !== cat)
            : [...s.selectedCategories, cat],
        })),

      removeFavorite: (id) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      reset: () => set({ activities: [], currentIndex: 0, error: null }),
    }),
    {
      name: 'explorer-v1',
      partialize: (s) => ({
        favorites: s.favorites,
        selectedCategories: s.selectedCategories,
        city: s.city,
        displayCity: s.displayCity,
        radius: s.radius,
        coordinates: s.coordinates,
      }),
    }
  )
)

export default useExplorerStore
