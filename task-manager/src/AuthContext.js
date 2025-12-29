import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, login as apiLogin, register as apiRegister } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('tm-token') || '')
    const [user, setUser] = useState(null)
    const [loadingUser, setLoadingUser] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!token) {
            setUser(null)
            return
        }
        setLoadingUser(true)
        getMe(token)
            .then((u) => setUser(u))
            .catch(() => {
                setUser(null)
                setToken('')
                localStorage.removeItem('tm-token')
            })
            .finally(() => setLoadingUser(false))
    }, [token])

    const login = async (email, password) => {
        setError('')
        const { token: tkn } = await apiLogin(email, password)
        localStorage.setItem('tm-token', tkn)
        setToken(tkn)
    }

    const signup = async ({ email, password, name }) => {
        setError('')
        const { token: tkn } = await apiRegister({ email, password, name })
        localStorage.setItem('tm-token', tkn)
        setToken(tkn)
    }

    const logout = () => {
        setToken('')
        setUser(null)
        localStorage.removeItem('tm-token')
    }

    const value = useMemo(
        () => ({ token, user, loadingUser, login, signup, logout, error, setError }),
        [token, user, loadingUser, error]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('AuthProvider missing')
    return ctx
}
