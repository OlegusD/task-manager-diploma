/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import {
    Container,
    Typography,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Link,
    Chip,
    Stack,
    TextField,
    MenuItem,
    Alert,
    Button,
} from '@mui/material'
import { listTasks, listStatuses, listPriorities, listTaskTypes, listUsers, updateTask } from '../api'
import { useAuth } from '../AuthContext'

function deadlineColor(task) {
    const now = Date.now()
    const start = task.start_date ? new Date(task.start_date).getTime() : now
    const due = task.due_date ? new Date(task.due_date).getTime() : now
    const total = Math.max(due - start, 1)
    const left = Math.max(due - now, 0)
    const ratio = left / total
    if (ratio >= 0.6) return 'success'
    if (ratio >= 0.2) return 'warning'
    return 'error'
}

export default function ListPage() {
    const { projectId } = useParams()
    const { token } = useAuth()
    const [tasks, setTasks] = useState([])
    const [error, setError] = useState('')
    const [statusMap, setStatusMap] = useState({})
    const [priorityMap, setPriorityMap] = useState({})
    const [typeMap, setTypeMap] = useState({})
    const [users, setUsers] = useState([])
    const [filters, setFilters] = useState({ q: '', status_id: '', priority_id: '', assignee_id: '' })

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!token) return
        loadRefs()
        loadData()
    }, [token, projectId])

    async function loadRefs() {
        try {
            const [sts, prs, tts, us] = await Promise.all([
                listStatuses(token, { project_id: projectId }),
                listPriorities(token),
                listTaskTypes(token),
                listUsers(token),
            ])
            setStatusMap(Object.fromEntries(sts.map((s) => [s.id, s.name])))
            setPriorityMap(Object.fromEntries(prs.map((p) => [p.id, p.name])))
            setTypeMap(Object.fromEntries(tts.map((t) => [t.id, t.name])))
            setUsers(us)
        } catch (e) {
            setError(e.message)
        }
    }

    async function loadData() {
        try {
            const tks = await listTasks(token, {
                project_id: projectId,
                q: filters.q,
                status_id: filters.status_id,
                priority_id: filters.priority_id,
                assignee_id: filters.assignee_id,
            })
            setTasks(tks)
        } catch (e) {
            setError(e.message)
        }
    }

    async function updateInline(id, payload) {
        try {
            await updateTask(token, id, payload)
            loadData()
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }} fontWeight={800}>
                ������ � ������
            </Typography>
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                    size="small"
                    label="�����"
                    value={filters.q}
                    onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                />
                <TextField
                    size="small"
                    select
                    label="������"
                    value={filters.status_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status_id: e.target.value }))}
                    sx={{ minWidth: 140 }}
                >
                    <MenuItem value="">���</MenuItem>
                    {Object.entries(statusMap).map(([id, name]) => (
                        <MenuItem key={id} value={id}>
                            {name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    select
                    label="�����������"
                    value={filters.assignee_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, assignee_id: e.target.value }))}
                    sx={{ minWidth: 180 }}
                >
                    <MenuItem value="">���</MenuItem>
                    {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                            {u.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    select
                    label="���������"
                    value={filters.priority_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, priority_id: e.target.value }))}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">���</MenuItem>
                    {Object.entries(priorityMap).map(([id, name]) => (
                        <MenuItem key={id} value={id}>
                            {name}
                        </MenuItem>
                    ))}
                </TextField>
                <Button variant="outlined" onClick={loadData}>
                    �����������
                </Button>
            </Stack>

            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>������</TableCell>
                        <TableCell>������</TableCell>
                        <TableCell>���������</TableCell>
                        <TableCell>���</TableCell>
                        <TableCell>�������������</TableCell>
                        <TableCell>����</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {tasks.map((t) => (
                        <TableRow key={t.id} hover>
                            <TableCell>
                                <Link component={RouterLink} to={`/tasks/${t.id}`} underline="hover">
                                    {t.title}
                                </Link>
                            </TableCell>
                            <TableCell>
                                <TextField
                                    select
                                    size="small"
                                    value={t.status_id}
                                    onChange={(e) => updateInline(t.id, { status_id: Number(e.target.value) })}
                                    sx={{ minWidth: 140 }}
                                >
                                    {Object.entries(statusMap).map(([id, name]) => (
                                        <MenuItem key={id} value={Number(id)}>
                                            {name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </TableCell>
                            <TableCell>{priorityMap[t.priority_id] || '�'}</TableCell>
                            <TableCell>{typeMap[t.type_id] || '�'}</TableCell>
                            <TableCell>
                                <TextField
                                    select
                                    size="small"
                                    value={t.assignee_id || ''}
                                    onChange={(e) => updateInline(t.id, { assignee_id: e.target.value || null })}
                                    sx={{ minWidth: 160 }}
                                >
                                    <MenuItem value="">�</MenuItem>
                                    {users.map((u) => (
                                        <MenuItem key={u.id} value={u.id}>
                                            {u.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip
                                        size="small"
                                        color={deadlineColor(t)}
                                        label={t.due_date ? new Date(t.due_date).toLocaleDateString() : '�'}
                                    />
                                </Stack>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Container>
    )
}




