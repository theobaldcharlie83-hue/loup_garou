import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useExplorerStore, { CATEGORIES } from '../../store/useExplorerStore'
import SwipeCard from '../../components/explorer/SwipeCard'
import ExplorerTabBar from '../../components/explorer/ExplorerTabBar'
import './SwipeScreen.css'

export default function SwipeScreen() {
  const navigate = useNavigate()
  const {
    activities, currentIndex, isLoading,
    displayCity, radius, selectedCategories, favorites,
    swipeYes, swipeNo, toggleCategory, reset,
  } = useExplorerStore()

  // Redirect back if nothing loaded
  useEffect(() => {
    if (!isLoading && activities.length === 0) {
      navigate('/explorer', { replace: true })
    }
  }, [activities.length, isLoading, navigate])

  const visibleActivities = activities.slice(currentIndex, currentIndex + 3)
  const isDone = currentIndex >= activities.length && activities.length > 0
  const progress = activities.length > 0 ? (currentIndex / activities.length) * 100 : 0

  return (
    <div className="swipe-screen">
      {/* Header */}
      <header className="swipe-screen__header">
        <button
          className="swipe-screen__back"
          onClick={() => navigate('/explorer')}
          aria-label="Retour"
        >
          ←
        </button>
        <div className="swipe-screen__loc">
          <span className="swipe-screen__city">{displayCity || 'Explorer'}</span>
          <span className="swipe-screen__radius">📍 {radius} km</span>
        </div>
        <button
          className="swipe-screen__fav-btn"
          onClick={() => navigate('/explorer/favorites')}
          aria-label="Favoris"
        >
          ♥
          {favorites.length > 0 && (
            <span className="swipe-screen__fav-count">{favorites.length}</span>
          )}
        </button>
      </header>

      {/* Category filter pills */}
      <div className="swipe-screen__cats" role="group" aria-label="Filtrer par catégorie">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`swipe-screen__cat${selectedCategories.includes(key) ? ' swipe-screen__cat--on' : ''}`}
            onClick={() => toggleCategory(key)}
            title={cat.label}
            aria-pressed={selectedCategories.includes(key)}
          >
            {cat.emoji}
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="swipe-screen__progress-track" role="progressbar" aria-valuenow={currentIndex} aria-valuemax={activities.length}>
        <div className="swipe-screen__progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="swipe-screen__count">
        {currentIndex} / {activities.length} activités
      </p>

      {/* Card area */}
      <div className="swipe-screen__stage">
        {isLoading ? (
          <div className="swipe-screen__feedback">
            <div className="swipe-spinner" />
            <p>Recherche des activités…</p>
          </div>
        ) : isDone ? (
          <div className="swipe-screen__feedback">
            <span className="swipe-screen__done-emoji">🎉</span>
            <h2>Tout vu !</h2>
            <p>Vous avez parcouru toutes les activités.</p>
            {favorites.length > 0 && (
              <p>
                <strong>{favorites.length}</strong> favori{favorites.length > 1 ? 's' : ''} enregistré{favorites.length > 1 ? 's' : ''} 🎊
              </p>
            )}
            <div className="swipe-screen__done-btns">
              <button
                className="ex-btn-primary"
                onClick={() => navigate('/explorer/favorites')}
              >
                ♥ Voir mes favoris
              </button>
              <button
                className="ex-btn-secondary"
                onClick={() => { reset(); navigate('/explorer') }}
              >
                🔄 Nouvelle recherche
              </button>
            </div>
          </div>
        ) : (
          <div className="swipe-screen__stack">
            {visibleActivities.map((activity, i) => (
              <SwipeCard
                key={activity.id}
                activity={activity}
                stackIndex={i}
                isTop={i === 0}
                onSwipeLeft={swipeYes}   /* ← gauche = OUI */
                onSwipeRight={swipeNo}   /* → droite = NON */
              />
            ))}
          </div>
        )}
      </div>

      <ExplorerTabBar />
    </div>
  )
}
