import { useState, useEffect } from 'react'
import { usersApi } from '../api/client'

// Бейдж ролі
function RoleBadge({ role }) {
  const config = {
    admin: { label: 'ADMIN', color: 'text-[#FF9400] border-[#FF9400]' },
    user: { label: 'USER', color: 'text-[#4ECDC4] border-[#4ECDC4]' },
    guest: { label: 'GUEST', color: 'text-[#D0E0E1] border-[#D0E0E1]' }
  }

  const { label, color } = config[role] || config.guest

  return (
    <span className={`badge ${color} bg-transparent`}>
      {label}
    </span>
  )
}

// Статистична картка
function StatCard({ value, label, color = '#F3F4F5' }) {
  return (
    <div className="card text-center">
      <p className="text-2xl font-black tracking-wider" style={{ color }}>{value}</p>
      <p className="text-[10px] font-bold text-[#D0E0E1] tracking-widest mt-1">{label}</p>
    </div>
  )
}

// Матриця прав доступу
function RoleMatrix({ permissions }) {
  const roles = ['admin', 'user', 'guest']
  const roleLabels = { admin: 'ADMIN', user: 'USER', guest: 'GUEST' }
  const roleColors = { admin: '#FF9400', user: '#4ECDC4', guest: '#D0E0E1' }
  const resourceLabels = {
    files: 'FILES',
    users: 'USERS',
    audit: 'AUDIT',
    threats: 'THREATS',
    integrity: 'INTEGRITY'
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#FF9400]">◈</span>
        <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">ACCESS MATRIX</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[#95122C]">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-[#D0E0E1] tracking-wider uppercase">
                Resource
              </th>
              {roles.map(role => (
                <th key={role} className="px-4 py-3 text-center text-[10px] font-bold tracking-wider uppercase" style={{ color: roleColors[role] }}>
                  {roleLabels[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(permissions).map(([resource, rolePerms]) => (
              <tr key={resource} className="border-b border-[#95122C]/30">
                <td className="px-4 py-3 font-bold text-[#F3F4F5] tracking-wide">
                  {resourceLabels[resource] || resource.toUpperCase()}
                </td>
                {roles.map(role => (
                  <td key={role} className="px-4 py-3 text-center">
                    {rolePerms[role]?.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1">
                        {rolePerms[role].map(action => (
                          <span key={action} className="text-[10px] bg-[#2ECC71]/20 text-[#2ECC71] px-2 py-0.5 rounded tracking-wider">
                            {action.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#666]">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Модальне вікно зміни ролі
function ChangeRoleModal({ user, onClose, onSave }) {
  const [role, setRole] = useState(user.role)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (role === user.role) {
      onClose()
      return
    }

    setLoading(true)
    try {
      await onSave(user.id, role)
      onClose()
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#100C00]/90 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4" style={{ '--cut-size': '15px' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
              <span className="text-[#100C00] text-lg">◉</span>
            </div>
            <h3 className="text-lg font-black text-[#F3F4F5] tracking-wider">CHANGE ROLE</h3>
          </div>
          <button onClick={onClose} className="text-[#D0E0E1] hover:text-[#FF9400] text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#95122C]/10 border border-[#95122C]/30 rounded p-3">
            <p className="text-xs text-[#D0E0E1] mb-1">USER</p>
            <p className="text-lg font-bold text-[#F3F4F5] tracking-wide">{user.username.toUpperCase()}</p>
          </div>

          <div>
            <label className="form-label">NEW ROLE</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
            >
              <option value="admin">Administrator</option>
              <option value="user">User</option>
              <option value="guest">Guest</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              CANCEL
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'SAVING...' : 'SAVE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 })
  const [filters, setFilters] = useState({ search: '', role: '', is_blocked: '' })
  const [roleModal, setRoleModal] = useState(null)

  useEffect(() => {
    loadPermissions()
    loadStats()
    // Авто-оновлення статистики
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadUsers()
    // Авто-оновлення списку користувачів
    const interval = setInterval(loadUsers, 10000)
    return () => clearInterval(interval)
  }, [pagination.page, filters])

  const loadPermissions = async () => {
    try {
      const response = await usersApi.getPermissions()
      setPermissions(response.data.permissions)
    } catch (error) {
      console.error('Помилка завантаження прав:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await usersApi.getStats()
      setStats(response.data)
    } catch (error) {
      console.error('Помилка завантаження статистики:', error)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        per_page: 20
      }

      if (filters.search) params.search = filters.search
      if (filters.role) params.role = filters.role
      if (filters.is_blocked) params.is_blocked = filters.is_blocked

      const response = await usersApi.list(params)
      setUsers(response.data.users)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Помилка завантаження користувачів:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChangeRole = async (userId, role) => {
    await usersApi.changeRole(userId, role)
    loadUsers()
    loadStats()
  }

  const handleBlock = async (userId) => {
    if (!confirm('Заблокувати цього користувача?')) return
    try {
      await usersApi.block(userId)
      loadUsers()
      loadStats()
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleUnblock = async (userId) => {
    try {
      await usersApi.unblock(userId)
      loadUsers()
      loadStats()
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleDelete = async (user) => {
    if (!confirm(`Видалити користувача "${user.username}"? Цю дію неможливо скасувати.`)) return
    try {
      await usersApi.delete(user.id)
      loadUsers()
      loadStats()
    } catch (error) {
      alert('Помилка: ' + (error.response?.data?.error || error.message))
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
            <span className="text-[#100C00] text-xl">◉</span>
          </div>
          <h1 className="text-2xl font-black text-[#F3F4F5] tracking-wider">ЮЗЕРИ</h1>
        </div>
        <p className="text-[#D0E0E1] text-sm tracking-wide">
          USER ACCESS CONTROL MANAGEMENT
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard value={stats?.total || 0} label="TOTAL" color="#F3F4F5" />
        <StatCard value={stats?.by_role?.admin || 0} label="ADMINS" color="#FF9400" />
        <StatCard value={stats?.by_role?.user || 0} label="USERS" color="#4ECDC4" />
        <StatCard value={stats?.by_role?.guest || 0} label="GUESTS" color="#D0E0E1" />
        <StatCard value={stats?.blocked || 0} label="BLOCKED" color="#FF6B6B" />
      </div>

      {/* Матриця прав */}
      <RoleMatrix permissions={permissions} />

      {/* Фільтри */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#FF9400]">◈</span>
          <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">FILTERS</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">SEARCH</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => {
                setFilters(f => ({ ...f, search: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              placeholder="Name or email..."
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">ROLE</label>
            <select
              value={filters.role}
              onChange={(e) => {
                setFilters(f => ({ ...f, role: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              <option value="admin">ADMIN</option>
              <option value="user">USER</option>
              <option value="guest">GUEST</option>
            </select>
          </div>

          <div>
            <label className="form-label">STATUS</label>
            <select
              value={filters.is_blocked}
              onChange={(e) => {
                setFilters(f => ({ ...f, is_blocked: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              <option value="false">ACTIVE</option>
              <option value="true">BLOCKED</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ search: '', role: '', is_blocked: '' })
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="btn btn-secondary w-full"
            >
              RESET
            </button>
          </div>
        </div>
      </div>

      {/* Таблиця користувачів */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#FF9400] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#D0E0E1] text-sm tracking-wider">LOADING USERS...</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#D0E0E1] font-bold tracking-wider">NO USERS FOUND</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#95122C]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">User</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Threat Score</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Last Activity</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-[#95122C]/30 hover:bg-[#95122C]/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
                          <span className="text-[#100C00] font-black text-sm">
                            {user.username[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="ml-3 font-bold text-[#F3F4F5] tracking-wide">{user.username.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-sm">{user.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3">
                      {user.is_blocked ? (
                        <span className="badge text-[#FF6B6B] border-[#FF6B6B] bg-transparent">BLOCKED</span>
                      ) : (
                        <span className="badge text-[#2ECC71] border-[#2ECC71] bg-transparent">ACTIVE</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-[#100C00] border border-[#95122C]/30 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.min(100, user.threat_score)}%`,
                              backgroundColor: user.threat_score >= 50 ? '#FF6B6B' : user.threat_score >= 20 ? '#FCA316' : '#2ECC71'
                            }}
                          />
                        </div>
                        <span className={`font-bold text-sm ${
                          user.threat_score >= 50 ? 'text-[#FF6B6B]' :
                          user.threat_score >= 20 ? 'text-[#FCA316]' : 'text-[#2ECC71]'
                        }`}>
                          {user.threat_score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-xs font-mono">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('uk-UA')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRoleModal(user)}
                          className="btn btn-sm btn-secondary"
                          title="Змінити роль"
                        >
                          ROLE
                        </button>

                        {user.is_blocked ? (
                          <button
                            onClick={() => handleUnblock(user.id)}
                            className="btn btn-sm btn-primary"
                            title="Розблокувати"
                          >
                            UNBLOCK
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlock(user.id)}
                            className="btn btn-sm btn-secondary"
                            title="Заблокувати"
                          >
                            BLOCK
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(user)}
                          className="btn btn-sm btn-danger"
                          title="Видалити"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Пагінація */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t-2 border-[#95122C]">
            <p className="text-sm text-[#D0E0E1] tracking-wider">
              PAGE {pagination.page} / {pagination.total_pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={!pagination.has_prev}
                className="btn btn-sm btn-secondary disabled:opacity-50"
              >
                ← PREV
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={!pagination.has_next}
                className="btn btn-sm btn-secondary disabled:opacity-50"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модальне вікно зміни ролі */}
      {roleModal && (
        <ChangeRoleModal
          user={roleModal}
          onClose={() => setRoleModal(null)}
          onSave={handleChangeRole}
        />
      )}
    </div>
  )
}
