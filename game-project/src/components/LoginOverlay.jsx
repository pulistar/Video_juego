import { useMemo, useState } from 'react'
import { loginRequest, registerRequest } from '../api/auth'

const initialForm = {
  identifier: '',
  username: '',
  email: '',
  password: ''
}

const LoginOverlay = ({ onSuccess, onOfflinePlay }) => {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const title = mode === 'login' ? 'Inicia sesion' : 'Crea tu cuenta'

  const actionLabel = useMemo(
    () => (mode === 'login' ? 'Entrar al juego' : 'Registrarme'),
    [mode]
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'))
    setForm(initialForm)
    setError(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (mode === 'login' && (!form.identifier || !form.password)) {
      setError('Ingresa usuario/correo y contrasena')
      return
    }

    if (mode === 'register' && (!form.username || !form.email || !form.password)) {
      setError('Completa usuario, correo y contrasena')
      return
    }

    try {
      setLoading(true)
      const payload =
        mode === 'login'
          ? await loginRequest({
            identifier: form.identifier.trim(),
            password: form.password
          })
          : await registerRequest({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password
          })

      onSuccess(payload)
    } catch (err) {
      setError(err.message || 'Error inesperado. Intentalo mas tarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>{title}</h1>
        <p className="login-subtitle">Necesitas identificarte para sincronizar tu progreso.</p>

        {mode === 'login' ? (
          <label>
            Usuario o correo
            <input
              name="identifier"
              type="text"
              value={form.identifier}
              onChange={handleChange}
              placeholder="robotMaster o robot@juego.com"
              autoComplete="username"
              disabled={loading}
            />
          </label>
        ) : (
          <>
            <label>
              Nombre de jugador
              <input
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                placeholder="robotMaster"
                autoComplete="off"
                disabled={loading}
              />
            </label>
            <label>
              Correo
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="robot@juego.com"
                autoComplete="email"
                disabled={loading}
              />
            </label>
          </>
        )}

        <label>
          Contrasena
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="********"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            disabled={loading}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-primary" type="submit" disabled={loading}>
          {loading ? 'Enviando...' : actionLabel}
        </button>

        <button className="login-secondary" type="button" onClick={toggleMode} disabled={loading}>
          {mode === 'login' ? 'No tienes cuenta? Registrate' : 'Ya tienes cuenta? Inicia sesion'}
        </button>

        {onOfflinePlay && (
          <button className="login-offline" type="button" onClick={onOfflinePlay} disabled={loading}>
            Jugar offline
          </button>
        )}
      </form>
    </div>
  )
}

export default LoginOverlay
