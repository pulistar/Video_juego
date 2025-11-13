const Score = require('../models/Score')

const buildLeaderboard = async (limit = 10) => {
  const scores = await Score.find()
    .sort({ points: -1, durationSeconds: 1, createdAt: 1 })
    .limit(limit)
    .lean()

  return scores.map(score => ({
    id: score._id.toString(),
    username: score.username,
    points: score.points,
    durationSeconds: score.durationSeconds,
    level: score.level,
    createdAt: score.createdAt
  }))
}

exports.createScore = async (req, res) => {
  try {
    const { points, durationSeconds, level } = req.body

    if (
      typeof points !== 'number' ||
      typeof durationSeconds !== 'number' ||
      typeof level !== 'number'
    ) {
      return res.status(400).json({ message: 'Datos de puntaje inválidos' })
    }

    const score = await Score.create({
      user: req.user._id,
      username: req.user.username,
      points: Math.max(0, Math.round(points)),
      durationSeconds: Math.max(0, Math.round(durationSeconds)),
      level: Math.max(1, Math.round(level))
    })

    const leaderboard = await buildLeaderboard()

    res.status(201).json({
      score: {
        id: score._id.toString(),
        username: score.username,
        points: score.points,
        durationSeconds: score.durationSeconds,
        level: score.level,
        createdAt: score.createdAt
      },
      leaderboard
    })
  } catch (error) {
    console.error('Error guardando puntaje', error)
    res.status(500).json({ message: 'No se pudo guardar el puntaje' })
  }
}

exports.getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
    const leaderboard = await buildLeaderboard(limit)
    res.json({ leaderboard })
  } catch (error) {
    console.error('Error obteniendo leaderboard', error)
    res.status(500).json({ message: 'No se pudo obtener el leaderboard' })
  }
}
