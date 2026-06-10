import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { msalInstance } from '../auth/AuthProvider'
import { apiRequest, loginRequest } from '../auth/msalConfig'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// ─── Request interceptor: attach Bearer token ────────────────────────────────────────────
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const accounts = msalInstance.getAllAccounts()
    if (accounts.length === 0) return config

    const account = accounts[0]
    try {
      const response = await msalInstance.acquireTokenSilent({
        ...apiRequest,
        account,
      })
      config.headers.Authorization = `Bearer ${response.accessToken}`
    } catch {
      // Fall back to ID token
      try {
        const response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account,
        })
        config.headers.Authorization = `Bearer ${response.idToken}`
      } catch (err) {
        console.warn('Could not acquire token for API request', err)
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor: handle 401 ──────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear MSAL cache and redirect to login
      const accounts = msalInstance.getAllAccounts()
      if (accounts.length > 0) {
        try {
          await msalInstance.acquireTokenPopup({
            ...apiRequest,
            account: accounts[0],
          })
          // Retry the original request
          return client.request(error.config!)
        } catch {
          await msalInstance.logoutPopup()
        }
      }
    }
    return Promise.reject(error)
  }
)

export default client
