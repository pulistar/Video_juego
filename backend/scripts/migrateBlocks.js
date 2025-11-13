const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const mongoose = require('mongoose')
const Block = require('../models/Block')
const fs = require('fs')

async function migrateBlocks() {
  try {
    console.log('🔄 Conectando a MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Conectado a MongoDB')

    // Limpiar colección existente
    await Block.deleteMany({})
    console.log('🧹 Colección de bloques limpiada')

    // Leer archivos JSON del frontend
    const frontendDataPath = path.resolve(__dirname, '../../game-project/public/data')
    
    const files = [
      { file: 'toy_car_blocks1.json', level: 1 },
      { file: 'toy_car_blocks2.json', level: 2 },
      { file: 'toy_car_blocks3.json', level: 3 }
    ]

    let totalBlocks = 0

    for (const { file, level } of files) {
      const filePath = path.join(frontendDataPath, file)
      
      if (fs.existsSync(filePath)) {
        console.log(`📁 Procesando ${file}...`)
        
        const rawData = fs.readFileSync(filePath, 'utf8')
        const blocks = JSON.parse(rawData)
        
        // Filtrar solo los bloques del nivel correspondiente y asegurar que tengan level
        const levelBlocks = blocks
          .filter(block => block.level === level)
          .map(block => ({
            name: block.name,
            x: block.x,
            y: block.y,
            z: block.z,
            level: block.level,
            role: block.role || 'default'
          }))

        if (levelBlocks.length > 0) {
          await Block.insertMany(levelBlocks)
          console.log(`✅ Insertados ${levelBlocks.length} bloques del nivel ${level}`)
          totalBlocks += levelBlocks.length
        } else {
          console.log(`⚠️ No se encontraron bloques para el nivel ${level} en ${file}`)
        }
      } else {
        console.log(`❌ Archivo no encontrado: ${filePath}`)
      }
    }

    console.log(`🎉 Migración completada: ${totalBlocks} bloques insertados`)

    // Mostrar estadísticas por nivel
    for (let level = 1; level <= 3; level++) {
      const count = await Block.countDocuments({ level })
      const coins = await Block.countDocuments({ 
        level, 
        name: { $regex: /coin/i } 
      })
      console.log(`📊 Nivel ${level}: ${count} bloques total, ${coins} monedas`)
    }

  } catch (error) {
    console.error('❌ Error en migración:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Desconectado de MongoDB')
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  migrateBlocks()
}

module.exports = migrateBlocks
