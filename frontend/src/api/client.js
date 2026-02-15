import axios from 'axios'

// Створення Axios інстансу
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Інтерсептор для додавання токена
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Інтерсептор для обробки відповідей
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Якщо 401 і є refresh token — пробуємо оновити
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', {}, {
            headers: {
              Authorization: `Bearer ${refreshToken}`
            }
          })

          const { access_token } = response.data
          localStorage.setItem('access_token', access_token)

          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh token недійсний — виходимо
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }
    }

    return Promise.reject(error)
  }
)

// API методи

// Автентифікація
export const authApi = {
  login: (username, password) =>
    apiClient.post('/auth/login', { username, password }),

  register: (username, email, password) =>
    apiClient.post('/auth/register', { username, email, password }),

  logout: () =>
    apiClient.post('/auth/logout'),

  refresh: () =>
    apiClient.post('/auth/refresh'),

  getMe: () =>
    apiClient.get('/auth/me')
}

// Файли
export const filesApi = {
  list: (params = {}) =>
    apiClient.get('/files', { params }),

  upload: (formData, onProgress) =>
    apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    }),

  download: (fileId) =>
    apiClient.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    }),

  delete: (fileId) =>
    apiClient.delete(`/files/${fileId}`),

  changeVisibility: (fileId, isPublic) =>
    apiClient.patch(`/files/${fileId}/visibility`, { is_public: isPublic }),

  verify: (fileId) =>
    apiClient.post(`/files/${fileId}/verify`),

  verifyAll: () =>
    apiClient.post('/files/verify-all'),

  getStats: () =>
    apiClient.get('/files/stats')
}

// Аудит
export const auditApi = {
  list: (params = {}) =>
    apiClient.get('/audit', { params }),

  export: (params = {}) =>
    apiClient.get('/audit/export', {
      params,
      responseType: 'blob'
    }),

  getStats: (hours = 24) =>
    apiClient.get('/audit/stats', { params: { hours } }),

  getRecent: (limit = 10) =>
    apiClient.get('/audit/recent', { params: { limit } }),

  getActions: () =>
    apiClient.get('/audit/actions')
}

// Загрози
export const threatsApi = {
  list: (params = {}) =>
    apiClient.get('/threats', { params }),

  getStats: (hours = 24) =>
    apiClient.get('/threats/stats', { params: { hours } }),

  resolve: (threatId, resolution, notes = '') =>
    apiClient.post(`/threats/${threatId}/resolve`, { resolution, notes }),

  getTypes: () =>
    apiClient.get('/threats/types'),

  getSeverities: () =>
    apiClient.get('/threats/severities'),

  getResolutions: () =>
    apiClient.get('/threats/resolutions')
}

// Користувачі
export const usersApi = {
  list: (params = {}) =>
    apiClient.get('/users', { params }),

  get: (userId) =>
    apiClient.get(`/users/${userId}`),

  changeRole: (userId, role) =>
    apiClient.patch(`/users/${userId}/role`, { role }),

  block: (userId, durationMinutes = null) =>
    apiClient.post(`/users/${userId}/block`, { duration_minutes: durationMinutes }),

  unblock: (userId) =>
    apiClient.post(`/users/${userId}/unblock`),

  delete: (userId) =>
    apiClient.delete(`/users/${userId}`),

  getRoles: () =>
    apiClient.get('/users/roles'),

  getPermissions: () =>
    apiClient.get('/users/permissions'),

  getStats: () =>
    apiClient.get('/users/stats'),

  // Демо-режим (без аутентифікації)
  demoReset: () =>
    apiClient.post('/users/demo-reset'),

  demoStatus: () =>
    apiClient.get('/users/demo-status')
}

// Хмарні провайдери
export const cloudApi = {
  // Отримати всі провайдери
  getProviders: () =>
    apiClient.get('/cloud/providers'),

  // Інформація про конкретного провайдера
  getProviderInfo: (providerType) =>
    apiClient.get(`/cloud/providers/${providerType}`),

  // Активувати провайдера
  activateProvider: (providerType) =>
    apiClient.post(`/cloud/providers/${providerType}/activate`),

  // Тест з'єднання
  testConnection: (providerType) =>
    apiClient.post(`/cloud/providers/${providerType}/test`),

  // Оновити конфігурацію
  updateConfig: (providerType, config) =>
    apiClient.put(`/cloud/providers/${providerType}/config`, config),

  // Статистика активного провайдера
  getActiveStats: () =>
    apiClient.get('/cloud/active/stats'),

  // Попередження про безпеку
  getWarnings: () =>
    apiClient.get('/cloud/warnings')
}

export default apiClient
