import { useState, useEffect } from 'react'
import { auditApi } from '../api/client'

// Бейдж статусу
function StatusBadge({ status }) {
  const config = {
    success: { label: 'SUCCESS', color: 'text-[#2ECC71] border-[#2ECC71]' },
    denied: { label: 'DENIED', color: 'text-[#FF6B6B] border-[#FF6B6B]' },
    error: { label: 'ERROR', color: 'text-[#FCA316] border-[#FCA316]' }
  }

  const { label, color } = config[status] || { label: status, color: 'text-[#D0E0E1] border-[#D0E0E1]' }

  return (
    <span className={`badge ${color} bg-transparent`}>
      {label}
    </span>
  )
}

// Компонент розгорнутих деталей
function EventDetails({ details }) {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-[#666]">—</span>
  }

  return (
    <pre className="text-xs bg-[#100C00] border border-[#95122C]/30 p-3 rounded overflow-x-auto max-w-md text-[#D0E0E1] font-mono">
      {JSON.stringify(details, null, 2)}
    </pre>
  )
}

// Статистична картка
function StatCard({ value, label, color = '#F3F4F5' }) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-black tracking-wider" style={{ color }}>{value}</p>
      <p className="text-[10px] font-bold text-[#D0E0E1] tracking-widest mt-1">{label}</p>
    </div>
  )
}

export default function AuditPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 })
  const [filters, setFilters] = useState({
    action: '',
    username: '',
    status: '',
    from: '',
    to: ''
  })
  const [actions, setActions] = useState({})
  const [expandedRow, setExpandedRow] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadActions()
  }, [])

  useEffect(() => {
    loadLogs()
    // Авто-оновлення кожні 10 секунд
    const interval = setInterval(loadLogs, 10000)
    return () => clearInterval(interval)
  }, [pagination.page, filters])

  const loadActions = async () => {
    try {
      const response = await auditApi.getActions()
      setActions(response.data.actions)
    } catch (error) {
      console.error('Помилка завантаження типів дій:', error)
    }
  }

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        per_page: 50
      }

      if (filters.action) params.action = filters.action
      if (filters.username) params.username = filters.username
      if (filters.status) params.status = filters.status
      if (filters.from) params.from = filters.from
      if (filters.to) params.to = filters.to

      const response = await auditApi.list(params)
      setLogs(response.data.logs)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Помилка завантаження логів:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = {}
      if (filters.from) params.from = filters.from
      if (filters.to) params.to = filters.to

      const response = await auditApi.export(params)

      // Створюємо посилання для скачування
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url

      const dateFrom = filters.from || 'start'
      const dateTo = filters.to || 'now'
      link.setAttribute('download', `audit_log_${dateFrom}_${dateTo}.csv`)

      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Помилка експорту:', error)
      alert('Помилка експорту: ' + (error.response?.data?.error || error.message))
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      action: '',
      username: '',
      status: '',
      from: '',
      to: ''
    })
    setPagination(p => ({ ...p, page: 1 }))
  }

  // Підрахунок статистики
  const successCount = logs.filter(l => l.status === 'success').length
  const deniedCount = logs.filter(l => l.status === 'denied').length
  const errorCount = logs.filter(l => l.status === 'error').length

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
              <span className="text-[#100C00] text-xl">◆</span>
            </div>
            <h1 className="text-2xl font-black text-[#F3F4F5] tracking-wider">АУДИТ</h1>
          </div>
          <p className="text-[#D0E0E1] text-sm tracking-wide">
            SYSTEM EVENT MONITORING LOG
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn btn-primary"
        >
          <span className="mr-2">↓</span>
          {exporting ? 'EXPORTING...' : 'EXPORT CSV'}
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard value={pagination.total} label="TOTAL RECORDS" color="#F3F4F5" />
        <StatCard value={successCount} label="SUCCESS" color="#2ECC71" />
        <StatCard value={deniedCount} label="DENIED" color="#FF6B6B" />
        <StatCard value={errorCount} label="ERRORS" color="#FCA316" />
      </div>

      {/* Фільтри */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#FF9400]">◈</span>
          <h3 className="text-[#F3F4F5] font-bold tracking-wider text-sm">FILTERS</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="form-label">ACTION TYPE</label>
            <select
              value={filters.action}
              onChange={(e) => {
                setFilters(f => ({ ...f, action: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              {Object.entries(actions).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">USER</label>
            <input
              type="text"
              value={filters.username}
              onChange={(e) => {
                setFilters(f => ({ ...f, username: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              placeholder="Search..."
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">STATUS</label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters(f => ({ ...f, status: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            >
              <option value="">ALL</option>
              <option value="success">SUCCESS</option>
              <option value="denied">DENIED</option>
              <option value="error">ERROR</option>
            </select>
          </div>

          <div>
            <label className="form-label">FROM</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters(f => ({ ...f, from: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">TO</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters(f => ({ ...f, to: e.target.value }))
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="btn btn-secondary w-full"
            >
              RESET
            </button>
          </div>
        </div>
      </div>

      {/* Таблиця */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#FF9400] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#D0E0E1] text-sm tracking-wider">LOADING LOGS...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#D0E0E1] font-bold tracking-wider">NO RECORDS FOUND</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#95122C]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">User</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Resource</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">IP</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-[#95122C]/30 hover:bg-[#95122C]/10 cursor-pointer transition-colors"
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-[#D0E0E1] text-xs whitespace-nowrap font-mono">
                        {new Date(log.timestamp).toLocaleString('uk-UA')}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-[#F3F4F5] text-sm">{log.action_description}</p>
                          <p className="text-[10px] text-[#666] tracking-wider">{log.action}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#D0E0E1] text-sm">{log.username?.toUpperCase() || '—'}</td>
                      <td className="px-4 py-3">
                        {log.resource_type ? (
                          <span className="badge text-[#4ECDC4] border-[#4ECDC4] bg-transparent">
                            {log.resource_type.toUpperCase()}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#666] text-xs font-mono">{log.ip_address}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 text-[#FF9400]">
                        {expandedRow === log.id ? '▲' : '▼'}
                      </td>
                    </tr>
                    {expandedRow === log.id && (
                      <tr className="bg-[#95122C]/5">
                        <td colSpan="7" className="p-4 border-b border-[#95122C]/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-[#FF9400] tracking-wider mb-2">DETAILS</p>
                              <EventDetails details={log.details} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-[#FF9400] tracking-wider mb-2">USER AGENT</p>
                              <p className="text-xs text-[#D0E0E1] break-all">
                                {log.user_agent || '—'}
                              </p>
                              {log.resource_id && (
                                <div className="mt-4">
                                  <p className="text-[10px] font-bold text-[#FF9400] tracking-wider mb-1">RESOURCE ID</p>
                                  <p className="text-xs text-[#D0E0E1] font-mono">{log.resource_id}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Пагінація */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t-2 border-[#95122C]">
            <p className="text-sm text-[#D0E0E1] tracking-wider">
              PAGE {pagination.page} / {pagination.total_pages} ({pagination.total} RECORDS)
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
    </div>
  )
}
