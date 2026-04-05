import { Routes, Route, Navigate } from 'react-router-dom'
import SetupScreen    from './screens/SetupScreen/SetupScreen'
import DashboardScreen from './screens/DashboardScreen/DashboardScreen'
import InterrogationScreen from './screens/InterrogationScreen/InterrogationScreen'
import './App.css'

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/"              element={<SetupScreen />} />
        <Route path="/dashboard"     element={<DashboardScreen />} />
        <Route path="/interrogation" element={<InterrogationScreen />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
