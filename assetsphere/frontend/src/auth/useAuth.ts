import { useCallback, useEffect, useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser'
import { loginRequest, apiRequest } from './msalConfig'

interface UseAuthReturn {
  user: AccountInfo | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  getToken: () => Promise<string | null>
}

export function useAuth(): UseAuthReturn {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [token, setToken] = useState<string | null>(null)
  const isLoading = inProgress !== 'none'

  const user = accounts[0] ?? null

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null

    try {
      const response = await instance.acquireTokenSilent({
        ...apiRequest,
        account: user,
      })
      return response.accessToken
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          const response = await instance.acquireTokenPopup(apiRequest)
          return response.accessToken
        } catch (popupError) {
          console.error('Token acquisition failed:', popupError)
          return null
        }
      }
      // Fall back to ID token for scenarios where API scope isn't configured
      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: user,
        })
        return response.idToken
      } catch {
        return null
      }
    }
  }, [instance, user])

  // Acquire token on mount / when user changes
  useEffect(() => {
    if (user) {
      getToken().then(setToken)
    } else {
      setToken(null)
    }
  }, [user, getToken])

  const login = useCallback(async () => {
    await instance.loginPopup(loginRequest)
  }, [instance])

  const logout = useCallback(async () => {
    await instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    })
  }, [instance])

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    getToken,
  }
}
