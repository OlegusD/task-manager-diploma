import React from 'react'
import { useParams, Link as RouterLink } from 'react-router'
import { Box, Container, Typography, Stack, Card, CardContent, Link } from '@mui/material'

const cols = [
    { id: 'todo', title: 'To Do' },
    { id: 'inprogress', title: 'In Progress' },
    { id: 'review', title: 'Review' },
    { id: 'bugfix', title: 'BugFix' },
]

const demoTasks = [
    { id: 't-101', title: 'Настроить проект', hint: 'Vite + MUI', col: 'todo' },
    { id: 't-102', title: 'Сделать канбан', hint: '@dnd-kit', col: 'todo' },
    { id: 't-201', title: 'Подключить бэкенд', hint: 'Express API', col: 'inprogress' },
    { id: 't-202', title: 'Добавить авторизацию', hint: 'JWT', col: 'inprogress' },
    { id: 't-301', title: 'Сделать деплой', hint: '—', col: 'review' },
]

export default function BoardPage() {
    const { projectId } = useParams()
    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Проект: {projectId} — Board
            </Typography>
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ overflowX: 'auto' }}>
                {cols.map((col) => (
                    <Box key={col.id} sx={{ width: 320, flexShrink: 0 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                            {col.title}
                        </Typography>
                        <Box
                            sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                                minHeight: 80,
                            }}
                        >
                            {demoTasks
                                .filter((t) => t.col === col.id)
                                .map((t) => (
                                    <Card key={t.id} variant="outlined" sx={{ mb: 1 }}>
                                        <CardContent sx={{ p: 1.25 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                <Link
                                                    component={RouterLink}
                                                    to={`/tasks/${t.id}`}
                                                    underline="hover"
                                                >
                                                    {t.title}
                                                </Link>
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t.hint}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                ))}
                        </Box>
                    </Box>
                ))}
            </Stack>
            <Typography sx={{ mt: 2 }}>
                <Link component={RouterLink} to={`/${projectId}/list`}>
                    Перейти в List
                </Link>
            </Typography>
        </Container>
    )
}
