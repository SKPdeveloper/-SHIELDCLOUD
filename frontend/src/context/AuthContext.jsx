import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Перевірка автентифікації при завантаженні
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token')
      const savedUser = localStorage.getItem('user')

      if (token && savedUser) {
        try {
          // Перевіряємо валідність токена
          const response = await authApi.getMe()
          setUser(response.data.user)
          localStorage.setItem('user', JSON.stringify(response.data.user))
        } catch (error) {
          // Токен недійсний
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user')
          setUser(null)
        }
      }

      setLoading(false)
    }

    initAuth()
  }, [])

  // Вхід
  const login = async (username, password) => {
    const response = await authApi.login(username, password)
    const { access_token, refresh_token, user: userData } = response.data

    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    localStorage.setItem('user', JSON.stringify(userData))

    setUser(userData)
    return userData
  }

  // Реєстрація
  const register = async (username, email, password) => {
    const response = await authApi.register(username, email, password)
    const { access_token, refresh_token, user: userData } = response.data

    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    localStorage.setItem('user', JSON.stringify(userData))

    setUser(userData)
    return userData
  }

  // Вихід
  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Ігноруємо помилки при виході
    }

    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    // Очищаємо збережені ключі шифрування
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('file_key_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    setUser(null)
  }

  // Оновлення даних користувача
  const updateUser = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  // Перевірка ролі
  const hasRole = (roles) => {
    if (!user) return false
    if (typeof roles === 'string') return user.role === roles
    return roles.includes(user.role)
  }

  // Перевірка чи є адміністратором
  const isAdmin = () => user?.role === 'admin'

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    hasRole,
    isAdmin
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth має використовуватись всередині AuthProvider')
  }
  return context
}
