const express = require('express')
const router = express.Router()
const blockController = require('../controllers/blockController')

// GET /api/blocks?level=1
router.get('/', blockController.getBlocks)

// GET /api/blocks/coin-count?level=1 - Contar monedas por nivel
router.get('/coin-count', blockController.getCoinCount)

// POST /api/blocks - Agregar un solo bloque
router.post('/', blockController.addBlock)

// POST /api/blocks/batch - Agregar múltiples bloques
router.post('/batch', blockController.addMultipleBlocks)

router.get('/ping', (req, res) => {
    res.json({ message: 'pong' });
});

module.exports = router
