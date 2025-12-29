import React, { useEffect, useMemo, useState } from 'react'
import {
    Container,
    Typography,
    Stack,
    Card,
    CardContent,
    TextField,
    Button,
    Alert,
    Box,
    Grid,
    Divider,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material'
import { useAuth } from '../AuthContext'
import {
    listUsers,
    createUser,
    deleteUser,
    updateUser,
    updateMe,
    listRoles,
    createRole,
    updateRole,
    deleteRoleApi,
} from '../api'

export default function TeamPage() {
    const { token, user } = useAuth()
    const [people, setPeople] = useState([])
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [roles, setRoles] = useState([])
    const [newRole, setNewRole] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [editUser, setEditUser] = useState(null)
    const [roleModal, setRoleModal] = useState(false)
    const [roleEdits, setRoleEdits] = useState({})

    useEffect(() => {
        if (!token) return
        load()
    }, [token])

    async function load() {
        try {
            const data = await listUsers(token)
            setPeople(data)
            if (user?.role === 'admin') {
                const rs = await listRoles(token)
                setRoles(rs)
                const map = {}
                rs.forEach((r) => {
                    map[r.id] = r.name
                    map[`${r.id}-admin`] = r.is_admin
                })
                map.newAdmin = false
                setRoleEdits(map)
            }
        } catch (e) {
            setError(e.message)
        }
    }

    const formErrors = useMemo(
        () => ({
            name: !form.name.trim(),
            email: !form.email.includes('@'),
            password: form.password.length < 6,
        }),
        [form]
    )

    async function handleSubmit(e) {
        e.preventDefault()
        setMessage('')
        if (user?.role !== 'admin') {
            setError('Добавлять сотрудников может только администратор')
            return
        }
        if (formErrors.name || formErrors.email || formErrors.password) {
            setError('Заполните корректно имя, email и пароль (мин 6 символов)')
            return
        }
        try {
            await createUser(token, { ...form, role: form.role || 'разработчик' })
            setForm({ name: '', email: '', password: '' })
            setMessage('Сотрудник добавлен')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Удалить сотрудника?')) return
        try {
            await deleteUser(token, id)
            setMessage('Сотрудник удален')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleSaveUser(payload) {
        if (!editUser) return
        try {
            if (user?.role === 'admin' && editUser.id !== user.id) {
                await updateUser(token, editUser.id, payload)
            } else {
                await updateMe(token, payload)
            }
            setMessage('Данные пользователя обновлены')
            setEditUser(null)
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleCreateRole(e) {
        e.preventDefault()
        if (!newRole.trim()) return
        try {
            const isAdmin = roleEdits.newAdmin === true
            await createRole(token, newRole.trim(), isAdmin)
            setNewRole('')
            setRoleEdits((prev) => ({ ...prev, newAdmin: false }))
            setMessage('Роль создана')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleUpdateRole(id, payload) {
        const name = payload?.name || roleEdits[id]
        const isAdmin =
            payload?.is_admin ??
            (roleEdits[`${id}-admin`] !== undefined ? roleEdits[`${id}-admin`] : undefined)
        if (!name?.trim() && isAdmin === undefined) return
        try {
            await updateRole(token, id, name?.trim(), isAdmin)
            setMessage('Роль обновлена')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDeleteRole(id) {
        if (!window.confirm('Удалить роль? Пользователи с этой ролью не должны существовать.')) return
        try {
            await deleteRoleApi(token, id)
            setMessage('Роль удалена')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <Container sx={{ py: 6 }}>
            <Stack spacing={2}>
                <Typography variant="h4" fontWeight={800}>
                    Команда
                </Typography>
                <Typography color="text.secondary" variant="body1">
                    Управляйте участниками. Добавление и удаление доступны только администратору.
                </Typography>
                {message ? (
                    <Alert severity="success" onClose={() => setMessage('')}>
                        {message}
                    </Alert>
                ) : null}
                {error ? (
                    <Alert severity="error" onClose={() => setError('')}>
                        {error}
                    </Alert>
                ) : null}
            </Stack>

            <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={7}>
                    <Stack spacing={2}>
                        {people.map((p) => (
                            <Card key={p.id} variant="outlined">
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            {p.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {p.email} · {p.role}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {(user?.role === 'admin' || p.id === user?.id) && (
                                            <Button
                                                size="small"
                                                onClick={() =>
                                                    setEditUser({
                                                        id: p.id,
                                                        name: p.name,
                                                        email: p.email,
                                                        role: p.role,
                                                    })
                                                }
                                            >
                                                Редактировать
                                            </Button>
                                        )}
                                        {user?.role === 'admin' && p.email !== 'admin@local' ? (
                                            <Button size="small" color="error" onClick={() => handleDelete(p.id)}>
                                                Удалить
                                            </Button>
                                        ) : null}
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                        {!people.length ? (
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography color="text.secondary">Сотрудники не найдены</Typography>
                                </CardContent>
                            </Card>
                        ) : null}
                    </Stack>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" fontWeight={700}>
                                Добавить сотрудника
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Введите имя, email и пароль. Пароль должен быть не короче 6 символов.
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Box
                                component="form"
                                onSubmit={handleSubmit}
                                sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
                            >
                                <TextField
                                    label="Имя"
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    error={formErrors.name}
                                    helperText={formErrors.name ? 'Имя обязательно' : ''}
                                    size="small"
                                    fullWidth
                                />
                                <TextField
                                    label="Email"
                                    value={form.email}
                                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                    error={formErrors.email}
                                    helperText={formErrors.email ? 'Неверный email' : ''}
                                    size="small"
                                    fullWidth
                                />
                                <TextField
                                    label="Пароль"
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                    error={formErrors.password}
                                    helperText={formErrors.password ? 'Минимум 6 символов' : ''}
                                    size="small"
                                    fullWidth
                                />
                                <TextField
                                    select
                                    label="Роль"
                                    size="small"
                                    value={form.role || 'разработчик'}
                                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                                >
                                    {roles.map((r) => (
                                        <MenuItem key={r.id} value={r.name}>
                                            {r.name} {r.is_admin ? '(админ)' : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <Button type="submit" variant="contained" disabled={user?.role !== 'admin'}>
                                    {user?.role === 'admin' ? 'Добавить' : 'Только админ'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                    {user?.role === 'admin' ? (
                        <Card variant="outlined" sx={{ mt: 2 }}>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle1" fontWeight={700}>
                                        Управление ролями
                                    </Typography>
                                    <Button size="small" variant="outlined" onClick={() => setRoleModal(true)}>
                                        Открыть
                                    </Button>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Создавайте, редактируйте и удаляйте роли. Используйте их при создании и правке
                                    пользователей.
                                </Typography>
                            </CardContent>
                        </Card>
                    ) : null}
                </Grid>
            </Grid>

            <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} fullWidth maxWidth="sm">
                <DialogTitle>Редактировать пользователя</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Имя"
                            value={editUser?.name || ''}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, name: e.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label="Email"
                            value={editUser?.email || ''}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, email: e.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label="Новый пароль"
                            type="password"
                            value={editUser?.password || ''}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, password: e.target.value }))}
                            fullWidth
                        />
                        {user?.role === 'admin' && editUser?.id !== user?.id ? (
                            <TextField
                                select
                                label="Роль"
                                value={editUser?.role || 'разработчик'}
                                onChange={(e) => setEditUser((prev) => ({ ...prev, role: e.target.value }))}
                                fullWidth
                            >
                                {roles.map((r) => (
                                    <MenuItem key={r.id} value={r.name}>
                                        {r.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditUser(null)}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={() =>
                            handleSaveUser({
                                name: editUser?.name,
                                email: editUser?.email,
                                password: editUser?.password,
                                role: editUser?.role,
                            })
                        }
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {user?.role === 'admin' ? (
                <Dialog open={roleModal} onClose={() => setRoleModal(false)} fullWidth maxWidth="md">
                    <DialogTitle>Роли</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            {roles.map((r) => (
                                <Stack
                                    key={r.id}
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ width: '100%' }}
                                >
                                    <TextField
                                        size="small"
                                        label="Название"
                                        value={roleEdits[r.id] ?? r.name}
                                        onChange={(e) =>
                                            setRoleEdits((prev) => ({ ...prev, [r.id]: e.target.value }))
                                        }
                                        fullWidth
                                    />
                                    <TextField
                                        select
                                        size="small"
                                        label="Админ-права"
                                        value={(roleEdits[`${r.id}-admin`] ?? r.is_admin) ? 'true' : 'false'}
                                        onChange={(e) =>
                                            setRoleEdits((prev) => ({
                                                ...prev,
                                                [`${r.id}-admin`]: e.target.value === 'true',
                                            }))
                                        }
                                        sx={{ minWidth: 140 }}
                                        disabled={r.name === 'admin'}
                                    >
                                        <MenuItem value="false">Нет</MenuItem>
                                        <MenuItem value="true">Да</MenuItem>
                                    </TextField>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() =>
                                            handleUpdateRole(r.id, {
                                                name: roleEdits[r.id] ?? r.name,
                                                is_admin:
                                                    roleEdits[`${r.id}-admin`] !== undefined
                                                        ? roleEdits[`${r.id}-admin`]
                                                        : r.is_admin,
                                            })
                                        }
                                        sx={{ whiteSpace: 'nowrap' }}
                                        disabled={r.name === 'admin'}
                                    >
                                        Сохранить
                                    </Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteRole(r.id)}
                                        disabled={r.name === 'admin'}
                                        sx={{ whiteSpace: 'nowrap' }}
                                    >
                                        Удалить
                                    </Button>
                                </Stack>
                            ))}
                            <Divider />
                            <Box component="form" onSubmit={handleCreateRole} sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    size="small"
                                    label="Новая роль"
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value)}
                                    fullWidth
                                />
                                <TextField
                                    select
                                    size="small"
                                    label="Админ-права"
                                    value={roleEdits.newAdmin ? 'true' : 'false'}
                                    onChange={(e) =>
                                        setRoleEdits((prev) => ({
                                            ...prev,
                                            newAdmin: e.target.value === 'true',
                                        }))
                                    }
                                    sx={{ minWidth: 140 }}
                                >
                                    <MenuItem value="false">Нет</MenuItem>
                                    <MenuItem value="true">Да</MenuItem>
                                </TextField>
                                <Button type="submit" variant="contained">
                                    Добавить
                                </Button>
                            </Box>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRoleModal(false)}>Закрыть</Button>
                    </DialogActions>
                </Dialog>
            ) : null}
        </Container>
    )
}
