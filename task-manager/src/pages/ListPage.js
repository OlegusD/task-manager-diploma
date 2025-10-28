import React from 'react'
import { useParams, Link as RouterLink } from 'react-router'
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
} from '@mui/material'

const rows = [
    { id: 't-101', title: 'Настроить проект', status: 'To Do', priority: 'Medium' },
    { id: 't-102', title: 'Сделать канбан', status: 'To Do', priority: 'High' },
    { id: 't-201', title: 'Подключить BE', status: 'In Progress', priority: 'High' },
    { id: 't-202', title: 'Добавить JWT', status: 'In Progress', priority: 'Medium' },
    { id: 't-301', title: 'Сделать деплой', status: 'Review', priority: 'Low' },
]

export default function ListPage() {
    const { projectId } = useParams()
    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Проект: {projectId} — List
            </Typography>

            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Задача</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell>Приоритет</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.id} hover>
                            <TableCell>
                                <Link
                                    component={RouterLink}
                                    to={`/tasks/${r.id}`}
                                    underline="hover"
                                >
                                    {r.title}
                                </Link>
                            </TableCell>
                            <TableCell>
                                <Chip size="small" label={r.status} />
                            </TableCell>
                            <TableCell>{r.priority}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Typography sx={{ mt: 2 }}>
                <Link component={RouterLink} to={`/${projectId}/board`}>
                    Перейти в Board
                </Link>
            </Typography>
        </Container>
    )
}
