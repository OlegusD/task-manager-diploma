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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Chip,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { listProjects, createProject, listUsers } from '../api'

export default function DashboardPage() {
    const { token, user } = useAuth()
    const [projects, setProjects] = useState([])
    const [people, setPeople] = useState([])
    const [newProject, setNewProject] = useState({ name: '', description: '', member_ids: [] })
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [projectModal, setProjectModal] = useState(false)

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
        e?.preventDefault()
        if (!newProject.name.trim()) return setError('Введите название проекта')
        try {
            await createProject(token, newProject)
            setNewProject({ name: '', description: '', member_ids: [] })
            setMessage('Проект создан')
            setProjectModal(false)
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
                            <Button
                                size="small"
                                variant="contained"
                                onClick={() => setProjectModal(true)}
                                sx={{ px: 1.75, py: 0.6, fontSize: 14 }}
                            >
                                Создать проект
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
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <Chip size="small" label={`Участников: ${p.members_count ?? 0}`} />
                                    </Stack>
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
                    <Typography variant="subtitle1" fontWeight={700}>
                        Сотрудники
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {people.map((p) => (
                            <Card key={p.id} variant="outlined">
                                <CardContent sx={{ py: 1.5 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box>
                                            <Typography variant="body1" fontWeight={600}>
                                                {p.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {p.email} · {p.role}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                        {!people.length ? (
                            <Typography color="text.secondary">Сотрудников нет</Typography>
                        ) : null}
                    </Stack>

                    <Button
                        component={RouterLink}
                        to="/team"
                        variant="outlined"
                        fullWidth
                        sx={{ mt: 2 }}
                    >
                        Управление сотрудниками
                    </Button>
                </Grid>
            </Grid>

            <Dialog open={projectModal} fullWidth maxWidth="sm" onClose={() => setProjectModal(false)}>
                <DialogTitle>Создать проект</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField
                            label="Название"
                            value={newProject.name}
                            onChange={(e) => setNewProject((prev) => ({ ...prev, name: e.target.value }))}
                            fullWidth
                        />
                        <TextField
                            label="Описание"
                            value={newProject.description}
                            onChange={(e) => setNewProject((prev) => ({ ...prev, description: e.target.value }))}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                        <TextField
                            select
                            label="Участники"
                            SelectProps={{ multiple: true }}
                            value={newProject.member_ids}
                            onChange={(e) =>
                                setNewProject((prev) => ({
                                    ...prev,
                                    member_ids: Array.isArray(e.target.value) ? e.target.value : [],
                                }))
                            }
                            fullWidth
                            size="small"
                        >
                            {people.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                    {p.name} ({p.email})
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setProjectModal(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleCreateProject}>
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
