import { request } from './client'

// Obtener bloques por nivel
export const fetchBlocks = (level = 1) =>
  request(`/api/blocks?level=${level}`, {
    method: 'GET'
  })

// Obtener cantidad de monedas por nivel
export const fetchCoinCount = (level = 1) =>
  request(`/api/blocks/coin-count?level=${level}`, {
    method: 'GET'
  })
