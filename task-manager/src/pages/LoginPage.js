import React, { useState } from 'react'
import { Avatar, Button, TextField, Grid, Box, Typography, Container, Link, Alert } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function LoginPage() {
    const navigate = useNavigate()
    const { login, setError, error } = useAuth()
    const [email, setEmail] = useState('admin@local')
    const [password, setPassword] = useState('admin')
    const [submitting, setSubmitting] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            await login(email, password)
            navigate('/')
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar sx={{ m: 1 }}>
                    <LockOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Вход
                </Typography>
                <Box component="form" onSubmit={handleLogin} sx={{ mt: 1 }}>
                    {error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Пароль"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={submitting}
                    >
                        Войти
                    </Button>
                    <Grid container justifyContent="flex-end">
                        <Grid item>
                            <Link component={RouterLink} to="/signup" sx={{ cursor: 'pointer' }}>
                                Еще нет аккаунта? Регистрация
                            </Link>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Container>
    )
}
