const Block = require('../models/Block')

// Función helper para identificar si un bloque es una moneda
const isCoinBlock = (blockName) => {
  if (!blockName || typeof blockName !== 'string') return false
  const name = blockName.toLowerCase()
  return (
    name.startsWith('coin') ||
    name.includes('coinobj') ||
    name.includes('coin_') ||
    name.includes('_coin') ||
    name.includes(' coin')
  )
}

exports.getBlocks = async (req, res) => {
    try {
        const level = parseInt(req.query.level) || 1;

        const blocks = await Block.find({ level: level }).select('name x y z level role -_id'); 

        res.json(blocks);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener bloques', error });
    }
}

// Nuevo endpoint para contar monedas por nivel
exports.getCoinCount = async (req, res) => {
    try {
        const level = parseInt(req.query.level) || 1
        console.log(`🪙 Contando monedas para nivel ${level}`)

        // Obtener todos los bloques del nivel
        const blocks = await Block.find({ level: level }).select('name -_id')
        
        // Contar cuántos son monedas
        const coinCount = blocks.filter(block => isCoinBlock(block.name)).length
        
        console.log(`🪙 Nivel ${level}: ${coinCount} monedas encontradas`)
        
        res.json({ 
            level: level,
            coinCount: coinCount,
            totalBlocks: blocks.length
        })
    } catch (error) {
        console.error('Error contando monedas:', error)
        res.status(500).json({ message: 'Error al contar monedas', error })
    }
};



// Agregar un nuevo bloque
exports.addBlock = async (req, res) => {
    const { name, x, y, z, level, rol } = req.body;
    const newBlock = new Block({ name, x, y, z, level, rol });
    await newBlock.save();

    res.status(201).json({ message: 'Bloque guardado', block: newBlock });
}


// Cargar lote desde JSON (para inicialización desde Blender)
exports.addMultipleBlocks = async (req, res) => {
    const blocks = req.body // array [{ x, y, z }, ...]
    await Block.insertMany(blocks)
    res.status(201).json({ message: 'Bloques guardados', count: blocks.length })
}
