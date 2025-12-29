import React, { useEffect, useState } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
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
} from '../api'
import { useAuth } from '../AuthContext'

export default function TaskPage() {
    const { taskId } = useParams()
    const { token, user } = useAuth()
    const [task, setTask] = useState(null)
    const [comments, setComments] = useState([])
    const [history, setHistory] = useState([])
    const [children, setChildren] = useState([])
    const [statuses, setStatuses] = useState([])
    const [priorities, setPriorities] = useState([])
    const [types, setTypes] = useState([])
    const [users, setUsers] = useState([])
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
    })
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) return
        loadTask()
        Promise.all([
            listStatuses(token),
            listPriorities(token),
            listTaskTypes(token),
            listUsers(token),
        ])
            .then(([sts, prs, tts, us]) => {
                setStatuses(sts)
                setPriorities(prs)
                setTypes(tts)
                setUsers(us)
            })
            .catch(() => {})
    }, [token, taskId])

    async function loadTask() {
        try {
            const data = await getTask(token, taskId)
            setTask(data.task)
            setComments(data.comments || [])
            setHistory(data.history || [])
            setChildren(data.children || [])
            setCommentPage(1)
            setHistoryPage(1)
            setForm({
                title: data.task.title,
                description: data.task.description || '',
                status_id: data.task.status_id,
                priority_id: data.task.priority_id,
                type_id: data.task.type_id || '',
                assignee_id: data.task.assignee_id || '',
            })
        } catch (e) {
            setError(e.message)
        }
    }

    async function saveTask() {
        try {
            await updateTask(token, taskId, {
                title: form.title,
                description: form.description,
                status_id: form.status_id,
                priority_id: form.priority_id,
                type_id: form.type_id || null,
                assignee_id: form.assignee_id || null,
            })
            await loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleStatusChange(statusId) {
        try {
            await updateTask(token, taskId, { status_id: statusId })
            loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleAddComment(e) {
        e.preventDefault()
        if (!commentDraft.trim()) return
        try {
            await addComment(token, taskId, commentDraft.trim())
            setCommentDraft('')
            loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleSaveComment(id) {
        if (!commentEditBody.trim()) return
        try {
            await updateComment(token, taskId, id, commentEditBody.trim())
            setCommentEditId(null)
            setCommentEditBody('')
            loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDeleteComment(id) {
        try {
            await deleteCommentApi(token, taskId, id)
            loadTask()
        } catch (e) {
            setError(e.message)
        }
    }

    const paginatedComments = comments.slice((commentPage - 1) * pageSize, commentPage * pageSize)
    const paginatedHistory = history.slice((historyPage - 1) * pageSize, historyPage * pageSize)

    if (!task) {
        return (
            <Container sx={{ py: 4 }}>
                <Typography>Загрузка...</Typography>
            </Container>
        )
    }

    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }} fontWeight={800}>
                {task.title}
            </Typography>
            {task.parent_id ? (
                <Typography variant="body2" sx={{ mb: 1 }}>
                    Родительская задача:{' '}
                    <Link component={RouterLink} to={`/tasks/${task.parent_id}`} underline="hover">
                        {task.parent_title || task.parent_id}
                    </Link>
                </Typography>
            ) : null}
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}
            <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                        <Chip label={`Статус: ${task.status_name}`} size="small" />
                        <Chip label={`Приоритет: ${task.priority_name}`} size="small" />
                        <Chip label={`Тип: ${task.type_name || '—'}`} size="small" />
                        {task.assignee_name ? (
                            <Chip label={`Исп: ${task.assignee_name}`} size="small" />
                        ) : null}
                        <Chip
                            label={`Дедлайн: ${
                                task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'
                            }`}
                            size="small"
                        />
                    </Stack>

                    <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                            Редактировать задачу
                        </Typography>
                        <Stack spacing={2}>
                            <TextField
                                label="Название"
                                value={form.title}
                                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                fullWidth
                            />
                            <TextField
                                label="Описание"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                                fullWidth
                                multiline
                                minRows={3}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select
                                    label="Статус"
                                    value={form.status_id}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, status_id: Number(e.target.value) }))
                                    }
                                    sx={{ minWidth: 160 }}
                                    size="small"
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
                                    sx={{ minWidth: 140 }}
                                    size="small"
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
                                        setForm((prev) => ({ ...prev, type_id: Number(e.target.value) || '' }))
                                    }
                                    sx={{ minWidth: 140 }}
                                    size="small"
                                >
                                    <MenuItem value="">—</MenuItem>
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
                                    sx={{ minWidth: 200 }}
                                    size="small"
                                >
                                    <MenuItem value="">Не выбрано</MenuItem>
                                    {users.map((u) => (
                                        <MenuItem key={u.id} value={u.id}>
                                            {u.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>
                            <Button variant="contained" onClick={saveTask} sx={{ alignSelf: 'flex-start' }}>
                                Сохранить изменения
                            </Button>
                        </Stack>
                    </Box>

                    <Divider />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Обновить статус
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                        {statuses.map((s) => (
                            <Button
                                key={s.id}
                                variant={s.id === task.status_id ? 'contained' : 'outlined'}
                                size="small"
                                onClick={() => handleStatusChange(s.id)}
                            >
                                {s.name}
                            </Button>
                        ))}
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={700}>
                        Дочерние задачи
                    </Typography>
                    <Stack spacing={1}>
                        {children.length ? (
                            children.map((c) => (
                                <Link key={c.id} component={RouterLink} to={`/tasks/${c.id}`} underline="hover">
                                    {c.title}
                                </Link>
                            ))
                        ) : (
                            <Typography color="text.secondary" variant="body2">
                                Дочерних задач нет
                            </Typography>
                        )}
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>
                        Комментарии
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {paginatedComments.map((c) => (
                            <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="caption" color="text.secondary">
                                        {c.author_name} · {new Date(c.created_at).toLocaleString()}
                                    </Typography>
                                    {(user?.role === 'admin' || c.author_id === user?.id) && (
                                        <Stack direction="row" spacing={1}>
                                            {commentEditId === c.id ? (
                                                <>
                                                    <Button size="small" onClick={() => handleSaveComment(c.id)}>
                                                        Сохранить
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        color="inherit"
                                                        onClick={() => {
                                                            setCommentEditId(null)
                                                            setCommentEditBody('')
                                                        }}
                                                    >
                                                        Отмена
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="small" onClick={() => {
                                                        setCommentEditId(c.id)
                                                        setCommentEditBody(c.body)
                                                    }}>
                                                        Редактировать
                                                    </Button>
                                                    <Button size="small" color="error" onClick={() => handleDeleteComment(c.id)}>
                                                        Удалить
                                                    </Button>
                                                </>
                                            )}
                                        </Stack>
                                    )}
                                </Stack>
                                {commentEditId === c.id ? (
                                    <TextField
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        sx={{ mt: 1 }}
                                        value={commentEditBody}
                                        onChange={(e) => setCommentEditBody(e.target.value)}
                                    />
                                ) : (
                                    <Typography variant="body2">{c.body}</Typography>
                                )}
                            </Paper>
                        ))}
                        {!comments.length ? (
                            <Typography color="text.secondary" variant="body2">
                                Нет комментариев
                            </Typography>
                        ) : (
                            <Pagination
                                size="small"
                                page={commentPage}
                                count={Math.max(1, Math.ceil(comments.length / pageSize))}
                                onChange={(_, page) => setCommentPage(page)}
                            />
                        )}
                    </Stack>

                    <Box component="form" onSubmit={handleAddComment} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            label="Новый комментарий"
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                        />
                        <Button type="submit" variant="contained" sx={{ mt: 1 }}>
                            Добавить
                        </Button>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Typography variant="subtitle1" fontWeight={700}>
                        История
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {paginatedHistory.map((h) => (
                            <Paper key={h.id} variant="outlined" sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {h.action} · {new Date(h.created_at).toLocaleString()} · {h.author_name || 'system'}
                                </Typography>
                                {h.new_value ? (
                                    <Typography variant="body2">
                                        {typeof h.new_value === 'object'
                                            ? JSON.stringify(h.new_value)
                                            : String(h.new_value)}
                                    </Typography>
                                ) : null}
                            </Paper>
                        ))}
                        {!history.length ? (
                            <Typography color="text.secondary" variant="body2">
                                История пуста
                            </Typography>
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
        </Container>
    )
}
