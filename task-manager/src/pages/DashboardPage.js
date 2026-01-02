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
import { listProjects, createProject, updateProject, listUsers, listTasks } from '../api'

export default function DashboardPage() {
    const { token, user } = useAuth()
    const isAdmin = user?.role === 'admin'
    const [projects, setProjects] = useState([])
    const [people, setPeople] = useState([])
    const [projectAssignees, setProjectAssignees] = useState({})
    const [newProject, setNewProject] = useState({ name: '', description: '', member_ids: [] })
    const [editProject, setEditProject] = useState(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [projectModal, setProjectModal] = useState(false)

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
            setProjects(pr || [])
            setPeople(staff || [])
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

    function memberIdsOf(project) {
        return (
            project?.member_ids ||
            project?.members?.map((m) => m.id) ||
            []
        ).map((id) => String(id))
    }

    function participantsFor(project) {
        const base = new Set(memberIdsOf(project))
        const fromTasks = projectAssignees[String(project.id)] || []
        fromTasks.forEach((id) => base.add(String(id)))
        return Array.from(base)
    }

    const visibleProjects = useMemo(() => {
        if (isAdmin) return projects
        return projects.filter((p) => {
            const members = participantsFor(p)
            const explicitFlag = p.is_member === true
            return explicitFlag || members.includes(String(user?.id))
        })
    }, [projects, isAdmin, user, projectAssignees])

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
            setMessage('Проект обновлен')
            setEditProject(null)
            loadData()
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
                    <Button variant="contained" onClick={() => setProjectModal(true)}>
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
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                    <Box sx={{ flex: 1, pr: 2 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            {p.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                            {p.description || 'Описание не задано'}
                                        </Typography>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', rowGap: 0.5 }}>
                                            <Chip size="small" label={`Участников: ${participants.length}`} />
                                            {participantNames.slice(0, 5).map((n) => (
                                                <Chip key={n} size="small" label={n} variant="outlined" />
                                            ))}
                                            {participantNames.length > 5 ? (
                                                <Chip size="small" label={`+${participantNames.length - 5}`} variant="outlined" />
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
                                        <Button size="small" onClick={() =>
                                            setEditProject({
                                                ...p,
                                                member_ids: memberIdsOf(p),
                                            })
                                        }>
                                            Редактировать
                                        </Button>
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

            <Dialog open={projectModal} onClose={() => setProjectModal(false)} fullWidth maxWidth="sm">
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
                                setNewProject((prev) => ({ ...prev, member_ids: e.target.value }))
                            }
                            SelectProps={{ multiple: true }}
                            fullWidth
                        >
                            {people.map((p) => (
                                <MenuItem key={p.id} value={p.id}>
                                    {p.name}
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
                                    setEditProject((prev) => ({ ...prev, member_ids: e.target.value }))
                                }
                                SelectProps={{ multiple: true }}
                                fullWidth
                            >
                                {people.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditProject(null)}>Отмена</Button>
                    <Button variant="contained" onClick={handleUpdateProject}>
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
