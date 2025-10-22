require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { init } = require('./db')

const authRoutes = require('./auth/routes')
const taskRoutes = require('./tasks/routes')
const refRoutes = require('./refs/routes')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/auth', authRoutes)
app.use('/tasks', taskRoutes)
app.use('/refs', refRoutes)

// Глобальный обработчик ошибок
app.use((err, _req, res, _next) => {
    console.error('[ERR]', err)
    res.status(500).json({ error: 'Server error' })
})

const port = Number(process.env.PORT || 4000)

init()
    .then(() => {
        app.listen(port, () => console.log(`API running on http://localhost:${port}`))
    })
    .catch((e) => {
        console.error('Failed to init DB:', e)
        process.exit(1)
    })
