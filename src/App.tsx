import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import Landing from './pages/Landing'
import Overview from './pages/Overview'
import NewResearch from './pages/NewResearch'
import ResearchHistory from './pages/ResearchHistory'
import SessionWorkspace from './pages/SessionWorkspace'
import EvidenceLibrary from './pages/EvidenceLibrary'
import VerificationTasks from './pages/VerificationTasks'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="new" element={<NewResearch />} />
        <Route path="history" element={<ResearchHistory />} />
        <Route path="session/:sessionId" element={<SessionWorkspace />} />
        <Route path="evidence" element={<EvidenceLibrary />} />
        <Route path="tasks" element={<VerificationTasks />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/app/session" element={<Navigate to="/app/history" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
