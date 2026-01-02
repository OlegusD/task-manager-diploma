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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Pagination,
} from '@mui/material'
import { useParams, Link as RouterLink } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
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
    getTask,
    createStatus,
    updateStatus,
    deleteStatus,
    addComment,
    updateComment,
    deleteCommentApi,
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

function shiftToInputDate(val) {
    if (!val) return ''
    const d = new Date(val)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 10)
}

function toApiDate(val) {
    return val ? `${val}T12:00:00Z` : null
}

function formatDate(val) {
    if (!val) return '-'
    return shiftToInputDate(val)
}

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

export default function BoardPage() {
    const { projectId } = useParams()
    const { token, user } = useAuth()
    const isAdmin = user?.role === 'admin'
    const isGuest = user?.role === 'гость'
    const [statuses, setStatuses] = useState([])
    const [priorities, setPriorities] = useState([])
    const [types, setTypes] = useState([])
    const [users, setUsers] = useState([])
    const [tasks, setTasks] = useState([])
    const [error, setError] = useState('')
    const [notif, setNotif] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [columnDraft, setColumnDraft] = useState('')
    const [filters, setFilters] = useState({
        q: '',
        assignee_id: '',
        priority_id: '',
        sort: '',
    })
    const [modalOpen, setModalOpen] = useState(false)
    const [modalTask, setModalTask] = useState(null)
    const [taskModalOpen, setTaskModalOpen] = useState(false)
    const [modalComment, setModalComment] = useState('')
    const [modalCommentsPage, setModalCommentsPage] = useState(1)
    const [modalHistoryPage, setModalHistoryPage] = useState(1)
    const [modalEditCommentId, setModalEditCommentId] = useState(null)
    const [modalEditCommentBody, setModalEditCommentBody] = useState('')
    const [modalSpentValue, setModalSpentValue] = useState(0)
    const [modalSpentUnit, setModalSpentUnit] = useState('minutes')
    const [modalEstimateValue, setModalEstimateValue] = useState(0)
    const [modalEstimateUnit, setModalEstimateUnit] = useState('minutes')
    const [trashTasks, setTrashTasks] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('trashTasks') || '[]')
        } catch {
            return []
        }
    })
    const [deletedStatusIds, setDeletedStatusIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('deletedStatuses') || '[]')
        } catch {
            return []
        }
    })
    const pageSize = 5
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
        spent_value: 0,
        spent_unit: 'minutes',
        estimated_value: 0,
        estimated_unit: 'minutes',
        author_id: '',
    })

    useEffect(() => {
        if (!token) return
        loadRefs()
        loadTasks()
    }, [token, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const socket = io(API_URL, { transports: ['websocket'] })
        socket.on('task_status_changed', (payload) => {
            setNotif(`Статус задачи ${payload.taskId} изменён`)
            loadTasks()
        })
        return () => socket.disconnect()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function loadRefs() {
        try {
            const [sts, prs, tts, us] = await Promise.all([
                listStatuses(token, { project_id: projectId }),
                listPriorities(token),
                listTaskTypes(token),
                listUsers(token),
            ])
            setStatuses(sts || [])
            setPriorities(prs)
            setTypes(tts)
            setUsers(us)
            const today = shiftToInputDate(new Date())
            const threeDays = shiftToInputDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
            setForm((prev) => ({
                ...prev,
                author_id: user?.id || prev.author_id,
                status_id: (sts && sts[0]?.id) ?? '',
                priority_id: prs[1]?.id ?? prs[0]?.id ?? '',
                type_id: tts[0]?.id ?? '',
                start_date: prev.start_date || today,
                due_date: prev.due_date || threeDays,
                spent_value: prev.spent_value ?? 0,
                spent_unit: prev.spent_unit || 'minutes',
                estimated_value: prev.estimated_value ?? 0,
                estimated_unit: prev.estimated_unit || 'minutes',
            }))
        } catch (e) {
            setError(e.message)
        }
    }

    async function loadTasks() {
        try {
            const data = await listTasks(token, {
                project_id: projectId,
                q: filters.q,
                assignee_id: filters.assignee_id,
                priority_id: filters.priority_id,
            })
            const activeIds = new Set([
                ...activeStatuses.map((s) => s.id),
                ...deletedStatusIds,
            ])
            const deletedIds = new Set(trashTasks.map((t) => t.id))
            const keep = []
            const toTrash = []
            data.forEach((t) => {
                if (deletedIds.has(t.id)) return
                if (!activeStatuses.length) {
                    keep.push(t)
                    return
                }
                const hasActive = activeIds.has(t.status_id)
                if (!t.status_id || !hasActive) {
                    toTrash.push(t)
                    return
                }
                keep.push(t)
            })
            let nextTrash = trashTasks
            if (toTrash.length) {
                const known = new Set(trashTasks.map((t) => t.id))
                const merged = [...trashTasks]
                toTrash.forEach((t) => {
                    if (!known.has(t.id)) {
                        merged.push(t)
                        known.add(t.id)
                    }
                })
                nextTrash = merged
                syncTrash(nextTrash)
            }
            setTasks(keep)
            cleanupDeletedStatuses(keep, nextTrash)
        } catch (e) {
            setError(e.message)
        }
    }

    function syncTrash(next) {
        setTrashTasks((prev) => {
            const value = typeof next === 'function' ? next(prev) : next || []
            try {
                localStorage.setItem('trashTasks', JSON.stringify(value))
            } catch {}
            return value
        })
    }

    function syncDeletedStatuses(next) {
        setDeletedStatusIds((prev) => {
            const value = typeof next === 'function' ? next(prev) : next || []
            try {
                localStorage.setItem('deletedStatuses', JSON.stringify(value))
            } catch {}
            return value
        })
    }

    function cleanupDeletedStatuses(nextTasks = tasks, nextTrash = trashTasks) {
        const used = new Set()
        nextTasks.forEach((t) => used.add(String(t.status_id)))
        nextTrash.forEach((t) => used.add(String(t.status_id)))
        // Убираем локально статусы из state, если они отмечены как удаленные и больше не используются.
        const unusedDeleted = deletedStatusIds.filter((id) => !used.has(String(id)))
        setStatuses((prev) =>
            prev.filter((s) => {
                if (unusedDeleted.includes(s.id)) return false
                if (!deletedStatusIds.includes(s.id)) return true
                return used.has(String(s.id))
            })
        )
        if (unusedDeleted.length) {
            syncDeletedStatuses((prev) => prev.filter((id) => !unusedDeleted.includes(id)))
            unusedDeleted.forEach((id) =>
                deleteStatus(token, Number(id)).catch(() => {
                    /* игнорируем, скрываем локально */
                })
            )
        }
    }

    function moveTaskToTrash(taskId) {
        const t = tasks.find((task) => String(task.id) === String(taskId))
        if (!t) return
        setTasks((prev) => prev.filter((task) => String(task.id) !== String(taskId)))
        syncTrash([...trashTasks.filter((task) => String(task.id) !== String(taskId)), t])
        setTasks((prev) =>
            prev.map((task) =>
                String(task.parent_id) === String(taskId) ? { ...task, parent_id: null } : task
            )
        )
        setNotif('Задача перемещена в удаленные')
    }

    async function handleStatusChange(taskId, statusId) {
        if (isGuest) return
        const targetStatus = statusOptions.find((s) => String(s.id) === String(statusId))
        const nextId = targetStatus ? targetStatus.id : statusId
        const nextName = targetStatus?.name
        try {
            const updated = tasks.map((t) =>
                String(t.id) === String(taskId)
                    ? { ...t, status_id: Number(nextId), status_name: nextName }
                    : t
            )
            setTasks(updated)
            cleanupDeletedStatuses(updated, trashTasks)
            await updateTask(token, taskId, { status_id: nextId })
            loadTasks()
        } catch (e) {
            setError(e.message)
        }
    }

    function startEdit(task) {
        if (!isAdmin && task.assignee_id !== user?.id) return
        const spent = fromMinutes(task.spent_minutes)
        const estimated = fromMinutes(task.estimated_minutes)
        setEditingId(task.id)
        setForm({
            title: task.title,
            description: task.description || '',
            status_id: task.status_id,
            priority_id: task.priority_id,
            type_id: task.type_id || '',
            assignee_id: task.assignee_id || '',
            parent_id: task.parent_id || '',
            start_date: shiftToInputDate(task.start_date),
            due_date: shiftToInputDate(task.due_date),
            spent_value: spent.value,
            spent_unit: spent.unit,
            estimated_value: estimated.value,
            estimated_unit: estimated.unit,
            author_id: task.author_id,
        })
        setTaskModalOpen(true)
    }

    async function handleDelete(id) {
        moveTaskToTrash(id)
    }

    const priorityWeight = useMemo(() => {
        const map = new Map()
        priorities.forEach((p) => map.set(p.id, p.weight))
        return map
    }, [priorities])

    const sortedTasks = useMemo(() => {
        const comparator = {
            status: (a, b) => (a.status_name || '').localeCompare(b.status_name || ''),
            assignee: (a, b) => (a.assignee_name || '').localeCompare(b.assignee_name || ''),
            priority: (a, b) => (priorityWeight.get(b.priority_id) || 0) - (priorityWeight.get(a.priority_id) || 0),
            due: (a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0),
            start: (a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0),
            title: (a, b) => (a.title || '').localeCompare(b.title || ''),
        }
        const cmp = comparator[filters.sort]
        if (!cmp) return tasks
        return [...tasks].sort(cmp)
    }, [tasks, filters.sort, priorityWeight])

    const activeStatuses = useMemo(() => {
        const map = new Map()
        statuses.forEach((s) => {
            if (!deletedStatusIds.includes(s.id) && !map.has(s.id)) {
                map.set(s.id, s)
            }
        })
        return Array.from(map.values()).sort((a, b) => a.position - b.position)
    }, [statuses, deletedStatusIds])

        const extraStatuses = useMemo(() => {
        const baseDeleted = deletedStatusIds
            .map((id) => statuses.find((s) => s.id === id))
            .filter(Boolean)
        const knownIds = new Set([...activeStatuses, ...baseDeleted].map((s) => s.id))
        const knownNames = new Set([...activeStatuses, ...baseDeleted].map((s) => (s.name || '').toLowerCase()))
        const extras = [...baseDeleted]
        sortedTasks.forEach((t) => {
            if (!t.status_id) return
            const lowerName = (t.status_name || '').toLowerCase()
            if (knownIds.has(t.status_id) || knownNames.has(lowerName)) return
            knownIds.add(t.status_id)
            knownNames.add(lowerName)
            extras.push({
                id: t.status_id,
                name: t.status_name || 'Статус',
                position: (activeStatuses.length + extras.length + 1) * 10,
                project_id: t.project_id,
                readonly: true,
            })
        })
        return extras
    }, [sortedTasks, activeStatuses, deletedStatusIds, statuses])

    const statusOptions = useMemo(
        () => [...activeStatuses, ...extraStatuses],
        [activeStatuses, extraStatuses]
    )

    const tasksByStatus = useMemo(() => {
        const map = new Map()
        statusOptions.forEach((s) => map.set(s.id, []))
        sortedTasks.forEach((t) => {
            if (!map.has(t.status_id)) map.set(t.status_id, [])
            map.get(t.status_id).push(t)
        })
        return map
    }, [sortedTasks, statusOptions])

    const parentOptions = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks])

    function resetForm() {
        setEditingId(null)
        setForm((prev) => ({
            ...prev,
            title: '',
            description: '',
            assignee_id: '',
            parent_id: '',
            author_id: user?.id || '',
            start_date: shiftToInputDate(new Date()),
            due_date: shiftToInputDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
            spent_value: 0,
            spent_unit: 'minutes',
            estimated_value: 0,
            estimated_unit: 'minutes',
        }))
    }
    async function handleSubmit(e) {
        e?.preventDefault()
        if (!form.title) return
        try {
            const normalizeDate = (d) => toApiDate(d)
            const spent = toMinutes(form.spent_value, form.spent_unit)
            const estimated = toMinutes(form.estimated_value, form.estimated_unit)
            const payload = {
                ...form,
                spent_value: undefined,
                spent_unit: undefined,
                estimated_value: undefined,
                estimated_unit: undefined,
                author_id: undefined,
                project_id: projectId,
                assignee_id: form.assignee_id || null,
                parent_id: form.parent_id || null,
                type_id: form.type_id ? Number(form.type_id) : null,
                status_id: form.status_id ? Number(form.status_id) : null,
                priority_id: form.priority_id ? Number(form.priority_id) : null,
                start_date: normalizeDate(form.start_date),
                due_date: normalizeDate(form.due_date),
                spent_minutes: spent,
                estimated_minutes: estimated,
            }
            if (editingId) {
                await updateTask(token, editingId, payload)
                setNotif('Задача обновлена')
            } else {
                await createTask(token, payload)
                setNotif('Задача создана')
            }
            resetForm()
            setTaskModalOpen(false)
            loadTasks()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDragEnd(result) {
        if (!result.destination) return
        if (isGuest && result.type === 'task') return
        if (result.type === 'column') {
            if (!isAdmin || isGuest) return
            const reordered = Array.from(statuses).sort((a, b) => a.position - b.position)
            const [removed] = reordered.splice(result.source.index, 1)
            reordered.splice(result.destination.index, 0, removed)
            const withPos = reordered.map((s, idx) => ({ ...s, position: idx + 1 }))
            setStatuses(withPos)
            const changed = [
                withPos[result.source.index],
                withPos[result.destination.index],
            ].filter(Boolean)
            for (const s of changed) {
                try {
                    await updateStatus(token, s.id, { position: s.position })
                } catch (e) {
                    setError(e.message)
                }
            }
            return
        }
        const taskId = result.draggableId
        const destId = result.destination.droppableId
        const sourceId = result.source.droppableId
        const taskFromTrash = trashTasks.find((t) => String(t.id) === String(taskId))
        const taskFromBoard = tasks.find((t) => String(t.id) === String(taskId))

        if (destId === 'trash') {
            if (sourceId === 'trash') return
            if (taskFromBoard) moveTaskToTrash(taskId)
            return
        }

        if (sourceId === 'trash' && destId !== 'trash') {
            if (!taskFromTrash) return
            const targetStatus = statusOptions.find((s) => String(s.id) === String(destId))
            const newStatus = targetStatus ? targetStatus.id : destId
            const statusName = targetStatus?.name
            const oldStatusId = taskFromTrash.status_id
            const nextTrash = trashTasks.filter((t) => String(t.id) !== String(taskId))
            syncTrash(nextTrash)
            try {
                const nextTasks = (() => {
                    const filtered = tasks.filter((t) => String(t.id) !== String(taskId))
                    return [
                        ...filtered,
                        { ...taskFromTrash, status_id: Number(newStatus), status_name: statusName },
                    ]
                })()
                setTasks(nextTasks)
                await updateTask(token, taskId, { status_id: newStatus })
                const statusStillUsed =
                    nextTasks.some((t) => String(t.status_id) === String(oldStatusId)) ||
                    nextTrash.some((t) => String(t.status_id) === String(oldStatusId))
                if (!statusStillUsed) {
                    setStatuses((prev) => prev.filter((s) => String(s.id) !== String(oldStatusId)))
                    syncDeletedStatuses((prev) =>
                        prev.filter((id) => String(id) !== String(oldStatusId))
                    )
                    try {
                        await deleteStatus(token, Number(oldStatusId))
                    } catch (err) {
                        setError(err.message)
                    }
                }
                cleanupDeletedStatuses(nextTasks, nextTrash)
                loadTasks()
            } catch (e) {
                setError(e.message)
            }
            return
        }

        const targetStatus = statusOptions.find((s) => String(s.id) === String(destId))
        const newStatus = targetStatus ? targetStatus.id : destId
        const task = taskFromBoard
        if (!task || task.status_id === newStatus) return
        await handleStatusChange(taskId, newStatus)
    }

    async function handleCreateColumn(e) {
        if (isGuest) return
        e.preventDefault()
        if (!columnDraft.trim()) return
        const nameExists = activeStatuses.some(
            (s) => (s.name || '').toLowerCase() === columnDraft.trim().toLowerCase()
        )
        if (nameExists) {
            setError('Колонка с таким названием уже есть')
            return
        }
        try {
            await createStatus(token, {
                name: columnDraft.trim(),
                position: activeStatuses.length + 1,
                project_id: projectId,
            })
            setColumnDraft('')
            await loadRefs()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleRenameStatus(id) {
        const nextName = window.prompt('Новое название статуса?')
        if (!nextName) return
        try {
            await updateStatus(token, id, { name: nextName })
            loadRefs()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDeleteStatus(id) {
        if (isGuest) return
        const colTasks = tasksByStatus.get(id) || []
        const warn =
            colTasks.length > 0
                ? 'В колонке есть задачи. Удалить колонку? Колонка будет скрыта, задачи останутся в блоке удаленных колонок.'
                : 'Удалить колонку?'
        if (!window.confirm(warn)) return
        if (colTasks.length) {
            setStatuses((prev) => prev.filter((s) => s.id !== id))
            syncDeletedStatuses((prev) => (prev.includes(id) ? prev : [...prev, id]))
            return
        }
        try {
            await deleteStatus(token, id)
            loadRefs()
            setTimeout(loadTasks, 200)
        } catch (e) {
            setError(e.message || 'Статус используется задачами')
        }
    }

    async function openModal(taskId) {
        try {
            const data = await getTask(token, taskId)
            setModalTask(data)
            const parsedSpent = fromMinutes(data.task.spent_minutes || 0)
            const parsedEstimated = fromMinutes(data.task.estimated_minutes || 0)
            setModalSpentValue(parsedSpent.value)
            setModalSpentUnit(parsedSpent.unit)
            setModalEstimateValue(parsedEstimated.value)
            setModalEstimateUnit(parsedEstimated.unit)
            setModalComment('')
            setModalCommentsPage(1)
            setModalHistoryPage(1)
            setModalOpen(true)
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleAddModalComment(e) {
        if (isGuest) return
        e.preventDefault()
        if (!modalTask || !modalComment.trim()) return
        try {
            await addComment(token, modalTask.task.id, modalComment.trim())
            setModalComment('')
            const data = await getTask(token, modalTask.task.id)
            setModalTask(data)
            setModalCommentsPage(1)
            setModalEditCommentId(null)
            setModalEditCommentBody('')
        } catch (e) {
            setError(e.message)
        }
    }

    function startEditModalComment(comment) {
        setModalEditCommentId(comment.id)
        setModalEditCommentBody(comment.body)
    }

    async function saveModalComment(commentId) {
        if (!modalTask) return
        const body = modalEditCommentBody.trim()
        if (!body) return
        try {
            await updateComment(token, modalTask.task.id, commentId, body)
            setModalEditCommentId(null)
            setModalEditCommentBody('')
            const data = await getTask(token, modalTask.task.id)
            setModalTask(data)
        } catch (e) {
            setError(e.message)
        }
    }

    async function deleteModalComment(commentId) {
        if (!modalTask) return
        try {
            await deleteCommentApi(token, modalTask.task.id, commentId)
            const data = await getTask(token, modalTask.task.id)
            setModalTask(data)
        } catch (e) {
            setError(e.message)
        }
    }

    async function saveModal(updated) {
        if (isGuest) return
        if (!modalTask) return
        try {
            await updateTask(token, modalTask.task.id, updated)
            setModalOpen(false)
            setModalTask(null)
            loadTasks()
        } catch (e) {
            setError(e.message)
        }
    }
    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }} fontWeight={800}>
                Проект · доска
            </Typography>
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('Колонка с таким названием уже есть')}>
                    {error}
                </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                    size="small"
                    label="Поиск"
                    value={filters.q}
                    onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                />
                <TextField
                    size="small"
                    select
                    label="Исполнитель"
                    value={filters.assignee_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, assignee_id: e.target.value }))}
                    sx={{ minWidth: 180 }}
                    disabled={!isAdmin}
                >
                    <MenuItem value="">Все</MenuItem>
                    {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                            {u.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    select
                    label="Приоритет"
                    value={filters.priority_id}
                    onChange={(e) =>
                        setFilters((prev) => ({ ...prev, priority_id: e.target.value }))
                    }
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">Все</MenuItem>
                    {priorities.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                            {p.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    select
                    label="Сортировка"
                    value={filters.sort}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">Нет</MenuItem>
                    <MenuItem value="status">Статус</MenuItem>
                    <MenuItem value="assignee">Исполнитель</MenuItem>
                    <MenuItem value="priority">Приоритет</MenuItem>
                    <MenuItem value="due">Дедлайн</MenuItem>
                    <MenuItem value="start">Начало</MenuItem>
                    <MenuItem value="title">Название</MenuItem>
                </TextField>
                <Button variant="outlined" onClick={loadTasks}>
                    Обновить
                </Button>
                <Button variant="contained" onClick={() => setTaskModalOpen(true)} disabled={isGuest}>
                    Создать задачу
                </Button>
            </Stack>

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems="flex-start"
                sx={{ mb: 2 }}
            >
                <Box
                    component="form"
                    onSubmit={handleCreateColumn}
                    sx={{
                        width: { xs: '100%', md: 280 },
                        p: 2,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        flexShrink: 0,
                    }}
                >
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                        Новая колонка
                    </Typography>
                    <TextField
                        fullWidth
                        size="small"
                        label="Название"
                        value={columnDraft}
                        onChange={(e) => setColumnDraft(e.target.value)}
                    />
                    <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={isGuest}>
                        Добавить
                    </Button>
                </Box>
            </Stack>

                                                <DragDropContext onDragEnd={handleDragEnd}>
                <Stack spacing={2}>
                    <Droppable droppableId="columns" direction="horizontal" type="column">
                        {(dropProvided) => (
                            <Stack
                                direction="row"
                                spacing={2}
                                alignItems="flex-start"
                                sx={{ overflowX: 'auto' }}
                                ref={dropProvided.innerRef}
                                {...dropProvided.droppableProps}
                            >
                                {activeStatuses.map((col, colIdx) => {
                                    const colTasks = tasksByStatus.get(col.id) || []
                                    return (
                                        <Draggable
                                            key={col.id}
                                            draggableId={`col-${col.id}`}
                                            index={colIdx}
                                            isDragDisabled={!isAdmin || isGuest}
                                        >
                                            {(colDrag) => (
                                                <Box
                                                    ref={colDrag.innerRef}
                                                    {...colDrag.draggableProps}
                                                    sx={{ width: 320, flexShrink: 0 }}
                                                >
                                                    <Stack
                                                        direction="row"
                                                        justifyContent="space-between"
                                                        alignItems="center"
                                                        {...colDrag.dragHandleProps}
                                                    >
                                                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                                            {col.name}
                                                        </Typography>
                                                        {isAdmin ? (
                                                            <Stack direction="row" spacing={1}>
                                                                <Button size="small" onClick={(e) => { e.stopPropagation(); handleRenameStatus(col.id); }}>Ред.</Button>
                                                                <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteStatus(col.id); }}>Удал.</Button>
                                                            </Stack>
                                                        ) : null}
                                                    </Stack>
                                                    <Droppable droppableId={String(col.id)} type="task">
                                                        {(provided) => (
                                                            <Box
                                                                ref={provided.innerRef}
                                                                {...provided.droppableProps}
                                                                sx={{
                                                                    p: 1,
                                                                    borderRadius: 1,
                                                                    bgcolor: 'background.paper',
                                                                    minHeight: 120,
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                }}
                                                            >
                                                                {colTasks.map((t, idx) => (
                                                                    <Draggable
                                                                        key={t.id}
                                                                        draggableId={String(t.id)}
                                                                        index={idx}
                                                                        isDragDisabled={isGuest}
                                                                    >
                                                                        {(dragProps) => (
                                                                            <Card
                                                                                ref={dragProps.innerRef}
                                                                                {...dragProps.draggableProps}
                                                                                {...dragProps.dragHandleProps}
                                                                                variant="outlined"
                                                                                sx={{
                                                                                    mb: 1,
                                                                                    borderLeft: '4px solid',
                                                                                    borderLeftColor: deadlineColor(t),
                                                                                }}
                                                                                onClick={() => openModal(t.id)}
                                                                            >
                                                                                <CardContent sx={{ p: 1.25 }}>
                                                                                    <Typography variant="body2" fontWeight={700}>
                                                                                        {t.title}
                                                                                    </Typography>
                                                                                    {t.parent_id ? (
                                                                                        <Button
                                                                                            component={RouterLink}
                                                                                            to={`/tasks/${t.parent_id}`}
                                                                                            size="small"
                                                                                            variant="text"
                                                                                            onClick={(e) => e.stopPropagation()}
                                                                                        >
                                                                                            Родительская задача
                                                                                        </Button>
                                                                                    ) : null}
                                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                                        {t.description || 'Нет описания'}
                                                                                    </Typography>
                                                                                    <Divider sx={{ my: 1 }} />
                                                                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                                                                                        <Chip label={`Приоритет: ${t.priority_name || '—'}`} size="small" />
                                                                                        <Chip label={`Тип: ${t.type_name || '—'}`} size="small" color="info" />
                                                                                        <Chip label={`Затрачено: ${formatSpent(t.spent_minutes)}`} size="small" color={spentColor(t.spent_minutes, t.estimated_minutes)} />
                                                                                        <Chip label={`Оценка: ${formatSpent(t.estimated_minutes)}`} size="small" />
                                                                                        {t.assignee_name ? (
                                                                                            <Chip label={`Исп: ${t.assignee_name}`} size="small" />
                                                                                        ) : null}
                                                                                    </Stack>
                                                                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                                                                                        С {formatDate(t.start_date)} до {formatDate(t.due_date)}
                                                                                    </Typography>
                                                                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                                                                        {(isAdmin || (!isGuest && t.assignee_id === user?.id)) && (
                                                                                            <TextField
                                                                                                select
                                                                                                size="small"
                                                                                                value={t.status_id}
                                                                                                onChange={(e) => {
                                                                                                    e.stopPropagation()
                                                                                                    handleStatusChange(t.id, Number(e.target.value))
                                                                                                }}
                                                                                                sx={{ minWidth: 140 }}
                                                                                            >
                                                                                                {statusOptions.map((s) => (
                                                                                                    <MenuItem key={s.id} value={s.id}>
                                                                                                        {s.name}
                                                                                                    </MenuItem>
                                                                                                ))}
                                                                                            </TextField>
                                                                                        )}
                                                                                        {isAdmin ? (
                                                                                            <>
                                                                                                <Button size="small" onClick={(e) => { e.stopPropagation(); startEdit(t); }}>Править</Button>
                                                                                                <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}>Удалить</Button>
                                                                                            </>
                                                                                        ) : null}
                                                                                    </Stack>
                                                                                </CardContent>
                                                                            </Card>
                                                                        )}
                                                                    </Draggable>
                                                                ))}
                                                                {provided.placeholder}
                                                                {!colTasks.length ? (
                                                                    <Typography color="text.secondary" variant="caption">Нет задач</Typography>
                                                                ) : null}
                                                            </Box>
                                                        )}
                                                    </Droppable>
                                                </Box>
                                            )}
                                        </Draggable>
                                    )
                                })}
                                {dropProvided.placeholder}
                            </Stack>
                        )}
                    </Droppable>

                    {extraStatuses.length ? (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Удаленные колонки
                            </Typography>
                            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ overflowX: 'auto' }}>
                                {extraStatuses
                                    .map((col) => {
                                        const colTasks = tasksByStatus.get(col.id) || []
                                        if (!colTasks.length) return null
                                        return (
                                            <Droppable droppableId={String(col.id)} type="task" key={col.id}>
                                                {(provided) => (
                                                    <Box
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        sx={{
                                                            width: 320,
                                                            flexShrink: 0,
                                                            p: 1,
                                                            borderRadius: 1,
                                                            border: '1px dashed',
                                                            borderColor: 'divider',
                                                            bgcolor: 'background.paper',
                                                        }}
                                                    >
                                                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                                            <Typography variant="subtitle1" fontWeight={700}>
                                                                Удаленные · {col.name}
                                                            </Typography>
                                                            <Stack direction="row" spacing={1}>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    disabled={isGuest}
                                                                    onClick={() => {
                                                                        syncDeletedStatuses((prev) => prev.filter((id) => id !== col.id))
                                                                        setStatuses((prev) => [...prev, col].sort((a, b) => a.position - b.position))
                                                                    }}
                                                                >
                                                                    Восстановить
                                                                </Button>
                                                                <Button
                                                                    size="small"
                                                                    color="error"
                                                                    disabled={isGuest}
                                                                    onClick={() => {
                                                                        const remove = async () => {
                                                                            try {
                                                                                if (colTasks.length) {
                                                                                    await Promise.all(
                                                                                        colTasks.map((t) => deleteTask(token, t.id))
                                                                                    )
                                                                                    setTasks((prev) =>
                                                                                        prev.filter((t) => t.status_id !== col.id)
                                                                                    )
                                                                                }
                                                                                await deleteStatus(token, col.id)
                                                                                syncDeletedStatuses((prev) =>
                                                                                    prev.filter((id) => id !== col.id)
                                                                                )
                                                                                setStatuses((prev) =>
                                                                                    prev.filter((s) => s.id !== col.id)
                                                                                )
                                                                                syncTrash((prev) =>
                                                                                    prev.filter((t) => t.status_id !== col.id)
                                                                                )
                                                                                loadTasks()
                                                                            } catch (err) {
                                                                                setError(err.message)
                                                                            }
                                                                        }
                                                                        if (!colTasks.length || window.confirm('Удалить колонку вместе с её задачами?')) {
                                                                            remove()
                                                                        }
                                                                    }}
                                                                >
                                                                    Удалить
                                                                </Button>
                                                            </Stack>
                                                        </Stack>
                                                        {colTasks.map((t, idx) => (
                                                            <Draggable key={t.id} draggableId={String(t.id)} index={idx} isDragDisabled={isGuest}>
                                                                {(dragProps) => (
                                                                    <Card
                                                                        ref={dragProps.innerRef}
                                                                        {...dragProps.draggableProps}
                                                                        {...dragProps.dragHandleProps}
                                                                        variant="outlined"
                                                                        sx={{ mb: 1, borderLeft: '4px solid', borderLeftColor: deadlineColor(t) }}
                                                                        onClick={() => openModal(t.id)}
                                                                    >
                                                                        <CardContent sx={{ p: 1.25 }}>
                                                                            <Typography variant="body2" fontWeight={700}>
                                                                                {t.title}
                                                                            </Typography>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {t.description || 'Нет описания'}
                                                                            </Typography>
                                                                        </CardContent>
                                                                    </Card>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                        {!colTasks.length ? (
                                                            <Typography color="text.secondary" variant="caption">
                                                                Нет задач
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                )}
                                            </Droppable>
                                        )
                                    })
                                    .filter(Boolean)}
                            </Stack>
                        </Stack>
                    ) : null}

                    {trashTasks.length ? (
                        <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" spacing={2}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Удаленные задачи
                                </Typography>
                                <Button
                                    size="small"
                                    color="error"
                                    disabled={isGuest}
                                    onClick={async () => {
                                        try {
                                            await Promise.all(trashTasks.map((t) => deleteTask(token, t.id)))
                                            syncTrash([])
                                            setNotif('Корзина очищена')
                                        } catch (e) {
                                            setError(e.message)
                                        }
                                    }}
                                >
                                    Очистить
                                </Button>
                            </Stack>
                            <Droppable droppableId="trash" type="task">
                                {(provided) => (
                                    <Box
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        sx={{
                                            width: 320,
        										flexShrink: 0,
                                            p: 1,
                                            borderRadius: 1,
                                            border: '1px dashed',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                        }}
                                    >
                                        {trashTasks.map((t, idx) => (
                                            <Draggable
                                                key={t.id}
                                                draggableId={String(t.id)}
                                                index={idx}
                                                isDragDisabled={isGuest}
                                            >
                                                {(dragProps) => (
                                                    <Card
                                                        ref={dragProps.innerRef}
                                                        {...dragProps.draggableProps}
                                                        {...dragProps.dragHandleProps}
                                                        variant="outlined"
                                                        sx={{
                                                            mb: 1,
                                                            borderLeft: '4px solid',
                                                            borderLeftColor: deadlineColor(t),
                                                        }}
                                                        onClick={() => openModal(t.id)}
                                                    >
                                                        <CardContent sx={{ p: 1.25 }}>
                                                            <Typography variant="body2" fontWeight={700}>
                                                                {t.title}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {t.description || 'Нет описания'}
                                                            </Typography>
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                        {!trashTasks.length ? (
                                            <Typography color="text.secondary" variant="caption">
                                                Нет задач
                                            </Typography>
                                        ) : null}
                                    </Box>
                                )}
                            </Droppable>
                        </Stack>
                    ) : null}
                </Stack>
            </DragDropContext>

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

            <Dialog
                open={modalOpen}
                fullWidth
                maxWidth="md"
                onClose={() => setModalOpen(false)}
                PaperProps={{ sx: { maxHeight: '90vh' } }}
            >
                {modalTask ? (
                    <>
                        <DialogTitle>{modalTask.task.title}</DialogTitle>
                        <DialogContent dividers sx={{ overflowX: 'hidden' }}>
                            <Stack spacing={2}>
                                <TextField
                                    label="Название"
                                    fullWidth
                                    value={modalTask.task.title}
                                    onChange={(e) =>
                                        setModalTask((prev) => ({
                                            ...prev,
                                            task: { ...prev.task, title: e.target.value },
                                        }))
                                    }
                                />
                                <TextField
                                    label="Описание"
                                    fullWidth
                                    multiline
                                    minRows={3}
                                    value={modalTask.task.description || ''}
                                    onChange={(e) =>
                                        setModalTask((prev) => ({
                                            ...prev,
                                            task: { ...prev.task, description: e.target.value },
                                        }))
                                    }
                                />
                                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                                    <TextField
                                        select
                                        label="Статус"
                                        value={modalTask.task.status_id}
                                        onChange={(e) =>
                                            setModalTask((prev) => ({
                                                ...prev,
                                                task: {
                                                    ...prev.task,
                                                    status_id: Number(e.target.value),
                                                },
                                            }))
                                        }
                                        size="small"
                                        sx={{ minWidth: 160 }}
                                        disabled={
                                            !isAdmin &&
                                            modalTask.task.assignee_id &&
                                            modalTask.task.assignee_id !== user?.id
                                        }
                                    >
                                        {statusOptions.map((s) => (
                                            <MenuItem key={s.id} value={s.id}>
                                                {s.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        select
                                        label="Приоритет"
                                        value={modalTask.task.priority_id}
                                        onChange={(e) =>
                                            setModalTask((prev) => ({
                                                ...prev,
                                                task: {
                                                    ...prev.task,
                                                    priority_id: Number(e.target.value),
                                                },
                                            }))
                                        }
                                        size="small"
                                        sx={{ minWidth: 140 }}
                                        disabled={
                                            !isAdmin &&
                                            modalTask.task.assignee_id &&
                                            modalTask.task.assignee_id !== user?.id
                                        }
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
                                        value={modalTask.task.type_id || ''}
                                        onChange={(e) =>
                                            setModalTask((prev) => ({
                                                ...prev,
                                                task: {
                                                    ...prev.task,
                                                    type_id: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                },
                                            }))
                                        }
                                        size="small"
                                        sx={{ minWidth: 140 }}
                                        disabled={
                                            !isAdmin &&
                                            modalTask.task.assignee_id &&
                                            modalTask.task.assignee_id !== user?.id
                                        }
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
                                        label="Исполнитель"
                                        value={modalTask.task.assignee_id || ''}
                                        onChange={(e) =>
                                            setModalTask((prev) => ({
                                                ...prev,
                                                task: {
                                                    ...prev.task,
                                                    assignee_id: e.target.value || null,
                                                },
                                            }))
                                        }
                                        size="small"
                                        sx={{ minWidth: 200 }}
                                        disabled={!isAdmin}
                                    >
                                        <MenuItem value="">Не выбрано</MenuItem>
                                        {users.map((u) => (
                                            <MenuItem key={u.id} value={u.id}>
                                                {u.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    {modalTask.task.parent_id ? (
                                        <Button
                                            component={RouterLink}
                                            to={`/tasks/${modalTask.task.parent_id}`}
                                            size="small"
                                        variant="outlined"
                                    >
                                            Родительская задача
                                        </Button>
                                    ) : null}
                                    <TextField
                                        label="Затраченное время"
                                        type="number"
                                        value={modalSpentValue}
                                        onChange={(e) => setModalSpentValue(e.target.value)}
                                        size="small"
                                        sx={{ minWidth: 160 }}
                                        InputProps={{ inputProps: { min: 0, step: 1 } }}
                                        disabled={
                                            !isAdmin &&
                                            modalTask.task.assignee_id &&
                                            modalTask.task.assignee_id !== user?.id
                                        }
                                    />
                                    <TextField
                                        select
                                        label="Единицы"
                                        size="small"
                                        value={modalSpentUnit}
                                        onChange={(e) => setModalSpentUnit(e.target.value)}
                                        sx={{ minWidth: 160 }}
                                        disabled={
                                            !isAdmin &&
                                            modalTask.task.assignee_id &&
                                            modalTask.task.assignee_id !== user?.id
                                        }
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
                                        value={modalEstimateValue}
                                        onChange={(e) => setModalEstimateValue(e.target.value)}
                                        size="small"
                                        sx={{ minWidth: 160 }}
                                        InputProps={{ inputProps: { min: 0, step: 1 } }}
                                        disabled={!(isAdmin || modalTask.task.author_id === user?.id)}
                                    />
                                    <TextField
                                        select
                                        label="Единицы оценки"
                                        size="small"
                                        value={modalEstimateUnit}
                                        onChange={(e) => setModalEstimateUnit(e.target.value)}
                                        sx={{ minWidth: 160 }}
                                        disabled={!(isAdmin || modalTask.task.author_id === user?.id)}
                                    >
                                        {timeUnits.map((u) => (
                                            <MenuItem key={u.key} value={u.key}>
                                                {u.label}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography variant="subtitle2">Дочерние задачи</Typography>
                                    {modalTask.children && modalTask.children.length ? (
                                        modalTask.children.map((c) => (
                                            <Button
                                                key={c.id}
                                                size="small"
                                                onClick={() => openModal(c.id)}
                                                variant="text"
                                                sx={{ justifyContent: 'flex-start' }}
                                            >
                                                {c.title}
                                            </Button>
                                        ))
                                    ) : (
                                        <Typography variant="caption" color="text.secondary">
                                            Дочерних задач нет
                                        </Typography>
                                    )}
                                </Stack>
                                <Divider />
                                <Typography variant="subtitle2">Комментарии</Typography>
                                <Stack spacing={1}>
                                    {modalTask.comments
                                        ?.slice(
                                            (modalCommentsPage - 1) * pageSize,
                                            modalCommentsPage * pageSize
                                        )
                                        .map((c) => (
                                            <Box
                                                key={c.id}
                                                sx={{
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    p: 1,
                                                    borderRadius: 1,
                                                }}
                                            >
                                                <Stack
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    alignItems="center"
                                                    spacing={1}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {c.author_name} ·{' '}
                                                        {new Date(c.created_at).toLocaleString()}
                                                    </Typography>
                                                    {(isAdmin || c.author_id === user?.id) && (
                                                        <Stack direction="row" spacing={1}>
                                                            {modalEditCommentId === c.id ? (
                                                                <>
                                                                    <Button
                                                                        size="small"
                                                                        onClick={() =>
                                                                            saveModalComment(c.id)
                                                                        }
                                                                    >
                                                                        Сохранить
                                                                    </Button>
                                                                    <Button
                                                                        size="small"
                                                                        color="inherit"
                                                                        onClick={() => {
                                                                            setModalEditCommentId(
                                                                                null
                                                                            )
                                                                            setModalEditCommentBody(
                                                                                ''
                                                                            )
                                                                        }}
                                                                    >
                                                                        Отмена
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        size="small"
                                                                        onClick={() =>
                                                                            startEditModalComment(
                                                                                c
                                                                            )
                                                                        }
                                                                    >
                                                                        Править
                                                                    </Button>
                                                                    <Button
                                                                        size="small"
                                                                        color="error"
                                                                        onClick={() =>
                                                                            deleteModalComment(c.id)
                                                                        }
                                                                    >
                                                                        Удалить
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </Stack>
                                                    )}
                                                </Stack>
                                                {modalEditCommentId === c.id ? (
                                                    <TextField
                                                        multiline
                                                        minRows={2}
                                                        size="small"
                                                        fullWidth
                                                        sx={{ mt: 1 }}
                                                        value={modalEditCommentBody}
                                                        onChange={(e) =>
                                                            setModalEditCommentBody(
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <Typography variant="body2">{c.body}</Typography>
                                                )}
                                            </Box>
                                        ))}
                                    {!modalTask.comments?.length ? (
                                        <Typography variant="caption" color="text.secondary">
                                            Нет комментариев
                                        </Typography>
                                    ) : (
                                        <Pagination
                                            size="small"
                                            page={modalCommentsPage}
                                            count={Math.max(
                                                1,
                                                Math.ceil(
                                                    (modalTask.comments?.length || 0) / pageSize
                                                )
                                            )}
                                            onChange={(_, page) => setModalCommentsPage(page)}
                                        />
                                    )}
                                    <Box
                                        component="form"
                                        onSubmit={handleAddModalComment}
                                        sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                                    >
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Новый комментарий"
                                            value={modalComment}
                                            onChange={(e) => setModalComment(e.target.value)}
                                        />
                                        <Button type="submit" variant="outlined">
                                            Добавить
                                        </Button>
                                    </Box>
                                </Stack>
                                <Divider />
                                <Typography variant="subtitle2">История</Typography>
                                <Stack spacing={1}>
                                    {modalTask.history
                                        ?.slice(
                                            (modalHistoryPage - 1) * pageSize,
                                            modalHistoryPage * pageSize
                                        )
                                        .map((h) => (
                                            <Box
                                                key={h.id}
                                                sx={{ border: '1px dashed', p: 1, borderRadius: 1 }}
                                            >
                                                <Typography variant="caption" color="text.secondary">
                                                    {h.action} ·{' '}
                                                    {new Date(h.created_at).toLocaleString()} ·{' '}
                                                    {h.author_name || 'system'}
                                                </Typography>
                                                {h.new_value ? (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ whiteSpace: 'pre-wrap' }}
                                                    >
                                                        {JSON.stringify(h.new_value, null, 2)}
                                                    </Typography>
                                                ) : null}
                                            </Box>
                                        ))}
                                    {!modalTask.history?.length ? (
                                        <Typography variant="caption" color="text.secondary">
                                            История пуста
                                        </Typography>
                                    ) : (
                                        <Pagination
                                            size="small"
                                            page={modalHistoryPage}
                                            count={Math.max(
                                                1,
                                                Math.ceil(
                                                    (modalTask.history?.length || 0) / pageSize
                                                )
                                            )}
                                            onChange={(_, page) => setModalHistoryPage(page)}
                                        />
                                    )}
                                </Stack>
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setModalOpen(false)}>Закрыть</Button>
                            <Button
                                variant="contained"
                                disabled={
                                    isGuest ||
                                    (!isAdmin &&
                                        modalTask.task.assignee_id &&
                                        modalTask.task.assignee_id !== user?.id)
                                }
                                onClick={() =>
                                    saveModal({
                                        title: modalTask.task.title,
                                        description: modalTask.task.description,
                                        status_id: modalTask.task.status_id,
                                        priority_id: modalTask.task.priority_id,
                                        type_id: modalTask.task.type_id,
                                        assignee_id: isAdmin ? modalTask.task.assignee_id : undefined,
                                        start_date: toApiDate(
                                            shiftToInputDate(modalTask.task.start_date)
                                        ),
                                        due_date: toApiDate(
                                            shiftToInputDate(modalTask.task.due_date)
                                        ),
                                        spent_minutes: toMinutes(modalSpentValue, modalSpentUnit),
                                        estimated_minutes: toMinutes(
                                            modalEstimateValue,
                                            modalEstimateUnit
                                        ),
                                    })
                                }
                            >
                                Сохранить
                            </Button>
                        </DialogActions>
                    </>
                ) : null}
            </Dialog>

            <Dialog
                open={taskModalOpen}
                fullWidth
                maxWidth="md"
                onClose={() => setTaskModalOpen(false)}
                PaperProps={{ sx: { maxHeight: '90vh' } }}
            >
                <DialogTitle>
                    {editingId ? 'Редактировать задачу' : 'Создать задачу'}
                </DialogTitle>
                <DialogContent dividers sx={{ overflowX: 'hidden' }}>
                    <Stack spacing={2}>
                        <TextField
                            label="Название"
                            value={form.title}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, title: e.target.value }))
                            }
                            required
                            fullWidth
                        />
                        <TextField
                            label="Описание"
                            value={form.description}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, description: e.target.value }))
                            }
                            fullWidth
                        />
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                select
                                label="Статус"
                            value={form.status_id}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    status_id: Number(e.target.value),
                                }))
                            }
                            size="small"
                            sx={{ minWidth: 180 }}
                            disabled={!isAdmin && editingId && form.assignee_id !== user?.id}
                        >
                            {statusOptions.map((s) => (
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
                                    setForm((prev) => ({
                                        ...prev,
                                        priority_id: Number(e.target.value),
                                    }))
                                }
                                size="small"
                                sx={{ minWidth: 160 }}
                                disabled={!isAdmin && editingId && form.assignee_id !== user?.id}
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
                                    setForm((prev) => ({
                                        ...prev,
                                        type_id: Number(e.target.value),
                                    }))
                                }
                                size="small"
                                sx={{ minWidth: 140 }}
                                disabled={!isAdmin && editingId && form.assignee_id !== user?.id}
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
                            disabled={!isAdmin}
                            >
                            <MenuItem value="">Не выбрано</MenuItem>
                            {users.map((u) => (
                                <MenuItem key={u.id} value={u.id}>
                                    {u.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                select
                                label="Родительская задача"
                                value={form.parent_id}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, parent_id: e.target.value }))
                                }
                                size="small"
                                sx={{ minWidth: 200 }}
                                disabled={!isAdmin && editingId && form.assignee_id !== user?.id}
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
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                label="Затраченное время"
                                type="number"
                                value={form.spent_value}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        spent_value: e.target.value,
                                    }))
                                }
                                size="small"
                                sx={{ minWidth: 160 }}
                                InputProps={{ inputProps: { min: 0, step: 1 } }}
                            />
                            <TextField
                                select
                                label="Единицы"
                                size="small"
                                value={form.spent_unit}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        spent_unit: e.target.value,
                                    }))
                                }
                                sx={{ minWidth: 160 }}
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
                                        estimated_value: e.target.value,
                                    }))
                                }
                                size="small"
                                sx={{ minWidth: 160 }}
                                InputProps={{ inputProps: { min: 0, step: 1 } }}
                                disabled={editingId ? !(isAdmin || user?.id === form.author_id) : false}
                            />
                            <TextField
                                select
                                label="Единицы оценки"
                                size="small"
                                value={form.estimated_unit}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        estimated_unit: e.target.value,
                                    }))
                                }
                                sx={{ minWidth: 160 }}
                                disabled={editingId ? !(isAdmin || user?.id === form.author_id) : false}
                            >
                                {timeUnits.map((u) => (
                                    <MenuItem key={u.key} value={u.key}>
                                        {u.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                <Button onClick={() => setTaskModalOpen(false)}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={
                        isGuest || (!isAdmin && editingId && form.assignee_id !== user?.id)
                    }
                >
                    {editingId ? 'Сохранить' : 'Создать'}
                </Button>
            </DialogActions>
            </Dialog>
        </Container>
    )
}


















