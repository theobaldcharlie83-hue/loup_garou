import { useState, useRef, useEffect } from 'react'
import { CATEGORIES } from '../../store/useExplorerStore'
import './SwipeCard.css'

const THRESHOLD = 90

export default function SwipeCard({ activity, stackIndex, isTop, onSwipeLeft, onSwipeRight }) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [exitDir, setExitDir] = useState(null)
  const startXRef = useRef(0)

  const config = CATEGORIES[activity.category] || CATEGORIES.museum

  // ── drag logic ──────────────────────────────────────────────────
  const startDrag = (clientX) => {
    if (!isTop || exitDir) return
    startXRef.current = clientX
    setIsDragging(true)
  }

  const moveDrag = (clientX) => {
    if (!isDragging) return
    setOffset(clientX - startXRef.current)
  }

  const endDrag = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (offset < -THRESHOLD) {
      setExitDir('left')
      setTimeout(() => onSwipeLeft(), 320)
    } else if (offset > THRESHOLD) {
      setExitDir('right')
      setTimeout(() => onSwipeRight(), 320)
    } else {
      setOffset(0)
    }
  }

  // Global mouse listeners attached only while dragging
  useEffect(() => {
    if (!isDragging) return
    const mm = (e) => moveDrag(e.clientX)
    const mu = () => endDrag()
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    return () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
    }
  })

  // ── event handlers ──────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.target.closest('button, a')) return
    e.preventDefault()
    startDrag(e.clientX)
  }
  const onTouchStart = (e) => {
    if (e.target.closest('button, a')) return
    startDrag(e.touches[0].clientX)
  }
  const onTouchMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    setOffset(e.touches[0].clientX - startXRef.current)
  }
  const onTouchEnd = () => endDrag()

  // ── button triggers ─────────────────────────────────────────────
  const triggerLeft = (e) => {
    e.stopPropagation()
    if (exitDir) return
    setExitDir('left')
    setTimeout(() => onSwipeLeft(), 320)
  }
  const triggerRight = (e) => {
    e.stopPropagation()
    if (exitDir) return
    setExitDir('right')
    setTimeout(() => onSwipeRight(), 320)
  }

  // ── visual state ────────────────────────────────────────────────
  const rotation = offset * 0.07
  const ouiOpacity = Math.min(Math.max((-offset - 20) / 80, 0), 1)
  const nonOpacity = Math.min(Math.max((offset - 20) / 80, 0), 1)

  let transform
  if (exitDir === 'left') {
    transform = 'translateX(-130vw) rotate(-25deg)'
  } else if (exitDir === 'right') {
    transform = 'translateX(130vw) rotate(25deg)'
  } else if (!isTop) {
    const scale = 1 - stackIndex * 0.04
    const ty = stackIndex * 14
    transform = `scale(${scale}) translateY(${ty}px)`
  } else {
    transform = `translateX(${offset}px) rotate(${rotation}deg)`
  }

  const transition =
    isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)'

  return (
    <div
      className={`swipe-card${isTop ? ' swipe-card--top' : ''}`}
      style={{ transform, transition, zIndex: 10 - stackIndex }}
      onMouseDown={isTop ? onMouseDown : undefined}
      onTouchStart={isTop ? onTouchStart : undefined}
      onTouchMove={isTop ? onTouchMove : undefined}
      onTouchEnd={isTop ? onTouchEnd : undefined}
    >
      {/* OUI / NON overlays */}
      {isTop && (
        <>
          <div className="swipe-overlay swipe-overlay--oui" style={{ opacity: ouiOpacity }}>
            ♥ OUI
          </div>
          <div className="swipe-overlay swipe-overlay--non" style={{ opacity: nonOpacity }}>
            ✕ NON
          </div>
        </>
      )}

      {/* Hero gradient */}
      <div className="swipe-card__hero" style={{ background: config.gradient }}>
        <span className="swipe-card__emoji" role="img" aria-hidden="true">
          {config.emoji}
        </span>
        <span className="swipe-card__cat-badge">{config.label}</span>
      </div>

      {/* Info block */}
      <div className="swipe-card__body">
        <h2 className="swipe-card__name">{activity.name}</h2>
        <div className="swipe-card__meta">
          {activity.distance && <span>📍 {activity.distance}</span>}
          {activity.openingHours && <span>🕒 {activity.openingHours}</span>}
        </div>
        {activity.description && (
          <p className="swipe-card__desc">{activity.description}</p>
        )}
        {activity.address && (
          <p className="swipe-card__addr">{activity.address}</p>
        )}
      </div>

      {/* Action buttons — left = OUI, right = NON */}
      {isTop && (
        <div className="swipe-card__actions">
          <button
            className="swipe-card__btn swipe-card__btn--oui"
            onClick={triggerLeft}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="J'aime"
          >
            <span>♥</span>
            <small>OUI</small>
          </button>
          <button
            className="swipe-card__btn swipe-card__btn--non"
            onClick={triggerRight}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Pas intéressé"
          >
            <span>✕</span>
            <small>NON</small>
          </button>
        </div>
      )}
    </div>
  )
}
