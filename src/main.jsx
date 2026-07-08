import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx'

// HashRouter (plutôt que BrowserRouter) : l'app est déployée en pages statiques
// sur GitHub Pages, qui ne réécrit pas les routes côté serveur. Un refresh sur
// /dashboard avec BrowserRouter renvoie une 404 ; avec /#/dashboard, le hash
// n'est jamais envoyé au serveur et le refresh recharge toujours index.html.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
