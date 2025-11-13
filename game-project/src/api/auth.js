import { request } from './client'

export const loginRequest = ({ identifier, password }) =>
  request('/api/auth/login', {
    method: 'POST',
    body: { identifier, password },
    skipAuth: true
  })

export const registerRequest = ({ username, email, password }) =>
  request('/api/auth/register', {
    method: 'POST',
    body: { username, email, password },
    skipAuth: true
  })
