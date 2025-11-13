// Experience/Utils/PhysicsShapes.js
import * as CANNON from 'cannon-es'
import * as THREE from 'three'

/**
 * Crea un Box aproximado del modelo.
 * Usa scaleFactor < 1 para reducir un poco la caja y evitar penetraciones que generan impulsos grandes.
 */
export function createBoxShapeFromModel(model, scaleFactor = 0.9) {
  const bbox = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  bbox.getSize(size)

  // Aplica un pequeño margen de reducción para estabilidad
  const hx = (size.x * scaleFactor) / 2
  const hy = (size.y * scaleFactor) / 2
  const hz = (size.z * scaleFactor) / 2

  // Evita dimensiones cero (que pueden romper el solver)
  const eps = 1e-3
  return new CANNON.Box(
    new CANNON.Vec3(Math.max(hx, eps), Math.max(hy, eps), Math.max(hz, eps))
  )
}

/**
 * Genera un Trimesh a partir del modelo (ideal para obstáculos estáticos).
 * Nota: los Trimesh dinámicos pueden ser inestables en Cannon. Úsalos como STATIC (mass=0).
 */
export function createTrimeshShapeFromModel(model) {
  const mergedPositions = []
  const mergedIndices = []
  let vertexOffset = 0

  model.updateMatrixWorld(true)

  const v = new THREE.Vector3()

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      // Asegura no indexado para hacer índices secuenciales por triángulo
      const geo = child.geometry.clone().toNonIndexed()
      const position = geo.attributes.position
      if (!position) return

      const vertexCount = position.count

      for (let i = 0; i < vertexCount; i++) {
        v.fromBufferAttribute(position, i)
        v.applyMatrix4(child.matrixWorld)
        // Filtra NaN/Inf
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) continue
        mergedPositions.push(v.x, v.y, v.z)
      }

      // Cada 3 vértices forman un triángulo en un geometry no indexado
      for (let i = 0; i < vertexCount; i += 3) {
        mergedIndices.push(vertexOffset + i + 0, vertexOffset + i + 1, vertexOffset + i + 2)
      }

      vertexOffset += vertexCount
    }
  })

  if (mergedPositions.length === 0) {
    console.warn('❌ No se pudo construir un Trimesh: modelo sin vértices')
    return null
  }

  const vertices = new Float32Array(mergedPositions)
  const needs32 = (mergedPositions.length / 3) > 65535
  const indices = needs32 ? new Uint32Array(mergedIndices) : new Uint16Array(mergedIndices)

  return new CANNON.Trimesh(vertices, indices)
}

