import { Routes, Route, Navigate } from 'react-router-dom'
import SetupScreen      from './screens/SetupScreen/SetupScreen'
import DashboardScreen  from './screens/DashboardScreen/DashboardScreen'
import ExplorerHome     from './screens/explorer/ExplorerHome'
import SwipeScreen      from './screens/explorer/SwipeScreen'
import FavoritesScreen  from './screens/explorer/FavoritesScreen'

import './App.css'

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* ── Loup-Garou game ─────────────────────── */}
        <Route path="/"          element={<SetupScreen />} />
        <Route path="/dashboard" element={<DashboardScreen />} />

        {/* ── Cultural Activities Explorer ─────────── */}
        <Route path="/explorer"           element={<ExplorerHome />} />
        <Route path="/explorer/swipe"     element={<SwipeScreen />} />
        <Route path="/explorer/favorites" element={<FavoritesScreen />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
