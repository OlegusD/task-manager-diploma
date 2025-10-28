import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router'
import { AppBar, Toolbar, Typography, Button } from '@mui/material'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import Dashboard from './pages/DashboardPage'
import BoardPage from './pages/BoardPage'
import ListPage from './pages/ListPage'
import TaskPage from './pages/TaskPage'

export default function App() {
    return (
        <>
            <BrowserRouter>
                <AppBar position="sticky" color="default" elevation={0}>
                    <Toolbar sx={{ gap: 2 }}>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            Task Manager
                        </Typography>
                        <Button component={Link} to="/">
                            Dashboard
                        </Button>
                        <Button component={Link} to="/login">
                            Login
                        </Button>
                        <Button component={Link} to="/signup">
                            Sign Up
                        </Button>
                    </Toolbar>
                </AppBar>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/:projectId/board" element={<BoardPage />} />
                    <Route path="/:projectId/list" element={<ListPage />} />
                    <Route path="/tasks/:taskId" element={<TaskPage />} />
                </Routes>
            </BrowserRouter>
        </>
    )
}
