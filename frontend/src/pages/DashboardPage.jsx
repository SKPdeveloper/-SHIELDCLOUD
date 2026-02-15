import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { filesApi, auditApi, threatsApi, usersApi } from '../api/client'

// ========== ІНФОРМАЦІЯ ПРО АТАКИ ==========
const AUTH_ATTACK_INFO = {
  mass_download: {
    name: 'MASS DOWNLOAD',
    icon: '📥',
    danger: 'ВИСОКА',
    description: `Mass Download — масове скачування для викрадення даних.
• 60% витоків — через інсайдерів
• Середній збиток: $4.24 млн
• 287 днів — час виявлення`,
    protection: `ДЕТЕКЦІЯ: >20 файлів за 5 хв
РЕАКЦІЯ: Threat Score +15-25, rate limiting
ФОРЕНЗІКА: Повний аудит-трейл`
  },
  mass_delete: {
    name: 'MASS DELETE',
    icon: '🗑️',
    danger: 'КРИТИЧНА',
    description: `Mass Delete — саботаж, знищення даних.
• 45% ransomware включають видалення бекапів
• 60% малих бізнесів закриваються після втрати даних`,
    protection: `ДЕТЕКЦІЯ: >10 видалень за 5 хв
РЕАКЦІЯ: НЕГАЙНЕ блокування, Score +30
ВІДНОВЛЕННЯ: Soft delete, S3 Versioning`
  },
  rapid_requests: {
    name: 'RAPID REQUESTS',
    icon: '⚡',
    danger: 'ВИСОКА',
    description: `DDoS-подібна атака — перевантаження серверу.
• DDoS зросли на 150% за 2023
• Вартість 1 хв простою: $5,600`,
    protection: `ДЕТЕКЦІЯ: Rate limit 100 req/min
РЕАКЦІЯ: HTTP 429, прогресивні затримки
ІНФРА: CDN, Auto-scaling`
  },
  unauthorized_access: {
    name: 'UNAUTHORIZED ACCESS',
    icon: '🚫',
    danger: 'КРИТИЧНА',
    description: `Спроба доступу до чужих ресурсів.
• IDOR — в топ-10 OWASP
• 34% витоків — через неправильний контроль`,
    protection: `ДЕТЕКЦІЯ: Перевірка прав на кожен запит
РЕАКЦІЯ: 403 Forbidden, Score +30
АРХІТЕКТУРА: UUID, серверна валідація`
  },
  privilege_escalation: {
    name: 'PRIVILEGE ESCALATION',
    icon: '👑',
    danger: 'КРИТИЧНА',
    description: `Підвищення привілеїв до admin.
• Присутня в 80% успішних зломів
• Вертикальна ескалація — найнебезпечніша`,
    protection: `ДЕТЕКЦІЯ: JWT верифікація, перевірка ролі з БД
РЕАКЦІЯ: 403, Score +50, блокування
АРХІТЕКТУРА: RBAC, deny by default`
  },
  data_exfiltration: {
    name: 'DATA EXFILTRATION',
    icon: '📤',
    danger: 'КРИТИЧНА',
    description: `Систематичне викрадення даних.
• 70% витоків не виявляються місяцями
• Кожен запис PII = $180 збитків`,
    protection: `ДЕТЕКЦІЯ: DLP моніторинг, аномальний трафік
РЕАКЦІЯ: Блокування, карантин, Score +40
ПРЕВЕНЦІЯ: Водяні знаки, шифрування`
  }
}

// ========== МОДАЛЬНЕ ВІКНО ІНФОРМАЦІЇ ПРО АТАКУ ==========
function InfoModal({ attackKey, onClose }) {
  const info = AUTH_ATTACK_INFO[attackKey]
  if (!info) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#95122C] to-[#FF9400] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{info.icon}</span>
              <div>
                <h2 className="text-[#F3F4F5] font-black tracking-wider">{info.name}</h2>
                <span className="badge badge-danger">НЕБЕЗПЕКА: {info.danger}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-[#F3F4F5]/60 hover:text-[#F3F4F5] text-2xl">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-[#FF9400] font-bold text-sm mb-2">⚔️ ОПИС</h3>
            <pre className="text-[#D0E0E1] text-sm whitespace-pre-wrap font-mono bg-[#100C00] p-3 border-l-2 border-[#95122C]">{info.description}</pre>
          </div>
          <div>
            <h3 className="text-[#2ECC71] font-bold text-sm mb-2">🛡️ ЗАХИСТ</h3>
            <pre className="text-[#D0E0E1] text-sm whitespace-pre-wrap font-mono bg-[#100C00] p-3 border-l-2 border-[#2ECC71]">{info.protection}</pre>
          </div>
        </div>
        <div className="p-4 border-t border-[#95122C] flex justify-end">
          <button onClick={onClose} className="btn btn-primary">OK</button>
        </div>
      </div>
    </div>
  )
}

// ========== МОДАЛЬНЕ ВІКНО ЗАХИСТУ ==========
function ProtectionModal({ attackKey, onClose }) {
  const info = AUTH_ATTACK_INFO[attackKey]
  if (!info) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#27AE60] to-[#2ECC71] p-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🛡️</span>
            <div>
              <h2 className="text-[#100C00] font-black">PROTECTION TRIGGERED!</h2>
              <p className="text-[#100C00]/70">{info.name} blocked</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <pre className="text-[#D0E0E1] text-sm whitespace-pre-wrap font-mono bg-[#100C00] p-3 border-l-2 border-[#2ECC71]">{info.protection}</pre>
        </div>
        <div className="p-4 border-t border-[#95122C] flex justify-end">
          <button onClick={onClose} className="btn btn-success">CONTINUE</button>
        </div>
      </div>
    </div>
  )
}

// ========== КОМПОНЕНТ АТАК ДЛЯ USER ==========
function AuthenticatedAttacks({ onAttackComplete }) {
  const [attacking, setAttacking] = useState(null)
  const [log, setLog] = useState([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [showInfo, setShowInfo] = useState(null)
  const [protectionTriggered, setProtectionTriggered] = useState(null)

  // Відкриття модального вікна з інформацією про атаку
  const openInfoModal = (attackKey) => {
    setShowInfo(attackKey)
  }

  const closeInfoModal = () => {
    setShowInfo(null)
  }

  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString('uk-UA')
    setLog(prev => [{ time, message, type }, ...prev.slice(0, 19)])
  }

  const runMassDownload = async () => {
    setAttacking('download')
    addLog('▶ MASS DOWNLOAD INITIATED', 'attack')

    try {
      const filesRes = await filesApi.list()
      const files = filesRes.data.files || []
      if (files.length === 0) {
        addLog('⚠ No files to download', 'warning')
        setAttacking(null)
        setShowInfo(null)
        return
      }

      const attempts = 25
      setProgress({ current: 0, total: attempts })
      let blocked = false

      for (let i = 0; i < attempts; i++) {
        setProgress({ current: i + 1, total: attempts })
        try {
          await filesApi.download(files[0].id)
          addLog(`◇ Download ${i + 1}/${attempts}`, 'info')
        } catch (e) {
          if (e.response?.status === 403 || e.response?.data?.error?.includes('заблоковано')) {
            addLog(`◉ BLOCKED: Access denied`, 'blocked')
            blocked = true
            break
          }
        }
        await new Promise(r => setTimeout(r, 100))
      }

      if (blocked) setProtectionTriggered('mass_download')
      addLog('■ MASS DOWNLOAD COMPLETED', 'info')
    } catch (e) {
      addLog(`✗ Error: ${e.message}`, 'fail')
    }

    setAttacking(null)
    onAttackComplete?.()
  }

  const runMassDelete = async () => {
    setAttacking('delete')
    addLog('▶ MASS DELETE INITIATED (simulation)', 'attack')

    const tempFiles = []
    setProgress({ current: 0, total: 10 })
    addLog('◇ Creating temp files...', 'info')

    for (let i = 0; i < 5; i++) {
      try {
        const blob = new Blob([`temp ${i}`], { type: 'text/plain' })
        const formData = new FormData()
        formData.append('file', blob, `temp_${Date.now()}_${i}.txt`)
        formData.append('client_iv', btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))))
        formData.append('is_public', 'false')
        const res = await filesApi.upload(formData)
        tempFiles.push(res.data.file.id)
      } catch (e) { }
    }

    addLog(`◇ Deleting ${tempFiles.length} files...`, 'attack')
    let blocked = false

    for (let i = 0; i < tempFiles.length; i++) {
      setProgress({ current: 5 + i + 1, total: 10 })
      try {
        await filesApi.delete(tempFiles[i])
        addLog(`◇ Deleted ${i + 1}`, 'info')
      } catch (e) {
        if (e.response?.data?.error?.includes('заблоковано')) {
          addLog(`◉ BLOCKED`, 'blocked')
          blocked = true
          break
        }
      }
      await new Promise(r => setTimeout(r, 200))
    }

    if (blocked) setProtectionTriggered('mass_delete')
    addLog('■ MASS DELETE COMPLETED', 'info')
    setAttacking(null)
    onAttackComplete?.()
  }

  const runRapidRequests = async () => {
    setAttacking('rapid')
    addLog('▶ RAPID REQUESTS INITIATED', 'attack')

    const batches = 5
    setProgress({ current: 0, total: batches })
    let blocked = false

    for (let b = 0; b < batches; b++) {
      setProgress({ current: b + 1, total: batches })
      addLog(`◇ Batch ${b + 1}: 30 requests...`, 'info')

      const promises = []
      for (let i = 0; i < 30; i++) {
        promises.push(filesApi.getStats().catch(e => {
          if (e.response?.status === 429) blocked = true
        }))
      }
      await Promise.all(promises)

      if (blocked) {
        addLog(`◉ RATE LIMITED`, 'blocked')
        break
      }
    }

    if (blocked) setProtectionTriggered('rapid_requests')
    addLog('■ RAPID REQUESTS COMPLETED', 'info')
    setAttacking(null)
    onAttackComplete?.()
  }

  const runUnauthorizedAccess = async () => {
    setAttacking('unauth')
    addLog('▶ UNAUTHORIZED ACCESS INITIATED', 'attack')

    const fakeIds = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
    setProgress({ current: 0, total: fakeIds.length })

    for (let i = 0; i < fakeIds.length; i++) {
      setProgress({ current: i + 1, total: fakeIds.length })
      try {
        await filesApi.download(fakeIds[i])
      } catch (e) {
        const status = e.response?.status
        if (status === 403) addLog(`◉ 403 Forbidden`, 'blocked')
        else if (status === 404) addLog(`◇ 404 Not Found`, 'fail')
      }
      await new Promise(r => setTimeout(r, 500))
    }

    setProtectionTriggered('unauthorized_access')
    addLog('■ UNAUTHORIZED ACCESS COMPLETED', 'info')
    setAttacking(null)
    onAttackComplete?.()
  }

  const AttackBtn = ({ id, icon, name, onClick, isActive }) => (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={attacking !== null}
        className={`w-full p-2.5 bg-[#201810] border-2 border-[#95122C] text-[#F3F4F5] text-[10px] font-bold tracking-wider cut-corner-sm
          hover:border-[#FF9400] hover:shadow-[0_0_15px_rgba(255,148,0,0.3)] disabled:opacity-50
          ${isActive ? 'border-[#FF9400] shadow-[0_0_15px_rgba(255,148,0,0.3)]' : ''}`}
      >
        {isActive ? (
          <span className="flex items-center justify-center gap-1">
            <span className="w-3 h-3 border-2 border-[#FF9400] border-t-transparent rounded-full animate-spin" />
            {progress.current}/{progress.total}
          </span>
        ) : `${icon} ${name}`}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); openInfoModal(id); }}
        className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF9400] text-[#100C00] rounded-full text-[10px] font-black hover:bg-[#FCA316] transition-colors z-10 flex items-center justify-center"
        title="Показати інформацію"
      >?</button>
    </div>
  )

  return (
    <>
      {showInfo && <InfoModal attackKey={showInfo} onClose={closeInfoModal} />}
      {protectionTriggered && <ProtectionModal attackKey={protectionTriggered} onClose={() => setProtectionTriggered(null)} />}

      <div className="card" style={{ '--cut-size': '16px' }}>
        <div className="flex items-center gap-2 mb-4">
        <span className="text-[#FF9400] text-xl">⚔</span>
        <h3 className="text-[#F3F4F5] font-black tracking-wider">ATTACK SIMULATION</h3>
        <span className="badge badge-warning ml-auto">AUTHENTICATED</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <AttackBtn id="mass_download" icon="📥" name="MASS DL" onClick={runMassDownload} isActive={attacking === 'download'} />
        <AttackBtn id="mass_delete" icon="🗑️" name="MASS DEL" onClick={runMassDelete} isActive={attacking === 'delete'} />
        <AttackBtn id="rapid_requests" icon="⚡" name="RAPID REQ" onClick={runRapidRequests} isActive={attacking === 'rapid'} />
        <AttackBtn id="unauthorized_access" icon="🚫" name="UNAUTH" onClick={runUnauthorizedAccess} isActive={attacking === 'unauth'} />
      </div>

      <div className="bg-[#100C00] border-2 border-[#95122C] p-2 h-32 overflow-y-auto font-mono text-[10px] cut-corner-sm">
        {log.length === 0 ? (
          <p className="text-[#666] text-center py-4">// SELECT ATTACK...</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className={`py-0.5 ${
              entry.type === 'attack' ? 'text-[#FF9400]' :
              entry.type === 'success' ? 'text-[#2ECC71]' :
              entry.type === 'blocked' ? 'text-[#00BFFF]' :
              entry.type === 'fail' ? 'text-[#95122C]' : 'text-[#666]'
            }`}>
              <span className="text-[#444]">[{entry.time}]</span> {entry.message}
            </div>
          ))
        )}
        </div>
      </div>
    </>
  )
}

// ========== СТАТИСТИЧНА КАРТКА ==========
function StatCard({ icon, value, label, color = 'orange' }) {
  const colors = {
    orange: 'border-[#FF9400] text-[#FF9400]',
    crimson: 'border-[#95122C] text-[#95122C]',
    green: 'border-[#2ECC71] text-[#2ECC71]',
    mist: 'border-[#D0E0E1] text-[#D0E0E1]'
  }
  return (
    <div className={`card text-center border-2 ${colors[color]}`} style={{ '--cut-size': '12px' }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-black glow-text">{value}</div>
      <div className="text-[10px] text-[#666] tracking-wider">{label}</div>
    </div>
  )
}

// ========== THREAT MONITOR (ADMIN) ==========
function ThreatMonitor({ stats }) {
  const types = [
    { key: 'BRUTE_FORCE', icon: '🔐', label: 'BRUTE' },
    { key: 'MASS_DOWNLOAD', icon: '📥', label: 'MASS DL' },
    { key: 'MASS_DELETE', icon: '🗑️', label: 'MASS DEL' },
    { key: 'RAPID_REQUESTS', icon: '⚡', label: 'RAPID' },
    { key: 'UNAUTHORIZED_ACCESS', icon: '🚫', label: 'UNAUTH' },
  ]

  return (
    <div className="card border-2 border-[#95122C]" style={{ '--cut-size': '16px' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[#95122C] text-xl">🛡️</span>
          <h3 className="text-[#F3F4F5] font-black tracking-wider">THREAT MONITOR</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#95122C] rounded-full animate-pulse" />
          <span className="text-[#95122C] text-xs font-bold">{stats.total_events_24h || 0} / 24H</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {types.map(t => (
          <div key={t.key} className="text-center p-2 bg-[#100C00] border border-[#95122C]/50 cut-corner-sm">
            <div className="text-lg">{t.icon}</div>
            <div className="text-lg font-black text-[#FF9400]">{stats.threat_by_type?.[t.key] || 0}</div>
            <div className="text-[8px] text-[#666]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#100C00] border border-[#95122C]/50 p-3 cut-corner-sm">
        <h4 className="text-[10px] text-[#D0E0E1] font-bold mb-2">TOP THREAT USERS</h4>
        <div className="space-y-1">
          {stats.top_threat_users?.slice(0, 3).map((u, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-[#D0E0E1]">{u.username}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-[#201810]">
                  <div className="h-full bg-gradient-to-r from-[#FF9400] to-[#95122C]" style={{ width: `${Math.min(100, u.score)}%` }} />
                </div>
                <span className={`font-mono text-[10px] ${u.score >= 100 ? 'text-[#FF6B6B]' : u.score >= 50 ? 'text-[#FF9400]' : 'text-[#FCA316]'}`}>
                  {u.score}
                </span>
              </div>
            </div>
          ))}
          {(!stats.top_threat_users || stats.top_threat_users.length === 0) && (
            <p className="text-[#666] text-center text-[10px]">NO THREATS DETECTED</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ========== PROTECTION SETTINGS (ADMIN) ==========
function ProtectionSettings({ onRefresh }) {
  const [settings] = useState({
    bruteForceThreshold: 5,
    massDownloadThreshold: 20,
    massDeleteThreshold: 10,
    blockThreshold: 100,
    autoBlock: true
  })

  const handleUnblockAll = async () => {
    if (!confirm('Unblock all users?')) return
    try {
      const res = await usersApi.list({ is_blocked: true })
      for (const user of res.data.users || []) {
        await usersApi.unblock(user.id)
      }
      alert('All users unblocked')
      onRefresh?.()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  return (
    <div className="card border-2 border-[#FF9400]" style={{ '--cut-size': '16px' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#FF9400] text-xl">⚙</span>
        <h3 className="text-[#F3F4F5] font-black tracking-wider">PROTECTION CONFIG</h3>
        <span className={`badge ml-auto ${settings.autoBlock ? 'badge-success' : 'badge-danger'}`}>
          {settings.autoBlock ? 'AUTO-BLOCK ON' : 'AUTO-BLOCK OFF'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'BRUTE FORCE', value: settings.bruteForceThreshold, unit: 'attempts' },
          { label: 'MASS DOWNLOAD', value: settings.massDownloadThreshold, unit: 'files/5min' },
          { label: 'MASS DELETE', value: settings.massDeleteThreshold, unit: 'files/5min' },
          { label: 'BLOCK THRESHOLD', value: settings.blockThreshold, unit: 'score' },
        ].map((item, i) => (
          <div key={i} className="bg-[#100C00] border border-[#95122C]/50 p-2 cut-corner-sm">
            <div className="text-[9px] text-[#666] tracking-wider">{item.label}</div>
            <div className="text-lg font-black text-[#FF9400]">{item.value} <span className="text-[10px] text-[#666]">{item.unit}</span></div>
          </div>
        ))}
      </div>

      <button onClick={handleUnblockAll} className="btn btn-secondary w-full text-xs">
        🔓 UNBLOCK ALL USERS
      </button>
    </div>
  )
}

// ========== ОСНОВНИЙ ДАШБОРД ==========
export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    files: { total_files: 0, total_size: 0, integrity: {} },
    threats: { total_events_24h: 0, threat_by_type: {}, top_threat_users: [] },
    users: { total: 0, active_24h: 0, blocked: 0 }
  })

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const filesRes = await filesApi.getStats()
      const threatsRes = await threatsApi.getStats(24).catch(() => ({ data: {} }))

      let userStats = { total: 0, active_24h: 0, blocked: 0 }
      if (isAdmin()) {
        const usersRes = await usersApi.getStats().catch(() => ({ data: userStats }))
        userStats = usersRes.data
      }

      setStats({
        files: filesRes.data,
        threats: threatsRes.data || {},
        users: userStats
      })
    } catch (e) {
      console.error('Load error:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#FF9400] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ===== ADMIN DASHBOARD =====
  if (isAdmin()) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F3F4F5] tracking-wider glow-text">◈ ADMIN CONTROL</h1>
            <p className="text-[#666] text-sm">SECURITY MONITORING & CONFIGURATION</p>
          </div>
          <button onClick={loadStats} className="btn btn-secondary text-xs">
            ↻ REFRESH
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatCard icon="🚨" value={stats.threats.total_events_24h || 0} label="THREATS / 24H" color="crimson" />
          <StatCard icon="⛔" value={stats.users.blocked || 0} label="BLOCKED" color="crimson" />
          <StatCard icon="👥" value={stats.users.active_24h || 0} label="ACTIVE / 24H" color="orange" />
          <StatCard icon="📁" value={stats.files.total_files || 0} label="FILES" color="green" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ThreatMonitor stats={stats.threats} />
          <ProtectionSettings onRefresh={loadStats} />
        </div>
      </div>
    )
  }

  // ===== USER DASHBOARD =====
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#F3F4F5] tracking-wider glow-text">◈ USER PANEL</h1>
        <p className="text-[#666] text-sm">WELCOME, {user?.username?.toUpperCase()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AuthenticatedAttacks onAttackComplete={loadStats} />

        <div className="space-y-4">
          {/* Threat Score */}
          <div className="card border-2 border-[#95122C]" style={{ '--cut-size': '14px' }}>
            <h3 className="text-sm font-black text-[#F3F4F5] tracking-wider mb-3">🎯 YOUR THREAT SCORE</h3>
            <div className="text-center">
              <div className={`text-5xl font-black mb-2 ${
                (user?.threat_score || 0) >= 100 ? 'text-[#FF6B6B]' :
                (user?.threat_score || 0) >= 50 ? 'text-[#FF9400]' : 'text-[#2ECC71]'
              } glow-text`}>
                {user?.threat_score || 0}
              </div>
              <div className="progress-bar mb-2">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, user?.threat_score || 0)}%` }} />
              </div>
              <p className="text-[10px] text-[#666]">
                {(user?.threat_score || 0) >= 100 ? '⛔ ACCOUNT BLOCKED' :
                 (user?.threat_score || 0) >= 50 ? '⚠ WARNING: SUSPICIOUS ACTIVITY' : '✓ STATUS: NORMAL'}
              </p>
            </div>
          </div>

          {/* Files */}
          <div className="card" style={{ '--cut-size': '14px' }}>
            <h3 className="text-sm font-black text-[#F3F4F5] tracking-wider mb-3">📁 YOUR FILES</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-[#100C00] border border-[#95122C]/50 cut-corner-sm">
                <div className="text-xl font-black text-[#FF9400]">{stats.files.total_files || 0}</div>
                <div className="text-[9px] text-[#666]">TOTAL</div>
              </div>
              <div className="text-center p-2 bg-[#100C00] border border-[#95122C]/50 cut-corner-sm">
                <div className="text-xl font-black text-[#2ECC71]">{stats.files.integrity?.verified || 0}</div>
                <div className="text-[9px] text-[#666]">VERIFIED</div>
              </div>
              <div className="text-center p-2 bg-[#100C00] border border-[#95122C]/50 cut-corner-sm">
                <div className="text-xl font-black text-[#95122C]">{stats.files.integrity?.compromised || 0}</div>
                <div className="text-[9px] text-[#666]">CORRUPT</div>
              </div>
            </div>
          </div>

          {/* Detected Threats */}
          <div className="card border-2 border-[#95122C]/50" style={{ '--cut-size': '14px' }}>
            <h3 className="text-sm font-black text-[#F3F4F5] tracking-wider mb-3">🚨 DETECTED THREATS</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '🔐', key: 'BRUTE_FORCE', label: 'BRUTE' },
                { icon: '📥', key: 'MASS_DOWNLOAD', label: 'MASS DL' },
                { icon: '⚡', key: 'RAPID_REQUESTS', label: 'RAPID' },
                { icon: '🚫', key: 'UNAUTHORIZED_ACCESS', label: 'UNAUTH' },
              ].map(t => (
                <div key={t.key} className="text-center p-2 bg-[#100C00] border border-[#95122C]/30 cut-corner-sm">
                  <span className="text-lg">{t.icon}</span>
                  <div className="text-lg font-black text-[#FF9400]">{stats.threats.threat_by_type?.[t.key] || 0}</div>
                  <div className="text-[8px] text-[#666]">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
