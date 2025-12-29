import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link as RouterLink } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Button, Box, Stack } from '@mui/material'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import BoardPage from './pages/BoardPage'
import ListPage from './pages/ListPage'
import TaskPage from './pages/TaskPage'
import TeamPage from './pages/TeamPage'

function Navigation() {
    const { user, logout } = useAuth()
    return (
        <AppBar position="sticky" color="default" elevation={0}>
            <Toolbar sx={{ gap: 2 }}>
                <Typography
                    variant="h6"
                    sx={{ flexGrow: 1, fontWeight: 800 }}
                    component={RouterLink}
                    to="/"
                    color="inherit"
                    underline="none"
                >
                    Task Manager
                </Typography>
                {user ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                            {user.name} ({user.role})
                        </Typography>
                        <Button component={RouterLink} to="/" size="small">
                            Проекты
                        </Button>
                        <Button component={RouterLink} to="/team" size="small">
                            Сотрудники
                        </Button>
                        <Button onClick={logout} size="small" variant="outlined">
                            Выйти
                        </Button>
                    </Stack>
                ) : (
                    <Stack direction="row" spacing={1}>
                        <Button component={RouterLink} to="/login">
                            Войти
                        </Button>
                        <Button component={RouterLink} to="/signup">
                            Регистрация
                        </Button>
                    </Stack>
                )}
            </Toolbar>
        </AppBar>
    )
}

function Protected({ children }) {
    const { token, loadingUser } = useAuth()
    if (loadingUser) return <Box p={3}>Загрузка...</Box>
    if (!token) return <Navigate to="/login" replace />
    return children
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Navigation />
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route
                        path="/"
                        element={
                            <Protected>
                                <DashboardPage />
                            </Protected>
                        }
                    />
                    <Route
                        path="/team"
                        element={
                            <Protected>
                                <TeamPage />
                            </Protected>
                        }
                    />
                    <Route
                        path="/projects/:projectId/board"
                        element={
                            <Protected>
                                <BoardPage />
                            </Protected>
                        }
                    />
                    <Route
                        path="/projects/:projectId/list"
                        element={
                            <Protected>
                                <ListPage />
                            </Protected>
                        }
                    />
                    <Route
                        path="/tasks/:taskId"
                        element={
                            <Protected>
                                <TaskPage />
                            </Protected>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}
