import * as THREE from 'three'
import Environment from './Environment.js'
import Fox from './Fox.js'
import Robot from './Robot.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import Floor from './Floor.js'
import Sound from './Sound.js'
import MobileControls from '../../controls/MobileControls.js'
import LevelManager from './LevelManager.js'
import BlockPrefab from './BlockPrefab.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Enemy from './Enemy.js'
import Prize from './Prize.js'
import { fetchCoinCount } from '../../api/blocks.js'

// ===== Ajustes de recogida de monedas =====
const PICKUP_RADIUS = 2.0      
const SPEED_MIN = 0.05         
const REQUIRE_MOVEMENT = false

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = this.experience.scene
    this.blockPrefab = new BlockPrefab(this.experience)
    this.resources = this.experience.resources
    this.levelManager = new LevelManager(this.experience)
    this.finalPrizeActivated = false
    this.gameStarted = false
    this.coinsToSpawnPortal = 10 // Valor por defecto, se actualizará dinámicamente
    this.enemies = []

    this.coinSound = new Sound('/sounds/coin.ogg')
    this.ambientSound = new Sound('/sounds/ambiente.mp3', { loop: true, volume: 0.3 })
    this.winner = new Sound('/sounds/winner.mp3')
    this.portalSound = new Sound('/sounds/portal.mp3')
    this.loseSound = new Sound('/sounds/lose.ogg')

    this.allowPrizePickup = false
    this.portalPrize = null // guardamos referencia al portal finalPrize

    setTimeout(() => {
      this.allowPrizePickup = true
    }, 2000)

    this.resources.on('ready', async () => {
      this.floor = new Floor(this.experience)
      this.environment = new Environment(this.experience)

      this.loader = new ToyCarLoader(this.experience)
      await this.loader.loadFromAPI(this.levelManager.currentLevel)

      this.fox = new Fox(this.experience)
      this.robot = new Robot(this.experience)
      
      // Configurar el fox para que siga al robot
      this.fox.setPlayer(this.robot)

      // Cámara tercera persona
      this.tpOffsetLocal = new THREE.Vector3(0, 1.6, -4.5)
      this.tpLookOffset  = new THREE.Vector3(0, 1.2,  0)
      this.tpLerpPos     = 0.18
      this.tpLerpLook    = 0.25
      this.__camDesired  = new THREE.Vector3()
      this.__camLook     = new THREE.Vector3()
      this.__tmp         = new THREE.Vector3()

      // Enemigos
      this.enemyTemplate = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      )
      this.enemyModelResource = this.resources.items?.EnemieModel?.scene || null
      
      // Usar la cantidad de enemigos según el nivel actual
      const enemiesCount = this.levelManager.getCurrentLevelEnemyCount()
      this.spawnEnemies(enemiesCount)

      this.experience.vr.bindCharacter(this.robot)

      this.mobileControls = new MobileControls({
        onUp:   (pressed) => { this.experience.keyboard.keys.up = pressed },
        onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
        onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
        onRight:(pressed) => { this.experience.keyboard.keys.right = pressed }
      })

      if (!this.experience.physics || !this.experience.physics.world) {
        console.error("🚫 Sistema de físicas no está inicializado al cargar el mundo.")
        return
      }

      this.gameStarted = true

      this._checkVRMode()
      this.experience.renderer.instance.xr.addEventListener('sessionstart', () => {
        this._checkVRMode()
      })

      // Estado inicial
      this.points = 0
      this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)
    })
  }

  // ===== Spawnea el portal (finalPrize) al completar las monedas requeridas =====
  spawnFinalPortal(center = new THREE.Vector3(0, 2.0, 0)) {
    if (this.finalPrizeActivated) return
    const portalGLTF = this.resources.items?.PortalModel?.scene
    if (!portalGLTF) {
      console.error('❌ PortalModel no está cargado en resources.items.PortalModel')
      return
    }

    // Crear Prize a partir del portal, role "finalPrize"
    this.portalPrize = new Prize({
      model: portalGLTF,
      position: center,
      scene: this.scene,
      role: 'finalPrize'
    })

    // Asegurar flags para limpieza por nivel
    this.portalPrize.model.userData.levelObject = true
    if (this.portalPrize.pivot) this.portalPrize.pivot.userData.levelObject = true

    // Hacer visible (un finalPrize normal empieza oculto)
    if (this.portalPrize.pivot) this.portalPrize.pivot.visible = true
    if (this.portalPrize.model) this.portalPrize.model.visible = true

    // Inyectarlo al sistema de pickup
    this.loader.prizes.push(this.portalPrize)

    // Partículas y beacon
    new FinalPrizeParticles({
      scene: this.scene,
      targetPosition: this.portalPrize.pivot.position,
      sourcePosition: this.robot.body?.position || center,
      experience: this.experience
    })

    // Efectos dentro del portal
    this.portalEffectsGroup = new THREE.Group()
    this.scene.add(this.portalEffectsGroup)

    // Crear partículas giratorias dentro del portal
    const particleCount = 20
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8)
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8
    })

    this.portalParticles = []
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial)
      
      // Posición inicial en espiral
      const angle = (i / particleCount) * Math.PI * 2
      const radius = Math.random() * 0.8 + 0.2
      const height = Math.random() * 1.5 - 0.75
      
      particle.position.set(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      )
      
      particle.userData = {
        angle: angle,
        radius: radius,
        speed: Math.random() * 2 + 1,
        verticalSpeed: Math.random() * 0.5 + 0.2
      }
      
      this.portalParticles.push(particle)
      this.portalEffectsGroup.add(particle)
    }

    // Luz suave azul dentro del portal
    const portalLight = new THREE.PointLight(0x00ffff, 1, 5)
    portalLight.position.set(0, 0, 0)
    this.portalEffectsGroup.add(portalLight)

    this.portalEffectsGroup.position.copy(this.portalPrize.pivot.position)

    if (window.userInteracted) this.portalSound.play()

    this.finalPrizeActivated = true
    console.log('🌀 Portal (finalPrize) spawneado en el centro.')
  }

  _updateChaseCamera() {
    const cam = this.experience.camera.instance
    const target = this.robot?.group
    if (!target) return

    const robotPos = target.position

    this.__camDesired
      .copy(this.tpOffsetLocal)
      .applyQuaternion(target.quaternion)
      .add(robotPos)

    cam.position.lerp(this.__camDesired, this.tpLerpPos)

    this.__camLook
      .copy(this.tpLookOffset)
      .applyQuaternion(target.quaternion)
      .add(robotPos)

    const currentLook = cam.getWorldDirection(this.__tmp.set(0,0,0)).add(cam.position)
    this.__tmp.lerpVectors(currentLook, this.__camLook, this.tpLerpLook)
    cam.lookAt(this.__tmp)
  }

  spawnEnemies(count = 3) {
    console.log(`👾 Spawneando ${count} enemigos para el nivel ${this.levelManager.currentLevel}`)
    if (!this.robot?.body?.position) return
    const playerPos = this.robot.body.position
    const minRadius = 25
    const maxRadius = 40

    if (this.enemies?.length) {
      this.enemies.forEach(e => e?.destroy?.())
      this.enemies = []
    }

    const modelToUse = this.enemyModelResource || this.enemyTemplate

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = minRadius + Math.random() * (maxRadius - minRadius)
      const x = playerPos.x + Math.cos(angle) * radius
      const z = playerPos.z + Math.sin(angle) * radius
      const y = 1.5

      const enemy = new Enemy({
        scene: this.scene,
        physicsWorld: this.experience.physics.world,
        playerRef: this.robot,
        model: modelToUse,
        position: new THREE.Vector3(x, y, z),
        experience: this.experience
      })

      enemy.delayActivation = 1.0 + i * 0.5
      this.enemies.push(enemy)
    }
  }

  toggleAudio() {
    this.ambientSound.toggle()
  }

  // Método para detener todos los enemigos cuando el jugador muere
  stopAllEnemies() {
    if (this.enemies && this.enemies.length > 0) {
      this.enemies.forEach(enemy => {
        if (enemy && enemy.stopAndIdle) {
          enemy.stopAndIdle()
        }
      })
      console.log(`😴 ${this.enemies.length} enemigos detenidos`)
    }
  }

  update(delta) {
    this.fox?.update()
    this.robot?.update()
    this.blockPrefab?.update()

    // Detectar tecla R para simular muerte (para pruebas)
    if (this.experience.keyboard?.keys?.reset && !this.resetKeyPressed) {
      this.resetKeyPressed = true
      this.handlePlayerDeath()
    } else if (!this.experience.keyboard?.keys?.reset) {
      this.resetKeyPressed = false
    }

    // Enemigos
    if (this.gameStarted) {
      this.enemies?.forEach(e => e.update(delta))

      const distToClosest = this.enemies?.reduce((min, e) => {
        if (!e?.body?.position || !this.robot?.body?.position) return min
        const d = e.body.position.distanceTo(this.robot.body.position)
        return Math.min(min, d)
      }, Infinity) ?? Infinity

      if (distToClosest < 1.0 && !this.defeatTriggered) {
        this.defeatTriggered = true

        if (window.userInteracted && this.loseSound) {
          this.loseSound.play()
        }

        const firstEnemy = this.enemies?.[0]
        const enemyMesh = firstEnemy?.model || firstEnemy?.group
        if (enemyMesh) {
          enemyMesh.scale.set(1.3, 1.3, 1.3)
          setTimeout(() => enemyMesh.scale.set(1, 1, 1), 500)
        }

        // Usar el nuevo sistema de muerte
        this.handlePlayerDeath()

        return
      }
    }

    // Cámara (fuera de VR)
    if (!this.experience.renderer.instance.xr.isPresenting) {
      this._updateChaseCamera()
    }

    // Animación de premios
    this.loader?.prizes?.forEach(p => p.update(delta))

    // ======= PICKUP de MONEDAS / PORTAL =======
    if (!this.allowPrizePickup || !this.loader || !this.robot) return

    let pos = null
    if (this.experience.renderer.instance.xr.isPresenting) {
      pos = this.experience.camera.instance.position
    } else if (this.robot?.getPickupPosition) {
      pos = this.robot.getPickupPosition()
    } else if (this.robot?.body?.position) {
      pos = this.robot.body.position
    } else {
      return
    }

    const speed = (this.robot?.getSpeed && this.robot.getSpeed()) || 0
    const moved = speed > SPEED_MIN

    this.loader.prizes.forEach((prize) => {
      if (!prize?.pivot) return

      const dist = prize.pivot.position.distanceTo(pos)
      const canPick = REQUIRE_MOVEMENT ? (dist < PICKUP_RADIUS && moved) : (dist < PICKUP_RADIUS)

      if (canPick && !prize.collected) {
        prize.collect()
        prize.collected = true
//monedas
        if (prize.role === "default") {
          this.points = (this.points || 0) + 1
          this.robot.points = this.points
          
          // Agregar puntos a la sesión acumulativa
          this.experience.tracker.addSessionPoints(1, this.levelManager.currentLevel)
          
          console.log(`🎯 Monedas recolectadas: ${this.points} / ${this.coinsToSpawnPortal}`)

          // Cuando llegue a la cantidad requerida de monedas, creamos el portal (si aún no fue creado)
          if (!this.finalPrizeActivated && this.points >= this.coinsToSpawnPortal) {
            this.spawnFinalPortal(new THREE.Vector3(0, 2.0, 0)) // centro "del mundo" - elevado
          }
        }

        if (prize.role === "finalPrize") {
          // Portal recogido → pasar de nivel
          console.log(`🚪 Portal del nivel ${this.levelManager.currentLevel} completado`)
          
          if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
            // Continuar al siguiente nivel (NO guardar puntuación aún)
            this.levelManager.nextLevel()
            this.points = 0 // Resetear puntos del nivel, pero mantener sesión activa
            this.robot.points = 0
            console.log(`➡️ Avanzando al nivel ${this.levelManager.currentLevel}`)
          } else {
            // Fin del juego completo - guardar sesión total
            console.log('🏆 ¡Juego completado! Guardando sesión total...')
            this.experience.tracker.endSession()
            
            this.experience.tracker.stop()
            this.experience.tracker.showEndGameModal(this.experience.tracker.getElapsedSeconds())

            this.experience.obstacleWavesDisabled = true
            clearTimeout(this.experience.obstacleWaveTimeout)
            this.experience.raycaster?.removeAllObstacles()

            if (window.userInteracted) {
              this.winner.play()
            }
          }
        }

        if (this.experience.raycaster?.removeRandomObstacles) {
          const reduction = 0.2 + Math.random() * 0.1
          this.experience.raycaster.removeRandomObstacles(reduction)
        }

        if (window.userInteracted) {
          this.coinSound.play()
        }

        this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)
      }
    })

    // Animar partículas del portal
    if (this.portalParticles && this.portalParticles.length > 0) {
      this.portalParticles.forEach(particle => {
        const userData = particle.userData
        
        // Movimiento circular
        userData.angle += userData.speed * delta
        particle.position.x = Math.cos(userData.angle) * userData.radius
        particle.position.z = Math.sin(userData.angle) * userData.radius
        
        // Movimiento vertical ondulante
        particle.position.y += Math.sin(userData.angle * 2) * userData.verticalSpeed * delta
        
        // Efecto de parpadeo
        particle.material.opacity = 0.5 + Math.sin(userData.angle * 3) * 0.3
      })
    }

    // Optimización física por distancia
    const playerPos = this.experience.renderer.instance.xr.isPresenting
      ? this.experience.camera.instance.position
      : this.robot?.body?.position

    this.scene.traverse((obj) => {
      if (obj.userData?.levelObject && obj.userData.physicsBody) {
        const dist = obj.position.distanceTo(playerPos)
        const shouldEnable = dist < 40 && obj.visible

        const body = obj.userData.physicsBody
        if (shouldEnable && !body.enabled) body.enabled = true
        else if (!shouldEnable && body.enabled) body.enabled = false
      }
    })
  }

  // Función para cargar la cantidad de monedas dinámicamente
  async loadCoinCount(level) {
    try {
      console.log(`🪙 Cargando cantidad de monedas para nivel ${level}`)
      const coinData = await fetchCoinCount(level)
      this.coinsToSpawnPortal = coinData.coinCount || 10 // fallback a 10
      console.log(`🎯 Nivel ${level}: Se necesitan ${this.coinsToSpawnPortal} monedas para el portal`)
    } catch (error) {
      console.warn(`⚠️ No se pudo obtener cantidad de monedas del servidor, usando valor por defecto (10)`)
      this.coinsToSpawnPortal = 10
    }
  }

  async loadLevel(level) {
    try {
      // Cargar cantidad de monedas dinámicamente
      await this.loadCoinCount(level)
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
      const apiUrl = `${backendUrl}/api/blocks?level=${level}`

      let data
      try {
        const res = await fetch(apiUrl)
        if (!res.ok) throw new Error('Error desde API')
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) {
          const preview = (await res.text()).slice(0, 120)
          throw new Error(`Respuesta no-JSON desde API (${apiUrl}): ${preview}`)
        }
        data = await res.json()
        console.log(`📦 Datos del nivel ${level} cargados desde API`)
      } catch (error) {
        console.warn(`⚠️ No se pudo conectar con el backend. Usando datos locales para nivel ${level}...`)
        const publicPath = (p) => {
          const base = import.meta.env.BASE_URL || '/'
          return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`
        }

        // Mapeo de archivos locales por nivel
        const localFiles = {
          1: 'data/toy_car_blocks1.json',
          2: 'data/toy_car_blocks2.json',
          3: 'data/toy_car_blocks3.json'
        }
        const localFile = localFiles[level] || localFiles[1]
        const localUrl = publicPath(localFile)
        const localRes = await fetch(localUrl)
        if (!localRes.ok) {
          const preview = (await localRes.text()).slice(0, 120)
          throw new Error(`No se pudo cargar ${localUrl} (HTTP ${localRes.status}). Vista previa: ${preview}`)
        }
        const localCt = localRes.headers.get('content-type') || ''
        if (!localCt.includes('application/json')) {
          const preview = (await localRes.text()).slice(0, 120)
          throw new Error(`Contenido no JSON en ${localUrl}. Vista previa: ${preview}`)
        }
        const allBlocks = await localRes.json()

        const filteredBlocks = allBlocks.filter(b => b.level === level)

        data = {
          blocks: filteredBlocks,
          spawnPoint: { x: -17, y: 1.5, z: -67 }
        }
      }

      const spawnPoint = data.spawnPoint || { x: 5, y: 1.5, z: 5 }
      this.points = 0
      this.robot.points = 0
      this.finalPrizeActivated = false

      // Si había portal/luces de un nivel previo, limpiarlos
      if (this.portalPrize?.pivot) this.scene.remove(this.portalPrize.pivot)
      this.portalPrize = null
      if (this.portalEffectsGroup) {
        this.portalEffectsGroup.children.forEach(obj => {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) obj.material.dispose()
        })
        this.scene.remove(this.portalEffectsGroup)
        this.portalEffectsGroup = null
        this.portalParticles = []
      }

      this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)

      if (data.blocks) {
        const publicPath = (p) => {
          const base = import.meta.env.BASE_URL || '/'
          return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`
        }
        const preciseUrl = publicPath('config/precisePhysicsModels.json')
        const preciseRes = await fetch(preciseUrl)
        if (!preciseRes.ok) {
          const preview = (await preciseRes.text()).slice(0, 120)
          throw new Error(`No se pudo cargar ${preciseUrl} (HTTP ${preciseRes.status}). Vista previa: ${preview}`)
        }
        const preciseCt = preciseRes.headers.get('content-type') || ''
        if (!preciseCt.includes('application/json')) {
          const preview = (await preciseRes.text()).slice(0, 120)
          throw new Error(`Contenido no JSON en ${preciseUrl}. Vista previa: ${preview}`)
        }
        const preciseModels = await preciseRes.json()
        this.loader._processBlocks(data.blocks, preciseModels)
      } else {
        await this.loader.loadFromURL(apiUrl)
      }

      // Oculta cualquier finalPrize que viniera desde el JSON (si existiera)
      this.loader.prizes.forEach(p => {
        if (p.role === 'finalPrize') {
          if (p.pivot) p.pivot.visible = false
          if (p.model) p.model.visible = false
          p.collected = false
        }
      })

      this.resetRobotPosition(spawnPoint)
      
      // 🎵 Iniciar música ambiente del nivel
      if (window.userInteracted && this.ambientSound) {
        try {
          this.ambientSound.stop() // Detener música anterior si existe
          this.ambientSound.play() // Iniciar música del nuevo nivel
          console.log(`🎵 Música ambiente reiniciada para nivel ${level}: /sounds/ambiente.mp3`)
        } catch (error) {
          console.error(`❌ Error al reiniciar música en nivel ${level}:`, error)
        }
      }
      
      console.log(`✅ Nivel ${level} cargado con spawn en`, spawnPoint)
    } catch (error) {
      console.error('❌ Error cargando nivel:', error)
    }
  }

  clearCurrentScene() {
    if (!this.experience || !this.scene || !this.experience.physics || !this.experience.physics.world) {
      console.warn('⚠️ No se puede limpiar: sistema de físicas no disponible.')
      return
    }

    let visualObjectsRemoved = 0
    let physicsBodiesRemoved = 0

    const childrenToRemove = []

    this.scene.children.forEach((child) => {
      if (child.userData && child.userData.levelObject) {
        childrenToRemove.push(child)
      }
    })

    childrenToRemove.forEach((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }

      this.scene.remove(child)

      if (child.userData.physicsBody) {
        this.experience.physics.world.removeBody(child.userData.physicsBody)
      }

      visualObjectsRemoved++
    })

    let physicsBodiesRemaining = -1

    if (this.experience.physics && this.experience.physics.world && Array.isArray(this.experience.physics.bodies)) {
      const survivingBodies = []
      let bodiesBefore = this.experience.physics.bodies.length

      this.experience.physics.bodies.forEach((body) => {
        if (body.userData && body.userData.levelObject) {
          this.experience.physics.world.removeBody(body)
          physicsBodiesRemoved++
        } else {
          survivingBodies.push(body)
        }
      })

      this.experience.physics.bodies = survivingBodies

      console.log(`🧹 Physics Cleanup Report:`)
      console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`)
      console.log(`🎯 Cuerpos físicos sobrevivientes: ${survivingBodies.length}`)
      console.log(`📦 Estado inicial: ${bodiesBefore} cuerpos → Estado final: ${survivingBodies.length} cuerpos`)
    } else {
      console.warn('⚠️ Physics system no disponible o sin cuerpos activos, omitiendo limpieza física.')
    }

    console.log(`🧹 Escena limpiada antes de cargar el nuevo nivel.`)
    console.log(`✅ Objetos 3D eliminados: ${visualObjectsRemoved}`)
    console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`)
    console.log(`🎯 Objetos 3D actuales en escena: ${this.scene.children.length}`)

    if (physicsBodiesRemaining !== -1) {
      console.log(`🎯 Cuerpos físicos actuales en Physics World: ${physicsBodiesRemaining}`)
    }

    if (this.loader && this.loader.prizes.length > 0) {
      this.loader.prizes.forEach(prize => {
        if (prize.model) {
          this.scene.remove(prize.model)
          if (prize.model.geometry) prize.model.geometry.dispose()
          if (prize.model.material) {
            if (Array.isArray(prize.model.material)) {
              prize.model.material.forEach(mat => mat.dispose())
            } else {
              prize.model.material.dispose()
            }
          }
        }
        if (prize.pivot) this.scene.remove(prize.pivot)
      })
      this.loader.prizes = []
      console.log('🎯 Premios del nivel anterior eliminados correctamente.')
    }

    this.finalPrizeActivated = false
    this.portalPrize = null

    if (this.portalEffectsGroup) {
      this.portalEffectsGroup.children.forEach(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) obj.material.dispose()
      })
      this.scene.remove(this.portalEffectsGroup)
      this.portalEffectsGroup = null
      this.portalParticles = []
    }
  }

  resetRobotPosition(spawn = { x: -17, y: 1.5, z: -67 }) {
    if (!this.robot?.body || !this.robot?.group) return

    this.robot.body.position.set(spawn.x, spawn.y, spawn.z)
    this.robot.body.velocity.set(0, 0, 0)
    this.robot.body.angularVelocity.set(0, 0, 0)
    this.robot.body.quaternion.setFromEuler(0, 0, 0)

    this.robot.group.position.set(spawn.x, spawn.y, spawn.z)
    this.robot.group.rotation.set(0, 0, 0)
  }

  async _processLocalBlocks(blocks) {
    const preciseRes = await fetch('/config/precisePhysicsModels.json')
    const preciseModels = await preciseRes.json()
    this.loader._processBlocks(blocks, preciseModels)

    console.log(`🎯 Monedas default en nivel local: ${this.loader.prizes.filter(p => p.role === 'default').length}`)
  }

  // Método para manejar la muerte del jugador
  handlePlayerDeath() {
    console.log('💀 Jugador ha muerto - Finalizando sesión')
    
    // Finalizar sesión acumulativa
    if (this.experience.tracker) {
      this.experience.tracker.endSession()
    }
    
    // Reiniciar nivel o mostrar game over
    this.resetToLevel1()
  }

  // Método para reiniciar al nivel 1
  resetToLevel1() {
    console.log('🔄 Reiniciando al nivel 1')
    
    // Resetear al nivel 1
    this.levelManager.currentLevel = 1
    this.points = 0
    this.robot.points = 0
    
    // Recargar nivel 1
    this.loadLevel(1)
    
    // Reiniciar posición del robot
    this.resetRobotPosition()
  }

  _checkVRMode() {
    const isVR = this.experience.renderer.instance.xr.isPresenting

    if (isVR) {
      if (this.robot?.group) {
        this.robot.group.visible = false
      }

      if (this.enemy) {
        this.enemy.delayActivation = 10.0
      }

      this.experience.camera.instance.position.set(5, 1.6, 5)
      this.experience.camera.instance.lookAt(new THREE.Vector3(5, 1.6, 4))
    } else {
      if (this.robot?.group) {
        this.robot.group.visible = true
      }
    }
  }
}
