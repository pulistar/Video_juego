const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const TOKEN_EXPIRATION = '7d' // 7 días en lugar de 12 horas

const buildToken = (userId) => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign({ userId: userId.toString() }, secret, { expiresIn: TOKEN_EXPIRATION })
}

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email y password son obligatorios' })
    }

    const normalizedEmail = email.toLowerCase()

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username }]
    })

    if (existing) {
      return res.status(409).json({ message: 'El usuario ya existe' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ username, email: normalizedEmail, passwordHash })
    const token = buildToken(user._id)

    res.status(201).json({
      user: user.toSafeObject(),
      token
    })
  } catch (error) {
    console.error('Error en registro', error)
    res.status(500).json({ message: 'Error al registrar usuario' })
  }
}

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Credenciales incompletas' })
    }

    const normalizedIdentifier = identifier.toLowerCase()
    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { username: identifier }]
    })

    if (!user) {
      return res.status(401).json({ message: 'Usuario o contraseña inválidos' })
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash)

    if (!passwordOk) {
      return res.status(401).json({ message: 'Usuario o contraseña inválidos' })
    }

    const token = buildToken(user._id)

    res.json({
      user: user.toSafeObject(),
      token
    })
  } catch (error) {
    console.error('Error en login', error)
    res.status(500).json({ message: 'Error al iniciar sesión' })
  }
}
