/* eslint-disable react-hooks/exhaustive-deps */
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
    const isAdmin = user?.role === 'admin'
    const [people, setPeople] = useState([])
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'гость' })
    const [roles, setRoles] = useState([])
    const [newRole, setNewRole] = useState('')
    const [newRoleAdmin, setNewRoleAdmin] = useState(false)
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
            if (isAdmin) {
                const rs = await listRoles(token)
                setRoles(rs)
                const map = {}
                rs.forEach((r) => {
                    map[r.id] = r.name
                    map[`${r.id}-admin`] = r.is_admin
                })
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
        if (!isAdmin) {
            setError('Только администратор может создавать пользователей')
            return
        }
        if (formErrors.name || formErrors.email || formErrors.password) {
            setError('Заполните корректно имя, email и пароль (мин 6 символов)')
            return
        }
        try {
            await createUser(token, { ...form })
            setForm({ name: '', email: '', password: '', role: 'гость' })
            setMessage('Пользователь создан')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Удалить пользователя?')) return
        try {
            await deleteUser(token, id)
            setMessage('Пользователь удален')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleSaveUser(payload) {
        if (!editUser) return
        try {
            if (isAdmin && editUser.id !== user.id) {
                await updateUser(token, editUser.id, payload)
            } else {
                await updateMe(token, payload)
            }
            setMessage('Пользователь обновлен')
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
            await createRole(token, newRole.trim(), newRoleAdmin)
            setNewRole('')
            setNewRoleAdmin(false)
            setMessage('Роль создана')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleUpdateRole(id) {
        const name = roleEdits[id]
        const isAdminRole = roleEdits[`${id}-admin`]
        if (!name?.trim()) return
        try {
            await updateRole(token, id, name.trim(), isAdminRole)
            setMessage('Роль обновлена')
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDeleteRole(id) {
        if (!window.confirm('Удалить роль? Пользователи с этой ролью станут гостями.')) return
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
                    Сотрудники
                </Typography>
                <Typography color="text.secondary" variant="body1">
                    Управление пользователями и ролями.
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
                                        <Typography fontWeight={700}>{p.name}</Typography>
                                        <Typography color="text.secondary">{p.email} · {p.role}</Typography>
                                    </Box>
                                    {(isAdmin || p.id === user?.id) && (
                                        <Stack direction="row" spacing={1}>
                                            <Button size="small" variant="outlined" onClick={() => setEditUser(p)}>
                                                Редактировать
                                            </Button>
                                            {isAdmin && p.email !== 'admin@local' ? (
                                                <Button size="small" color="error" onClick={() => handleDelete(p.id)}>
                                                    Удалить
                                                </Button>
                                            ) : null}
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                        {!people.length ? (
                            <Typography color="text.secondary">Нет пользователей</Typography>
                        ) : null}
                    </Stack>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                    Создать пользователя
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Заполните имя, email и пароль. Пароль минимум 6 символов.
                                </Typography>
                                <Box component="form" onSubmit={handleSubmit}>
                                    <TextField
                                        label="Имя"
                                        fullWidth
                                        sx={{ mb: 1 }}
                                        value={form.name}
                                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                        error={formErrors.name}
                                        helperText={formErrors.name ? 'Имя обязательно' : ''}
                                        disabled={!isAdmin}
                                    />
                                    <TextField
                                        label="Email"
                                        fullWidth
                                        sx={{ mb: 1 }}
                                        value={form.email}
                                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                                        error={formErrors.email}
                                        helperText={formErrors.email ? 'Введите корректный email' : ''}
                                        disabled={!isAdmin}
                                    />
                                    <TextField
                                        label="Пароль"
                                        type="password"
                                        fullWidth
                                        sx={{ mb: 1 }}
                                        value={form.password}
                                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                                        error={formErrors.password}
                                        helperText={formErrors.password ? 'Минимум 6 символов' : ''}
                                        disabled={!isAdmin}
                                    />
                                    <TextField
                                        select
                                        label="Роль"
                                        fullWidth
                                        sx={{ mb: 1 }}
                                        value={form.role}
                                        onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                                        disabled={!isAdmin}
                                    >
                                        {roles.map((r) => (
                                            <MenuItem key={r.id} value={r.name}>
                                                {r.name} {r.is_admin ? '(админ)' : ''}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <Button type="submit" variant="contained" fullWidth disabled={!isAdmin}>
                                        Создать
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        {isAdmin ? (
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                        Роли
                                    </Typography>
                                    <Divider sx={{ mb: 1 }} />
                                    <Stack spacing={1}>
                                        {roles.map((r) => (
                                            <Stack key={r.id} spacing={1} direction="row" alignItems="center">
                                                <TextField
                                                    size="small"
                                                    value={roleEdits[r.id] ?? r.name}
                                                    onChange={(e) =>
                                                        setRoleEdits((prev) => ({ ...prev, [r.id]: e.target.value }))
                                                    }
                                                    sx={{ flex: 1 }}
                                                />
                                                <TextField
                                                    size="small"
                                                    select
                                                    value={(roleEdits[`${r.id}-admin`] ?? r.is_admin) ? 'true' : 'false'}
                                                    onChange={(e) =>
                                                        setRoleEdits((prev) => ({
                                                            ...prev,
                                                            [`${r.id}-admin`]: e.target.value === 'true',
                                                        }))
                                                    }
                                                    sx={{ width: 120 }}
                                                >
                                                    <MenuItem value="false">Нет</MenuItem>
                                                    <MenuItem value="true">Да</MenuItem>
                                                </TextField>
                                                <Button size="small" variant="outlined" onClick={() => handleUpdateRole(r.id)}>
                                                    Сохранить
                                                </Button>
                                                <Button size="small" color="error" onClick={() => handleDeleteRole(r.id)}>
                                                    Удалить
                                                </Button>
                                            </Stack>
                                        ))}
                                    </Stack>
                                    <Divider sx={{ my: 1 }} />
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        Новая роль
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            label="Название"
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value)}
                                            sx={{ flex: 1 }}
                                        />
                                        <TextField
                                            size="small"
                                            select
                                            label="Админ"
                                            value={newRoleAdmin ? 'true' : 'false'}
                                            onChange={(e) => setNewRoleAdmin(e.target.value === 'true')}
                                            sx={{ width: 120 }}
                                        >
                                            <MenuItem value="false">Нет</MenuItem>
                                            <MenuItem value="true">Да</MenuItem>
                                        </TextField>
                                        <Button variant="contained" onClick={handleCreateRole}>
                                            Добавить
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ) : null}
                    </Stack>
                </Grid>
            </Grid>

            <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} fullWidth maxWidth="sm">
                <DialogTitle>Редактировать пользователя</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
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
                            label="Пароль (оставьте пустым, если не менять)"
                            type="password"
                            value={editUser?.password || ''}
                            onChange={(e) => setEditUser((prev) => ({ ...prev, password: e.target.value }))}
                            fullWidth
                        />
                        {isAdmin && editUser?.id !== user?.id ? (
                            <TextField
                                select
                                label="Роль"
                                value={editUser?.role || 'гость'}
                                onChange={(e) => setEditUser((prev) => ({ ...prev, role: e.target.value }))}
                                fullWidth
                            >
                                {roles.map((r) => (
                                    <MenuItem key={r.id} value={r.name}>
                                        {r.name} {r.is_admin ? '(админ)' : ''}
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
                                password: editUser?.password || undefined,
                                role: editUser?.role,
                            })
                        }
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={roleModal} onClose={() => setRoleModal(false)} fullWidth maxWidth="sm">
                <DialogTitle>Создать роль</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Название"
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            select
                            label="Админ"
                            value={newRoleAdmin ? 'true' : 'false'}
                            onChange={(e) => setNewRoleAdmin(e.target.value === 'true')}
                            fullWidth
                        >
                            <MenuItem value="false">Нет</MenuItem>
                            <MenuItem value="true">Да</MenuItem>
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleModal(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleCreateRole}>
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
