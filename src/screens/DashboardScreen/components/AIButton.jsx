/**
 * Bouton IA unifié : normalise le libellé et le style des ~12 boutons
 * "faire jouer la peluche" dispersés dans la carte de nuit et le tribunal.
 * Libellé : 🎲 IA — {label} [(strategy)]
 */
export default function AIButton({ label, strategy, onClick, disabled, icon = '🎲' }) {
  return (
    <button
      className="header-btn ai-btn"
      style={{ marginBottom: 10, alignSelf: 'center' }}
      onClick={onClick}
      disabled={disabled}
    >
      {icon} IA — {label}{strategy ? ` (${strategy})` : ''}
    </button>
  )
}
