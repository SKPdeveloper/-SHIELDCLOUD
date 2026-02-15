import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'

// Навігаційні посилання
const getNavLinks = (isAdmin, t) => {
  const links = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: '◈' },
    { to: '/files', label: t('nav.files'), icon: '◇' }
  ]

  if (isAdmin) {
    links.push(
      { to: '/audit', label: t('nav.audit'), icon: '◆' },
      { to: '/threats', label: t('nav.threats'), icon: '⚠' },
      { to: '/users', label: t('nav.users'), icon: '◉' }
    )
  }

  links.push({ to: '/settings', label: t('nav.settings'), icon: '⚙' })

  return links
}

// Бейдж ролі
function RoleBadge({ role }) {
  const config = {
    admin: { label: 'ADMIN', color: 'text-accent border-accent' },
    user: { label: 'USER', color: 'text-warning border-warning' },
    guest: { label: 'GUEST', color: 'text-secondary border-secondary' }
  }

  const { label, color } = config[role] || config.guest

  return (
    <span className={`badge ${color}`} style={{
      background: 'transparent',
      color: `var(--accent-primary)`,
      borderColor: `var(--accent-primary)`
    }}>
      {label}
    </span>
  )
}

// Креативний логотип
function Logo() {
  return (
    <div className="logo-container">
      <div className="logo-shield" />
      <div className="logo-pulse" />
    </div>
  )
}

// Перемикач теми
function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

// Перемикач мови
function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage()

  return (
    <button
      onClick={toggleLanguage}
      className="px-2 py-1 text-xs font-bold tracking-wider border-2 rounded transition-all hover:border-accent"
      style={{
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border-primary)'
      }}
      title="Change language"
    >
      {language === 'uk' ? '🇺🇦 UA' : '🇬🇧 EN'}
    </button>
  )
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navLinks = getNavLinks(isAdmin(), t)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)', backgroundAttachment: 'fixed' }}>
      {/* Мобільний overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
          style={{ background: 'rgba(16, 12, 0, 0.8)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r-2 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'var(--bg-gradient-card)',
          borderColor: 'var(--border-primary)'
        }}
      >
        {/* Логотип */}
        <div className="h-20 px-4 border-b-2 flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="font-black text-lg tracking-wider" style={{ color: 'var(--text-primary)' }}>SHIELD</h1>
              <p className="text-[10px] font-bold tracking-[0.2em]" style={{ color: 'var(--accent-primary)' }}>CLOUD DEFENSE</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-2xl transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        {/* Статус системи */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-secondary)' }}>
          <div className="flex items-center justify-between text-[10px] font-bold tracking-wider">
            <span style={{ color: 'var(--text-secondary)' }}>{t('sidebar.systemStatus')}</span>
            <span className="flex items-center gap-1" style={{ color: 'var(--success)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
              {t('status.online')}
            </span>
          </div>
        </div>

        {/* Перемикачі теми та мови */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-secondary)' }}>
          <ThemeToggle />
          <LanguageToggle />
        </div>

        {/* Навігація */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="text-lg">{link.icon}</span>
              <span className="tracking-wider">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Профіль користувача */}
        <div className="p-4 border-t-2" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="card p-3 mb-3" style={{ '--cut-size': '10px' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center cut-corner-sm"
                   style={{ background: 'var(--accent-gradient)' }}>
                <span className="font-black" style={{ color: 'var(--bg-primary)' }}>
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate tracking-wide" style={{ color: 'var(--text-primary)' }}>
                  {user?.username?.toUpperCase()}
                </p>
                <RoleBadge role={user?.role} />
              </div>
            </div>
            {/* Threat Score */}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-secondary)' }}>
              <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{t('sidebar.threatScore')}</span>
                <span style={{ color: user?.threat_score >= 50 ? 'var(--danger)' : 'var(--success)' }}>
                  {user?.threat_score || 0}/100
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(100, user?.threat_score || 0)}%`,
                    background: user?.threat_score >= 50
                      ? 'linear-gradient(90deg, var(--warning), var(--danger))'
                      : 'var(--accent-gradient)'
                  }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-secondary w-full text-xs"
          >
            <span className="mr-2">⏻</span>
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Основний контент */}
      <div className="lg:pl-64">
        {/* Мобільний header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 border-b-2 lg:hidden"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2"
            style={{ color: 'var(--accent-primary)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center ml-4 gap-2">
            <Logo />
            <span className="font-black tracking-wider" style={{ color: 'var(--text-primary)' }}>SHIELDCLOUD</span>
          </div>
        </header>

        {/* Декоративна верхня лінія */}
        <div className="hidden lg:block h-1" style={{ background: 'var(--accent-gradient)' }} />

        {/* Контент сторінки */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t" style={{ borderColor: 'var(--border-secondary)' }}>
          <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>SHIELDCLOUD DEFENSE SYSTEM v1.0</span>
            <span style={{ color: 'var(--accent-primary)' }}>◈ ENCRYPTED CONNECTION</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
