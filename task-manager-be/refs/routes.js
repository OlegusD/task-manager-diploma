const { Router } = require('express')
const { query } = require('../db')
const { requireAuth, requireRole } = require('../auth/middleware')

const router = Router()
router.use(requireAuth)

router.get('/statuses', async (req, res) => {
    const { project_id } = req.query
    if (!project_id) {
        const { rows } = await query(
            `SELECT id, name, position, project_id FROM statuses WHERE project_id IS NULL ORDER BY position ASC`
        )
        return res.json(rows)
    }
    const { rows } = await query(
        `SELECT id, name, position, project_id FROM statuses WHERE project_id = $1 ORDER BY position ASC`,
        [project_id]
    )
    if (rows.length) return res.json(rows)
    const { rows: fallback } = await query(
        `SELECT id, name, position, project_id FROM statuses WHERE project_id IS NULL ORDER BY position ASC`
    )
    res.json(fallback)
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
        `SELECT p.id, p.name, p.description, p.created_at,
            COUNT(pm.user_id)::int AS members_count
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id
         GROUP BY p.id
         ORDER BY p.created_at ASC`
    )
    res.json(rows)
})

router.get('/projects/:id/members', async (req, res) => {
    const { id } = req.params
    const { rows } = await query(
        `SELECT pm.user_id AS id, u.name, u.email, r.name AS role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE pm.project_id = $1`,
        [id]
    )
    res.json(rows)
})

router.post('/projects', requireRole('admin'), async (req, res) => {
    const { name, description, member_ids = [] } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Missing name' })
    try {
        await query('BEGIN')
        const { rows } = await query(
            `
        INSERT INTO projects (id, name, description)
        VALUES (gen_random_uuid(), $1, $2)
        ON CONFLICT (name) DO NOTHING
        RETURNING id;
      `,
            [name, description ?? null]
        )
        if (!rows.length) {
            await query('ROLLBACK')
            return res.status(409).json({ error: 'Project exists' })
        }
        const newId = rows[0].id
        if (Array.isArray(member_ids) && member_ids.length) {
            for (const userId of member_ids) {
                await query(
                    `INSERT INTO project_members (project_id, user_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [newId, userId]
                )
            }
        }
        await query('COMMIT')
        res.status(201).json({ id: newId })
    } catch (e) {
        await query('ROLLBACK')
        console.error(e)
        res.status(500).json({ error: 'Failed to create project' })
    }
})

router.delete('/projects/:id', requireRole('admin'), async (req, res) => {
    const { id } = req.params
    try {
        await query('BEGIN')
        const { rows: found } = await query(
            `SELECT id FROM projects WHERE id::text = $1 OR name = $1 LIMIT 1`,
            [id]
        )
        if (!found.length) {
            await query('ROLLBACK')
            return res.status(404).json({ error: 'Not found' })
        }
        const projectId = found[0].id
        await query(`DELETE FROM tasks WHERE project_id = $1`, [projectId])
        await query(`DELETE FROM statuses WHERE project_id = $1`, [projectId])
        await query(`DELETE FROM project_members WHERE project_id = $1`, [projectId])
        await query(`DELETE FROM projects WHERE id = $1`, [projectId])
        await query('COMMIT')
        res.status(204).end()
    } catch (e) {
        await query('ROLLBACK')
        console.error(e)
        res.status(500).json({ error: 'Failed to delete project' })
    }
})

router.patch('/projects/:id', requireRole('admin'), async (req, res) => {
    const { id } = req.params
    const { name, description, member_ids } = req.body || {}
    if (!name && description === undefined && member_ids === undefined) {
        return res.status(400).json({ error: 'Nothing to update' })
    }
    try {
        await query('BEGIN')
        if (name || description !== undefined) {
            const sets = []
            const params = []
            if (name) {
                params.push(name)
                sets.push(`name=$${params.length}`)
            }
            if (description !== undefined) {
                params.push(description)
                sets.push(`description=$${params.length}`)
            }
            params.push(id)
            await query(`UPDATE projects SET ${sets.join(', ')} WHERE id=$${params.length}`, params)
        }

        if (Array.isArray(member_ids)) {
            const current = await query(
                `SELECT user_id FROM project_members WHERE project_id = $1`,
                [id]
            )
            const currentIds = new Set(current.rows.map((r) => String(r.user_id)))
            const nextIds = new Set(member_ids.map(String))

            const toAdd = member_ids.filter((uid) => !currentIds.has(String(uid)))
            const toRemove = Array.from(currentIds).filter((uid) => !nextIds.has(uid))

            for (const uid of toAdd) {
                await query(
                    `INSERT INTO project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                    [id, uid]
                )
            }
            if (toRemove.length) {
                await query(
                    `UPDATE tasks SET assignee_id = NULL WHERE project_id = $1 AND assignee_id = ANY($2::uuid[])`,
                    [id, toRemove]
                )
                await query(
                    `DELETE FROM project_members WHERE project_id = $1 AND user_id = ANY($2::uuid[])`,
                    [id, toRemove]
                )
            }
        }

        await query('COMMIT')
        res.json({ ok: true })
    } catch (e) {
        await query('ROLLBACK')
        console.error(e)
        res.status(500).json({ error: 'Failed to update project' })
    }
})

router.get('/users', async (_req, res) => {
    const { rows } = await query(
        `SELECT u.id, u.name, u.email, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at ASC`
    )
    res.json(rows)
})

router.post('/statuses', async (req, res) => {
    const { name, position = 1, project_id } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Missing name' })
    if (!project_id) return res.status(400).json({ error: 'Missing project_id' })
    const pos = Number(position)
    if (Number.isNaN(pos)) return res.status(400).json({ error: 'Bad position' })
    const { rows } = await query(
        `
      INSERT INTO statuses (name, position, project_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (name, project_id) DO NOTHING
      RETURNING id;
    `,
        [name, pos, project_id]
    )
    if (!rows.length) return res.status(409).json({ error: 'Status exists' })
    res.status(201).json({ id: rows[0].id })
})

router.patch('/statuses/:id', async (req, res) => {
    const { id } = req.params
    const { name, position } = req.body || {}
    if (!name && position === undefined) return res.status(400).json({ error: 'No fields' })
    const sets = []
    const params = []
    if (name) {
        params.push(name)
        sets.push(`name = $${params.length}`)
    }
    if (position !== undefined) {
        const pos = Number(position)
        if (Number.isNaN(pos)) return res.status(400).json({ error: 'Bad position' })
        params.push(pos)
        sets.push(`position = $${params.length}`)
    }
    params.push(id)
    await query(`UPDATE statuses SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
    res.json({ ok: true })
})

router.delete('/statuses/:id', async (req, res) => {
    const { id } = req.params
    const { rows } = await query('SELECT COUNT(*)::int AS cnt FROM tasks WHERE status_id=$1', [id])
    if (rows[0].cnt > 0) return res.status(400).json({ error: 'Status in use' })
    await query('DELETE FROM statuses WHERE id=$1', [id])
    res.json({ ok: true })
})

module.exports = router
