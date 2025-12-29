export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000'

async function api(path, { method = 'GET', token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        const message = (await res.json().catch(() => null))?.error || res.statusText
        throw new Error(message)
    }
    if (res.status === 204) return null
    return res.json()
}

export function login(email, password) {
    return api('/auth/login', { method: 'POST', body: { email, password } })
}

export function register({ email, password, name }) {
    return api('/auth/register', { method: 'POST', body: { email, password, name } })
}

export function getMe(token) {
    return api('/auth/me', { token })
}

export function createUser(token, payload) {
    return api('/auth/users', { method: 'POST', token, body: payload })
}

export function listProjects(token) {
    return api('/refs/projects', { token })
}

export function createProject(token, payload) {
    return api('/refs/projects', { method: 'POST', token, body: payload })
}

export function listStatuses(token, params = {}) {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') search.append(k, v)
    })
    const qs = search.toString()
    return api(`/refs/statuses${qs ? `?${qs}` : ''}`, { token })
}

export function listPriorities(token) {
    return api('/refs/priorities', { token })
}

export function listTaskTypes(token) {
    return api('/refs/task-types', { token })
}

export function listUsers(token) {
    return api('/refs/users', { token })
}

export function listTasks(token, params = {}) {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') search.append(k, v)
    })
    const qs = search.toString()
    return api(`/tasks${qs ? `?${qs}` : ''}`, { token })
}

export function createTask(token, payload) {
    return api('/tasks', { method: 'POST', token, body: payload })
}

export function updateTask(token, id, payload) {
    return api(`/tasks/${id}`, { method: 'PATCH', token, body: payload })
}

export function deleteTask(token, id) {
    return api(`/tasks/${id}`, { method: 'DELETE', token })
}

export function getTask(token, id) {
    return api(`/tasks/${id}`, { token })
}

export function addComment(token, id, body) {
    return api(`/tasks/${id}/comments`, { method: 'POST', token, body: { body } })
}

export function updateComment(token, taskId, commentId, body) {
    return api(`/tasks/${taskId}/comments/${commentId}`, {
        method: 'PATCH',
        token,
        body: { body },
    })
}

export function deleteCommentApi(token, taskId, commentId) {
    return api(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE', token })
}

export function createStatus(token, payload) {
    return api('/refs/statuses', { method: 'POST', token, body: payload })
}

export function updateStatus(token, id, payload) {
    return api(`/refs/statuses/${id}`, { method: 'PATCH', token, body: payload })
}

export function deleteStatus(token, id) {
    return api(`/refs/statuses/${id}`, { method: 'DELETE', token })
}

export function deleteUser(token, id) {
    return api(`/auth/users/${id}`, { method: 'DELETE', token })
}

export function updateUserRole(token, id, role) {
    return api(`/auth/users/${id}`, { method: 'PATCH', token, body: { role } })
}

export function updateUser(token, id, payload) {
    return api(`/auth/users/${id}`, { method: 'PATCH', token, body: payload })
}

export function updateMe(token, payload) {
    return api('/auth/me', { method: 'PATCH', token, body: payload })
}

export function listRoles(token) {
    return api('/auth/roles', { token })
}

export function createRole(token, name, is_admin = false) {
    return api('/auth/roles', { method: 'POST', token, body: { name, is_admin } })
}

export function updateRole(token, id, name, is_admin) {
    const body = {}
    if (name !== undefined) body.name = name
    if (is_admin !== undefined) body.is_admin = is_admin
    return api(`/auth/roles/${id}`, { method: 'PATCH', token, body })
}

export function deleteRoleApi(token, id) {
    return api(`/auth/roles/${id}`, { method: 'DELETE', token })
}
