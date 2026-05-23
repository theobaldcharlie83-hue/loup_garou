import { useNavigate, useLocation } from 'react-router-dom'
import useExplorerStore from '../../store/useExplorerStore'
import './ExplorerTabBar.css'

const TABS = [
  { path: '/explorer',           icon: '🏠', label: 'Accueil' },
  { path: '/explorer/swipe',     icon: '🗺️', label: 'Explorer' },
  { path: '/explorer/favorites', icon: '♥',  label: 'Favoris' },
]

export default function ExplorerTabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const favCount = useExplorerStore((s) => s.favorites.length)

  return (
    <nav className="explorer-tab-bar">
      {TABS.map((tab) => {
        const isActive = pathname === tab.path
        const badge = tab.path === '/explorer/favorites' && favCount > 0 ? favCount : 0
        return (
          <button
            key={tab.path}
            className={`tab-item${isActive ? ' tab-item--active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="tab-item__icon">
              {tab.icon}
              {badge > 0 && <span className="tab-badge">{badge > 99 ? '99+' : badge}</span>}
            </span>
            <span className="tab-item__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
