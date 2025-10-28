import React from 'react'
import { useParams, Link as RouterLink } from 'react-router'
import { Container, Typography, Paper, Stack, Chip, Link, Divider } from '@mui/material'

export default function TaskPage() {
    const { taskId } = useParams()
    // без логики — просто заглушка деталей
    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Задача: {taskId}
            </Typography>
            <Paper sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip label="Статус: In Progress" size="small" />
                    <Chip label="Приоритет: High" size="small" />
                </Stack>
                <Typography variant="subtitle1" fontWeight={700}>
                    Краткое описание
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Здесь будут детали задачи, комментарии и история изменений.
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                    <Link component={RouterLink} to="/demo-project/list">
                        ← К списку
                    </Link>
                </Typography>
            </Paper>
        </Container>
    )
}
