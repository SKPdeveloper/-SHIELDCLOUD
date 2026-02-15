import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi, usersApi } from '../api/client'

// Інформація про атаки
const ATTACK_INFO = {
  brute_force: {
    name: 'BRUTE FORCE',
    icon: '🔐',
    danger: 'ВИСОКА',
    description: `Brute Force — систематичний перебір всіх можливих комбінацій паролів.

• 80% успішних зломів використовують brute force
• Простий 6-символьний пароль зламується за 11 хвилин
• Автоматизовані інструменти: Hydra, Medusa, Burp Suite`,
    protection: `ДЕТЕКЦІЯ: Підрахунок невдалих спроб (поріг: 5 за 10 хв)
РЕАКЦІЯ: Блокування акаунту + IP, Threat Score +25
НАСЛІДКИ: Фіксація в аудиті, можливий перманентний бан`
  },
  password_spray: {
    name: 'PASSWORD SPRAY',
    icon: '🌊',
    danger: 'ВИСОКА',
    description: `Password Spray — один популярний пароль для багатьох акаунтів.

• 16% користувачів використовують "123456"
• Топ-100 паролів покривають 40% всіх акаунтів
• Обходить стандартний захист від brute force`,
    protection: `ДЕТЕКЦІЯ: Моніторинг невдалих входів з однієї IP на різні акаунти
РЕАКЦІЯ: Блокування IP при >10 спробах, CAPTCHA
ПРЕВЕНЦІЯ: Заборона слабких паролів, 2FA`
  },
  credential_stuffing: {
    name: 'CREDENTIAL STUFFING',
    icon: '📋',
    danger: 'КРИТИЧНА',
    description: `Credential Stuffing — використання викрадених credentials з витоків.

• 65% людей використовують один пароль скрізь
• 15 мільярдів записів "злито" в даркнет
• 0.1-2% успішність при мільйонах спроб`,
    protection: `ДЕТЕКЦІЯ: Перевірка по базі Have I Been Pwned
РЕАКЦІЯ: Примусова зміна пароля, Threat Score +30
РЕКОМЕНДАЦІЯ: Унікальний пароль + менеджер паролів`
  },
  dictionary_attack: {
    name: 'DICTIONARY ATTACK',
    icon: '📖',
    danger: 'ВИСОКА',
    description: `Dictionary Attack — атака зі словником популярних паролів.

• Словники містять до 100+ мільйонів паролів
• RockYou словник — найпопулярніший (14 млн)
• 91% паролів в топ-1000`,
    protection: `ДЕТЕКЦІЯ: Rate limiting, виявлення паттернів
РЕАКЦІЯ: Прогресивні затримки, CAPTCHA, блокування IP
ПРЕВЕНЦІЯ: Заборона топ-10000 паролів при реєстрації`
  },
  enumeration: {
    name: 'USER ENUMERATION',
    icon: '🔍',
    danger: 'СЕРЕДНЯ',
    description: `User Enumeration — визначення існуючих акаунтів через відповіді сервера.

• 67% сайтів вразливі
• Скорочує час атаки в 1000+ разів
• Підготовка до фішингу`,
    protection: `ДЕТЕКЦІЯ: Моніторинг запитів з різними логінами
РЕАКЦІЯ: Уніфіковані відповіді, однаковий час
ЗАХИСТ: Приховування факту існування акаунту`
  },
  session_hijacking: {
    name: 'SESSION HIJACKING',
    icon: '🎭',
    danger: 'КРИТИЧНА',
    description: `Session Hijacking — викрадення сесії авторизованого користувача.

• Найпоширеніша атака на веб-додатки
• XSS, Sniffing, Session Fixation, MITM
• Середній збиток: $150,000`,
    protection: `ДЕТЕКЦІЯ: Відстеження зміни IP, fingerprinting
РЕАКЦІЯ: Примусовий logout, Threat Score +30
ПРЕВЕНЦІЯ: HttpOnly + Secure cookies, SameSite=Strict`
  }
}

// ========== МОДАЛЬНЕ ВІКНО ІНФОРМАЦІЇ ==========
function InfoModal({ attackKey, onClose }) {
  const info = ATTACK_INFO[attackKey]
  if (!info) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#95122C] to-[#FF9400] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{info.icon}</span>
              <div>
                <h2 className="text-[#F3F4F5] font-black text-lg tracking-wider">{info.name}</h2>
                <span className="badge badge-danger">НЕБЕЗПЕКА: {info.danger}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-[#F3F4F5]/60 hover:text-[#F3F4F5] text-2xl">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-[#FF9400] font-bold text-sm mb-2 tracking-wider">⚔️ ОПИС АТАКИ</h3>
            <pre className="text-[#D0E0E1] text-sm whitespace-pre-wrap font-mono bg-[#100C00] p-4 border-l-2 border-[#95122C]">{info.description}</pre>
          </div>
          <div>
            <h3 className="text-[#2ECC71] font-bold text-sm mb-2 tracking-wider">🛡️ МЕХАНІЗМ ЗАХИСТУ</h3>
            <pre className="text-[#D0E0E1] text-sm whitespace-pre-wrap font-mono bg-[#100C00] p-4 border-l-2 border-[#2ECC71]">{info.protection}</pre>
          </div>
        </div>
        <div className="p-4 border-t border-[#95122C] flex justify-end">
          <button onClick={onClose} className="btn btn-primary">ЗРОЗУМІЛО</button>
        </div>
      </div>
    </div>
  )
}

// ========== МОДАЛЬНЕ ВІКНО ЗАХИСТУ ==========
function ProtectionModal({ attackKey, onClose }) {
  const info = ATTACK_INFO[attackKey]
  if (!info) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#27AE60] to-[#2ECC71] p-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🛡️</span>
            <div>
              <h2 className="text-[#100C00] font-black text-lg">ЗАХИСТ СПРАЦЮВАВ!</h2>
              <p className="text-[#100C00]/70">Атаку "{info.name}" заблоковано</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <pre className="text-[#D0E0E1] text-sm whitespace-pre-wrap font-mono bg-[#100C00] p-4 border-l-2 border-[#2ECC71]">{info.protection}</pre>
        </div>
        <div className="p-4 border-t border-[#95122C] flex justify-end">
          <button onClick={onClose} className="btn btn-success">ПРОДОВЖИТИ</button>
        </div>
      </div>
    </div>
  )
}

// ========== ПАНЕЛЬ АТАК ==========
function AttackPanel() {
  const [attacking, setAttacking] = useState(null)
  const [log, setLog] = useState([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [showInfo, setShowInfo] = useState(null)
  const [protectionTriggered, setProtectionTriggered] = useState(null)

  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString('uk-UA')
    setLog(prev => [{ time, message, type }, ...prev.slice(0, 19)])
  }

  const openInfoModal = (attackKey) => {
    setShowInfo(attackKey)
  }

  const closeInfoModal = () => {
    setShowInfo(null)
  }

  const closeProtectionModal = () => {
    setProtectionTriggered(null)
  }

  const runBruteForce = async () => {
    setAttacking('brute_force')
    addLog('▶ BRUTE FORCE INITIATED', 'attack')
    const attempts = 8
    setProgress({ current: 0, total: attempts })
    let blocked = false

    for (let i = 0; i < attempts; i++) {
      setProgress({ current: i + 1, total: attempts })
      try {
        await authApi.login('admin', `wrong_${Date.now()}_${i}`)
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.includes('заблоковано')) {
          addLog(`◉ BLOCKED: ${msg}`, 'blocked')
          blocked = true
          break
        } else {
          addLog(`✗ Attempt ${i + 1}: FAILED`, 'fail')
        }
      }
      await new Promise(r => setTimeout(r, 300))
    }

    if (blocked) setProtectionTriggered('brute_force')
    addLog('■ BRUTE FORCE COMPLETED', 'info')
    setAttacking(null)
  }

  const runPasswordSpray = async () => {
    setAttacking('password_spray')
    addLog('▶ PASSWORD SPRAY INITIATED', 'attack')
    const users = ['admin', 'user', 'test', 'guest', 'root']
    const passwords = ['123456', 'password', 'admin']
    setProgress({ current: 0, total: users.length * passwords.length })
    let count = 0, blockedCount = 0

    for (const user of users) {
      for (const pass of passwords) {
        count++
        setProgress({ current: count, total: users.length * passwords.length })
        try {
          await authApi.login(user, pass)
          addLog(`✓ ${user}:${pass} — SUCCESS`, 'success')
        } catch (e) {
          const msg = e.response?.data?.error || ''
          if (msg.includes('заблоковано')) {
            addLog(`◉ ${user} BLOCKED`, 'blocked')
            blockedCount++
          } else {
            addLog(`✗ ${user}:${pass}`, 'fail')
          }
        }
        await new Promise(r => setTimeout(r, 150))
      }
    }

    if (blockedCount > 0) setProtectionTriggered('password_spray')
    addLog('■ PASSWORD SPRAY COMPLETED', 'info')
    setAttacking(null)
  }

  const runDictionary = async () => {
    setAttacking('dictionary_attack')
    addLog('▶ DICTIONARY ATTACK INITIATED', 'attack')
    const dict = ['123456', 'password', 'admin', 'qwerty', 'letmein', 'welcome', 'Admin123', 'pass123']
    setProgress({ current: 0, total: dict.length })
    let blocked = false

    for (let i = 0; i < dict.length; i++) {
      setProgress({ current: i + 1, total: dict.length })
      try {
        await authApi.login('admin', dict[i])
        addLog(`✓ PASSWORD FOUND: "${dict[i]}"`, 'success')
        break
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.includes('заблоковано')) {
          addLog(`◉ BLOCKED at attempt ${i + 1}`, 'blocked')
          blocked = true
          break
        } else {
          addLog(`✗ "${dict[i]}"`, 'fail')
        }
      }
      await new Promise(r => setTimeout(r, 200))
    }

    if (blocked) setProtectionTriggered('dictionary_attack')
    addLog('■ DICTIONARY ATTACK COMPLETED', 'info')
    setAttacking(null)
  }

  const runEnumeration = async () => {
    setAttacking('enumeration')
    addLog('▶ USER ENUMERATION INITIATED', 'attack')
    const users = ['admin', 'root', 'user', 'test', 'guest', 'support']
    setProgress({ current: 0, total: users.length })
    const found = []

    for (let i = 0; i < users.length; i++) {
      setProgress({ current: i + 1, total: users.length })
      try {
        await authApi.login(users[i], 'wrong_test')
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.includes('заблоковано') || msg.includes('Невірн')) {
          addLog(`✓ "${users[i]}" EXISTS`, 'success')
          found.push(users[i])
        } else {
          addLog(`◉ "${users[i]}" — unified response (protected)`, 'blocked')
        }
      }
      await new Promise(r => setTimeout(r, 150))
    }

    addLog(`■ ENUMERATION: Found ${found.length} users`, 'info')
    setAttacking(null)
  }

  const AttackBtn = ({ id, icon, name, onClick, isActive }) => (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={attacking !== null}
        className={`w-full p-3 bg-[#201810] border-2 border-[#95122C] text-[#F3F4F5] text-xs font-bold tracking-wider cut-corner-sm transition-all
          hover:border-[#FF9400] hover:shadow-[0_0_20px_rgba(255,148,0,0.3)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isActive ? 'border-[#FF9400] shadow-[0_0_20px_rgba(255,148,0,0.3)]' : ''}`}
      >
        {isActive ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#FF9400] border-t-transparent rounded-full animate-spin" />
            {progress.current}/{progress.total}
          </span>
        ) : (
          <span>{icon} {name}</span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); openInfoModal(id); }}
        className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF9400] text-[#100C00] rounded-full text-xs font-black hover:bg-[#FCA316] transition-all flex items-center justify-center"
        title="Інформація про атаку"
      >?</button>
    </div>
  )

  return (
    <>
      {/* Модальні вікна — ПОЗА основним контейнером */}
      {showInfo && <InfoModal attackKey={showInfo} onClose={closeInfoModal} />}
      {protectionTriggered && <ProtectionModal attackKey={protectionTriggered} onClose={closeProtectionModal} />}

      <div className="card mt-6" style={{ '--cut-size': '20px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[#FF9400] text-xl">⚔</span>
            <h3 className="text-[#F3F4F5] font-black tracking-wider">ATTACK SIMULATION</h3>
          </div>
          <span className="badge badge-danger">UNAUTHENTICATED</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <AttackBtn id="brute_force" icon="🔐" name="BRUTE FORCE" onClick={runBruteForce} isActive={attacking === 'brute_force'} />
          <AttackBtn id="password_spray" icon="🌊" name="SPRAY" onClick={runPasswordSpray} isActive={attacking === 'password_spray'} />
          <AttackBtn id="dictionary_attack" icon="📖" name="DICTIONARY" onClick={runDictionary} isActive={attacking === 'dictionary_attack'} />
          <AttackBtn id="enumeration" icon="🔍" name="ENUMERATION" onClick={runEnumeration} isActive={attacking === 'enumeration'} />
        </div>

        {/* Консоль логів */}
        <div className="bg-[#100C00] border-2 border-[#95122C] p-3 h-36 overflow-y-auto font-mono text-xs cut-corner-sm">
          {log.length === 0 ? (
            <p className="text-[#666] text-center py-4">// SELECT ATTACK VECTOR...</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className={`py-0.5 ${
                entry.type === 'attack' ? 'text-[#FF9400]' :
                entry.type === 'success' ? 'text-[#2ECC71]' :
                entry.type === 'blocked' ? 'text-[#00BFFF]' :
                entry.type === 'fail' ? 'text-[#95122C]' :
                'text-[#666]'
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

// ========== ОСНОВНА СТОРІНКА ЛОГІНУ ==========
export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoStatus, setDemoStatus] = useState(null)
  const [resetting, setResetting] = useState(false)

  const { login, register } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadDemoStatus()
    // Авто-оновлення статусу кожні 5 секунд
    const interval = setInterval(loadDemoStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDemoStatus = async () => {
    try {
      const res = await usersApi.demoStatus()
      setDemoStatus(res.data)
    } catch (e) {
      console.error('Demo status error:', e)
    }
  }

  const handleDemoReset = async () => {
    setResetting(true)
    try {
      const res = await usersApi.demoReset()
      setError('')
      alert(`✓ ${res.data.message}\n\nUnblocked: ${res.data.unblocked_users.join(', ') || 'none'}\nReset scores: ${res.data.reset_scores}`)
      loadDemoStatus()
    } catch (e) {
      alert('✗ Error: ' + (e.response?.data?.error || e.message))
    } finally {
      setResetting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await login(username, password)
      } else {
        if (password !== confirmPassword) {
          setError('Паролі не співпадають')
          setLoading(false)
          return
        }
        if (password.length < 8) {
          setError('Пароль має містити щонайменше 8 символів')
          setLoading(false)
          return
        }
        await register(username, email, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Сталася помилка')
      loadDemoStatus()
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (user, pass) => {
    setError('')
    setLoading(true)
    try {
      await login(user, pass)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка входу')
      loadDemoStatus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-gradient)' }}>
      {/* Декоративні елементи */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#FF9400]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#95122C]/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-lg w-full">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#FF9400] to-[#95122C] cut-corner mb-4 animate-pulse-glow">
            <span className="text-[#100C00] text-4xl font-black">S</span>
          </div>
          <h1 className="text-3xl font-black tracking-wider glow-text" style={{ color: 'var(--text-primary)' }}>SHIELDCLOUD</h1>
          <p className="text-sm mt-1 tracking-[0.3em]" style={{ color: 'var(--text-secondary)' }}>CLOUD DATA PROTECTION SYSTEM</p>
        </div>

        {/* Форма */}
        <div className="card" style={{ '--cut-size': '24px' }}>
          <h2 className="text-xl font-black text-center mb-6 tracking-wider" style={{ color: 'var(--text-primary)' }}>
            {isLogin ? '◈ АВТОРИЗАЦІЯ' : '◈ РЕЄСТРАЦІЯ'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-[#95122C]/20 border-2 border-[#95122C] text-[#FF6B6B] text-sm cut-corner-sm">
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                placeholder="enter username"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="form-label">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="email@example.com"
                  required
                />
              </div>
            )}

            <div>
              <label className="form-label">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="form-label">CONFIRM PASSWORD</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#100C00] border-t-transparent rounded-full animate-spin" />
                  PROCESSING...
                </span>
              ) : (
                isLogin ? '▶ УВІЙТИ' : '▶ ЗАРЕЄСТРУВАТИСЯ'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="text-sm font-bold tracking-wider hover:opacity-80"
              style={{ color: 'var(--accent-primary)' }}
            >
              {isLogin ? '◇ СТВОРИТИ АКАУНТ' : '◇ ВХІД В АКАУНТ'}
            </button>
          </div>

          {/* Швидкий вхід та демо */}
          {isLogin && (
            <div className="mt-6 p-4 border-2 cut-corner-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
              <p className="text-[10px] text-center mb-3 tracking-widest" style={{ color: 'var(--text-muted)' }}>QUICK ACCESS</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => quickLogin('admin', 'admin123')}
                  disabled={loading}
                  className="btn btn-secondary text-xs py-2"
                >
                  🛡️ ADMIN
                </button>
                <button
                  onClick={() => quickLogin('user', 'user123')}
                  disabled={loading}
                  className="btn btn-secondary text-xs py-2"
                >
                  👤 USER
                </button>
              </div>

              {/* Статус демо */}
              {demoStatus && demoStatus.blocked_count > 0 && (
                <div className="p-3 bg-[#95122C]/20 border border-[#95122C] mb-3 cut-corner-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#FF6B6B] text-xs font-bold">⛔ BLOCKED: {demoStatus.blocked_count}</span>
                  </div>
                  <div className="text-[10px] text-[#D0E0E1]/60 mb-2">
                    {demoStatus.blocked_users.map(u => u.username).join(', ')}
                  </div>
                </div>
              )}

              <button
                onClick={handleDemoReset}
                disabled={resetting}
                className={`w-full py-2 text-xs font-bold tracking-wider cut-corner-sm transition-all ${
                  demoStatus?.blocked_count > 0
                    ? 'bg-[#27AE60] text-[#100C00] hover:bg-[#2ECC71]'
                    : 'bg-[#201810] border hover:border-[#FF9400]'
                }`}
                style={demoStatus?.blocked_count > 0 ? {} : { color: 'var(--text-muted)', borderColor: 'var(--border-secondary)' }}
              >
                {resetting ? '⏳ RESETTING...' : '🔄 DEMO RESET (UNBLOCK ALL)'}
              </button>
            </div>
          )}
        </div>

        {/* Панель атак */}
        <AttackPanel />
      </div>
    </div>
  )
}
