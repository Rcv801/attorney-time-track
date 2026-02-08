import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/app/Dashboard'
import Entries from './pages/app/Entries'
import ClientsAndMatters from './pages/app/ClientsAndMatters'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import RequireAuth from './components/RequireAuth'
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="entries" element={<Entries />} />
          <Route path="clients-matters" element={<ClientsAndMatters />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
