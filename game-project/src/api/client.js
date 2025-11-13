import { getAuthToken } from '../utils/session'

const sanitizePath = (path) => {
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

const normalizeBaseUrl = () => {
  const value = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export const API_BASE_URL = normalizeBaseUrl()

export const request = async (path, { method = 'GET', body, headers, skipAuth = false } = {}) => {
  const url = `${API_BASE_URL}${sanitizePath(path)}`
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers
  }

  if (!skipAuth) {
    const token = getAuthToken()
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined
  })

  let data = null
  try {
    data = await response.json()
  } catch (error) {
    // Ignore body parse errors so we can surface HTTP issues below.
  }

  if (!response.ok) {
    const message = data?.message || 'Error al comunicarse con el servidor'
    throw new Error(message)
  }

  return data
}
