// src/Experience/Utils/GameTracker.js
import { submitScore } from '../../api/scores'
import { getAuthToken } from '../../utils/session'

export default class GameTracker {
  constructor({ modal, menu }) {
    this.modal = modal
    this.menu = menu
    this.startTime = null
    this.endTime = null
    this.finished = false
    this.leaderboard = []
    this.localBestTimes = this._readLocalTimes()
  }

  start() {
    this.startTime = Date.now()
    this._startLoop()
  }

  stop() {
    this.endTime = Date.now()
    this.finished = true
    return this.getElapsedSeconds()
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0
    const end = this.finished ? this.endTime : Date.now()
    return Math.floor((end - this.startTime) / 1000)
  }

  _startLoop() {
    const update = () => {
      if (this.finished) return
      const elapsed = this.getElapsedSeconds()

      if (this.menu && typeof this.menu.setTimer === 'function') {
        this.menu.setTimer(elapsed)
      }

      requestAnimationFrame(update)
    }
    update()
  }

  async recordRun({ durationSeconds, points, level }) {
    const hasToken = Boolean(getAuthToken())
    if (!hasToken) {
      this._updateLocalTimes(durationSeconds)
      return
    }

    try {
      const payload = await submitScore({ durationSeconds, points, level })
      if (Array.isArray(payload?.leaderboard)) {
        this.leaderboard = payload.leaderboard
        window.dispatchEvent(
          new CustomEvent('leaderboard-updated', { detail: payload.leaderboard })
        )
      }
    } catch (error) {
      console.warn('No se pudo guardar el puntaje remoto', error)
      this._updateLocalTimes(durationSeconds)
    }
  }

  _readLocalTimes() {
    try {
      return JSON.parse(localStorage.getItem('bestTimes') || '[]')
    } catch (error) {
      console.warn('No se pudo leer bestTimes locales', error)
      return []
    }
  }

  _updateLocalTimes(seconds) {
    const updated = [...this.localBestTimes, seconds]
      .filter((value) => typeof value === 'number' && Number.isFinite(value))
      .sort((a, b) => a - b)
      .slice(0, 5)

    this.localBestTimes = updated
    localStorage.setItem('bestTimes', JSON.stringify(updated))
  }

  // Modal de fin de juego
  showEndGameModal(currentTime) {
    if (!this.modal || typeof this.modal.show !== 'function') {
      console.warn('�s���? No se puede mostrar el modal de fin: modal no definido.')
      return
    }

    const ranking = this._buildRankingText()

    this.modal.show({
      icon: '🏆',
      message: `🎮 ¡MISIÓN COMPLETADA! 🎮\n\n🌟 Has conquistado todos los niveles\n⚡ Tiempo récord: ${currentTime}s\n🎯 ¡Eres un verdadero campeón!\n\n${ranking}`,
      buttons: [
        {
          text: '🔄 Reintentar',
          onClick: () => {
            window.experience.resetGameToFirstLevel()
          }
        },
        {
          text: '�?O Cancelar',
          onClick: () => {
            this.modal.hide()
            this.showReplayButton()
          }
        }

      ]
    })

    const cancelBtn = document.getElementById('cancel-button')
    if (cancelBtn) cancelBtn.remove()
  }

  _buildRankingText() {
    if (this.leaderboard.length > 0) {
      return '�Y?� Mejores jugadores:\n' + this.leaderboard
        .map((entry, index) =>
          `#${index + 1} ${entry.username} - ${entry.points} pts (${entry.durationSeconds}s)`
        )
        .join('\n')
    }

    if (this.localBestTimes.length === 0) {
      return 'A��n no hay puntajes guardados.'
    }

    return '�Y?� Mejores tiempos locales:\n' + this.localBestTimes
      .map((time, index) => `#${index + 1}: ${time}s`)
      .join('\n')
  }

  // iniciar juego
  showReplayButton() {
    if (document.getElementById('replay-button')) return

    const btn = document.createElement('button')
    btn.id = 'replay-button'
    btn.innerText = '�YZ� Volver a jugar'

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '10px 16px',
      fontSize: '16px',
      background: '#00fff7',
      color: '#000',
      border: 'none',
      borderRadius: '8px',
      boxShadow: '0 0 12px #00fff7',
      cursor: 'pointer',
      zIndex: 9999
    })

    btn.onclick = () => {
      this.hideGameButtons()
      window.experience.resetGame()
    }

    document.body.appendChild(btn)
  }

  hideGameButtons() {
    const replayBtn = document.getElementById('replay-button')
    if (replayBtn) replayBtn.remove()
  }

  destroy() {
    this.finished = true
    if (this.timerElement && this.timerElement.remove) {
      this.timerElement.remove()
      this.timerElement = null
    }
  }

  handleCancelGame() {
    if (this.finished) return

    this.modal?.show({
      icon: '�s���?',
      message: '��Deseas cancelar la partida en curso?\nPerderǭs tu progreso actual.',
      buttons: [
        {
          text: '�?O Cancelar juego',
          onClick: () => {
            this.hideGameButtons()
            this.modal.hide()
            window.experience.resetGame()
          }
        },
        {
          text: '�Ÿ��? Seguir jugando',
          onClick: () => this.modal.hide()
        }
      ]
    })
  }
}
