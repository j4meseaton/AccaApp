import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, ProtectedRoute, LoginPage } from './auth/AuthProvider'

// Pages
import { Dashboard } from './pages/Dashboard'
import { Inventory } from './pages/Inventory'
import { AssetDetail } from './pages/AssetDetail'
import { Lifecycle } from './pages/Lifecycle'
import { Licenses } from './pages/Licenses'
import { Compliance } from './pages/Compliance'
import { Integrations } from './pages/Integrations'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { Users } from './pages/Users'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <Inventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assets/:id"
              element={
                <ProtectedRoute>
                  <AssetDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lifecycle"
              element={
                <ProtectedRoute>
                  <Lifecycle />
                </ProtectedRoute>
              }
            />
            <Route
              path="/licenses"
              element={
                <ProtectedRoute>
                  <Licenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance"
              element={
                <ProtectedRoute>
                  <Compliance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations"
              element={
                <ProtectedRoute>
                  <Integrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-surface">
                  <div className="text-center">
                    <p className="text-6xl font-bold text-text-muted">404</p>
                    <p className="text-text-secondary mt-2">Page not found</p>
                    <a href="/dashboard" className="mt-4 inline-block text-accent hover:underline text-sm">
                      Return to Dashboard
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
