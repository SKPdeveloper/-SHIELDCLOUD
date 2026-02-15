import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { cloudApi } from '../api/client'

// ========== ХМАРНІ ПРОВАЙДЕРИ ==========
function CloudProvidersTab() {
  const [providers, setProviders] = useState([])
  const [activeProvider, setActiveProvider] = useState('')
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(null)
  const [activating, setActivating] = useState(null)
  const { isAdmin } = useAuth()
  const { t } = useLanguage()

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      const res = await cloudApi.getProviders()
      setProviders(res.data.providers)
      setActiveProvider(res.data.active_provider)
    } catch (e) {
      console.error('Load providers error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async (providerType) => {
    setTesting(providerType)
    try {
      const res = await cloudApi.testConnection(providerType)
      if (res.data.connected) {
        alert(`✓ ${t('settings.testSuccess')}\n\nObjects: ${res.data.stats?.total_objects || 0}\nSize: ${formatSize(res.data.stats?.total_size || 0)}`)
      } else {
        alert(`✗ ${t('settings.testFailed')}: ${res.data.error}`)
      }
    } catch (e) {
      alert(`✗ ERROR: ${e.response?.data?.error || e.message}`)
    } finally {
      setTesting(null)
    }
  }

  const handleActivate = async (providerType) => {
    if (!isAdmin()) {
      alert('Admin only')
      return
    }
    setActivating(providerType)
    try {
      await cloudApi.activateProvider(providerType)
      setActiveProvider(providerType)
      alert(`✓ ${t('settings.activated')}`)
      loadProviders()
    } catch (e) {
      alert(`✗ ${e.response?.data?.error || e.message}`)
    } finally {
      setActivating(null)
    }
  }

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 rounded-full animate-spin"
             style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Попередження */}
      <div className="card border-2" style={{ '--cut-size': '16px', borderColor: 'var(--warning)' }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠</span>
          <div>
            <h4 className="font-bold tracking-wider" style={{ color: 'var(--warning)' }}>{t('settings.warning')}</h4>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t('settings.externalWarning')}
            </p>
          </div>
        </div>
      </div>

      {/* Провайдери */}
      <div className="space-y-4">
        {providers.map(provider => (
          <div
            key={provider.provider}
            className="card border-2"
            style={{
              '--cut-size': '16px',
              borderColor: provider.is_active ? 'var(--success)' : 'var(--border-primary)'
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <span className="text-4xl">{provider.icon}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black tracking-wider" style={{ color: 'var(--text-primary)' }}>
                      {provider.display_name}
                    </h3>
                    {provider.is_active && <span className="badge badge-success">{t('settings.activated')}</span>}
                    {provider.connected && <span className="badge badge-info">CONNECTED</span>}
                  </div>

                  <p className="text-sm mt-2 max-w-lg" style={{ color: 'var(--text-muted)' }}>
                    {provider.description?.trim().slice(0, 150)}...
                  </p>

                  {provider.stats && (
                    <div className="flex gap-3 mt-3">
                      <span className="text-xs px-2 py-1 border cut-corner-sm"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
                        📦 {provider.stats.total_objects} objects
                      </span>
                      <span className="text-xs px-2 py-1 border cut-corner-sm"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
                        💾 {formatSize(provider.stats.total_size)}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-3 mt-3 text-[10px]">
                    {provider.is_safe_for_testing && <span style={{ color: 'var(--success)' }}>✓ SAFE FOR TESTING</span>}
                    {provider.warning && <span style={{ color: 'var(--danger)' }}>⚠ {provider.warning}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {provider.provider !== 'external' ? (
                  <>
                    <button
                      onClick={() => handleTest(provider.provider)}
                      disabled={testing === provider.provider}
                      className="btn btn-secondary text-xs"
                    >
                      {testing === provider.provider ? '⏳' : '🔌'} {t('settings.test')}
                    </button>
                    {!provider.is_active && isAdmin() && (
                      <button
                        onClick={() => handleActivate(provider.provider)}
                        disabled={activating === provider.provider}
                        className="btn btn-primary text-xs"
                      >
                        {activating === provider.provider ? '⏳' : '▶'} {t('settings.activate')}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-center" style={{ color: 'var(--border-primary)' }}>
                    🔒 API KEYS<br/>REQUIRED
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ========== ВИГЛЯД ==========
function AppearanceTab() {
  const { theme, setTheme, isDark } = useTheme()
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="space-y-6">
      {/* Тема */}
      <div className="card" style={{ '--cut-size': '16px' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🎨 {t('settings.theme')}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('dark')}
            className={`p-4 border-2 rounded transition-all ${
              isDark ? 'border-accent' : 'border-secondary'
            }`}
            style={{
              background: '#100C00',
              borderColor: isDark ? 'var(--accent-primary)' : 'var(--border-secondary)'
            }}
          >
            <div className="text-3xl mb-2">🌙</div>
            <div className="font-bold text-sm" style={{ color: '#F3F4F5' }}>{t('settings.darkTheme')}</div>
            <div className="text-[10px] mt-1" style={{ color: '#666' }}>
              #100C00 → #95122C → #FF9400
            </div>
            {isDark && <div className="mt-2 text-[10px]" style={{ color: 'var(--success)' }}>✓ ACTIVE</div>}
          </button>

          <button
            onClick={() => setTheme('light')}
            className={`p-4 border-2 rounded transition-all ${
              !isDark ? 'border-accent' : 'border-secondary'
            }`}
            style={{
              background: '#F3F4F5',
              borderColor: !isDark ? 'var(--accent-primary)' : 'var(--border-secondary)'
            }}
          >
            <div className="text-3xl mb-2">☀️</div>
            <div className="font-bold text-sm" style={{ color: '#100C00' }}>{t('settings.lightTheme')}</div>
            <div className="text-[10px] mt-1" style={{ color: '#666' }}>
              #F3F4F5 → #D0E0E1 → #FF9400
            </div>
            {!isDark && <div className="mt-2 text-[10px]" style={{ color: '#1E8449' }}>✓ ACTIVE</div>}
          </button>
        </div>
      </div>

      {/* Мова */}
      <div className="card" style={{ '--cut-size': '16px' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🌐 {t('settings.language')}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setLanguage('uk')}
            className="p-4 border-2 rounded transition-all"
            style={{
              background: 'var(--bg-card)',
              borderColor: language === 'uk' ? 'var(--accent-primary)' : 'var(--border-secondary)'
            }}
          >
            <div className="text-3xl mb-2">🇺🇦</div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t('settings.ukrainian')}</div>
            {language === 'uk' && <div className="mt-2 text-[10px]" style={{ color: 'var(--success)' }}>✓ ACTIVE</div>}
          </button>

          <button
            onClick={() => setLanguage('en')}
            className="p-4 border-2 rounded transition-all"
            style={{
              background: 'var(--bg-card)',
              borderColor: language === 'en' ? 'var(--accent-primary)' : 'var(--border-secondary)'
            }}
          >
            <div className="text-3xl mb-2">🇬🇧</div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t('settings.english')}</div>
            {language === 'en' && <div className="mt-2 text-[10px]" style={{ color: 'var(--success)' }}>✓ ACTIVE</div>}
          </button>
        </div>
      </div>

      {/* Превью палітри */}
      <div className="card" style={{ '--cut-size': '16px' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🎨 COLOR PALETTE
        </h3>
        <div className="grid grid-cols-6 gap-2">
          {[
            { color: '#F3F4F5', name: 'Light' },
            { color: '#D0E0E1', name: 'Mist' },
            { color: '#FF9400', name: 'Orange' },
            { color: '#FCA316', name: 'Gold' },
            { color: '#95122C', name: 'Crimson' },
            { color: '#100C00', name: 'Dark' },
          ].map(c => (
            <div key={c.name} className="text-center">
              <div
                className="w-full h-12 border-2 mb-1 cut-corner-sm"
                style={{
                  background: c.color,
                  borderColor: c.color === '#F3F4F5' || c.color === '#D0E0E1' ? '#95122C' : '#F3F4F5'
                }}
              />
              <div className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>{c.name}</div>
              <div className="text-[8px]" style={{ color: 'var(--text-muted)' }}>{c.color}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ========== ДОВІДКА ==========
function HelpTab() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-wider glow-text" style={{ color: 'var(--text-primary)' }}>
          ◈ {t('settings.helpTitle')}
        </h2>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>CLOUD DATA PROTECTION SYSTEM</p>
      </div>

      {/* Про систему */}
      <div className="card" style={{ '--cut-size': '16px' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🛡️ ABOUT SYSTEM
        </h3>
        <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
          <p><strong>ShieldCloud</strong> — educational platform for cloud security demonstration:</p>
          <ul className="list-none space-y-1 ml-4">
            <li className="flex items-start gap-2"><span style={{ color: 'var(--accent-primary)' }}>◈</span> Real attack simulations in safe environment</li>
            <li className="flex items-start gap-2"><span style={{ color: 'var(--accent-primary)' }}>◈</span> Threat detection & mitigation methods</li>
            <li className="flex items-start gap-2"><span style={{ color: 'var(--accent-primary)' }}>◈</span> Zero risk to real systems</li>
            <li className="flex items-start gap-2"><span style={{ color: 'var(--accent-primary)' }}>◈</span> Comprehensive security education</li>
          </ul>
        </div>
      </div>

      {/* Архітектура */}
      <div className="card border-2" style={{ '--cut-size': '20px', borderColor: 'var(--accent-primary)' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🏗️ {t('settings.architecture')}
        </h3>
        <div className="p-4 border overflow-x-auto" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <pre className="text-[11px] font-mono leading-relaxed whitespace-pre" style={{ color: 'var(--text-secondary)' }}>{`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                           ╔═══════════════════╗                              ┃
┃                           ║   FRONTEND        ║                              ┃
┃                           ║   React 18        ║                              ┃
┃                           ╚═════════╤═════════╝                              ┃
┃    ┌────────────────┐              │              ┌────────────────┐        ┃
┃    │ ▓▓ CLIENT      │              │              │ ▓▓ ATTACK      │        ┃
┃    │ ▓▓ ENCRYPTION  │◄─────────────┼──────────────►│ ▓▓ SIMULATOR  │        ┃
┃    │    AES-256-GCM │              │              │    6 VECTORS   │        ┃
┃    └────────────────┘              │              └────────────────┘        ┃
┃                                    │                                         ┃
┃ ════════════════════════════╪══════╧══════╪═════════════════════════════════ ┃
┃                             │   HTTPS     │                                  ┃
┃                             │   + JWT     │                                  ┃
┃                             ▼             ▼                                  ┃
┃                    ╔═══════════════════════════════╗                        ┃
┃                    ║        BACKEND (Flask)        ║                        ┃
┃                    ╚═══════════════════════════════╝                        ┃
┃                                    │                                         ┃
┃       ┌────────────────────────────┼────────────────────────────┐           ┃
┃       │                            │                            │           ┃
┃       ▼                            ▼                            ▼           ┃
┃ ┌───────────────┐        ┌─────────────────┐         ┌─────────────────┐   ┃
┃ │ ░░ JWT AUTH   │        │ ░░ RBAC         │         │ ░░ THREAT       │   ┃
┃ │ ░░ + REFRESH  │        │ ░░ MIDDLEWARE   │         │ ░░ DETECTOR     │   ┃
┃ │    TOKENS     │        │    3 ROLES      │         │    + SCORING    │   ┃
┃ └───────┬───────┘        └────────┬────────┘         └────────┬────────┘   ┃
┃         │                         │                           │             ┃
┃         └─────────────────────────┼───────────────────────────┘             ┃
┃                                   │                                          ┃
┃                                   ▼                                          ┃
┃               ╔═════════════════════════════════════════╗                   ┃
┃               ║    ENCRYPTION SERVICE (KMS / Fernet)    ║                   ┃
┃               ╚═════════════════════════════════════════╝                   ┃
┃                                   │                                          ┃
┃ ══════════════════════════════════╪══════════════════════════════════════   ┃
┃                                   │                                          ┃
┃       ┌───────────────────────────┼───────────────────────────┐             ┃
┃       │                           │                           │             ┃
┃       ▼                           ▼                           ▼             ┃
┃ ┌─────────────────┐    ┌─────────────────┐      ┌─────────────────┐        ┃
┃ │ ▓▓ LOCALSTACK   │    │ ▓▓ MINIO        │      │ ░░ EXTERNAL     │        ┃
┃ │    AWS S3       │    │    S3-LIKE      │      │    AWS/GCP      │        ┃
┃ │    EMULATION    │    │    SELF-HOSTED  │      │    ⚠ RISKY      │        ┃
┃ │    ✓ SAFE       │    │    ✓ SAFE       │      │    API KEYS     │        ┃
┃ └─────────────────┘    └─────────────────┘      └─────────────────┘        ┃
┃                                                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

▓▓ = ACTIVE COMPONENT    ░░ = SECURITY LAYER    ════ = ENCRYPTED CHANNEL
`}</pre>
        </div>
      </div>

      {/* Подвійне шифрування */}
      <div className="card" style={{ '--cut-size': '16px' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🔐 DOUBLE ENCRYPTION
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-2 p-4 cut-corner-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--info)' }}>
            <h4 className="font-black mb-2" style={{ color: 'var(--info)' }}>CLIENT-SIDE</h4>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• Algorithm: <span style={{ color: 'var(--accent-primary)' }}>AES-256-GCM</span></li>
              <li>• Key: Generated in browser</li>
              <li>• IV: Random 12 bytes</li>
              <li>• Data encrypted BEFORE upload</li>
            </ul>
          </div>
          <div className="border-2 p-4 cut-corner-sm" style={{ background: 'var(--bg-primary)', borderColor: 'var(--success)' }}>
            <h4 className="font-black mb-2" style={{ color: 'var(--success)' }}>SERVER-SIDE</h4>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• Algorithm: <span style={{ color: 'var(--accent-primary)' }}>Fernet (AES-128-CBC)</span></li>
              <li>• KMS: AWS KMS key management</li>
              <li>• Unique Data Key per file</li>
              <li>• Envelope encryption</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Technologies */}
      <div className="card" style={{ '--cut-size': '16px' }}>
        <h3 className="text-lg font-black tracking-wider mb-4" style={{ color: 'var(--accent-primary)' }}>
          🔧 TECHNOLOGIES
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: '⚛️', name: 'React 18', desc: 'Frontend' },
            { icon: '🐍', name: 'Flask 3.0', desc: 'Backend' },
            { icon: '🐳', name: 'Docker', desc: 'Container' },
            { icon: '☁️', name: 'AWS S3', desc: 'Storage' },
          ].map((tech, i) => (
            <div key={i} className="text-center p-3 border cut-corner-sm"
                 style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-secondary)' }}>
              <div className="text-2xl mb-1">{tech.icon}</div>
              <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{tech.name}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tech.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
        <p>SHIELDCLOUD — CYBERSECURITY EDUCATIONAL PROJECT</p>
        <p style={{ color: 'var(--accent-primary)' }}>MODELING & IMPLEMENTATION OF CLOUD DATA PROTECTION SYSTEM</p>
      </div>
    </div>
  )
}

// ========== ОСНОВНА СТОРІНКА ==========
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('appearance')
  const { t } = useLanguage()

  const tabs = [
    { id: 'appearance', label: `🎨 ${t('settings.appearance')}`, component: AppearanceTab },
    { id: 'cloud', label: `☁️ ${t('settings.cloudProviders')}`, component: CloudProvidersTab },
    { id: 'help', label: `📚 ${t('settings.help')}`, component: HelpTab }
  ]

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || AppearanceTab

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-wider glow-text" style={{ color: 'var(--text-primary)' }}>
          ◈ {t('settings.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 pb-2" style={{ borderColor: 'var(--border-primary)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 text-sm font-bold tracking-wider transition-all cut-corner-sm"
            style={{
              background: activeTab === tab.id ? 'var(--accent-gradient)' : 'var(--bg-card)',
              color: activeTab === tab.id ? 'var(--bg-primary)' : 'var(--text-muted)',
              border: activeTab === tab.id ? 'none' : '1px solid var(--border-secondary)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <ActiveComponent />
    </div>
  )
}
