import React, { useState } from 'react'
import { Avatar, Button, TextField, Grid, Box, Typography, Container, Link, Alert } from '@mui/material'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function SignupPage() {
    const navigate = useNavigate()
    const { signup, setError, error } = useAuth()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const formErrors = {
        name: !name.trim(),
        email: !email.includes('@'),
        password: password.length < 6,
    }

    const handleSignup = async (e) => {
        e.preventDefault()
        if (formErrors.name || formErrors.email || formErrors.password) {
            setError('Заполните корректно имя, email и пароль (мин 6 символов)')
            return
        }
        setSubmitting(true)
        try {
            await signup({ email, password, name, role: 'гость' })
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
                    <PersonAddAltOutlinedIcon />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Регистрация
                </Typography>
                <Box component="form" onSubmit={handleSignup} sx={{ mt: 1 }}>
                    {error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Имя"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={formErrors.name}
                        helperText={formErrors.name ? 'Имя обязательно' : ''}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={formErrors.email}
                        helperText={formErrors.email ? 'Введите корректный email' : ''}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Пароль"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={formErrors.password}
                        helperText={formErrors.password ? 'Минимум 6 символов' : ''}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={submitting}
                    >
                        Создать аккаунт
                    </Button>
                    <Grid container justifyContent="flex-end">
                        <Grid item>
                            <Link component={RouterLink} to="/login" sx={{ cursor: 'pointer' }}>
                                Уже есть аккаунт? Войти
                            </Link>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Container>
    )
}

