import { useState, useEffect } from 'react'
import { threatsApi } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

// Кольори для графіків у новому стилі
const SEVERITY_COLORS = {
  critical: '#FF6B6B',
  high: '#FF9400',
  medium: '#4ECDC4',
  low: '#2ECC71'
}

const PIE_COLORS = ['#FF9400', '#95122C', '#4ECDC4', '#2ECC71', '#9B59B6', '#FCA316']

// Бейдж рівня серйозності
function SeverityBadge({ severity }) {
  const config = {
    critical: { label: 'CRITICAL', color: 'text-[#FF6B6B] border-[#FF6B6B]' },
    high: { label: 'HIGH', color: 'text-[#FF9400] border-[#FF9400]' },
    medium: { label: 'MEDIUM', color: 'text-[#4ECDC4] border-[#4ECDC4]' },
    low: { label: 'LOW', color: 'text-[#2ECC71] border-[#2ECC71]' }
  }

  const { label, color } = config[severity] || { label: severity, color: 'text-[#D0E0E1] border-[#D0E0E1]' }

  return (
    <span className={`badge ${color} bg-transparent`}>
      {label}
    </span>
  )
}

// Статистична картка
function StatCard({ value, label, color = '#F3F4F5', icon }) {
  return (
    <div className="card text-center">
      {icon && (
        <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
          <span className="text-[#100C00] text-lg">{icon}</span>
        </div>
      )}
      <p className="text-3xl font-black tracking-wider" style={{ color }}>{value}</p>
      <p className="text-[10px] font-bold text-[#D0E0E1] tracking-widest mt-1">{label}</p>
    </div>
  )
}

// Модальне вікно вирішення загрози
function ResolveModal({ threat, onClose, onResolve }) {
  const [resolution, setResolution] = useState('false_positive')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onResolve(threat.id, resolution, notes)
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
              <span className="text-[#100C00] text-lg">⚠</span>
            </div>
            <h3 className="text-lg font-black text-[#F3F4F5] tracking-wider">RESOLVE THREAT</h3>
          </div>
          <button onClick={onClose} className="text-[#D0E0E1] hover:text-[#FF9400] text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#95122C]/10 border border-[#95122C]/30 rounded p-3">
            <p className="text-xs text-[#D0E0E1] mb-1">
              <span className="text-[#FF9400]">TYPE:</span> {threat.threat_type}
            </p>
            <p className="text-sm text-[#F3F4F5]">{threat.description}</p>
          </div>

          <div>
            <label className="form-label">RESOLUTION TYPE</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="form-input"
            >
              <option value="false_positive">False Positive</option>
              <option value="confirmed">Confirmed</option>
              <option value="mitigated">Mitigated</option>
            </select>
          </div>

          <div>
            <label className="form-label">NOTES</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="form-input"
              placeholder="Describe actions taken..."
            />
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

// Кастомний тултіп для графіків
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#100C00] border-2 border-[#95122C] p-3 cut-corner-sm">
        <p className="text-[#FF9400] text-xs font-bold">{label}</p>
        <p className="text-[#F3F4F5] text-sm">{payload[0].value} threats</p>
      </div>
    )
  }
  return null
}

export default function ThreatsPage() {
  const [threats, setThreats] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 })
  const [filters, setFilters] = useState({
    severity: '',
    threat_type: '',
    is_resolved: ''
  })
  const [resolveModal, setResolveModal] = useState(null)
  const [threatTypes, setThreatTypes] = useState({})

  useEffect(() => {
    loadThreatTypes()
    loadStats()
    // Авто-оновлення статистики
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadThreats()
    // Авто-оновлення списку загроз
    const interval = setInterval(loadThreats, 10000)
    return () => clearInterval(interval)
  }, [pagination.page, filters])

  const loadThreatTypes = async () => {
    try {
      const response = await threatsApi.getTypes()
      setThreatTypes(response.data.types)
    } catch (error) {
      console.error('Помилка завантаження типів:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await threatsApi.getStats(168) // За тиждень
      setStats(response.data)
    } catch (error) {
      console.error('Помилка завантаження статистики:', error)
    }
  }

  const loadThreats = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        per_page: 20
      }

      if (filters.severity) params.severity = filters.severity
      if (filters.threat_type) params.threat_type = filters.threat_type
      if (filters.is_resolved) params.is_resolved = filters.is_resolved

      const response = await threatsApi.list(params)
      setThreats(response.data.threats)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Помилка завантаження загроз:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (threatId, resolution, notes) => {
    await threatsApi.resolve(threatId, resolution, notes)
    loadThreats()
    loadStats()
  }

  // Підготовка даних для графіка по годинах
  const hourlyData = stats?.threat_by_hour || []

  // Підготовка даних для кругової діаграми
  const typeData = Object.entries(stats?.threat_by_type || {}).map(([name, value]) => ({
    name: threatTypes[name]?.description || name,
    value
  }))

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
            <span className="text-[#100C00] text-xl">⚠</span>
          </div>
          <h1 className="text-2xl font-black text-[#F3F4F5] tracking-wider">ЗАГРОЗИ</h1>
        </div>
        <p className="text-[#D0E0E1] text-sm tracking-wide">
          THREAT DETECTION & RESPONSE SYSTEM
        </p>
      </div>

      {/* Картки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard value={stats?.total_events_24h || 0} label="THREATS 24H" icon="◈" />
        <StatCard value={stats?.critical_events_24h || 0} label="CRITICAL" color="#FF6B6B" />
        <StatCard value={stats?.high_events_24h || 0} label="HIGH" color="#FF9400" />
        <StatCard value={stats?.blocked_accounts || 0} label="BLOCKED ACCOUNTS" color="#95122C" />
      </div>

      {/* Графіки */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Графік по годинах */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#FF9400]">◈</span>
            <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">THREATS LAST 24H</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#95122C30" />
                <XAxis dataKey="hour" stroke="#D0E0E1" fontSize={10} />
                <YAxis stroke="#D0E0E1" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#FF9400" name="Threats" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Кругова діаграма по типах */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#FF9400]">◈</span>
            <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">BY TYPE</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#100C00',
                    border: '2px solid #95122C',
                    borderRadius: '4px'
                  }}
                  labelStyle={{ color: '#FF9400' }}
                  itemStyle={{ color: '#F3F4F5' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '10px', color: '#D0E0E1' }}
                  formatter={(value) => <span className="text-[#D0E0E1]">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Топ користувачів */}
      {stats?.top_threat_users?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#FF9400]">◈</span>
            <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">TOP THREAT USERS</h3>
          </div>
          <div className="space-y-3">
            {stats.top_threat_users.map((user, index) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-[#95122C]/10 border border-[#95122C]/30 rounded">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
                    <span className="text-[#100C00] font-black text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-bold text-[#F3F4F5] tracking-wide">{user.username.toUpperCase()}</p>
                    <p className="text-[10px] text-[#D0E0E1] tracking-wider">{user.events} EVENTS</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-[#FF6B6B]">{user.score}</p>
                  <p className="text-[8px] text-[#D0E0E1] tracking-widest">THREAT SCORE</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Фільтри */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#FF9400]">◈</span>
          <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">FILTERS</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">SEVERITY</label>
            <select
              value={filters.severity}
              onChange={(e) => {
                setFilters(f => ({ ...f, severity: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              <option value="critical">CRITICAL</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
          </div>

          <div>
            <label className="form-label">TYPE</label>
            <select
              value={filters.threat_type}
              onChange={(e) => {
                setFilters(f => ({ ...f, threat_type: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              {Object.keys(threatTypes).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">STATUS</label>
            <select
              value={filters.is_resolved}
              onChange={(e) => {
                setFilters(f => ({ ...f, is_resolved: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              <option value="false">ACTIVE</option>
              <option value="true">RESOLVED</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ severity: '', threat_type: '', is_resolved: '' })
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="btn btn-secondary w-full"
            >
              RESET
            </button>
          </div>
        </div>
      </div>

      {/* Таблиця загроз */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#FF9400] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#D0E0E1] text-sm tracking-wider">SCANNING THREATS...</p>
            </div>
          </div>
        ) : threats.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#2ECC71]/20 rounded-lg flex items-center justify-center">
              <span className="text-[#2ECC71] text-2xl">✓</span>
            </div>
            <p className="text-[#2ECC71] font-bold tracking-wider">NO THREATS DETECTED</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#95122C]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Severity</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">User</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {threats.map(threat => (
                  <tr key={threat.id} className="border-b border-[#95122C]/30 hover:bg-[#95122C]/10 transition-colors">
                    <td className="px-4 py-3 text-[#D0E0E1] text-xs whitespace-nowrap font-mono">
                      {new Date(threat.timestamp).toLocaleString('uk-UA')}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#F3F4F5] text-sm">{threat.threat_type}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={threat.severity} /></td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-sm">
                      {threat.user?.username?.toUpperCase() || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-sm max-w-xs truncate">
                      {threat.description}
                    </td>
                    <td className="px-4 py-3">
                      {threat.is_resolved ? (
                        <span className="badge text-[#2ECC71] border-[#2ECC71] bg-transparent">
                          {threat.resolution?.toUpperCase()}
                        </span>
                      ) : (
                        <span className="badge text-[#FCA316] border-[#FCA316] bg-transparent animate-pulse">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!threat.is_resolved && (
                        <button
                          onClick={() => setResolveModal(threat)}
                          className="btn btn-sm btn-primary"
                        >
                          RESOLVE
                        </button>
                      )}
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

      {/* Модальне вікно */}
      {resolveModal && (
        <ResolveModal
          threat={resolveModal}
          onClose={() => setResolveModal(null)}
          onResolve={handleResolve}
        />
      )}
    </div>
  )
}
