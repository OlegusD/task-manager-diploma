/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react'
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Chip,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
    listProjects,
    createProject,
    updateProject,
    deleteProject,
    listUsers,
    listTasks,
    listProjectMembers,
} from '../api'

export default function DashboardPage() {
    const { token, user } = useAuth()
    const isAdmin = user?.role === 'admin'
    const isGuest = user?.role === 'гость'
    const [projects, setProjects] = useState([])
    const [people, setPeople] = useState([])
    const [projectAssignees, setProjectAssignees] = useState({})
    const [projectMembers, setProjectMembers] = useState({})
    const [newProject, setNewProject] = useState({ name: '', description: '', member_ids: [] })
    const [editProject, setEditProject] = useState(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [createOpen, setCreateOpen] = useState(false)

    useEffect(() => {
        if (!token) return
        loadData()
    }, [token])

    async function loadData() {
        try {
            const [pr, staff, taskList] = await Promise.all([
                listProjects(token),
                listUsers(token),
                listTasks(token, {}),
            ])

            const membersMap = {}
            await Promise.all(
                (pr || []).map(async (p) => {
                    try {
                        membersMap[p.id] = (await listProjectMembers(token, p.id)) || []
                    } catch {
                        membersMap[p.id] = []
                    }
                })
            )

            const projectsWithMembers = (pr || []).map((p) => ({
                ...p,
                member_ids: (membersMap[p.id] || []).map((m) => m.id),
            }))

            setProjects(projectsWithMembers)
            setPeople(staff || [])
            setProjectMembers(membersMap)

            const byProject = {}
            taskList?.forEach((t) => {
                if (!t.project_id || !t.assignee_id) return
                const key = String(t.project_id)
                if (!byProject[key]) byProject[key] = new Set()
                byProject[key].add(t.assignee_id)
            })
            const normalized = {}
            Object.entries(byProject).forEach(([k, set]) => {
                normalized[k] = Array.from(set)
            })
            setProjectAssignees(normalized)
        } catch (e) {
            setError(e.message)
        }
    }

    function participantsFor(project) {
        const base = new Set((projectMembers[project.id] || []).map((m) => String(m.id)))
        const fromTasks = projectAssignees[String(project.id)] || []
        fromTasks.forEach((id) => base.add(String(id)))
        return Array.from(base)
    }

    const visibleProjects = useMemo(() => {
        if (isAdmin || isGuest) return projects
        return projects.filter((p) => {
            const members = participantsFor(p)
            const explicitFlag = p.is_member === true
            return explicitFlag || members.includes(String(user?.id))
        })
    }, [projects, isAdmin, isGuest, user, projectAssignees, projectMembers])

    const memberOptions = useMemo(
        () => people.filter((p) => (p.role || '').toLowerCase() !== 'гость'),
        [people]
    )

    async function handleCreateProject(e) {
        e?.preventDefault()
        if (!newProject.name.trim()) return setError('Введите название проекта')
        try {
            await createProject(token, {
                ...newProject,
                member_ids: newProject.member_ids || [],
            })
            setNewProject({ name: '', description: '', member_ids: [] })
            setMessage('Проект создан')
            setCreateOpen(false)
            loadData()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleUpdateProject() {
        if (!editProject || !editProject.name.trim()) {
            setError('Введите название проекта')
            return
        }
        try {
            await updateProject(token, editProject.id, {
                name: editProject.name,
                description: editProject.description,
                member_ids: editProject.member_ids || [],
            })
            setMessage('Проект обновлён')
            setEditProject(null)
            loadData()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDeleteProject(id) {
        if (!window.confirm('Удалить проект и все его задачи?')) return
        try {
            await deleteProject(token, id)
            setMessage('Проект удалён')
            loadData()
        } catch (e) {
            setError(e.message)
        }
    }

    async function openEdit(project) {
        try {
            const members = await listProjectMembers(token, project.id)
            setProjectMembers((prev) => ({ ...prev, [project.id]: members || [] }))
            setEditProject({
                ...project,
                member_ids: (members || []).map((m) => m.id),
            })
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <Container sx={{ py: 6 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>
                    Проекты
                </Typography>
                {isAdmin ? (
                    <Button variant="contained" onClick={() => setCreateOpen(true)}>
                        Создать проект
                    </Button>
                ) : null}
            </Stack>

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

            <Stack spacing={2}>
                {visibleProjects.map((p) => {
                    const participants = participantsFor(p)
                    const participantNames = participants
                        .map((id) => people.find((u) => String(u.id) === String(id))?.name)
                        .filter(Boolean)
                    return (
                        <Card key={p.id} variant="outlined">
                            <CardContent>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="flex-start"
                                    spacing={2}
                                >
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            {p.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            {p.description || 'Описание не задано'}
                                        </Typography>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            sx={{ mb: 1, flexWrap: 'wrap', rowGap: 0.5 }}
                                        >
                                            <Chip size="small" label={`Участников: ${participants.length}`} />
                                            {participantNames.slice(0, 5).map((n) => (
                                                <Chip key={n} size="small" label={n} variant="outlined" />
                                            ))}
                                            {participantNames.length > 5 ? (
                                                <Chip
                                                    size="small"
                                                    label={`+${participantNames.length - 5}`}
                                                    variant="outlined"
                                                />
                                            ) : null}
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
                                    </Box>
                                    {isAdmin ? (
                                        <Stack spacing={1} alignItems="flex-end">
                                            <Button size="small" color="error" onClick={() => handleDeleteProject(p.id)}>
                                                Удалить проект
                                            </Button>
                                            <Button size="small" variant="outlined" onClick={() => openEdit(p)}>
                                                Редактировать
                                            </Button>
                                        </Stack>
                                    ) : null}
                                </Stack>
                            </CardContent>
                        </Card>
                    )
                })}
                {!visibleProjects.length ? (
                    <Typography color="text.secondary">Нет доступных проектов</Typography>
                ) : null}
            </Stack>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Создать проект</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
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
                            multiline
                            minRows={2}
                            fullWidth
                        />
                        <TextField
                            select
                            label="Участники"
                            value={newProject.member_ids}
                            onChange={(e) =>
                                setNewProject((prev) => ({
                                    ...prev,
                                    member_ids: Array.isArray(e.target.value) ? e.target.value : [],
                                }))
                            }
                            fullWidth
                            SelectProps={{ multiple: true }}
                        >
                            {memberOptions.map((u) => (
                                <MenuItem key={u.id} value={u.id}>
                                    {u.name} ({u.role})
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
                    <Button onClick={handleCreateProject} variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editProject)} onClose={() => setEditProject(null)} fullWidth maxWidth="sm">
                <DialogTitle>Редактировать проект</DialogTitle>
                <DialogContent>
                    {editProject ? (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                label="Название"
                                value={editProject.name}
                                onChange={(e) =>
                                    setEditProject((prev) => ({ ...prev, name: e.target.value }))
                                }
                                fullWidth
                            />
                            <TextField
                                label="Описание"
                                value={editProject.description || ''}
                                onChange={(e) =>
                                    setEditProject((prev) => ({ ...prev, description: e.target.value }))
                                }
                                multiline
                                minRows={2}
                                fullWidth
                            />
                            <TextField
                                select
                                label="Участники"
                                value={editProject.member_ids || []}
                                onChange={(e) =>
                                    setEditProject((prev) => ({
                                        ...prev,
                                        member_ids: Array.isArray(e.target.value) ? e.target.value : [],
                                    }))
                                }
                                fullWidth
                                SelectProps={{ multiple: true }}
                            >
                                {memberOptions.map((u) => (
                                    <MenuItem key={u.id} value={u.id}>
                                        {u.name} ({u.role})
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditProject(null)}>Отмена</Button>
                    <Button onClick={handleUpdateProject} variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
