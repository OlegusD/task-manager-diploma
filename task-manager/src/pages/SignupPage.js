import React from 'react'
import { Avatar, Button, TextField, Grid, Box, Typography, Container, Link } from '@mui/material'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import { useNavigate } from 'react-router'

export default function SignupPage() {
    const navigate = useNavigate()

    const handleSignup = (e) => {
        e.preventDefault()
        navigate('/login') // переход на логин после регистрации
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
                    <TextField margin="normal" required fullWidth label="Имя" />
                    <TextField margin="normal" required fullWidth label="Email" />
                    <TextField margin="normal" required fullWidth label="Пароль" type="password" />
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
                        Создать аккаунт
                    </Button>
                    <Grid container justifyContent="flex-end">
                        <Grid item>
                            <Link onClick={() => navigate('/login')} sx={{ cursor: 'pointer' }}>
                                Уже есть аккаунт? Войти
                            </Link>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Container>
    )
}
