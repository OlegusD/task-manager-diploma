import React from 'react'
import { Container, Typography, Button, Box, Stack } from '@mui/material'
import { useNavigate } from 'react-router'

export default function Dashboard() {
    const navigate = useNavigate()
    const demoProject = 'demo-project'
    const demoTaskId = 't-123'

    return (
        <Container sx={{ py: 8 }}>
            <Typography variant="h4" gutterBottom>
                Добро пожаловать в Task Manager
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
                Здесь будут проекты. Для навигации — демо-кнопки ниже.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
                <Button variant="contained" onClick={() => navigate(`/${demoProject}/board`)}>
                    Открыть Board
                </Button>
                <Button variant="outlined" onClick={() => navigate(`/${demoProject}/list`)}>
                    Открыть List
                </Button>
                <Button onClick={() => navigate(`/tasks/${demoTaskId}`)}>Открыть Task</Button>
            </Stack>

            <Box sx={{ mt: 5 }}>
                <Typography variant="caption" color="text.secondary">
                    Навигация без логики: только переходы по маршрутам.
                </Typography>
            </Box>
        </Container>
    )
}
