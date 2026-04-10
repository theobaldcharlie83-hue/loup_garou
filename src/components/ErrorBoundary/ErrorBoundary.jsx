import React from 'react'

/**
 * Composant ErrorBoundary pour capturer les erreurs de rendu React
 * et afficher un message utile au MJ au lieu d'un écran blanc.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    // Met à jour l'état pour que le prochain rendu affiche l'UI de secours.
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Vous pouvez aussi enregistrer l'erreur dans un service de rapport d'erreurs
    console.error("ErrorBoundary a capturé une erreur :", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // UI de secours personnalisée
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#0e0e35',
          color: '#e8b4f9',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ fontSize: '3rem' }}>🔮 Oups...</h1>
          <p style={{ fontSize: '1.2rem', maxWidth: '600px' }}>
            Le Grimoire a rencontré une perturbation magique. 
            Une erreur s'est produite lors de l'affichage de l'application.
          </p>
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            textAlign: 'left',
            fontSize: '0.9rem',
            color: '#ffb4ab',
            maxWidth: '90%',
            overflow: 'auto',
            border: '1px solid #ffb4ab'
          }}>
            <strong>Erreur :</strong> {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '2rem',
              padding: '12px 24px',
              borderRadius: '24px',
              border: 'none',
              background: '#e8b4f9',
              color: '#471e58',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Tenter de recharger le Grimoire
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
