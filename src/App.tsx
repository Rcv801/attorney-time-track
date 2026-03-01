import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/app/Dashboard'
import Entries from './pages/app/Entries'
import ClientsAndMatters from './pages/app/ClientsAndMatters'
import Invoices from './pages/app/Invoices'
import InvoiceBuilderPage from './pages/app/InvoiceBuilderPage'
import InvoiceDetail from './pages/app/InvoiceDetail'
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
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceBuilderPage />} />
          <Route path="invoices/:invoiceId" element={<InvoiceDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
