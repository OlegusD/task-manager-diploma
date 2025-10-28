require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

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

        // Расширения не требуются (uuid генерим на приложении)

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
        author_id UUID NOT NULL REFERENCES users(id),
        parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

        await client.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);
    `)

        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);`)

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

        // Сид данных: роли
        await client.query(`
      INSERT INTO roles (name) VALUES
        ('admin'), ('user')
      ON CONFLICT (name) DO NOTHING;
    `)

        // Сид данных: статусы (колонки)
        await client.query(`
      INSERT INTO statuses (name, position) VALUES
        ('To Do', 1),
        ('In Progress', 2),
        ('Done', 3)
      ON CONFLICT (name) DO NOTHING;
    `)

        // Сид данных: приоритеты
        await client.query(`
      INSERT INTO priorities (name, weight) VALUES
        ('Low', 1),
        ('Medium', 2),
        ('High', 3)
      ON CONFLICT (name) DO NOTHING;
    `)

        // Базовый админ
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
            .catch(async (e) => {
                // Если нет pgcrypto/gen_random_uuid, сгенерим uuid на приложении:
                const { v4: uuidv4 } = require('uuid')
                await client.query(
                    `
        INSERT INTO users (id, email, password_hash, name, role_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING;
        `,
                    [uuidv4(), adminEmail, adminHash, adminName, adminRoleId]
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
