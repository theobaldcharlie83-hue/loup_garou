import React from 'react'

const AUTOSAVE_KEY = 'loup_garou_autosave'

/**
 * Capture les erreurs de rendu et propose une reprise SANS perdre la partie :
 *  1. « Reprendre » : ré-affiche l'écran (la partie est toujours en mémoire) ;
 *  2. « Retour à l'accueil » : écran de configuration, la partie en cours reste
 *     accessible via « Retourner à la partie en cours » ;
 *  3. « Recharger » : relance l'app (l'autosave restaure la partie) ;
 *  4. dernier recours : effacer la partie en cours (les sauvegardes nommées
 *     sont conservées), utile si l'état enregistré lui-même est corrompu.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary a capturé une erreur :', error, errorInfo)
  }

  retry = () => this.setState({ hasError: false, error: null })

  goHome = () => {
    window.location.hash = '#/'
    this.retry()
  }

  hardReset = () => {
    if (!window.confirm('Effacer la partie en cours ? Les parties sauvegardées seront conservées.')) return
    try { localStorage.removeItem(AUTOSAVE_KEY) } catch { /* stockage indisponible */ }
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="error-screen" role="alert">
        <div className="error-card parchment-panel">
          <h1>Le grimoire s'est refermé…</h1>
          <p>Un imprévu a interrompu l'affichage. Votre partie est conservée : essayez de reprendre.</p>
          <div className="error-actions">
            <button className="btn-ink" onClick={this.retry}>Reprendre</button>
            <button className="btn-ghost" onClick={this.goHome}>Retour à l'accueil</button>
            <button className="btn-ghost" onClick={() => window.location.reload()}>Recharger</button>
          </div>
          <details className="error-details">
            <summary>Détails techniques</summary>
            <code>{this.state.error?.toString()}</code>
            <button className="error-reset" onClick={this.hardReset}>Effacer la partie en cours (dernier recours)</button>
          </details>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
