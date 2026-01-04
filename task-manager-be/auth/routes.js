const { Router } = require('express')
const { query } = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { requireAuth, requireRole } = require('./middleware')

const router = Router()

router.post('/register', async (req, res) => {
    const { email, password, name, role = 'гость' } = req.body || {}
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' })

    const { rows: exists } = await query('SELECT id FROM users WHERE email=$1', [email])
    if (exists.length) return res.status(409).json({ error: 'Email exists' })

    let roleId
    const { rows: roleRow } = await query(`SELECT id FROM roles WHERE name=$1 LIMIT 1;`, [role])
    if (roleRow.length) {
        roleId = roleRow[0].id
    } else {
        await query('INSERT INTO roles (name, is_admin) VALUES ($1,false) ON CONFLICT (name) DO NOTHING', [
            role,
        ])
        const { rows: roleRow2 } = await query(`SELECT id FROM roles WHERE name=$1 LIMIT 1;`, [role])
        roleId = roleRow2[0]?.id
    }
    if (!roleId) return res.status(400).json({ error: 'Role not available' })

    const hash = bcrypt.hashSync(password, 10)
    const id = uuidv4()

    await query(
        'INSERT INTO users (id, email, password_hash, name, role_id) VALUES ($1,$2,$3,$4,$5)',
        [id, email, hash, name, roleId]
    )

    const token = jwt.sign(
        { userId: id, role, email },
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

router.patch('/me', requireAuth, async (req, res) => {
    const { name, email, password } = req.body || {}
    const sets = []
    const params = []
    if (name) {
        params.push(name)
        sets.push(`name=$${params.length}`)
    }
    if (email) {
        const { rows: exists } = await query('SELECT id FROM users WHERE email=$1 AND id<>$2', [
            email,
            req.user.id,
        ])
        if (exists.length) return res.status(409).json({ error: 'Email exists' })
        params.push(email)
        sets.push(`email=$${params.length}`)
    }
    if (password) {
        params.push(bcrypt.hashSync(password, 10))
        sets.push(`password_hash=$${params.length}`)
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' })
    params.push(req.user.id)
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id=$${params.length}`, params)
    res.json({ ok: true })
})

router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
    const { email, password, name, role = 'разработчик' } = req.body || {}
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

router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { id } = req.params
    try {
        await query('BEGIN')
        await query('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = $1', [id])
        await query('DELETE FROM project_members WHERE user_id=$1', [id])
        await query('DELETE FROM users WHERE id=$1 AND email <> $2', [id, 'admin@local'])
        await query('COMMIT')
        res.json({ ok: true })
    } catch (e) {
        await query('ROLLBACK')
        res.status(500).json({ error: 'Failed to delete user' })
    }
})

router.patch('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { id } = req.params
    const { role, name, email, password } = req.body || {}
    const sets = []
    const params = []
    if (name) {
        params.push(name)
        sets.push(`name=$${params.length}`)
    }
    if (email) {
        const { rows: exists } = await query('SELECT id FROM users WHERE email=$1 AND id<>$2', [
            email,
            id,
        ])
        if (exists.length) return res.status(409).json({ error: 'Email exists' })
        params.push(email)
        sets.push(`email=$${params.length}`)
    }
    if (password) {
        params.push(bcrypt.hashSync(password, 10))
        sets.push(`password_hash=$${params.length}`)
    }
    if (role) {
        const { rows: roleRow } = await query('SELECT id FROM roles WHERE name=$1 LIMIT 1', [role])
        if (!roleRow.length) return res.status(400).json({ error: 'Unknown role' })
        params.push(roleRow[0].id)
        sets.push(`role_id=$${params.length}`)
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields' })
    params.push(id, 'admin@local')
    await query(
        `UPDATE users SET ${sets.join(', ')} WHERE id=$${params.length - 1} AND email<>$${params.length}`,
        params
    )
    res.json({ ok: true })
})

router.get('/roles', requireAuth, requireRole('admin'), async (_req, res) => {
    const { rows } = await query('SELECT id, name, is_admin FROM roles ORDER BY id ASC')
    res.json(rows)
})

router.post('/roles', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, is_admin = false } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Missing name' })
    await query('INSERT INTO roles (name, is_admin) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING', [
        name,
        is_admin,
    ])
    res.status(201).json({ ok: true })
})

router.patch('/roles/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { id } = req.params
    const { name, is_admin } = req.body || {}
    if (!name && is_admin === undefined) return res.status(400).json({ error: 'Missing fields' })
    const sets = []
    const params = []
    if (name) {
        params.push(name)
        sets.push(`name=$${params.length}`)
    }
    if (is_admin !== undefined) {
        params.push(!!is_admin)
        sets.push(`is_admin=$${params.length}`)
    }
    params.push(id)
    await query(`UPDATE roles SET ${sets.join(', ')} WHERE id=$${params.length}`, params)
    res.json({ ok: true })
})

router.delete('/roles/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { id } = req.params
    const { rows } = await query('SELECT COUNT(*)::int AS cnt FROM users WHERE role_id=$1', [id])
    if (rows[0]?.cnt > 0) return res.status(409).json({ error: 'Нельзя удалить роль с пользователями' })
    await query('DELETE FROM roles WHERE id=$1', [id])
    res.json({ ok: true })
})

module.exports = router

