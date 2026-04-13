import { Routes, Route, Navigate } from 'react-router-dom'
import SetupScreen    from './screens/SetupScreen/SetupScreen'
import DashboardScreen from './screens/DashboardScreen/DashboardScreen'

import './App.css'

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/"              element={<SetupScreen />} />
        <Route path="/dashboard"     element={<DashboardScreen />} />

        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
