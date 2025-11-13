const STORAGE_KEY = 'toy-car-auth'

export const getStoredAuth = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('No se pudo leer la sesión', error)
    return null
  }
}

export const setStoredAuth = (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export const clearStoredAuth = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export const getAuthToken = () => getStoredAuth()?.token || null

export const storageKey = STORAGE_KEY
