export default class LevelManager {
  constructor(experience) {
    this.experience = experience
    this.currentLevel = 1
    this.totalLevels = 3

    // objetivo de monedas por nivel
    this.pointsToComplete = {
      1: 10,
      2: 10,
      3: 10
    }

    // cantidad de enemigos por nivel
    this.enemiesPerLevel = {
      1: 3,
      2: 5,
      3: 10
    }
  }

  nextLevel() {
    if (this.currentLevel < this.totalLevels) {
      this.currentLevel++

      this.experience.world.clearCurrentScene()
      this.experience.world.loadLevel(this.currentLevel)

      // Recolocar al robot tras cargar (ajusta si tu nivel 2 cambia)
      setTimeout(() => {
        this.experience.world.resetRobotPosition({ x: 0, y: 0, z: 0 })
        
        // Spawn enemigos del nuevo nivel
        const enemiesCount = this.getCurrentLevelEnemyCount()
        this.experience.world.spawnEnemies(enemiesCount)
      }, 1000)
    }
  }

  resetLevel() {
    this.currentLevel = 1
    this.experience.world.loadLevel(this.currentLevel)
  }

  getCurrentLevelTargetPoints() {
    return this.pointsToComplete?.[this.currentLevel] ?? 10
  }

  getCurrentLevelEnemyCount() {
    return this.enemiesPerLevel?.[this.currentLevel] ?? 3
  }
}
