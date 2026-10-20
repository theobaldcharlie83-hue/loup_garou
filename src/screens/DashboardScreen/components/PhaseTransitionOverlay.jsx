/** Overlay animé de transition Jour/Nuit (présentational). Un toucher le fait disparaître. */
export default function PhaseTransitionOverlay({ active, phase, onSkip }) {
  const dir = phase === 'day' ? 'to-day' : phase === 'night' ? 'to-night' : ''
  return (
    <div
      className={`phase-transition-overlay${active ? ' active' : ''} ${dir}`}
      onClick={active ? onSkip : undefined}
      aria-hidden={!active}
    >
      <div className="phase-transition-content">
        <div className="phase-transition-icon">{phase === 'night' ? '🌙' : '☀️'}</div>
        <div className="phase-transition-text">
          {phase === 'night' ? 'La nuit tombe sur Thiercelieux…' : 'Le jour se lève sur Thiercelieux…'}
        </div>
      </div>
      <div className="phase-transition-village" aria-hidden="true" />
    </div>
  )
}
