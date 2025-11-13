import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef

        // Velocidad y estado
        this.baseSpeed = 1.0
        this.speed = this.baseSpeed
        this.delayActivation = 0
        this.state = { isAttacking: false }

        // 🔊 Sonidos (seguros para autoplay)
        this.proximitySound = null
        this.attackSound = null
        this._initSounds()

        // 🦴 Clonado seguro del modelo (GLTF con esqueleto)
        try {
            this.model = SkeletonUtils.clone(model)
        } catch (e) {
            console.warn('[Enemy] No se pudo clonar con SkeletonUtils, usando cubo fallback.', e)
            this.model = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            )
        }

        if (position) this.model.position.copy(position)
        this.model.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true
                obj.frustumCulled = false
            }
        })
        this.scene.add(this.model)

        // ⚙️ Física
        const enemyMaterial = new CANNON.Material('enemyMaterial')
        enemyMaterial.friction = 0.0

        const shape = new CANNON.Sphere(0.5)
        this.body = new CANNON.Body({
            mass: 5,
            shape,
            material: enemyMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01
        })

        // Alinear altura con el jugador si existe
        if (this.playerRef?.body) {
            this.body.position.y = this.playerRef.body.position.y
            this.model.position.y = this.body.position.y
        }

        this.body.sleepSpeedLimit = 0.0
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)

        this.model.userData.physicsBody = this.body

        // 🎬 Animaciones
        this._initAnimations()

        // 💥 Colisión con el jugador
        this._onCollide = (event) => {
            if (!event || !event.body) return
            if (event.body === this.playerRef.body) {
                if (typeof this.playerRef.die === 'function') this.playerRef.die()
                this.proximitySound?.stop?.()
                new FinalPrizeParticles({
                    scene: this.scene,
                    targetPosition: this.body.position,
                    sourcePosition: this.body.position,
                    experience: this.experience
                })
                this.destroy()
            }
        }
        this.body.addEventListener('collide', this._onCollide)
    }

    _initSounds() {
        try {
            // Loop de proximidad (empieza en silencio)
            this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 })
            // One-shot de ataque (ruta que pediste)
            this.attackSound = new Sound('/sounds/ataque.mp3', { volume: 1 })

            // Respetar autoplay del navegador: sólo inicia si hubo interacción del usuario
            if (window.userInteracted) {
                this.proximitySound?.play?.()
            }
        } catch (e) {
            console.warn('[Enemy] No se pudieron inicializar los sonidos:', e)
        }
    }

    _initAnimations() {
        this.mixer = new THREE.AnimationMixer(this.model)

        // Clips desde el recurso y/o clon
        const resourceClips = this.experience?.resources?.items?.EnemieModel?.animations || []
        const clonedClips = this.model.animations || []
        const clips = [...clonedClips, ...resourceClips]

        // console.log('👾 Animaciones disponibles en enemigo:', clips.map(c => c.name))
        
        const findByExact = (name) => clips.find(c => c?.name === name)
        const findByHint = (hints) => clips.find(c => hints.some(h => c?.name?.toLowerCase().includes(h)))

        // Mapeo por nombres exactos de tu GLB
        let idleClip   = findByExact('inactivo')
        let walkClip   = findByExact('caminar')
        let runClip    = null                       // No usar "Accion"
        let attackClip = findByExact('atacar')

        // Fallback a nombres originales si no encuentra los nuevos
        if (!idleClip)   idleClip   = findByExact('[Action Stash]')
        if (!walkClip)   walkClip   = findByExact('[Action Stash].001')
        if (!runClip)    runClip    = findByExact('[Action Stash].002')
        if (!attackClip) attackClip = findByExact('[Action Stash].003')

        const action = (clip) => clip ? this.mixer.clipAction(clip) : null

        this.actions = {
            idle:   action(idleClip),
            walk:   action(walkClip),
            run:    action(runClip),
            attack: action(attackClip)
        }

        // Configurar loops para animaciones suaves y continuas
        if (this.actions.walk) {
            this.actions.walk.setLoop(THREE.LoopRepeat)
            this.actions.walk.repetitions = Infinity
            this.actions.walk.clampWhenFinished = false  // No parar al final
            this.actions.walk.enabled = true
        }
        
        if (this.actions.idle) {
            this.actions.idle.setLoop(THREE.LoopRepeat)
            this.actions.idle.repetitions = Infinity
            this.actions.idle.clampWhenFinished = false  // No parar al final
            this.actions.idle.enabled = true
        }
        
        if (this.actions.attack) {
            this.actions.attack.setLoop(THREE.LoopOnce)
            this.actions.attack.clampWhenFinished = true
            this.actions.attack.timeScale = 0.6 // más lenta para apreciar el golpe
        }

        this.mixer.addEventListener('finished', (e) => {
            if (e?.action === this.actions.attack) {
                this.state.isAttacking = false
                this._play('idle', { force: true })
            }
        })

        // Acción inicial
        const start = this.actions.idle || this.actions.walk || this.actions.run || this.actions.attack
        if (start) {
            start.reset().play()
            this.currentAction = start
        } else {
            console.warn('[Enemy] No se encontraron clips de animación.')
            this.currentAction = null
        }
    }

    _play(name, { force = false } = {}) {
        if (!this.actions || !this.mixer) return
        const next = this.actions[name]
        if (!next) return
        if (!force && this.state.isAttacking && next !== this.actions.attack) return
        if (this.currentAction === next) return

        if (this.currentAction) {
            this.currentAction.crossFadeTo(next, 0.3, false) // Transición más suave
        }
        
        // Para animaciones cíclicas, nunca hacer reset
        if (next === this.actions.walk || next === this.actions.idle) {
            // Si es la misma animación, no hacer nada (continúa automáticamente)
            if (this.currentAction === next) return
            
            // Si cambia de animación, no hacer reset para mantener fluidez
            next.play()
        } else {
            // Para animaciones no cíclicas (attack), hacer reset normal
            next.reset().play()
        }
        
        this.currentAction = next

        if (next === this.actions.attack && window.userInteracted) {
            this.attackSound?.play?.()
        }
    }

    update(delta) {
        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }
        if (!this.body || !this.playerRef?.body) return
        
        // Si el jugador está muerto, solo actualizar animaciones
        if (this.state.playerDead) {
            this.mixer && this.mixer.update(delta)
            return
        }

        this.mixer && this.mixer.update(delta)

        const targetPos = new CANNON.Vec3(
            this.playerRef.body.position.x,
            this.playerRef.body.position.y,
            this.playerRef.body.position.z
        )
        const enemyPos = this.body.position

        const distance = enemyPos.distanceTo(targetPos)
        this.speed = distance < 4 ? 2.5 : this.baseSpeed

        // Volumen por distancia
        const maxDistance = 10
        const proximityVolume = 1 - Math.min(distance, maxDistance) / maxDistance
        if (this.proximitySound?.setVolume) {
            this.proximitySound.setVolume(proximityVolume * 0.8)
            if (window.userInteracted) this.proximitySound?.play?.() // por si aún no había arrancado
        }

        // Movimiento hacia el jugador
        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            targetPos.y - enemyPos.y,
            targetPos.z - enemyPos.z
        )

        const reachDist = 1.25
        if (distance > reachDist) {
            direction.normalize()
            direction.scale(this.speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.y = direction.y
            this.body.velocity.z = direction.z

            if (!this.state.isAttacking && this.actions) {
                const isRunning = (this.speed > this.baseSpeed + 0.1)
                if (isRunning && this.actions.run) this._play('run')
                else if (this.actions.walk) this._play('walk')
                else if (this.actions.idle) this._play('idle')
            }
        } else {
            // En rango de ataque
            this.body.velocity.x *= 0.2
            this.body.velocity.z *= 0.2
            if (this.actions?.attack && !this.state.isAttacking) {
                this.state.isAttacking = true
                this._play('attack', { force: true })
            }
        }

        // Sincronización visual y orientación
        if (this.model) {
            this.model.position.copy(this.body.position)
            const lookAt = new THREE.Vector3(targetPos.x, this.model.position.y, targetPos.z)
            this.model.lookAt(lookAt)
        }
    }

    // Método para detener el enemigo cuando el jugador muere
    stopAndIdle() {
        this.state.isAttacking = false
        this.state.playerDead = true
        
        // Detener movimiento
        if (this.body) {
            this.body.velocity.set(0, 0, 0)
            this.body.angularVelocity.set(0, 0, 0)
        }
        
        // Cambiar a animación inactivo
        if (this.actions && this.actions.idle) {
            this._play('idle', { force: true })
        }
        
        console.log('😴 Enemigo detenido - jugador muerto')
    }

    destroy() {
        if (this.mixer) {
            this.mixer.stopAllAction()
            this.mixer.uncacheRoot(this.model)
            this.mixer = null
        }
        if (this.model) {
            this.scene.remove(this.model)
            this.model = null
        }
        if (this.proximitySound) {
            this.proximitySound.stop?.()
            this.proximitySound = null
        }
        if (this.attackSound) {
            this.attackSound.stop?.()
            this.attackSound = null
        }
        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)
            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }
            this.body = null
        }
    }
}
