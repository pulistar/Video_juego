// Experience/Utils/Physics.js
import * as CANNON from 'cannon-es'

export default class Physics {
  constructor() {
    // Mundo
    this.world = new CANNON.World()
    this.world.gravity.set(0, -9.82, 0)

    // Broadphase + Solver más estable
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = true

    const solver = new CANNON.GSSolver()
    solver.iterations = 15
    solver.tolerance = 1e-3
    this.world.solver = solver

    // Defaults “suaves”
    this.world.defaultContactMaterial.friction = 0.5
    this.world.defaultContactMaterial.restitution = 0.0
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7
    this.world.defaultContactMaterial.contactEquationRelaxation = 8
    this.world.defaultContactMaterial.frictionEquationStiffness = 1e6
    this.world.defaultContactMaterial.frictionEquationRelaxation = 8

    // Materiales
    this.defaultMaterial   = new CANNON.Material('default')
    this.robotMaterial     = new CANNON.Material('robot')
    this.obstacleMaterial  = new CANNON.Material('obstacle')
    this.wallMaterial      = new CANNON.Material('wall')

    // Contacto default
    const defaultContact = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.5,
        restitution: 0.0,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 8,
        frictionEquationStiffness: 1e6,
        frictionEquationRelaxation: 8
      }
    )
    this.world.addContactMaterial(defaultContact)
    this.world.defaultContactMaterial = defaultContact

    // Robot ↔ Obstáculo
    const robotObstacle = new CANNON.ContactMaterial(
      this.robotMaterial,
      this.obstacleMaterial,
      {
        friction: 0.7,
        restitution: 0.0,
        contactEquationStiffness: 8e6,
        contactEquationRelaxation: 12,
        frictionEquationStiffness: 8e5,
        frictionEquationRelaxation: 12
      }
    )
    this.world.addContactMaterial(robotObstacle)

    // Robot ↔ Pared
    const robotWall = new CANNON.ContactMaterial(
      this.robotMaterial,
      this.wallMaterial,
      {
        friction: 0.7,
        restitution: 0.0,
        contactEquationStiffness: 8e6,
        contactEquationRelaxation: 10,
        frictionEquationStiffness: 8e5,
        frictionEquationRelaxation: 10
      }
    )
    this.world.addContactMaterial(robotWall)
  }

  /**
   * Robot DINÁMICO “domado” (por si lo necesitas en otro modo)
   */
  registerRobotBody(body) {
    body.material = this.robotMaterial
    body.allowSleep = true
    body.sleepSpeedLimit = 0.2
    body.sleepTimeLimit = 0.6
    body.linearDamping = 0.4
    body.angularDamping = 0.6
    body.fixedRotation = false
    return body
  }

  /**
   * Robot CINEMÁTICO sin respuesta de colisión (para controller)
   * 👉 NO recibe ni aplica impulsos. Lo mueves tú a mano.
   */
  registerKinematicController(body) {
    body.material = this.robotMaterial
    body.type = CANNON.Body.KINEMATIC
    body.mass = 0
    body.collisionResponse = false
    body.allowSleep = false
    body.linearDamping = 0.99
    body.angularDamping = 1.0
    return body
  }

  /**
   * Obstáculo/Pared estático
   */
  registerStaticObstacle(body) {
    body.material = this.obstacleMaterial
    body.type = CANNON.Body.STATIC
    body.mass = 0
    body.updateMassProperties()
    body.allowSleep = true
    body.sleepSpeedLimit = 0.05
    body.sleepTimeLimit = 0.2
    return body
  }

  registerWall(body) {
    body.material = this.wallMaterial
    body.type = CANNON.Body.STATIC
    body.mass = 0
    body.updateMassProperties()
    body.allowSleep = true
    body.sleepSpeedLimit = 0.05
    body.sleepTimeLimit = 0.2
    return body
  }

  update(delta) {
    // Limpia shapes/cuerpos corruptos (defensivo)
    this.world.bodies = this.world.bodies.filter((body) => {
      if (!body || !Array.isArray(body.shapes) || body.shapes.length === 0) return false
      for (const shape of body.shapes) {
        if (!shape || !shape.body || shape.body !== body) return false
      }
      return true
    })

    try {
      this.world.step(1 / 60, delta, 5)
    } catch (err) {
      if (err?.message?.includes('wakeUpAfterNarrowphase')) {
        console.warn('⚠️ Cannon encontró un shape corrupto residual. Ignorado.')
      } else {
        console.error('🚫 Cannon step error:', err)
      }
    }
  }
}
