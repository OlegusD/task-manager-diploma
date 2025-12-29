const { Router } = require('express')
const { query } = require('../db')
const { requireAuth, requireRole } = require('../auth/middleware')

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

router.get('/task-types', async (_req, res) => {
    const { rows } = await query('SELECT id, name FROM task_types ORDER BY id ASC')
    res.json(rows)
})

router.get('/projects', async (_req, res) => {
    const { rows } = await query(
        'SELECT id, name, description, created_at FROM projects ORDER BY created_at ASC'
    )
    res.json(rows)
})

router.post('/projects', requireRole('admin'), async (req, res) => {
    const { name, description } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Missing name' })
    const idRow = await query(
        `
      INSERT INTO projects (id, name, description)
      VALUES (gen_random_uuid(), $1, $2)
      ON CONFLICT (name) DO NOTHING
      RETURNING id;
    `,
        [name, description ?? null]
    )
    if (!idRow.rows.length) return res.status(409).json({ error: 'Project exists' })
    res.status(201).json({ id: idRow.rows[0].id })
})

router.get('/users', async (_req, res) => {
    const { rows } = await query(
        `SELECT u.id, u.name, u.email, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at ASC`
    )
    res.json(rows)
})

module.exports = router
