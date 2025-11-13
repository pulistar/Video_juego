const jwt = require('jsonwebtoken')
const User = require('../models/User')

module.exports = async function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET no configurado')
    }

    const payload = jwt.verify(token, secret)
    const user = await User.findById(payload.sub)

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Error autenticando token', error)
    res.status(401).json({ message: 'Token inválido o expirado' })
  }
}
