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
            setError('Р—Р°РїРѕР»РЅРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅРѕ РёРјСЏ, email Рё РїР°СЂРѕР»СЊ (РјРёРЅ 6 СЃРёРјРІРѕР»РѕРІ)')
            return
        }
        setSubmitting(true)
        try {
            await signup({ email, password, name, role: 'РіРѕСЃС‚СЊ' })
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
                    Р РµРіРёСЃС‚СЂР°С†РёСЏ
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
                        label="РРјСЏ"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={formErrors.name}
                        helperText={formErrors.name ? 'РРјСЏ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ' : ''}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={formErrors.email}
                        helperText={formErrors.email ? 'Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email' : ''}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="РџР°СЂРѕР»СЊ"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={formErrors.password}
                        helperText={formErrors.password ? 'РњРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ' : ''}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={submitting}
                    >
                        РЎРѕР·РґР°С‚СЊ Р°РєРєР°СѓРЅС‚
                    </Button>
                    <Grid container justifyContent="flex-end">
                        <Grid item>
                            <Link component={RouterLink} to="/login" sx={{ cursor: 'pointer' }}>
                                РЈР¶Рµ РµСЃС‚СЊ Р°РєРєР°СѓРЅС‚? Р’РѕР№С‚Рё
                            </Link>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Container>
    )
}


