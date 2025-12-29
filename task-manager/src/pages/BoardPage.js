import React, { useEffect, useMemo, useState } from 'react'
import {
    Box,
    Container,
    Typography,
    Stack,
    Card,
    CardContent,
    Chip,
    Button,
    TextField,
    MenuItem,
    Snackbar,
    Alert,
    Divider,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
    listTasks,
    listStatuses,
    listPriorities,
    listTaskTypes,
    listUsers,
    createTask,
    updateTask,
    deleteTask,
    API_URL,
} from '../api'
import { useAuth } from '../AuthContext'

function deadlineColor(task) {
    const now = Date.now()
    const start = task.start_date ? new Date(task.start_date).getTime() : now
    const due = task.due_date ? new Date(task.due_date).getTime() : now
    const total = Math.max(due - start, 1)
    const left = Math.max(due - now, 0)
    const ratio = left / total
    if (ratio >= 0.6) return 'success.light'
    if (ratio >= 0.2) return 'warning.light'
    return 'error.light'
}

function formatDate(val) {
    return val ? new Date(val).toLocaleDateString() : '—'
}

export default function BoardPage() {
    const { projectId } = useParams()
    const { token } = useAuth()
    const [statuses, setStatuses] = useState([])
    const [priorities, setPriorities] = useState([])
    const [types, setTypes] = useState([])
    const [users, setUsers] = useState([])
    const [tasks, setTasks] = useState([])
    const [error, setError] = useState('')
    const [notif, setNotif] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        title: '',
        description: '',
        status_id: '',
        priority_id: '',
        type_id: '',
        assignee_id: '',
        parent_id: '',
        start_date: '',
        due_date: '',
    })

    useEffect(() => {
        if (!token) return
        loadRefs()
        loadTasks()
    }, [token, projectId])

    useEffect(() => {
        const socket = io(API_URL, { transports: ['websocket'] })
        socket.on('task_status_changed', (payload) => {
            setNotif(`Статус задачи ${payload.taskId} изменен`)
            loadTasks()
        })
        return () => socket.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function loadRefs() {
        try {
            const [sts, prs, tts, us] = await Promise.all([
                listStatuses(token),
                listPriorities(token),
                listTaskTypes(token),
                listUsers(token),
            ])
            setStatuses(sts)
            setPriorities(prs)
            setTypes(tts)
            setUsers(us)
            setForm((prev) => ({
                ...prev,
                status_id: sts[0]?.id ?? '',
                priority_id: prs[1]?.id ?? prs[0]?.id ?? '',
                type_id: tts[0]?.id ?? '',
                start_date: prev.start_date || new Date().toISOString().slice(0, 10),
                due_date:
                    prev.due_date ||
                    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            }))
        } catch (e) {
            setError(e.message)
        }
    }

    async function loadTasks() {
        try {
            const data = await listTasks(token, { project_id: projectId })
            setTasks(data)
        } catch (e) {
            setError(e.message)
        }
    }

    const tasksByStatus = useMemo(() => {
        const map = new Map()
        statuses.forEach((s) => map.set(s.id, []))
        tasks.forEach((t) => {
            if (!map.has(t.status_id)) map.set(t.status_id, [])
            map.get(t.status_id).push(t)
        })
        return map
    }, [tasks, statuses])

    const parentOptions = useMemo(
        () => tasks.filter((t) => !t.parent_id),
        [tasks]
    )

    function resetForm() {
        setEditingId(null)
        setForm((prev) => ({
            ...prev,
            title: '',
            description: '',
            assignee_id: '',
            parent_id: '',
            start_date: new Date().toISOString().slice(0, 10),
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.title) return
        try {
            const payload = {
                ...form,
                project_id: projectId,
                assignee_id: form.assignee_id || null,
                parent_id: form.parent_id || null,
                type_id: form.type_id ? Number(form.type_id) : null,
                status_id: form.status_id ? Number(form.status_id) : null,
                priority_id: form.priority_id ? Number(form.priority_id) : null,
            }
            if (editingId) {
                await updateTask(token, editingId, payload)
                setNotif('Задача обновлена')
            } else {
                await createTask(token, payload)
                setNotif('Задача создана')
            }
            resetForm()
            loadTasks()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDelete(id) {
        try {
            await deleteTask(token, id)
            setNotif('Задача удалена')
            loadTasks()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleStatusChange(taskId, statusId) {
        try {
            await updateTask(token, taskId, { status_id: statusId })
            loadTasks()
        } catch (e) {
            setError(e.message)
        }
    }

    function startEdit(task) {
        setEditingId(task.id)
        setForm({
            title: task.title,
            description: task.description || '',
            status_id: task.status_id,
            priority_id: task.priority_id,
            type_id: task.type_id || '',
            assignee_id: task.assignee_id || '',
            parent_id: task.parent_id || '',
            start_date: task.start_date ? task.start_date.slice(0, 10) : '',
            due_date: task.due_date ? task.due_date.slice(0, 10) : '',
        })
    }

    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }} fontWeight={800}>
                Проект · доска
            </Typography>
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}

            <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3, p: 2, borderRadius: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    {editingId ? 'Редактирование задачи' : 'Новая задача'}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                        label="Заголовок"
                        value={form.title}
                        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        required
                        fullWidth
                        size="small"
                    />
                    <TextField
                        label="Описание"
                        value={form.description}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        fullWidth
                        size="small"
                    />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        select
                        label="Статус"
                        value={form.status_id}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, status_id: Number(e.target.value) }))
                        }
                        size="small"
                        sx={{ minWidth: 180 }}
                    >
                        {statuses.map((s) => (
                            <MenuItem key={s.id} value={s.id}>
                                {s.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Приоритет"
                        value={form.priority_id}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, priority_id: Number(e.target.value) }))
                        }
                        size="small"
                        sx={{ minWidth: 160 }}
                    >
                        {priorities.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                                {p.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Тип"
                        value={form.type_id}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, type_id: Number(e.target.value) }))
                        }
                        size="small"
                        sx={{ minWidth: 140 }}
                    >
                        {types.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                                {t.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Исполнитель"
                        value={form.assignee_id}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, assignee_id: e.target.value }))
                        }
                        size="small"
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">Не выбрано</MenuItem>
                        {users.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                                {u.name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        select
                        label="Родительская задача"
                        value={form.parent_id}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, parent_id: e.target.value }))
                        }
                        size="small"
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">Нет</MenuItem>
                        {parentOptions.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                                {t.title}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Начало"
                        type="date"
                        value={form.start_date}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, start_date: e.target.value }))
                        }
                        size="small"
                        sx={{ minWidth: 160 }}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="Дедлайн"
                        type="date"
                        value={form.due_date}
                        onChange={(e) =>
                            setForm((prev) => ({ ...prev, due_date: e.target.value }))
                        }
                        size="small"
                        sx={{ minWidth: 160 }}
                        InputLabelProps={{ shrink: true }}
                    />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button type="submit" variant="contained">
                        {editingId ? 'Сохранить' : 'Создать'}
                    </Button>
                    {editingId ? (
                        <Button variant="text" onClick={resetForm}>
                            Отменить
                        </Button>
                    ) : null}
                </Stack>
            </Box>

            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ overflowX: 'auto' }}>
                {statuses
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((col) => {
                        const colTasks = tasksByStatus.get(col.id) || []
                        return (
                            <Box key={col.id} sx={{ width: 320, flexShrink: 0 }}>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                    {col.name}
                                </Typography>
                                <Box
                                    sx={{
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: 'background.paper',
                                        minHeight: 80,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                    }}
                                >
                                    {colTasks.map((t) => (
                                        <Card
                                            key={t.id}
                                            variant="outlined"
                                            sx={{
                                                mb: 1,
                                                borderLeft: `4px solid`,
                                                borderLeftColor: deadlineColor(t),
                                            }}
                                        >
                                            <CardContent sx={{ p: 1.25 }}>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {t.title}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {t.description || 'Нет описания'}
                                                </Typography>
                                                <Divider sx={{ my: 1 }} />
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    alignItems="center"
                                                    sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
                                                >
                                                    <Chip label={`Приоритет: ${t.priority_name}`} size="small" />
                                                    <Chip
                                                        label={`Тип: ${t.type_name || '—'}`}
                                                        size="small"
                                                        color="info"
                                                    />
                                                    {t.assignee_name ? (
                                                        <Chip label={`Исп: ${t.assignee_name}`} size="small" />
                                                    ) : null}
                                                </Stack>
                                                <Typography
                                                    variant="caption"
                                                    sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
                                                >
                                                    С {formatDate(t.start_date)} до {formatDate(t.due_date)}
                                                </Typography>

                                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                                    <TextField
                                                        select
                                                        size="small"
                                                        value={t.status_id}
                                                        onChange={(e) =>
                                                            handleStatusChange(t.id, Number(e.target.value))
                                                        }
                                                        sx={{ minWidth: 140 }}
                                                    >
                                                        {statuses.map((s) => (
                                                            <MenuItem key={s.id} value={s.id}>
                                                                {s.name}
                                                            </MenuItem>
                                                        ))}
                                                    </TextField>
                                                    <Button size="small" onClick={() => startEdit(t)}>
                                                        Править
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleDelete(t.id)}
                                                    >
                                                        Удалить
                                                    </Button>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {!colTasks.length ? (
                                        <Typography color="text.secondary" variant="caption">
                                            Нет задач
                                        </Typography>
                                    ) : null}
                                </Box>
                            </Box>
                        )
                    })}
            </Stack>

            <Snackbar
                open={Boolean(notif)}
                autoHideDuration={4000}
                onClose={() => setNotif('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setNotif('')} severity="info" sx={{ width: '100%' }}>
                    {notif}
                </Alert>
            </Snackbar>
        </Container>
    )
}
