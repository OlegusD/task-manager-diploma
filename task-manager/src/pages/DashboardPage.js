import React, { useEffect, useState } from 'react'
import {
    Container,
    Typography,
    Button,
    Box,
    Stack,
    Card,
    CardContent,
    TextField,
    Alert,
    Grid,
    Divider,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { listProjects, createProject, listUsers, createUser } from '../api'

export default function DashboardPage() {
    const { token, user } = useAuth()
    const [projects, setProjects] = useState([])
    const [people, setPeople] = useState([])
    const [newProject, setNewProject] = useState({ name: '', description: '' })
    const [newPerson, setNewPerson] = useState({ name: '', email: '', password: '' })
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) return
        loadData()
    }, [token])

    async function loadData() {
        try {
            const [pr, staff] = await Promise.all([listProjects(token), listUsers(token)])
            setProjects(pr)
            setPeople(staff)
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleCreateProject(e) {
        e.preventDefault()
        if (!newProject.name.trim()) return
        try {
            await createProject(token, newProject)
            setNewProject({ name: '', description: '' })
            setMessage('Проект создан')
            loadData()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleCreatePerson(e) {
        e.preventDefault()
        if (!newPerson.name || !newPerson.email || !newPerson.password) return
        try {
            await createUser(token, newPerson)
            setNewPerson({ name: '', email: '', password: '' })
            setMessage('Сотрудник добавлен')
            loadData()
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <Container sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom fontWeight={800}>
                Рабочая панель
            </Typography>
            {message ? (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>
                    {message}
                </Alert>
            ) : null}
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}

            <Grid container spacing={3} alignItems="flex-start">
                <Grid item xs={12} md={7}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">Проекты</Typography>
                        {user?.role === 'admin' ? (
                            <Button size="small" onClick={() => loadData()}>
                                Обновить
                            </Button>
                        ) : null}
                    </Stack>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                        {projects.map((p) => (
                            <Card key={p.id} variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight={700}>
                                        {p.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        {p.description || 'Без описания'}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            component={RouterLink}
                                            to={`/projects/${p.id}/board`}
                                            variant="contained"
                                            size="small"
                                        >
                                            Доска
                                        </Button>
                                        <Button
                                            component={RouterLink}
                                            to={`/projects/${p.id}/list`}
                                            variant="outlined"
                                            size="small"
                                        >
                                            Список
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                        {!projects.length ? (
                            <Typography color="text.secondary">Проектов пока нет</Typography>
                        ) : null}
                    </Stack>
                </Grid>

                <Grid item xs={12} md={5}>
                    {user?.role === 'admin' ? (
                        <Box component="form" onSubmit={handleCreateProject} sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                                Новый проект
                            </Typography>
                            <TextField
                                label="Название"
                                value={newProject.name}
                                onChange={(e) =>
                                    setNewProject((prev) => ({ ...prev, name: e.target.value }))
                                }
                                size="small"
                                fullWidth
                                sx={{ mt: 1, mb: 1 }}
                            />
                            <TextField
                                label="Описание"
                                value={newProject.description}
                                onChange={(e) =>
                                    setNewProject((prev) => ({ ...prev, description: e.target.value }))
                                }
                                size="small"
                                fullWidth
                                multiline
                                rows={2}
                            />
                            <Button type="submit" variant="contained" sx={{ mt: 1 }}>
                                Создать проект
                            </Button>
                        </Box>
                    ) : null}

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="subtitle1" fontWeight={700}>
                        Команда
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {people.map((p) => (
                            <Card key={p.id} variant="outlined">
                                <CardContent sx={{ py: 1.5 }}>
                                    <Typography variant="body1" fontWeight={600}>
                                        {p.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {p.email} · {p.role}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                        {!people.length ? (
                            <Typography color="text.secondary">Сотрудников нет</Typography>
                        ) : null}
                    </Stack>

                    {user?.role === 'admin' ? (
                        <Box component="form" onSubmit={handleCreatePerson} sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                                Добавить сотрудника
                            </Typography>
                            <TextField
                                label="Имя"
                                value={newPerson.name}
                                onChange={(e) =>
                                    setNewPerson((prev) => ({ ...prev, name: e.target.value }))
                                }
                                size="small"
                                fullWidth
                                sx={{ mt: 1 }}
                            />
                            <TextField
                                label="Email"
                                value={newPerson.email}
                                onChange={(e) =>
                                    setNewPerson((prev) => ({ ...prev, email: e.target.value }))
                                }
                                size="small"
                                fullWidth
                                sx={{ mt: 1 }}
                            />
                            <TextField
                                label="Пароль"
                                value={newPerson.password}
                                onChange={(e) =>
                                    setNewPerson((prev) => ({ ...prev, password: e.target.value }))
                                }
                                size="small"
                                fullWidth
                                sx={{ mt: 1 }}
                                type="password"
                            />
                            <Button type="submit" variant="contained" sx={{ mt: 1 }}>
                                Добавить в базу
                            </Button>
                        </Box>
                    ) : null}
                </Grid>
            </Grid>
        </Container>
    )
}
