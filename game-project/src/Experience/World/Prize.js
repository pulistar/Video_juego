import * as THREE from 'three'

export default class Prize {
  constructor({ model, position, scene, role = 'default', sound = null, showHelper = false }) {
    this.scene = scene
    this.collected = false
    this.role = role
    this.sound = sound

    this.pivot = new THREE.Group()
    this.pivot.position.copy(position)
    this.pivot.userData.interactivo = true
    this.pivot.userData.collected = false
    this.pivot.userData.role = role // <- importante para que Robot lo ignore como colisionable

    this.model = model.clone ? model.clone() : model
    const visual = (this.model.children && this.model.children.find(child => child.isMesh)) || this.model
    visual.userData.interactivo = true
    visual.userData.role = role

    // Centrar visual en su bbox
    const bbox = new THREE.Box3().setFromObject(visual)
    const center = new THREE.Vector3()
    bbox.getCenter(center)
    visual.position.sub(center)

    this.pivot.add(visual)

    if (showHelper) {
      const helper = new THREE.AxesHelper(0.5)
      this.pivot.add(helper)
    }

    this.scene.add(this.pivot)
    // Si es finalPrize y lo creamos manualmente, lo ponemos visible
    this.pivot.visible = (role !== 'finalPrize') ? true : this.pivot.visible
    if (role === 'finalPrize' && this.model) this.model.visible = this.pivot.visible ?? true

    console.log(`🎯 Premio en: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) [role: ${this.role}]`)
  }

  update(delta) {
    if (this.collected) return
    
    // Solo rotar monedas, no el portal
    if (this.role !== 'finalPrize') {
      this.pivot.rotation.y += delta * 1.5
    }
  }

  collect() {
    if (this.collected) return
    this.collected = true
    if (this.sound && typeof this.sound.play === 'function') {
      this.sound.play()
    }
    this.pivot.traverse(child => { child.userData.collected = true })
    this.scene.remove(this.pivot)
  }
}
