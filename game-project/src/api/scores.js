import { request } from './client'

export const submitScore = ({ points, durationSeconds, level }) =>
  request('/api/scores', {
    method: 'POST',
    body: { points, durationSeconds, level }
  })

export const fetchScores = (limit = 10) =>
  request(`/api/scores?limit=${limit}`, {
    method: 'GET'
  })
