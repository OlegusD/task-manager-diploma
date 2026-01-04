/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import {
    Container,
    Typography,
    Paper,
    Stack,
    Chip,
    Divider,
    TextField,
    Button,
    Alert,
    Box,
    Link,
    MenuItem,
    Pagination,
} from '@mui/material'
import {
    getTask,
    updateTask,
    addComment,
    listStatuses,
    listPriorities,
    listTaskTypes,
    listUsers,
    updateComment,
    deleteCommentApi,
    listProjectMembers,
} from '../api'
import { useAuth } from '../AuthContext'

const timeUnits = [
    { key: 'minutes', label: 'минут', factor: 1 },
    { key: 'hours', label: 'часов', factor: 60 },
    { key: 'days', label: 'дней', factor: 60 * 24 },
    { key: 'months', label: 'месяцев', factor: 60 * 24 * 30 },
    { key: 'years', label: 'лет', factor: 60 * 24 * 365 },
]

function toMinutes(value, unitKey) {
    const unit = timeUnits.find((u) => u.key === unitKey) || timeUnits[0]
    const val = Number(value) || 0
    return Math.max(0, Math.round(val * unit.factor))
}

function fromMinutes(minutes = 0) {
    const mins = Number(minutes) || 0
    if (!mins) return { value: 0, unit: 'minutes' }
    const ordered = [...timeUnits].sort((a, b) => b.factor - a.factor)
    for (const u of ordered) {
        if (mins % u.factor === 0 && mins / u.factor >= 1) {
            return { value: mins / u.factor, unit: u.key }
        }
    }
    return { value: mins, unit: 'minutes' }
}

function formatSpent(minutes = 0) {
    const { value, unit } = fromMinutes(minutes)
    const unitLabel = timeUnits.find((u) => u.key === unit)?.label || 'минут'
    return `${value} ${unitLabel}`
}

function spentColor(spent, estimated) {
    const est = Number(estimated) || 0
    const sp = Number(spent) || 0
    if (!est) return 'default'
    const ratio = sp / est
    if (ratio <= 1) return 'success'
    if (ratio <= 1.2) return 'warning'
    return 'error'
}

export default function TaskPage() {
    const { taskId } = useParams()
    const navigate = useNavigate()
    const { token, user } = useAuth()
    const isGuest = user?.role === 'гость'
    const isAdmin = user?.role === 'admin'

    const [task, setTask] = useState(null)
    const [comments, setComments] = useState([])
    const [history, setHistory] = useState([])
    const [children, setChildren] = useState([])
    const [statuses, setStatuses] = useState([])
    const [priorities, setPriorities] = useState([])
    const [types, setTypes] = useState([])
    const [users, setUsers] = useState([])
    const [projectMembers, setProjectMembers] = useState([])
    const [commentDraft, setCommentDraft] = useState('')
    const [commentPage, setCommentPage] = useState(1)
    const [historyPage, setHistoryPage] = useState(1)
    const pageSize = 5
    const [commentEditId, setCommentEditId] = useState(null)
    const [commentEditBody, setCommentEditBody] = useState('')
    const [form, setForm] = useState({
        title: '',
        description: '',
        status_id: '',
        priority_id: '',
        type_id: '',
        assignee_id: '',
        spent_value: 0,
        spent_unit: 'minutes',
        estimated_value: 0,
        estimated_unit: 'minutes',
    })
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) return
        loadTask()
    }, [token, taskId])

    async function loadRefs(projectId) {
        try {
            const [sts, prs, tts, us, members] = await Promise.all([
                listStatuses(token, projectId ? { project_id: projectId } : undefined),
                listPriorities(token),
                listTaskTypes(token),
                listUsers(token),
                projectId ? listProjectMembers(token, projectId) : Promise.resolve([]),
            ])
            const unique = []
            const seen = new Set()
            ;(sts || []).forEach((s) => {
                const key = `${s.project_id || 'null'}|${(s.name || '').toLowerCase()}`
                if (seen.has(key)) return
                seen.add(key)
                unique.push(s)
            })
            setStatuses(unique)
            setPriorities(prs || [])
            setTypes(tts || [])
            setUsers(us || [])
            setProjectMembers(members || [])
        } catch (e) {
            setError(e.message)
        }
    }

    const uniqueStatuses = useMemo(() => {
        const map = new Map()
        statuses.forEach((s) => {
            const key = (s.name || '').trim().toLowerCase()
            const existing = map.get(key)
            if (!existing || (task && task.status_id === s.id)) {
                map.set(key, s)
            }
        })
        return Array.from(map.values())
    }, [statuses, task])

    const statusMap = useMemo(() => new Map(uniqueStatuses.map((s) => [s.id, s.name])), [uniqueStatuses])
    const availableAssignees = useMemo(
        () => projectMembers.filter((m) => (m.role || '').toLowerCase() !== 'гость'),
        [projectMembers]
    )

    async function loadTask() {
        try {
            const data = await getTask(token, taskId)
            setTask(data.task)
            setComments(data.comments || [])
            setHistory(data.history || [])
            setChildren(data.children || [])
            setCommentPage(1)
            setHistoryPage(1)
            const parsedSpent = fromMinutes(data.task.spent_minutes || 0)
            const parsedEstimated = fromMinutes(data.task.estimated_minutes || 0)
            setForm({
                title: data.task.title,
                description: data.task.description || '',
                status_id: data.task.status_id,
                priority_id: data.task.priority_id,
                type_id: data.task.type_id || '',
                assignee_id: data.task.assignee_id || '',
                spent_value: parsedSpent.value,
                spent_unit: parsedSpent.unit,
                estimated_value: parsedEstimated.value,
                estimated_unit: parsedEstimated.unit,
            })
            await loadRefs(data.task.project_id)
        } catch (e) {
            setError(e.message)
        }
    }

    const canEdit = task ? isAdmin || task.assignee_id === user?.id : false

    async function saveTask() {
        if (isGuest || !canEdit) return
        try {
            await updateTask(token, taskId, {
                title: form.title,
                description: form.description,
                status_id: form.status_id,
                priority_id: form.priority_id,
                type_id: form.type_id || null,
                assignee_id: form.assignee_id || null,
                spent_minutes: toMinutes(form.spent_value, form.spent_unit),
                estimated_minutes: toMinutes(form.estimated_value, form.estimated_unit),
            })
            await loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleStatusChange(statusId) {
        if (!canEdit || isGuest) return
        try {
            await updateTask(token, taskId, {
                status_id: statusId,
            })
            await loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleAddComment(e) {
        e.preventDefault()
        if (!commentDraft.trim() || isGuest || !canEdit) return
        try {
            const res = await addComment(token, taskId, commentDraft.trim())
            setComments(res.comments || [])
            setCommentDraft('')
            setCommentPage(1)
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleSaveComment(id) {
        if (!commentEditBody.trim() || isGuest || !canEdit) return
        try {
            const res = await updateComment(token, id, commentEditBody.trim())
            setComments(res.comments || comments)
            setCommentEditId(null)
            setCommentEditBody('')
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDeleteComment(id) {
        if (isGuest || !canEdit) return
        try {
            const res = await deleteCommentApi(token, id)
            setComments(res.comments || comments.filter((c) => c.id !== id))
        } catch (e) {
            setError(e.message)
        }
    }

    const paginatedComments = useMemo(() => {
        const start = (commentPage - 1) * pageSize
        return comments.slice(start, start + pageSize)
    }, [comments, commentPage])

    const paginatedHistory = useMemo(() => {
        const start = (historyPage - 1) * pageSize
        return history.slice(start, start + pageSize)
    }, [history, historyPage])

    const statusLabel = task ? statusMap.get(task.status_id) || '-' : '-'

    return (
        <Container sx={{ py: 4 }}>
            <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
                Назад
            </Button>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}

            {task ? (
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between">
                            <Typography variant="h5" fontWeight={800}>
                                {task.title}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap rowGap={0.5}>
                                <Chip label={`Статус: ${statusLabel}`} size="small" />
                                <Chip label={`Приоритет: ${task.priority_name}`} size="small" />
                                <Chip label={`Тип: ${task.type_name || '-'}`} size="small" />
                                {task.assignee_name ? (
                                    <Chip label={`Исп.: ${task.assignee_name}`} size="small" />
                                ) : null}
                                <Chip
                                    label={`Затрачено: ${formatSpent(task.spent_minutes)}`}
                                    size="small"
                                    color={spentColor(task.spent_minutes, task.estimated_minutes)}
                                />
                                <Chip label={`Оценка: ${formatSpent(task.estimated_minutes)}`} size="small" />
                                {task.due_date ? (
                                    <Chip
                                        label={`Дедлайн: ${new Date(task.due_date).toLocaleDateString()}`}
                                        size="small"
                                    />
                                ) : null}
                            </Stack>
                        </Stack>

                        <Stack spacing={2}>
                            <TextField
                                label="Название"
                                value={form.title}
                                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                fullWidth
                                disabled={!canEdit || isGuest}
                            />
                            <TextField
                                label="Описание"
                                value={form.description}
                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                fullWidth
                                multiline
                                minRows={3}
                                disabled={!canEdit || isGuest}
                            />
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                                <TextField
                                    select
                                    label="Статус"
                                    value={form.status_id}
                                    onChange={(e) => setForm((prev) => ({ ...prev, status_id: e.target.value }))}
                                    fullWidth
                                    disabled={!canEdit || isGuest}
                                >
                                    {uniqueStatuses.map((s) => (
                                        <MenuItem key={s.id} value={s.id}>
                                            {s.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="Приоритет"
                                    value={form.priority_id}
                                    onChange={(e) => setForm((prev) => ({ ...prev, priority_id: e.target.value }))}
                                    fullWidth
                                    disabled={!canEdit || isGuest}
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
                                    onChange={(e) => setForm((prev) => ({ ...prev, type_id: e.target.value }))}
                                    fullWidth
                                    disabled={!canEdit || isGuest}
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
                                    onChange={(e) => setForm((prev) => ({ ...prev, assignee_id: e.target.value }))}
                                    fullWidth
                                    disabled={!canEdit || isGuest}
                                >
                                    <MenuItem value="">Не назначен</MenuItem>
                                    {availableAssignees.map((u) => (
                                        <MenuItem key={u.id} value={u.id}>
                                            {u.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                                <TextField
                                    label="Затраченное время"
                                    type="number"
                                    value={form.spent_value}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, spent_value: Number(e.target.value) }))
                                    }
                                    fullWidth
                                    disabled={!canEdit || isGuest}
                                />
                                <TextField
                                    select
                                    label="Единицы"
                                    value={form.spent_unit}
                                    onChange={(e) => setForm((prev) => ({ ...prev, spent_unit: e.target.value }))}
                                    fullWidth
                                    disabled={!canEdit || isGuest}
                                >
                                    {timeUnits.map((u) => (
                                        <MenuItem key={u.key} value={u.key}>
                                            {u.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    label="Оценка времени"
                                    type="number"
                                    value={form.estimated_value}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            estimated_value: Number(e.target.value),
                                        }))
                                    }
                                    fullWidth
                                    disabled={!isAdmin || isGuest}
                                />
                                <TextField
                                    select
                                    label="Единицы оценки"
                                    value={form.estimated_unit}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, estimated_unit: e.target.value }))
                                    }
                                    fullWidth
                                    disabled={!isAdmin || isGuest}
                                >
                                    {timeUnits.map((u) => (
                                        <MenuItem key={u.key} value={u.key}>
                                            {u.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <Button
                                variant="contained"
                                onClick={saveTask}
                                disabled={isGuest || !canEdit}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                Сохранить изменения
                            </Button>
                        </Stack>

                        <Divider />
                        <Typography variant="subtitle1" fontWeight={700}>
                            Обновить статус
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap rowGap={1}>
                            {uniqueStatuses.map((s) => (
                                <Button
                                    key={s.id}
                                    size="small"
                                    variant={s.id === form.status_id ? 'contained' : 'outlined'}
                                    onClick={() => handleStatusChange(s.id)}
                                    disabled={isGuest || !canEdit}
                                >
                                    {s.name}
                                </Button>
                            ))}
                        </Stack>

                        <Divider />
                        {task.parent_id ? (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle1" fontWeight={700}>
                                    Родительская задача
                                </Typography>
                                <Link component={RouterLink} to={`/tasks/${task.parent_id}`} underline="hover">
                                    {task.parent_title || task.parent_id}
                                </Link>
                            </Stack>
                        ) : null}

                        <Typography variant="subtitle1" fontWeight={700}>
                            Дочерние задачи
                        </Typography>
                        {children.length ? (
                            <Stack spacing={1}>
                                {children.map((c) => (
                                    <Link key={c.id} component={RouterLink} to={`/tasks/${c.id}`} underline="hover">
                                        {c.title}
                                    </Link>
                                ))}
                            </Stack>
                        ) : (
                            <Typography color="text.secondary">Дочерних задач нет</Typography>
                        )}

                        <Divider />
                        <Typography variant="subtitle1" fontWeight={700}>
                            Комментарии
                        </Typography>
                        <Stack spacing={1}>
                            {paginatedComments.map((c) => (
                                <Paper key={c.id} variant="outlined" sx={{ p: 1 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" color="text.secondary">
                                            {c.author_name || 'Без имени'} ·{' '}
                                            {new Date(c.created_at).toLocaleString()}
                                        </Typography>
                                        {canEdit && !isGuest ? (
                                            <Stack direction="row" spacing={1}>
                                                <Button
                                                    size="small"
                                                    onClick={() => {
                                                        setCommentEditId(c.id)
                                                        setCommentEditBody(c.body)
                                                    }}
                                                >
                                                    Править
                                                </Button>
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteComment(c.id)}
                                                >
                                                    Удалить
                                                </Button>
                                            </Stack>
                                        ) : null}
                                    </Stack>
                                    {commentEditId === c.id ? (
                                        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                value={commentEditBody}
                                                onChange={(e) => setCommentEditBody(e.target.value)}
                                            />
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => handleSaveComment(c.id)}
                                            >
                                                Сохранить
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => setCommentEditId(null)}
                                            >
                                                Отмена
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {c.body}
                                        </Typography>
                                    )}
                                </Paper>
                            ))}
                            {!comments.length ? (
                                <Typography color="text.secondary">Нет комментариев</Typography>
                            ) : (
                                <Pagination
                                    size="small"
                                    page={commentPage}
                                    count={Math.max(1, Math.ceil(comments.length / pageSize))}
                                    onChange={(_, page) => setCommentPage(page)}
                                />
                            )}
                            <Box
                                component="form"
                                onSubmit={handleAddComment}
                                sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                            >
                                <TextField
                                    size="small"
                                    fullWidth
                                    label="Новый комментарий"
                                    value={commentDraft}
                                    onChange={(e) => setCommentDraft(e.target.value)}
                                    disabled={isGuest || !canEdit}
                                />
                                <Button type="submit" variant="outlined" disabled={isGuest || !canEdit}>
                                    Добавить
                                </Button>
                            </Box>
                        </Stack>

                        <Divider />
                        <Typography variant="subtitle1" fontWeight={700}>
                            История
                        </Typography>
                        <Stack spacing={1}>
                            {paginatedHistory.map((h) => (
                                <Paper key={h.id} variant="outlined" sx={{ p: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {h.action} · {new Date(h.created_at).toLocaleString()} ·{' '}
                                        {h.author_name || 'system'}
                                    </Typography>
                                    {h.new_value ? (
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {JSON.stringify(h.new_value, null, 2)}
                                        </Typography>
                                    ) : null}
                                </Paper>
                            ))}
                            {!history.length ? (
                                <Typography color="text.secondary">История пуста</Typography>
                            ) : (
                                <Pagination
                                    size="small"
                                    page={historyPage}
                                    count={Math.max(1, Math.ceil(history.length / pageSize))}
                                    onChange={(_, page) => setHistoryPage(page)}
                                />
                            )}
                        </Stack>
                    </Stack>
                </Paper>
            ) : (
                <Typography>Загрузка...</Typography>
            )}
        </Container>
    )
}
