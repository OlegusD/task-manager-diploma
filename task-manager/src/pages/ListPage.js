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
    Alert,
} from '@mui/material'
import { listTasks, listStatuses, listPriorities, listTaskTypes } from '../api'
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

    useEffect(() => {
        if (!token) return
        loadData()
    }, [token, projectId])

    async function loadData() {
        try {
            const [tks, sts, prs, tts] = await Promise.all([
                listTasks(token, { project_id: projectId }),
                listStatuses(token),
                listPriorities(token),
                listTaskTypes(token),
            ])
            setTasks(tks)
            setStatusMap(Object.fromEntries(sts.map((s) => [s.id, s.name])))
            setPriorityMap(Object.fromEntries(prs.map((p) => [p.id, p.name])))
            setTypeMap(Object.fromEntries(tts.map((t) => [t.id, t.name])))
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }} fontWeight={800}>
                Проект · список
            </Typography>
            {error ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            ) : null}

            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Задача</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell>Приоритет</TableCell>
                        <TableCell>Тип</TableCell>
                        <TableCell>Ответственный</TableCell>
                        <TableCell>Срок</TableCell>
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
                                <Chip size="small" label={statusMap[t.status_id] || '—'} />
                            </TableCell>
                            <TableCell>{priorityMap[t.priority_id] || '—'}</TableCell>
                            <TableCell>{typeMap[t.type_id] || '—'}</TableCell>
                            <TableCell>{t.assignee_name || '—'}</TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip
                                        size="small"
                                        color={deadlineColor(t)}
                                        label={t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
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
