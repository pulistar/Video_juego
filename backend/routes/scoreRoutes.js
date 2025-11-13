const express = require('express')
const scoreController = require('../controllers/scoreController')
const authRequired = require('../middleware/authRequired')

const router = express.Router()

router.get('/', scoreController.getLeaderboard)
router.post('/', authRequired, scoreController.createScore)

module.exports = router
