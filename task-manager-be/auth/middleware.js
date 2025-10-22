const jwt = require('jsonwebtoken')

function requireAuth(req, res, next) {
    const header = req.headers.authorization || ''
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
    const token = header.slice(7)
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'change_me')
        req.user = { id: payload.userId, role: payload.role, email: payload.email }
        next()
    } catch {
        return res.status(401).json({ error: 'Invalid token' })
    }
}

function requireRole(roleName) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'No user' })
        if (req.user.role !== roleName) return res.status(403).json({ error: 'Forbidden' })
        next()
    }
}

module.exports = { requireAuth, requireRole }
