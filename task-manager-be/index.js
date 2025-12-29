require('dotenv').config()
const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const { init } = require('./db')
const { setIo } = require('./ws')

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

app.use((err, _req, res, _next) => {
    console.error('[ERR]', err)
    res.status(500).json({ error: 'Server error' })
})

const port = Number(process.env.PORT || 4000)
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
setIo(io)

io.on('connection', (socket) => {
    console.log('[WS] client connected', socket.id)
    socket.on('disconnect', () => console.log('[WS] client disconnected', socket.id))
})

init()
    .then(() => {
        server.listen(port, () => console.log(`API running on http://localhost:${port}`))
    })
    .catch((e) => {
        console.error('Failed to init DB:', e)
        process.exit(1)
    })
