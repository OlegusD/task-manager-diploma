import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
} from '@mui/material'
import { getTask, updateTask, addComment, listStatuses } from '../api'
import { useAuth } from '../AuthContext'

export default function TaskPage() {
    const { taskId } = useParams()
    const { token } = useAuth()
    const [task, setTask] = useState(null)
    const [comments, setComments] = useState([])
    const [history, setHistory] = useState([])
    const [statuses, setStatuses] = useState([])
    const [commentDraft, setCommentDraft] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) return
        loadTask()
        listStatuses(token).then(setStatuses).catch(() => {})
    }, [token, taskId])

    async function loadTask() {
        try {
            const data = await getTask(token, taskId)
            setTask(data.task)
            setComments(data.comments || [])
            setHistory(data.history || [])
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
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}
            <Paper sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Chip label={`Статус: ${task.status_name}`} size="small" />
                    <Chip label={`Приоритет: ${task.priority_name}`} size="small" />
                    <Chip label={`Тип: ${task.type_name || '—'}`} size="small" />
                    {task.assignee_name ? <Chip label={`Исп: ${task.assignee_name}`} size="small" /> : null}
                    <Chip
                        label={`Дедлайн: ${
                            task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'
                        }`}
                        size="small"
                    />
                </Stack>
                <Typography variant="subtitle1" fontWeight={700}>
                    Описание
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {task.description || 'Описание не заполнено'}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Обновить статус
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
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

                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>
                    Комментарии
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                    {comments.map((c) => (
                        <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                {c.author_name} · {new Date(c.created_at).toLocaleString()}
                            </Typography>
                            <Typography variant="body2">{c.body}</Typography>
                        </Paper>
                    ))}
                    {!comments.length ? (
                        <Typography color="text.secondary" variant="body2">
                            Нет комментариев
                        </Typography>
                    ) : null}
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

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle1" fontWeight={700}>
                    История
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                    {history.map((h) => (
                        <Paper key={h.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                {h.action} · {new Date(h.created_at).toLocaleString()} ·{' '}
                                {h.author_name || 'system'}
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
                    ) : null}
                </Stack>
            </Paper>
        </Container>
    )
}
