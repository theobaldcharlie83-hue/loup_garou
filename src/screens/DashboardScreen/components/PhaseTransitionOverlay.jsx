/** Overlay animé de transition Jour/Nuit (présentational). */
export default function PhaseTransitionOverlay({ active, phase }) {
  const dir = phase === 'day' ? 'to-day' : phase === 'night' ? 'to-night' : ''
  return (
    <div className={`phase-transition-overlay${active ? ' active' : ''} ${dir}`}>
      <div className="phase-transition-content">
        <div className="phase-transition-icon">{phase === 'night' ? '🌙' : '☀️'}</div>
        <div className="phase-transition-text">
          {phase === 'night' ? 'La Nuit Tombe...' : 'Le Jour se Lève...'}
        </div>
      </div>
    </div>
  )
}
