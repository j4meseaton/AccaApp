import React, { type ReactNode } from 'react'
import { MsalProvider, useIsAuthenticated, useMsal } from '@azure/msal-react'
import { PublicClientApplication, InteractionStatus } from '@azure/msal-browser'
import { Navigate, useLocation } from 'react-router-dom'
import { msalConfig, loginRequest } from './msalConfig'

// Singleton MSAL instance — created once at module load time
export const msalInstance = new PublicClientApplication(msalConfig)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
}

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress } = useMsal()
  const location = useLocation()

  // Wait for MSAL to finish any in-progress interaction before deciding
  if (inProgress !== InteractionStatus.None) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Authenticating…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Login page component used when unauthenticated
export function LoginPage() {
  const { instance, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest)
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md px-8 py-10 bg-surface2 border border-border-color rounded-2xl shadow-card">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-xl font-bold text-text-primary tracking-tight">AssetSphere</span>
        </div>

        <h1 className="text-2xl font-semibold text-text-primary text-center mb-2">Welcome back</h1>
        <p className="text-text-secondary text-sm text-center mb-8">
          Sign in with your Microsoft account to continue
        </p>

        <button
          onClick={handleLogin}
          disabled={inProgress !== InteractionStatus.None}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors duration-200"
        >
          {inProgress !== InteractionStatus.None ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 23 23" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="10" height="10" fill="#f25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
              <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
              <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
            </svg>
          )}
          Sign in with Microsoft
        </button>

        <p className="text-text-muted text-xs text-center mt-6">
          By signing in, you agree to your organisation's IT policies.
        </p>
      </div>
    </div>
  )
}
