const { Router } = require('express')
const { query } = require('../db')
const { requireAuth } = require('../auth/middleware')

const router = Router()
router.use(requireAuth)

router.get('/statuses', async (_req, res) => {
    const { rows } = await query('SELECT id, name, position FROM statuses ORDER BY position ASC')
    res.json(rows)
})

router.get('/priorities', async (_req, res) => {
    const { rows } = await query('SELECT id, name, weight FROM priorities ORDER BY weight ASC')
    res.json(rows)
})

module.exports = router
