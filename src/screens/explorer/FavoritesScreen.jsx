import { useNavigate } from 'react-router-dom'
import useExplorerStore, { CATEGORIES } from '../../store/useExplorerStore'
import ExplorerTabBar from '../../components/explorer/ExplorerTabBar'
import './FavoritesScreen.css'

export default function FavoritesScreen() {
  const navigate = useNavigate()
  const { favorites, removeFavorite } = useExplorerStore()

  const grouped = Object.keys(CATEGORIES).reduce((acc, key) => {
    const items = favorites.filter((f) => f.category === key)
    if (items.length > 0) acc[key] = items
    return acc
  }, {})

  return (
    <div className="fav-screen">
      <header className="fav-screen__header">
        <button className="fav-screen__back" onClick={() => navigate(-1)} aria-label="Retour">
          ←
        </button>
        <h1>Mes Favoris</h1>
        <span className="fav-screen__badge">{favorites.length}</span>
      </header>

      <div className="fav-screen__content">
        {favorites.length === 0 ? (
          <EmptyState onExplore={() => navigate('/explorer/swipe')} />
        ) : (
          Object.entries(grouped).map(([catKey, items]) => {
            const cat = CATEGORIES[catKey]
            return (
              <section key={catKey} className="fav-group">
                <h2 className="fav-group__title">
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className="fav-group__count">{items.length}</span>
                </h2>
                <div className="fav-group__list">
                  {items.map((activity) => (
                    <FavoriteCard
                      key={activity.id}
                      activity={activity}
                      cat={cat}
                      onRemove={() => removeFavorite(activity.id)}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>

      <ExplorerTabBar />
    </div>
  )
}

function EmptyState({ onExplore }) {
  return (
    <div className="fav-empty">
      <span className="fav-empty__icon">💭</span>
      <h2>Aucun favori pour l'instant</h2>
      <p>
        Swipez <strong>à gauche</strong> sur les activités qui vous plaisent pour les retrouver ici.
      </p>
      <button className="ex-btn-primary fav-empty__btn" onClick={onExplore}>
        🗺️ Explorer maintenant
      </button>
    </div>
  )
}

function FavoriteCard({ activity, cat, onRemove }) {
  const mapsUrl = activity.lat && activity.lng
    ? `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`
    : null

  return (
    <article className="fav-card">
      <div className="fav-card__thumb" style={{ background: cat.gradient }}>
        <span>{cat.emoji}</span>
      </div>

      <div className="fav-card__info">
        <h3 className="fav-card__name">{activity.name}</h3>
        <div className="fav-card__meta">
          {activity.distance    && <span>📍 {activity.distance}</span>}
          {activity.openingHours && <span>🕒 {activity.openingHours}</span>}
        </div>
        {activity.description && (
          <p className="fav-card__desc">{activity.description}</p>
        )}
        <div className="fav-card__links">
          {activity.website && (
            <a href={activity.website} target="_blank" rel="noopener noreferrer" className="fav-link">
              🌐 Site web
            </a>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="fav-link">
              🗺️ Maps
            </a>
          )}
        </div>
      </div>

      <button className="fav-card__remove" onClick={onRemove} aria-label="Supprimer">
        ×
      </button>
    </article>
  )
}
