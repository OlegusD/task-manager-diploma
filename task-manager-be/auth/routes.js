const { Router } = require('express')
const { query } = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { requireAuth, requireRole } = require('./middleware')

const router = Router()

router.post('/register', async (req, res) => {
    const { email, password, name } = req.body || {}
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' })

    const { rows: exists } = await query('SELECT id FROM users WHERE email=$1', [email])
    if (exists.length) return res.status(409).json({ error: 'Email exists' })

    const { rows: role } = await query(`SELECT id FROM roles WHERE name='user' LIMIT 1;`)
    const roleId = role[0]?.id
    const hash = bcrypt.hashSync(password, 10)
    const id = uuidv4()

    await query(
        'INSERT INTO users (id, email, password_hash, name, role_id) VALUES ($1,$2,$3,$4,$5)',
        [id, email, hash, name, roleId]
    )

    const token = jwt.sign(
        { userId: id, role: 'user', email },
        process.env.JWT_SECRET || 'change_me',
        { expiresIn: '30m' }
    )
    res.json({ token })
})

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {}
    const { rows } = await query(
        `SELECT u.id, u.password_hash, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE email=$1 LIMIT 1`,
        [email]
    )
    if (!rows.length) return res.status(401).json({ error: 'Bad credentials' })
    const user = rows[0]
    if (!bcrypt.compareSync(password, user.password_hash))
        return res.status(401).json({ error: 'Bad credentials' })

    const token = jwt.sign(
        { userId: user.id, role: user.role, email },
        process.env.JWT_SECRET || 'change_me',
        { expiresIn: '30m' }
    )
    res.json({ token })
})

router.get('/me', requireAuth, async (req, res) => {
    const { rows } = await query(
        `SELECT u.id, u.email, u.name, r.name AS role, u.created_at
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id=$1`,
        [req.user.id]
    )
    res.json(rows[0] || null)
})

router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
    const { email, password, name, role = 'user' } = req.body || {}
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' })

    const { rows: exists } = await query('SELECT id FROM users WHERE email=$1', [email])
    if (exists.length) return res.status(409).json({ error: 'Email exists' })

    const { rows: roleRow } = await query(`SELECT id FROM roles WHERE name=$1 LIMIT 1;`, [role])
    const roleId = roleRow[0]?.id
    if (!roleId) return res.status(400).json({ error: 'Unknown role' })

    const hash = bcrypt.hashSync(password, 10)
    const id = uuidv4()
    await query(
        'INSERT INTO users (id, email, password_hash, name, role_id) VALUES ($1,$2,$3,$4,$5)',
        [id, email, hash, name, roleId]
    )
    res.status(201).json({ id })
})

module.exports = router
