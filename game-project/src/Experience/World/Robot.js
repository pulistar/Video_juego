import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

// === Helpers ===
function hasAncestorFlag(obj, key) {
  let n = obj
  while (n) {
    if (n.userData && n.userData[key]) return true
    n = n.parent
  }
  return false
}
function isPrizeLike(obj) {
  let n = obj
  while (n) {
    const r = n.userData && n.userData.role
    if (r === 'default' || r === 'finalPrize') return true
    n = n.parent
  }
  return false
}

export default class Robot {
  constructor(experience) {
    this.experience = experience
    this.scene = this.experience.scene
    this.resources = this.experience.resources
    this.time = this.experience.time
    this.physics = this.experience.physics
    this.keyboard = this.experience.keyboard
    this.debug = this.experience.debug
    this.points = 0

    this.state = { isAttacking: false, isJumping: false }

    // Controller
    this.radius = 0.4
    this.eyeHeight = 1.2
    this.groundProbeLen = 3.0
    this.groundSnapEps = 0.02
    this.blockInset = 0.06
    this.moveSpeed = 6.0
    this.runMultiplier = 1.5
    this.turnSpeed = 2.5
    this.multirayOffset = 0.45
    this.maxRaiseSnap = 0.35

    // Reutilizables
    this._raycaster = new THREE.Raycaster()
    this._rayDown = new THREE.Raycaster()
    this._tmpV = new THREE.Vector3()
    this._tmpV2 = new THREE.Vector3()
    this._lastPos = new THREE.Vector3()
    this._currPos = new THREE.Vector3()
    this._speed = 0

    this._colliders = []
    this._colliderRefreshCounter = 0

    this.setModel()
    this.setPhysics()
    this.setAnimation()

    this._refreshColliders(true)
    this._snapToGround(true)
  }

  setModel() {
    this.model = this.resources.items.robotModel.scene
    this.model.scale.set(0.6, 0.6, 0.6)
    this.model.position.set(0, -0.1, 0)

    this.group = new THREE.Group()
    this.group.add(this.model)
    this.scene.add(this.group)

    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true
    })
  }



  setPhysics() {
    const shape = new CANNON.Sphere(this.radius)

    this.body = new CANNON.Body({
      mass: 0,
      shape,
      position: new CANNON.Vec3(0, this.eyeHeight, 0)
    })

    if (this.physics?.registerKinematicController) {
      this.physics.registerKinematicController(this.body)
    } else {
      this.body.type = CANNON.Body.KINEMATIC
      this.body.mass = 0
      this.body.collisionResponse = false
      this.body.allowSleep = false
      this.body.linearDamping = 0.99
      this.body.angularDamping = 1.0
    }

    this.body.material = this.physics.robotMaterial
    this.body.angularFactor.set(0, 1, 0)
    this.body.velocity.setZero()
    this.body.angularVelocity.setZero()
    this.physics.world.addBody(this.body)

    this.group.position.set(0, this.eyeHeight, 0)
    this._lastPos.copy(this.group.position)
  }

  setAnimation() {
    this.animation = {}
    this.animation.mixer = new THREE.AnimationMixer(this.model)
    const clips = this.resources.items.robotModel.animations || []
    console.log('🎬 Animaciones disponibles en el modelo:', clips.map(c => c.name))

    const findClip = (names = [], fallbackIndex = null) => {
      let clip = clips.find(c => names.includes(c?.name))
      if (!clip && Number.isInteger(fallbackIndex) && clips[fallbackIndex]) {
        clip = clips[fallbackIndex]
        console.warn(`[Robot] Clip no encontrado por nombre (${names.join(', ')}). Usando índice ${fallbackIndex}: ${clip?.name}`)
      }
      if (!clip) console.warn(`[Robot] Clip ausente: ${names.join(', ')}`)
      return clip
    }

    // Mapeo para tu personaje personalizado
    const idleClip   = findClip(['inicio'], 0)        
    const walkClip   = findClip(['correr'], 1)       
    const runClip    = findClip(['correr'], 2)          
    const attackClip = null                              
    const jumpClip   = findClip(['saltar'], 3)           
    const deathClip  = findClip(['muerto'], 4)           

    const mkAction = (clip) => {
      if (!clip) return null
      const act = this.animation.mixer.clipAction(clip)
      act.enabled = true
      act.setEffectiveWeight(1)
      act.setEffectiveTimeScale(1)
      return act
    }

    this.animation.actions = {
      idle:   mkAction(idleClip),
      walk:   mkAction(walkClip),
      run:    mkAction(runClip),
      attack: mkAction(attackClip),
      jump:   mkAction(jumpClip),
      death:  mkAction(deathClip)
    }

    if (this.animation.actions.attack) {
      this.animation.actions.attack.timeScale = 0.5
      this.animation.actions.attack.setLoop(THREE.LoopOnce)
      this.animation.actions.attack.clampWhenFinished = true
    }

    // Configurar animación de muerte
    if (this.animation.actions.death) {
      this.animation.actions.death.setLoop(THREE.LoopOnce)
      this.animation.actions.death.clampWhenFinished = true
    }

    // Configurar animación de salto
    if (this.animation.actions.jump) {
      this.animation.actions.jump.setLoop(THREE.LoopOnce)
      this.animation.actions.jump.clampWhenFinished = false
      this.animation.actions.jump.timeScale = 0.8 // Hacer más lenta para que se vea mejor
    }

    const startAction =
      this.animation.actions.idle ||
      this.animation.actions.walk ||
      this.animation.actions.run  ||
      this.animation.actions.attack

    if (startAction) {
      startAction.reset().fadeIn(0.2).play()
      this.animation.actions.current = startAction
    } else {
      console.error('[Robot] No hay ningún clip válido. Revisa que el modelo tenga animaciones.')
    }

    this.animation.mixer.addEventListener('finished', (e) => {
      const finishedName = e?.action?.getClip?.()?.name
      const attackName = this.animation.actions.attack?.getClip?.()?.name
      if (finishedName && attackName && finishedName === attackName) {
        this.state.isAttacking = false
        if (this.animation.actions.idle) this.animation.play('idle', { force: true })
      }
    })

    this.animation.play = (name, { force = false } = {}) => {
      const newAction = this.animation.actions[name]
      const oldAction = this.animation.actions.current
      if (!newAction) return
      if (!force && this.state.isAttacking && newAction !== this.animation.actions.attack) return
      if (newAction === oldAction) return

      oldAction?.fadeOut(0.2)
      newAction.reset().setEffectiveWeight(1).fadeIn(0.2).play()
      this.animation.actions.current = newAction

      // Sonidos eliminados temporalmente
    }
  }

  _refreshColliders(aggressive = false) {
    this._colliders.length = 0

    this.scene.traverse((obj) => {
      if (!obj.visible || !obj.isMesh) return
      if (this.group === obj || this.group.children.includes(obj)) return
      if (isPrizeLike(obj)) return

      const isGround = hasAncestorFlag(obj, 'isGround')
      const isLevel  = hasAncestorFlag(obj, 'levelObject')
      if (isGround || isLevel || aggressive) {
        this._colliders.push(obj)
      }
    })

    if (aggressive && this._colliders.length === 0) {
      this.scene.traverse((o) => {
        if (!o.visible || !o.isMesh) return
        if (this.group === o || this.group.children.includes(o)) return
        if (isPrizeLike(o)) return
        this._colliders.push(o)
      })
    }
  }

  _worldNormalOf(hit) {
    const n = hit.face?.normal?.clone?.() || new THREE.Vector3(0, 1, 0)
    const m3 = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
    return n.applyMatrix3(m3).normalize()
  }
  _isGroundNormal(n) { return n.y > 0.6 }
  _isWallNormal(n)   { return Math.abs(n.y) < 0.6 }

  _snapToGround(force = false) {
    const from = this.group.position.clone()
    from.y += 0.25
    this._rayDown.set(from, new THREE.Vector3(0, -1, 0))
    this._rayDown.far = this.groundProbeLen

    const hits = this._rayDown.intersectObjects(this._colliders, true)
    if (!hits.length) return

    let hit = null
    for (const h of hits) {
      const n = this._worldNormalOf(h)
      if (this._isGroundNormal(n)) { hit = h; break }
    }
    if (!hit) return

    const floorY = hit.point.y
    const desiredY = floorY + this.radius + this.groundSnapEps
    const curY = this.group.position.y

    if (!force && (desiredY - curY) > this.maxRaiseSnap) return

    if (force || Math.abs(curY - desiredY) > 1e-3) {
      this.group.position.y = desiredY
      this.body.position.set(this.group.position.x, desiredY, this.group.position.z)
    }
  }

  _sweepAxis(from, to, axis /* 'x' | 'z' */) {
    const dir = to.clone().sub(from)
    const dist = dir.length()
    if (dist <= 0) return from.clone()
    dir.normalize()

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion).normalize()
    const right   = new THREE.Vector3(1, 0, 0).applyQuaternion(this.group.quaternion).normalize()
    const lateral = (axis === 'x') ? forward : right

    const origins = [
      from.clone(),
      from.clone().addScaledVector(lateral,  this.multirayOffset),
      from.clone().addScaledVector(lateral, -this.multirayOffset),
    ]

    let minAllowed = dist
    for (const o of origins) {
      this._raycaster.set(o, dir)
      this._raycaster.far = dist + this.blockInset + this.radius
      const hits = this._raycaster.intersectObjects(this._colliders, true)
      if (!hits.length) continue

      for (const h of hits) {
        if (h.distance <= 1e-4) continue
        const n = this._worldNormalOf(h)
        if (!this._isWallNormal(n)) continue
        const allowed = Math.max(h.distance - this.blockInset - this.radius, 0)
        minAllowed = Math.min(minAllowed, allowed)
        break
      }
    }

    const epsilon = 1e-3
    const step = Math.max(minAllowed, epsilon)
    const result = from.clone().addScaledVector(dir, step)
    result.y = to.y
    return result
  }

  _moveWithBlockXZ(desiredPos) {
    const curr = this.group.position.clone()
    // X
    let stepX = curr.clone(); stepX.x = desiredPos.x
    stepX = this._sweepAxis(curr, stepX, 'x')
    // Z
    let stepZ = stepX.clone(); stepZ.z = desiredPos.z
    stepZ = this._sweepAxis(stepX, stepZ, 'z')

    // Aplica y asienta
    this.group.position.copy(stepZ)
    this._snapToGround(false)

    // body kinemático
    this.body.position.set(this.group.position.x, this.group.position.y, this.group.position.z)
    this.body.velocity.set(0, 0, 0)
  }

  // ==== API para World (pickup) ====
  getPickupPosition() {
    return new THREE.Vector3(this.group.position.x, this.group.position.y, this.group.position.z)
  }
  getSpeed() {
    return this._speed
  }

  update() {
    if (this.animation.actions.current === this.animation.actions.death) return

    const delta = this.time.delta * 0.001
    this.animation.mixer.update(delta)

    this._colliderRefreshCounter = (this._colliderRefreshCounter + 1) % 120
    if (this._colliderRefreshCounter === 0 || this._colliders.length === 0) {
      this._refreshColliders(false)
      if (this._colliders.length === 0) this._refreshColliders(true)
    }

    const keys = this.keyboard.getState()
    if (this.state.isAttacking) {
      this.group.position.copy(this.body.position)
      return
    }

    const runMul = keys.shift ? this.runMultiplier : 1.0
    const speed = this.moveSpeed * runMul

    const forward = this._tmpV.set(0, 0, 1).applyQuaternion(this.group.quaternion).normalize()
    const right   = this._tmpV2.set(1, 0, 0).applyQuaternion(this.group.quaternion).normalize()
    let move = new THREE.Vector3()

    if (keys.up)    move.add(forward)
    if (keys.down)  move.add(forward.clone().multiplyScalar(-1))
    if (keys.left)  this.group.rotation.y += this.turnSpeed * delta
    if (keys.right) this.group.rotation.y -= this.turnSpeed * delta

    if (keys.space && this.animation.actions.jump && !this.state.isJumping) {
      this.state.isJumping = true
      this.animation.play('jump')
      console.log('⬆️ Saltando!')
      
      // Resetear el estado de salto después de la animación
      setTimeout(() => {
        this.state.isJumping = false
      }, 1000) // 1 segundo
    }

    const desiredPos = this.group.position.clone()
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta)
      desiredPos.add(move)
      desiredPos.y = this.group.position.y
      this._moveWithBlockXZ(desiredPos)
    } else {
      this._snapToGround(false)
      this.body.position.set(this.group.position.x, this.group.position.y, this.group.position.z)
    }

    const isMoving = move.lengthSq() > 0
    if (isMoving) {
      if (keys.shift && this.animation.actions.run) this.animation.play('run')
      else if (this.animation.actions.walk) this.animation.play('walk')
    } else if (this.animation.actions.idle) {
      this.animation.play('idle')
    }

    if (keys.attack && this.animation.actions.attack) {
      this.state.isAttacking = true
      this.animation.play('attack', { force: true })
      return
    }

    this._currPos.copy(this.group.position)
    this._speed = this._currPos.distanceTo(this._lastPos) / Math.max(delta, 1e-4)
    this._lastPos.copy(this._currPos)
  }

  moveInDirection(dir, speed) {
    if (!window.userInteracted || !this.experience.renderer.instance.xr.isPresenting) return
    const mobile = window.experience?.mobileControls
    if (mobile?.intensity > 0 && !this.state.isAttacking) {
      const dir2D = mobile.directionVector
      const dir3D = new THREE.Vector3(dir2D.x, 0, dir2D.y).normalize()
      const v = dir3D.clone().multiplyScalar((speed || 2.5) * mobile.intensity)
      const desiredPos = this.group.position.clone().add(v)
      this._moveWithBlockXZ(desiredPos)

      const angle = Math.atan2(dir3D.x, dir3D.z)
      this.group.rotation.y = angle
      this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)

      if (this.animation.actions.walk && this.animation.actions.current !== this.animation.actions.walk) {
        this.animation.play('walk')
      }
    }
  }

  die() {
    if (this.animation.actions.current !== this.animation.actions.death) {
      this.animation.actions.current?.fadeOut(0.2)
      this.animation.actions.death?.reset().fadeIn(0.2).play()
      this.animation.actions.current = this.animation.actions.death

      // Sonido eliminado temporalmente

      if (this.physics.world.bodies.includes(this.body)) {
        this.physics.world.removeBody(this.body)
      }
      this.body = null
      this.group.position.y -= 0.5
      this.group.rotation.x = -Math.PI / 2
      console.log('Robot ha muerto')
    }
  }
}
