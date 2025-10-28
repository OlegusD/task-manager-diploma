const { Router } = require('express')
const { query } = require('../db')
const { v4: uuidv4 } = require('uuid')
const { requireAuth, requireRole } = require('../auth/middleware')

const router = Router()
router.use(requireAuth)

// Список задач (с фильтрами по статусу/приоритету)
router.get('/', async (req, res) => {
    const { status_id, priority_id } = req.query
    const where = []
    const params = []
    if (status_id) {
        params.push(status_id)
        where.push(`t.status_id = $${params.length}`)
    }
    if (priority_id) {
        params.push(priority_id)
        where.push(`t.priority_id = $${params.length}`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const { rows } = await query(
        `
    SELECT t.*, s.name AS status_name, p.name AS priority_name, u.name AS author_name, asg.name AS assignee_name
    FROM tasks t
    JOIN statuses s ON s.id = t.status_id
    JOIN priorities p ON p.id = t.priority_id
    JOIN users u ON u.id = t.author_id
    LEFT JOIN users asg ON asg.id = t.assignee_id
    ${whereSql}
    ORDER BY t.created_at DESC
    `,
        params
    )
    res.json(rows)
})

// Создать задачу
router.post('/', async (req, res) => {
    const { title, description, status_id, priority_id, parent_id, assignee_id } = req.body || {}
    if (!title || !status_id || !priority_id)
        return res.status(400).json({ error: 'Missing fields' })

    const id = uuidv4()
    await query(
        `INSERT INTO tasks (id, title, description, status_id, priority_id, author_id, parent_id, assignee_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
            id,
            title,
            description ?? null,
            status_id,
            priority_id,
            req.user.id,
            parent_id ?? null,
            assignee_id ?? null,
        ]
    )

    await query(
        `INSERT INTO task_history (id, task_id, action, new_value, author_id)
     VALUES ($1,$2,'created',$3,$4)`,
        [
            uuidv4(),
            id,
            JSON.stringify({ title, status_id, priority_id, parent_id, assignee_id }),
            req.user.id,
        ]
    )

    res.status(201).json({ id })
})

router.get('/:id', async (req, res) => {
    const { id } = req.params
    const { rows } = await query(
        `SELECT
       t.*,
       s.name AS status_name,
       p.name AS priority_name,
       au.name  AS author_name,
       asg.name AS assignee_name
     FROM tasks t
     JOIN statuses  s   ON s.id  = t.status_id
     JOIN priorities p  ON p.id  = t.priority_id
     JOIN users     au  ON au.id = t.author_id
     LEFT JOIN users asg ON asg.id = t.assignee_id
     WHERE t.id = $1`,
        [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })

    const { rows: comments } = await query(
        `SELECT c.*, u.name AS author_name
     FROM task_comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id=$1 ORDER BY c.created_at ASC`,
        [id]
    )
    const { rows: history } = await query(
        `SELECT h.*, u.name AS author_name
     FROM task_history h LEFT JOIN users u ON u.id = h.author_id
     WHERE h.task_id=$1 ORDER BY h.created_at ASC`,
        [id]
    )
    res.json({ task: rows[0], comments, history })
})

// Обновить задачу (только автор или админ)
router.patch('/:id', async (req, res) => {
    const { id } = req.params

    // Получим текущую задачу
    const { rows: owner } = await query(
        'SELECT author_id, status_id, priority_id, title, description, parent_id, assignee_id FROM tasks WHERE id=$1',
        [id]
    )
    if (!owner.length) return res.status(404).json({ error: 'Not found' })
    const task = owner[0]
    const isOwner = task.author_id === req.user.id
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    // Разрешённые поля (добавили assignee_id)
    const fieldsMap = {
        title: 'title',
        description: 'description',
        status_id: 'status_id',
        priority_id: 'priority_id',
        parent_id: 'parent_id',
        assignee_id: 'assignee_id',
    }

    const sets = []
    const params = []
    Object.keys(fieldsMap).forEach((k) => {
        if (req.body[k] !== undefined) {
            params.push(req.body[k])
            sets.push(`${fieldsMap[k]} = $${params.length}`)
        }
    })
    if (!sets.length) return res.status(400).json({ error: 'No fields' })

    params.push(id)
    await query(
        `UPDATE tasks SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params
    )

    // Логируем дельту
    const diffs = {}
    Object.keys(fieldsMap).forEach((k) => {
        if (req.body[k] !== undefined && req.body[k] !== task[k]) {
            diffs[k] = { from: task[k], to: req.body[k] }
        }
    })
    await query(
        `INSERT INTO task_history (id, task_id, action, old_value, new_value, author_id)
     VALUES ($1,$2,'updated',$3,$4,$5)`,
        [uuidv4(), id, JSON.stringify(task), JSON.stringify(diffs), req.user.id]
    )

    res.json({ ok: true })
})

// Удалить задачу (только автор или админ)
router.delete('/:id', async (req, res) => {
    const { id } = req.params
    const { rows } = await query('SELECT author_id FROM tasks WHERE id=$1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    const isOwner = rows[0].author_id === req.user.id
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    await query(
        `INSERT INTO task_history (id, task_id, action, author_id)
     VALUES ($1,$2,'deleted',$3)`,
        [uuidv4(), id, req.user.id]
    )
    await query('DELETE FROM tasks WHERE id=$1', [id])
    res.json({ ok: true })
})

// Добавить комментарий
router.post('/:id/comments', async (req, res) => {
    const { id } = req.params
    const { body } = req.body || {}
    if (!body) return res.status(400).json({ error: 'Missing body' })

    const { rows: exists } = await query('SELECT id FROM tasks WHERE id=$1', [id])
    if (!exists.length) return res.status(404).json({ error: 'Not found' })

    const commentId = uuidv4()
    await query(`INSERT INTO task_comments (id, task_id, author_id, body) VALUES ($1,$2,$3,$4)`, [
        commentId,
        id,
        req.user.id,
        body,
    ])

    await query(
        `INSERT INTO task_history (id, task_id, action, new_value, author_id)
     VALUES ($1,$2,'comment_added',$3,$4)`,
        [uuidv4(), id, JSON.stringify({ body }), req.user.id]
    )

    res.status(201).json({ id: commentId })
})

module.exports = router
