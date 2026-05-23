import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useExplorerStore, { CATEGORIES } from '../../store/useExplorerStore'
import { geocodeCity, reverseGeocode } from '../../services/geocodingService'
import { fetchActivities } from '../../services/overpassService'
import { MOCK_ACTIVITIES } from '../../services/mockData'
import './ExplorerHome.css'

export default function ExplorerHome() {
  const navigate = useNavigate()
  const {
    city, setCity, setDisplayCity, setCoordinates,
    radius, setRadius, selectedCategories, toggleCategory,
    loadActivities, setLoading, setError, isLoading, favorites,
  } = useExplorerStore()

  const [localCity, setLocalCity] = useState(city)
  const [localCoords, setLocalCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [fieldError, setFieldError] = useState(null)

  // ── GPS ──────────────────────────────────────────────────────────
  const handleGPS = () => {
    if (!navigator.geolocation) { setFieldError('Géolocalisation non supportée'); return }
    setLocating(true)
    setFieldError(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude }
        setLocalCoords(pos)
        try {
          const name = await reverseGeocode(pos.lat, pos.lng)
          setLocalCity(name)
        } catch {
          setLocalCity('Ma position')
        }
        setLocating(false)
      },
      () => { setFieldError("Position indisponible"); setLocating(false) },
      { timeout: 10000 }
    )
  }

  // ── Discover ─────────────────────────────────────────────────────
  const handleDiscover = async () => {
    if (!localCity.trim() && !localCoords) { setFieldError('Entrez une ville ou utilisez le GPS'); return }
    if (selectedCategories.length === 0) { setFieldError('Sélectionnez au moins une catégorie'); return }
    setFieldError(null)
    setLoading(true)
    setError(null)

    try {
      let coords
      let displayName

      if (localCoords) {
        coords = localCoords
        displayName = localCity || 'Ma position'
      } else {
        const geo = await geocodeCity(localCity)
        coords = { lat: geo.lat, lng: geo.lng }
        displayName = geo.displayName
      }

      setCoordinates(coords)
      setCity(localCity)
      setDisplayCity(displayName)

      let activities
      try {
        activities = await fetchActivities(coords.lat, coords.lng, radius, selectedCategories)
        if (activities.length < 3) throw new Error('Résultats insuffisants')
      } catch {
        // Fallback to mock data filtered by category
        activities = MOCK_ACTIVITIES.filter((a) => selectedCategories.includes(a.category))
      }

      loadActivities(activities)
      navigate('/explorer/swipe')
    } catch (err) {
      setFieldError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="explorer-home">
      <div className="explorer-home__blob" aria-hidden="true" />

      {/* Header */}
      <header className="explorer-home__header">
        <div className="explorer-home__icon">🗺️</div>
        <h1>Explorer</h1>
        <p>Découvrez les activités<br />culturelles autour de vous</p>
      </header>

      <main className="explorer-home__main">
        {/* City input */}
        <div className="ex-field">
          <label className="ex-label">Ville</label>
          <div className="ex-input-row">
            <input
              className={`ex-input${fieldError ? ' ex-input--error' : ''}`}
              type="text"
              placeholder="Paris, Lyon, Bordeaux..."
              value={localCity}
              onChange={(e) => {
                setLocalCity(e.target.value)
                setLocalCoords(null)
                setFieldError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
            />
            <button
              className="ex-gps-btn"
              onClick={handleGPS}
              disabled={locating}
              aria-label="Utiliser ma position GPS"
            >
              {locating ? <span className="ex-spinner-sm" /> : '📍'}
            </button>
          </div>
          {fieldError && <p className="ex-field-error">{fieldError}</p>}
        </div>

        {/* Radius slider */}
        <div className="ex-field">
          <label className="ex-label">
            Rayon : <strong>{radius} km</strong>
          </label>
          <input
            className="ex-slider"
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            style={{
              background: `linear-gradient(to right, #5b4cf5 ${((radius - 0.5) / 4.5) * 100}%, #e2e4f2 ${((radius - 0.5) / 4.5) * 100}%)`,
            }}
          />
          <div className="ex-slider-labels">
            <span>0.5 km</span>
            <span>5 km</span>
          </div>
        </div>

        {/* Categories */}
        <div className="ex-field">
          <label className="ex-label">Catégories</label>
          <div className="ex-cats">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                className={`ex-cat-chip${selectedCategories.includes(key) ? ' ex-cat-chip--active' : ''}`}
                onClick={() => toggleCategory(key)}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="explorer-home__footer">
        <button
          className="ex-discover-btn"
          onClick={handleDiscover}
          disabled={isLoading}
        >
          {isLoading ? <span className="ex-spinner" /> : '🔍 Découvrir'}
        </button>

        {favorites.length > 0 && (
          <button
            className="ex-favs-link"
            onClick={() => navigate('/explorer/favorites')}
          >
            ♥ Mes favoris ({favorites.length})
          </button>
        )}
      </footer>
    </div>
  )
}
