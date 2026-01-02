/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react'
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
    const unitLabel = timeUnits.find((u) => u.key === unit)?.label || 'РјРёРЅСѓС‚'
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
        spent_value: 0,
        spent_unit: 'minutes',
        estimated_value: 0,
        estimated_unit: 'minutes',
    })
    const [error, setError] = useState('')

    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        } catch (e) {
            setError(e.message)
        }
    }

    async function saveTask() {
        if (isGuest) return
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
                <Typography>Р вЂ”Р В°Р С–РЎР‚РЎС“Р В·Р С”Р В°...</Typography>
            </Container>
        )
    }

    const statusLabel =
        task.status_name ||
        statuses.find((s) => s.id === task.status_id)?.name ||
        'Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р Р…Р ВµР С‘Р В·Р Р†Р ВµРЎРѓРЎвЂљР ВµР Р…'

    return (
        <Container sx={{ py: 4 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Button variant="outlined" onClick={() => navigate(-1)}>
                    Р СњР В°Р В·Р В°Р Т‘
                </Button>
                <Typography variant="h5" fontWeight={800}>
                    {task.title}
                </Typography>
            </Stack>
            {task.parent_id ? (
                <Typography variant="body2" sx={{ mb: 1 }}>
                    Р В Р С•Р Т‘Р С‘РЎвЂљР ВµР В»РЎРЉРЎРѓР С”Р В°РЎРЏ Р В·Р В°Р Т‘Р В°РЎвЂЎР В°:{' '}
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
                        <Chip label={`Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ: ${statusLabel}`} size="small" />
                        <Chip
                            label={`Р СџРЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљ: ${task.priority_name}`}
                            size="small"
                        />
                        <Chip label={`Р СћР С‘Р С—: ${task.type_name || '-'}`} size="small" />
                        {task.assignee_name ? (
                            <Chip label={`Р ВРЎРѓР С—: ${task.assignee_name}`} size="small" />
                        ) : null}
                        <Chip
                            label={`Р вЂ”Р В°РЎвЂљРЎР‚Р В°РЎвЂЎР ВµР Р…Р С•: ${formatSpent(
                                task.spent_minutes || 0
                            )}`}
                            size="small"
                            color={spentColor(task.spent_minutes, task.estimated_minutes)}
                        />
                        <Chip
                            label={`Р С›РЎвЂ Р ВµР Р…Р С”Р В°: ${formatSpent(
                                task.estimated_minutes || 0
                            )}`}
                            size="small"
                            color="default"
                        />
                        <Chip
                            label={`Р вЂќР ВµР Т‘Р В»Р В°Р в„–Р Р…: ${
                                task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'
                            }`}
                            size="small"
                        />
                    </Stack>

                    <Box
                        sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}
                    >
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                            Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ
                            Р В·Р В°Р Т‘Р В°РЎвЂЎРЎС“
                        </Typography>
                        <Stack spacing={2}>
                            <TextField
                                label="Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ"
                                value={form.title}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, title: e.target.value }))
                                }
                                fullWidth
                                disabled={isGuest}
                            />
                            <TextField
                                label="Р С›Р С—Р С‘РЎРѓР В°Р Р…Р С‘Р Вµ"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                                fullWidth
                                multiline
                                minRows={3}
                                disabled={isGuest}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select
                                    label="Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ"
                                    value={form.status_id}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            status_id: Number(e.target.value),
                                        }))
                                    }
                                    sx={{ minWidth: 160 }}
                                    size="small"
                                    disabled={isGuest}
                                >
                                    {statuses.map((s) => (
                                        <MenuItem key={s.id} value={s.id}>
                                            {s.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="Р СџРЎР‚Р С‘Р С•РЎР‚Р С‘РЎвЂљР ВµРЎвЂљ"
                                    value={form.priority_id}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            priority_id: Number(e.target.value),
                                        }))
                                    }
                                    sx={{ minWidth: 140 }}
                                    size="small"
                                    disabled={isGuest}
                                >
                                    {priorities.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            {p.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="Р СћР С‘Р С—"
                                    value={form.type_id}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            type_id: Number(e.target.value) || '',
                                        }))
                                    }
                                    sx={{ minWidth: 140 }}
                                    size="small"
                                    disabled={isGuest}
                                >
                                    <MenuItem value="">-</MenuItem>
                                    {types.map((t) => (
                                        <MenuItem key={t.id} value={t.id}>
                                            {t.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select
                                    label="Р ВРЎРѓР С—Р С•Р В»Р Р…Р С‘РЎвЂљР ВµР В»РЎРЉ"
                                    value={form.assignee_id}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            assignee_id: e.target.value,
                                        }))
                                    }
                                    sx={{ minWidth: 200 }}
                                    size="small"
                                    disabled={isGuest}
                                >
                                    <MenuItem value="">
                                        Р СњР Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р С•
                                    </MenuItem>
                                    {users.map((u) => (
                                        <MenuItem key={u.id} value={u.id}>
                                            {u.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    label="Р вЂ”Р В°РЎвЂљРЎР‚Р В°РЎвЂЎР ВµР Р…Р Р…Р С•Р Вµ Р Р†РЎР‚Р ВµР СРЎРЏ"
                                    type="number"
                                    value={form.spent_value}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            spent_value: e.target.value,
                                        }))
                                    }
                                    sx={{ minWidth: 160 }}
                                    size="small"
                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                    disabled={
                                        isGuest ||
                                        !(user?.role === 'admin' || user?.id === task.assignee_id)
                                    }
                                />
                                <TextField
                                    select
                                    label="Р вЂўР Т‘Р С‘Р Р…Р С‘РЎвЂ РЎвЂ№"
                                    value={form.spent_unit}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, spent_unit: e.target.value }))
                                    }
                                    sx={{ minWidth: 160 }}
                                    size="small"
                                    disabled={
                                        isGuest ||
                                        !(user?.role === 'admin' || user?.id === task.assignee_id)
                                    }
                                >
                                    {timeUnits.map((u) => (
                                        <MenuItem key={u.key} value={u.key}>
                                            {u.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    label="Р С›РЎвЂ Р ВµР Р…Р С”Р В° Р Р†РЎР‚Р ВµР СР ВµР Р…Р С‘"
                                    type="number"
                                    value={form.estimated_value}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            estimated_value: e.target.value,
                                        }))
                                    }
                                    sx={{ minWidth: 160 }}
                                    size="small"
                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                    disabled={
                                        isGuest ||
                                        !(user?.role === 'admin' || user?.id === task.author_id)
                                    }
                                />
                                <TextField
                                    select
                                    label="Р вЂўР Т‘Р С‘Р Р…Р С‘РЎвЂ РЎвЂ№ Р С•РЎвЂ Р ВµР Р…Р С”Р С‘"
                                    value={form.estimated_unit}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            estimated_unit: e.target.value,
                                        }))
                                    }
                                    sx={{ minWidth: 160 }}
                                    size="small"
                                    disabled={
                                        isGuest ||
                                        !(user?.role === 'admin' || user?.id === task.author_id)
                                    }
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
                                sx={{ alignSelf: 'flex-start' }}
                                disabled={isGuest}
                            >
                                Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ
                                Р С‘Р В·Р СР ВµР Р…Р ВµР Р…Р С‘РЎРЏ
                            </Button>
                        </Stack>
                    </Box>

                    <Divider />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ
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
                        Р вЂќР С•РЎвЂЎР ВµРЎР‚Р Р…Р С‘Р Вµ Р В·Р В°Р Т‘Р В°РЎвЂЎР С‘
                    </Typography>
                    <Stack spacing={1}>
                        {children.length ? (
                            children.map((c) => (
                                <Link
                                    key={c.id}
                                    component={RouterLink}
                                    to={`/tasks/${c.id}`}
                                    underline="hover"
                                >
                                    {c.title}
                                </Link>
                            ))
                        ) : (
                            <Typography color="text.secondary" variant="body2">
                                Р вЂќР С•РЎвЂЎР ВµРЎР‚Р Р…Р С‘РЎвЂ¦ Р В·Р В°Р Т‘Р В°РЎвЂЎ
                                Р Р…Р ВµРЎвЂљ
                            </Typography>
                        )}
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1 }}>
                        Р С™Р С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘Р С‘
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {paginatedComments.map((c) => (
                            <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                >
                                    <Typography variant="caption" color="text.secondary">
                                        {c.author_name} Р’В·{' '}
                                        {new Date(c.created_at).toLocaleString()}
                                    </Typography>
                                    {isGuest
                                        ? null
                                        : (user?.role === 'admin' || c.author_id === user?.id) && (
                                              <Stack direction="row" spacing={1}>
                                                  {commentEditId === c.id ? (
                                                      <>
                                                          <Button
                                                              size="small"
                                                              onClick={() =>
                                                                  handleSaveComment(c.id)
                                                              }
                                                          >
                                                              Р РЋР С•РЎвЂ¦РЎР‚Р В°Р Р…Р С‘РЎвЂљРЎРЉ
                                                          </Button>
                                                          <Button
                                                              size="small"
                                                              color="inherit"
                                                              onClick={() => {
                                                                  setCommentEditId(null)
                                                                  setCommentEditBody('')
                                                              }}
                                                          >
                                                              Р С›РЎвЂљР СР ВµР Р…Р В°
                                                          </Button>
                                                      </>
                                                  ) : (
                                                      <>
                                                          <Button
                                                              size="small"
                                                              onClick={() => {
                                                                  setCommentEditId(c.id)
                                                                  setCommentEditBody(c.body)
                                                              }}
                                                          >
                                                              Р В Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ
                                                          </Button>
                                                          <Button
                                                              size="small"
                                                              color="error"
                                                              onClick={() =>
                                                                  handleDeleteComment(c.id)
                                                              }
                                                          >
                                                              Р Р€Р Т‘Р В°Р В»Р С‘РЎвЂљРЎРЉ
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
                                Р СњР ВµРЎвЂљ Р С”Р С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘Р ВµР Р†
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
                            label="Р СњР С•Р Р†РЎвЂ№Р в„– Р С”Р С•Р СР СР ВµР Р…РЎвЂљР В°РЎР‚Р С‘Р в„–"
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                        />
                        <Button type="submit" variant="contained" sx={{ mt: 1 }}>
                            Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ
                        </Button>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Typography variant="subtitle1" fontWeight={700}>
                        Р ВРЎРѓРЎвЂљР С•РЎР‚Р С‘РЎРЏ
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {paginatedHistory.map((h) => (
                            <Paper key={h.id} variant="outlined" sx={{ p: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {h.action} Р’В· {new Date(h.created_at).toLocaleString()} Р’В·{' '}
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
                                Р ВРЎРѓРЎвЂљР С•РЎР‚Р С‘РЎРЏ Р С—РЎС“РЎРѓРЎвЂљР В°
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
