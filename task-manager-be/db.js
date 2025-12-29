require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL || 'postgres://postgres:1@localhost:5432/task-manager-db',
})

async function query(text, params) {
    const res = await pool.query(text, params)
    return res
}

async function init() {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`)

        await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS task_types (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role_id INTEGER NOT NULL REFERENCES roles(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS statuses (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        position INTEGER NOT NULL
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS priorities (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        weight INTEGER NOT NULL
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status_id INTEGER NOT NULL REFERENCES statuses(id),
        priority_id INTEGER NOT NULL REFERENCES priorities(id),
        type_id INTEGER REFERENCES task_types(id),
        project_id UUID REFERENCES projects(id),
        author_id UUID NOT NULL REFERENCES users(id),
        assignee_id UUID REFERENCES users(id),
        parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        start_date TIMESTAMP NOT NULL DEFAULT NOW(),
        due_date TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

        await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);
    `)

        await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
    `)

        await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES task_types(id);
    `)

        await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS start_date TIMESTAMP NOT NULL DEFAULT NOW();
    `)

        await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS due_date TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days');
    `)

        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);`)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);`)

        await client.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id UUID PRIMARY KEY,
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

        await client.query(`
      CREATE TABLE IF NOT EXISTS task_history (
        id UUID PRIMARY KEY,
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        action TEXT NOT NULL,                   -- e.g. created/updated/deleted/status_changed/priority_changed/comment_added
        old_value JSONB,
        new_value JSONB,
        author_id UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

        await client.query(`
      INSERT INTO roles (name) VALUES
        ('admin'), ('user')
      ON CONFLICT (name) DO NOTHING;
    `)

        await client.query(`
      INSERT INTO statuses (name, position) VALUES
        ('To Do', 1),
        ('In Progress', 2),
        ('Done', 3)
      ON CONFLICT (name) DO NOTHING;
    `)

        await client.query(`
      INSERT INTO priorities (name, weight) VALUES
        ('Low', 1),
        ('Medium', 2),
        ('High', 3)
      ON CONFLICT (name) DO NOTHING;
    `)

        await client.query(`
      INSERT INTO task_types (name) VALUES
        ('Bug'),
        ('Feature'),
        ('Epic')
      ON CONFLICT (name) DO NOTHING;
    `)

        const { rows: existingProjects } = await client.query(
            `SELECT id FROM projects WHERE name='General' LIMIT 1;`
        )
        const defaultProjectId = existingProjects[0]?.id ?? uuidv4()

        const { rows: projectRows } = await client.query(
            `
      INSERT INTO projects (id, name, description)
      VALUES ($1, 'General', 'Default project')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id;
    `,
            [defaultProjectId]
        )
        const projectId = projectRows[0]?.id
        if (projectId) {
            await client.query(`UPDATE tasks SET project_id = $1 WHERE project_id IS NULL`, [
                projectId,
            ])
        }

        const { rows: adminRole } = await client.query(
            `SELECT id FROM roles WHERE name='admin' LIMIT 1;`
        )
        const adminRoleId = adminRole[0]?.id
        const adminEmail = 'admin@local'
        const adminName = 'Admin'
        const adminPass = 'admin'
        const adminHash = bcrypt.hashSync(adminPass, 10)

        await client
            .query(
                `
      INSERT INTO users (id, email, password_hash, name, role_id)
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING;
      `,
                [adminEmail, adminHash, adminName, adminRoleId]
            )
            .catch(async () => {
                const fallbackId = uuidv4()
                await client.query(
                    `
        INSERT INTO users (id, email, password_hash, name, role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO NOTHING;
        `,
                    [fallbackId, adminEmail, adminHash, adminName, adminRoleId]
                )
            })

        await client.query('COMMIT')
        console.log('[DB] Initialized')
    } catch (e) {
        await client.query('ROLLBACK')
        console.error('[DB] Init error:', e)
        throw e
    } finally {
        client.release()
    }
}

module.exports = { pool, query, init }
