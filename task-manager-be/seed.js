/**
 * Seeder: полностью перезаписывает базу (DROP/CREATE) и наполняет дефолтными данными.
 * ВНИМАНИЕ: уничтожает текущие данные в DATABASE_URL.
 */
require('dotenv').config()
const { Client } = require('pg')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

async function dropAndCreateDb() {
    const url = new URL(process.env.DATABASE_URL || 'postgres://postgres:1@localhost:5432/task-manager-db')
    const dbName = url.pathname.replace('/', '')
    const adminUser = url.username
    const adminPass = url.password
    const host = url.hostname
    const port = url.port || 5432

    // подключаемся к postgres для DROP/CREATE
    const sysClient = new Client({
        user: adminUser,
        password: adminPass,
        host,
        port,
        database: 'postgres',
    })
    await sysClient.connect()
    await sysClient.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`, [dbName])
    await sysClient.query(`DROP DATABASE IF EXISTS "${dbName}"`)
    await sysClient.query(`CREATE DATABASE "${dbName}"`)
    await sysClient.end()
    console.log(`[seed] Dropped and created database ${dbName}`)
}

async function seedData() {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    // schema
    await client.query(`
      CREATE TABLE projects (id UUID PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW());
      CREATE TABLE task_types (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
      CREATE TABLE roles (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
      CREATE TABLE users (id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role_id INTEGER NOT NULL REFERENCES roles(id), created_at TIMESTAMP NOT NULL DEFAULT NOW());
      CREATE TABLE project_members (project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (project_id, user_id));
      CREATE TABLE statuses (id SERIAL PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL, project_id UUID REFERENCES projects(id));
      CREATE TABLE priorities (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, weight INTEGER NOT NULL);
      CREATE TABLE tasks (
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
      CREATE TABLE task_comments (id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, author_id UUID NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW());
      CREATE TABLE task_history (id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, action TEXT NOT NULL, old_value JSONB, new_value JSONB, author_id UUID REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW());
      CREATE UNIQUE INDEX idx_statuses_unique ON statuses(name, project_id);
      CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
      CREATE INDEX idx_tasks_project ON tasks(project_id);
      CREATE INDEX idx_statuses_project ON statuses(project_id NULLS FIRST);
    `)

    // refs
    await client.query(`INSERT INTO roles (name) VALUES ('admin'), ('user');`)
    await client.query(`INSERT INTO task_types (name) VALUES ('Bug'), ('Feature'), ('Epic');`)
    await client.query(`INSERT INTO priorities (name, weight) VALUES ('Low',1),('Medium',2),('High',3);`)

    // project
    const projectId = uuidv4()
    await client.query(
        `INSERT INTO projects (id, name, description) VALUES ($1,'General','Default seeded project')`,
        [projectId]
    )

    // users
    const adminId = uuidv4()
    const userId = uuidv4()
    const [adminRole, userRole] = await Promise.all([
        client.query(`SELECT id FROM roles WHERE name='admin' LIMIT 1`),
        client.query(`SELECT id FROM roles WHERE name='user' LIMIT 1`),
    ])
    await client.query(
        `INSERT INTO users (id,email,password_hash,name,role_id) VALUES ($1,$2,$3,$4,$5)`,
        [adminId, 'admin@local', bcrypt.hashSync('admin', 10), 'Admin', adminRole.rows[0].id]
    )
    await client.query(
        `INSERT INTO users (id,email,password_hash,name,role_id) VALUES ($1,$2,$3,$4,$5)`,
        [userId, 'user@local', bcrypt.hashSync('password', 10), 'User One', userRole.rows[0].id]
    )

    await client.query(
        `INSERT INTO project_members (project_id, user_id) VALUES ($1,$2),($1,$3)`,
        [projectId, adminId, userId]
    )

    // statuses
    const statusRows = await client.query(
        `INSERT INTO statuses (name, position, project_id) VALUES
        ('Backlog',1,$1),('In Progress',2,$1),('Review',3,$1),('Done',4,$1)
        RETURNING id, name`,
        [projectId]
    )
    const statusMap = Object.fromEntries(statusRows.rows.map((r) => [r.name, r.id]))

    // tasks
    const bugId = uuidv4()
    const featureId = uuidv4()
    const subTaskId = uuidv4()
    const typeRows = await client.query(`SELECT name,id FROM task_types`)
    const typeMap = Object.fromEntries(typeRows.rows.map((r) => [r.name, r.id]))
    const priority = await client.query(`SELECT name,id FROM priorities`)
    const priMap = Object.fromEntries(priority.rows.map((r) => [r.name, r.id]))

    await client.query(
        `INSERT INTO tasks (id,title,description,status_id,priority_id,type_id,project_id,author_id,assignee_id,parent_id,start_date,due_date)
         VALUES
         ($1,'Fix login bug','JWT refresh issue', $2,$3,$4,$5,$6,$6,NULL,NOW(),NOW()+INTERVAL '3 days'),
         ($7,'Implement kanban board','Drag & drop columns', $8,$9,$10,$5,$6,$11,NULL,NOW(),NOW()+INTERVAL '5 days'),
         ($12,'Subtask: column reorder','Allow moving statuses', $8,$9,$10,$5,$6,$11,$7,NOW(),NOW()+INTERVAL '2 days')`,
        [
            bugId,
            statusMap['Backlog'],
            priMap['High'],
            typeMap['Bug'],
            projectId,
            adminId,
            featureId,
            statusMap['In Progress'],
            priMap['Medium'],
            typeMap['Feature'],
            userId,
            subTaskId,
        ]
    )

    await client.end()
    console.log('[seed] Database seeded.')
}

async function main() {
    await dropAndCreateDb()
    await seedData()
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
