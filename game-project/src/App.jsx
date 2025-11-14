import { useCallback, useEffect, useRef, useState } from 'react'
import Experience from './Experience/Experience'
import LoginOverlay from './components/LoginOverlay'
import LeaderboardPanel from './components/LeaderboardPanel'
import { fetchScores } from './api/scores'
import { clearStoredAuth, getStoredAuth, setStoredAuth } from './utils/session'
import './styles/loader.css'
import './styles/login.css'
import './styles/leaderboard.css'

const App = () => {
  const canvasRef = useRef()
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [auth, setAuth] = useState(() => getStoredAuth())
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)

  const canShowLeaderboard = Boolean(auth?.token)
  const canPlay = canShowLeaderboard || offlineMode

  const loadLeaderboard = useCallback(async () => {
    if (!canShowLeaderboard) return
    try {
      setLeaderboardLoading(true)
      const data = await fetchScores(10)
      setLeaderboard(data?.leaderboard || [])
    } catch (error) {
      console.warn('No se pudo cargar leaderboard', error)
    } finally {
      setLeaderboardLoading(false)
    }
  }, [canShowLeaderboard])

  useEffect(() => {
    if (!canShowLeaderboard) return undefined

    loadLeaderboard()

    const handleExternalUpdate = (event) => {
      if (Array.isArray(event.detail)) {
        setLeaderboard(event.detail)
      }
    }

    window.addEventListener('leaderboard-updated', handleExternalUpdate)

    return () => {
      window.removeEventListener('leaderboard-updated', handleExternalUpdate)
    }
  }, [canShowLeaderboard, loadLeaderboard])

  useEffect(() => {
    if (!canPlay) return undefined

    setLoading(true)
    const experience = new Experience(canvasRef.current)

    // Inicializar sesión de juego cuando se carga la experiencia
    const handleComplete = () => {
      setLoading(false)
      // Iniciar nueva sesión cuando el juego esté listo
      if (experience.tracker) {
        experience.tracker.startSession()
      }
    }

    const handleProgress = (event) => setProgress(event.detail)

    window.addEventListener('resource-progress', handleProgress)
    window.addEventListener('resource-complete', handleComplete)

    return () => {
      window.removeEventListener('resource-progress', handleProgress)
      window.removeEventListener('resource-complete', handleComplete)
    }
  }, [canPlay])

  const handleAuthSuccess = (payload) => {
    const nextState = { user: payload.user, token: payload.token }
    setStoredAuth(nextState)
    setProgress(0)
    setLoading(true)
    setAuth(nextState)
    setOfflineMode(false)
  }

  const handleLogout = () => {
    const confirmed = window.confirm('¿Estás seguro de que quieres cerrar sesión?\n\nPerderás el progreso actual del juego.')
    
    if (confirmed) {
      clearStoredAuth()
      setAuth(null)
      setLeaderboard([])
      setOfflineMode(false)
      window.location.reload()
    }
  }

  const handleOfflinePlay = () => {
    clearStoredAuth()
    setAuth(null)
    setProgress(0)
    setLoading(true)
    setOfflineMode(true)
  }

  return (
    <>
      {!canPlay && (
        <LoginOverlay onSuccess={handleAuthSuccess} onOfflinePlay={handleOfflinePlay} />
      )}

      {canPlay && (
        <>
          {loading && (
            <div id="loader-overlay">
              <div id="loader-bar" style={{ width: `${progress}%` }}></div>
              <div id="loader-text">Cargando... {progress}%</div>
            </div>
          )}
          <button className="logout-button" type="button" onClick={handleLogout}>
            👤 {auth?.user?.username || 'Usuario'} | 🚪 Salir
          </button>
          {canShowLeaderboard && (
            <LeaderboardPanel
              leaderboard={leaderboard}
              onRefresh={loadLeaderboard}
              loading={leaderboardLoading}
            />
          )}
        </>
      )}

      <canvas
        ref={canvasRef}
        className="webgl"
        style={{ visibility: canPlay ? 'visible' : 'hidden' }}
      />
    </>
  )
}

export default App
