import * as THREE from 'three'

export default class Fox {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.debug = this.experience.debug
        
        // Configuración de seguimiento
        this.followDistance = 3.0      // Distancia mínima para seguir
        this.followSpeed = 2.0         // Velocidad de seguimiento
        this.runDistance = 6.0         // Distancia para correr
        this.playerRef = null          // Referencia al jugador

        // Debug
        if (this.debug.active) {
            this.debugFolder = this.debug.ui.addFolder('fox')
        }

        // Resource
        this.resource = this.resources.items.foxModel

        this.setModel()
        this.setAnimation()
    }

    setModel() {
        this.model = this.resource.scene
        this.model.scale.set(0.02, 0.02, 0.02)
        this.model.position.set(3, 0, 0)
        this.scene.add(this.model)
        //Activando la sobra de fox
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
            }
        })
    }
    //Manejo GUI
    setAnimation() {
        this.animation = {}

        // Mixer
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        // Actions
        this.animation.actions = {}

        this.animation.actions.idle = this.animation.mixer.clipAction(this.resource.animations[0])
        this.animation.actions.walking = this.animation.mixer.clipAction(this.resource.animations[1])
        this.animation.actions.running = this.animation.mixer.clipAction(this.resource.animations[2])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()

        // Play the action
        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 1)

            this.animation.actions.current = newAction
        }

        // Debug
        if (this.debug.active) {
            const debugObject = {
                playIdle: () => { this.animation.play('idle') },
                playWalking: () => { this.animation.play('walking') },
                playRunning: () => { this.animation.play('running') }
            }
            this.debugFolder.add(debugObject, 'playIdle')
            this.debugFolder.add(debugObject, 'playWalking')
            this.debugFolder.add(debugObject, 'playRunning')
        }
    }

    // Método para establecer la referencia del jugador
    setPlayer(playerRef) {
        this.playerRef = playerRef
        console.log('🦊 Fox configurado para seguir al jugador')
    }

    update() {
        this.animation.mixer.update(this.time.delta * 0.001)
        
        // Lógica de seguimiento
        if (this.playerRef && this.playerRef.body && this.playerRef.body.position) {
            this.followPlayer()
        }
    }

    followPlayer() {
        const playerPos = this.playerRef.body.position
        const foxPos = this.model.position
        
        // Calcular distancia al jugador
        const distance = foxPos.distanceTo(new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z))
        
        // Si está muy cerca, no hacer nada (idle)
        if (distance < this.followDistance) {
            if (this.animation.actions.current !== this.animation.actions.idle) {
                this.animation.play('idle')
            }
            return
        }
        
        // Calcular dirección hacia el jugador
        const direction = new THREE.Vector3(
            playerPos.x - foxPos.x,
            0, // Mantener Y constante
            playerPos.z - foxPos.z
        ).normalize()
        
        // Determinar velocidad según distancia
        const speed = distance > this.runDistance ? this.followSpeed * 1.5 : this.followSpeed
        const animationName = distance > this.runDistance ? 'running' : 'walking'
        
        // Cambiar animación si es necesario
        if (this.animation.actions.current !== this.animation.actions[animationName]) {
            this.animation.play(animationName)
        }
        
        // Mover el fox hacia el jugador
        const deltaTime = this.time.delta * 0.001
        this.model.position.x += direction.x * speed * deltaTime
        this.model.position.z += direction.z * speed * deltaTime
        
        // Hacer que el fox mire hacia donde se mueve
        if (direction.length() > 0) {
            const targetRotation = Math.atan2(direction.x, direction.z)
            this.model.rotation.y = THREE.MathUtils.lerp(this.model.rotation.y, targetRotation, 0.1)
        }
    }
}
