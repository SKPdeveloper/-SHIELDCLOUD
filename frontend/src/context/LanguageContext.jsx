import { createContext, useContext, useState, useEffect } from 'react'

// Переклади
const translations = {
  uk: {
    // Навігація
    nav: {
      dashboard: 'ДАШБОРД',
      files: 'ФАЙЛИ',
      audit: 'АУДИТ',
      threats: 'ЗАГРОЗИ',
      users: 'ЮЗЕРИ',
      settings: 'НАЛАШТУВАННЯ',
      logout: 'ВИЙТИ'
    },
    // Загальне
    common: {
      loading: 'Завантаження...',
      save: 'ЗБЕРЕГТИ',
      cancel: 'СКАСУВАТИ',
      delete: 'ВИДАЛИТИ',
      edit: 'РЕДАГУВАТИ',
      search: 'Пошук...',
      reset: 'СКИНУТИ',
      export: 'ЕКСПОРТ',
      prev: '← ПОПЕРЕДНЯ',
      next: 'НАСТУПНА →',
      page: 'Сторінка',
      of: 'з',
      all: 'Всі',
      yes: 'ТАК',
      no: 'НІ',
      ok: 'OK',
      continue: 'ПРОДОВЖИТИ',
      close: 'ЗАКРИТИ'
    },
    // Статуси
    status: {
      online: 'ОНЛАЙН',
      offline: 'ОФЛАЙН',
      active: 'АКТИВНИЙ',
      blocked: 'ЗАБЛОКОВАНО',
      verified: 'ПЕРЕВІРЕНО',
      compromised: 'СКОМПРОМЕТОВАНО',
      unchecked: 'НЕ ПЕРЕВІРЕНО',
      success: 'УСПІХ',
      denied: 'ВІДМОВА',
      error: 'ПОМИЛКА'
    },
    // Авторизація
    auth: {
      login: 'ВХІД',
      loginTitle: 'АВТОРИЗАЦІЯ',
      username: "Ім'я користувача",
      password: 'Пароль',
      loginButton: 'УВІЙТИ',
      quickLogin: 'ШВИДКИЙ ВХІД',
      forgotPassword: 'Забули пароль?',
      demoMode: 'ДЕМО РЕЖИМ',
      demoReset: 'СКИНУТИ ДЕМО',
      demoResetDesc: 'Розблокувати акаунти та скинути threat scores',
      blockedAccounts: 'заблоковано'
    },
    // Дашборд
    dashboard: {
      adminControl: 'АДМІН ПАНЕЛЬ',
      userPanel: 'ПАНЕЛЬ КОРИСТУВАЧА',
      welcome: 'ВІТАЄМО',
      refresh: 'ОНОВИТИ',
      threats24h: 'ЗАГРОЗИ / 24Г',
      blocked: 'ЗАБЛОКОВАНО',
      active24h: 'АКТИВНІ / 24Г',
      totalFiles: 'ФАЙЛІВ',
      threatMonitor: 'МОНІТОР ЗАГРОЗ',
      protectionConfig: 'НАЛАШТУВАННЯ ЗАХИСТУ',
      unblockAll: 'РОЗБЛОКУВАТИ ВСІХ',
      yourThreatScore: 'ВАШ THREAT SCORE',
      yourFiles: 'ВАШІ ФАЙЛИ',
      detectedThreats: 'ВИЯВЛЕНІ ЗАГРОЗИ',
      attackSimulation: 'СИМУЛЯЦІЯ АТАК',
      authenticated: 'АВТОРИЗОВАНИЙ'
    },
    // Файли
    files: {
      title: 'ФАЙЛИ',
      subtitle: 'Управління зашифрованими файлами',
      secureUpload: 'БЕЗПЕЧНЕ ЗАВАНТАЖЕННЯ',
      dropFiles: 'ПЕРЕТЯГНІТЬ ФАЙЛИ АБО НАТИСНІТЬ',
      maxSize: 'МАКС 50 MB НА ФАЙЛ • AES-256 ШИФРУВАННЯ',
      encrypting: 'ШИФРУВАННЯ...',
      uploading: 'ЗАВАНТАЖЕННЯ...',
      complete: 'ЗАВЕРШЕНО',
      verifyAll: 'ПЕРЕВІРИТИ ВСІ',
      scanning: 'СКАНУВАННЯ...',
      noFiles: 'ФАЙЛІВ НЕ ЗНАЙДЕНО',
      file: 'ФАЙЛ',
      size: 'РОЗМІР',
      owner: 'ВЛАСНИК',
      integrity: 'ЦІЛІСНІСТЬ',
      visibility: 'ВИДИМІСТЬ',
      date: 'ДАТА',
      actions: 'ДІЇ',
      public: 'ПУБЛІЧНИЙ',
      private: 'ПРИВАТНИЙ',
      keyMissing: 'КЛЮЧ ВІДСУТНІЙ',
      download: 'Завантажити',
      verify: 'Перевірити цілісність',
      deleteFile: 'Видалити'
    },
    // Аудит
    audit: {
      title: 'АУДИТ',
      subtitle: 'Журнал подій системи',
      totalRecords: 'ВСЬОГО ЗАПИСІВ',
      actionType: 'ТИП ДІЇ',
      user: 'КОРИСТУВАЧ',
      time: 'ЧАС',
      action: 'ДІЯ',
      resource: 'РЕСУРС',
      ip: 'IP',
      noRecords: 'ЗАПИСІВ НЕ ЗНАЙДЕНО',
      details: 'ДЕТАЛІ',
      userAgent: 'USER AGENT',
      resourceId: 'ID РЕСУРСУ',
      from: 'ВІД',
      to: 'ДО',
      exportCsv: 'ЕКСПОРТ CSV',
      exporting: 'ЕКСПОРТ...'
    },
    // Загрози
    threats: {
      title: 'ЗАГРОЗИ',
      subtitle: 'Система виявлення та реагування',
      threats24h: 'ЗАГРОЗИ 24Г',
      critical: 'КРИТИЧНІ',
      high: 'ВИСОКІ',
      blockedAccounts: 'ЗАБЛОКОВАНІ АКАУНТИ',
      threatsLast24h: 'ЗАГРОЗИ ЗА 24Г',
      byType: 'ЗА ТИПОМ',
      topThreatUsers: 'НАЙБІЛЬШІ ЗАГРОЗИ',
      severity: 'РІВЕНЬ',
      type: 'ТИП',
      description: 'ОПИС',
      noThreats: 'ЗАГРОЗ НЕ ВИЯВЛЕНО',
      resolve: 'ВИРІШИТИ',
      resolveThreat: 'ВИРІШЕННЯ ЗАГРОЗИ',
      resolutionType: 'ТИП ВИРІШЕННЯ',
      falsePositive: 'Хибне спрацювання',
      confirmed: 'Підтверджено',
      mitigated: 'Усунено',
      notes: 'ПРИМІТКИ',
      medium: 'СЕРЕДНІЙ',
      low: 'НИЗЬКИЙ'
    },
    // Користувачі
    users: {
      title: 'ЮЗЕРИ',
      subtitle: 'Управління доступом',
      total: 'ВСЬОГО',
      admins: 'АДМІНІВ',
      usersCount: 'КОРИСТУВАЧІВ',
      guests: 'ГОСТЕЙ',
      blockedCount: 'ЗАБЛОКОВАНО',
      accessMatrix: 'МАТРИЦЯ ДОСТУПУ',
      resourceLabel: 'РЕСУРС',
      admin: 'АДМІН',
      userRole: 'КОРИСТУВАЧ',
      guest: 'ГІСТЬ',
      email: 'EMAIL',
      role: 'РОЛЬ',
      threatScore: 'THREAT SCORE',
      lastActivity: 'ОСТАННЯ АКТИВНІСТЬ',
      changeRole: 'ЗМІНИТИ РОЛЬ',
      newRole: 'НОВА РОЛЬ',
      administrator: 'Адміністратор',
      block: 'БЛОК',
      unblock: 'РОЗБЛОК',
      noUsers: 'КОРИСТУВАЧІВ НЕ ЗНАЙДЕНО'
    },
    // Налаштування
    settings: {
      title: 'НАЛАШТУВАННЯ',
      subtitle: 'Конфігурація системи',
      cloudProviders: 'ХМАРНІ ПРОВАЙДЕРИ',
      help: 'ДОПОМОГА',
      appearance: 'ВИГЛЯД',
      theme: 'ТЕМА',
      darkTheme: 'Темна тема',
      lightTheme: 'Світла тема',
      language: 'МОВА',
      ukrainian: 'Українська',
      english: 'English',
      localstack: 'LOCALSTACK',
      localstackDesc: 'Локальна емуляція AWS S3',
      minio: 'MINIO',
      minioDesc: 'S3-сумісне сховище',
      external: 'ЗОВНІШНЄ',
      externalDesc: 'Реальні хмарні API',
      warning: 'УВАГА',
      externalWarning: 'Підключення до реальних AWS/GCP/Azure може призвести до блокування акаунту',
      activate: 'АКТИВУВАТИ',
      test: 'ТЕСТ',
      activated: 'АКТИВОВАНО',
      testSuccess: 'З\'ЄДНАННЯ УСПІШНЕ',
      testFailed: 'ПОМИЛКА З\'ЄДНАННЯ',
      helpTitle: 'ДОКУМЕНТАЦІЯ SHIELDCLOUD',
      architecture: 'АРХІТЕКТУРА',
      features: 'ФУНКЦІЇ',
      attacks: 'АТАКИ'
    },
    // Sidebar
    sidebar: {
      systemStatus: 'СТАТУС СИСТЕМИ',
      threatScore: 'THREAT SCORE'
    },
    // Атаки
    attacks: {
      massDownload: 'МАСОВЕ ЗАВАНТАЖЕННЯ',
      massDelete: 'МАСОВЕ ВИДАЛЕННЯ',
      rapidRequests: 'ШВИДКІ ЗАПИТИ',
      unauthorizedAccess: 'НЕАВТОРИЗОВАНИЙ ДОСТУП',
      privilegeEscalation: 'ПІДВИЩЕННЯ ПРИВІЛЕЇВ',
      dataExfiltration: 'ВИКРАДЕННЯ ДАНИХ',
      danger: 'НЕБЕЗПЕКА',
      description: 'ОПИС',
      protection: 'ЗАХИСТ',
      protectionTriggered: 'ЗАХИСТ СПРАЦЮВАВ!'
    },
    // Повідомлення
    messages: {
      confirmDelete: 'Видалити файл',
      confirmBlock: 'Заблокувати цього користувача?',
      confirmUnblock: 'Розблокувати цього користувача?',
      confirmDeleteUser: 'Видалити користувача? Цю дію неможливо скасувати.',
      accountBlocked: 'АКАУНТ ЗАБЛОКОВАНО',
      warningActivity: 'УВАГА: ПІДОЗРІЛА АКТИВНІСТЬ',
      statusNormal: 'СТАТУС: НОРМА',
      selectAttack: '// ОБЕРІТЬ АТАКУ...'
    }
  },
  en: {
    // Navigation
    nav: {
      dashboard: 'DASHBOARD',
      files: 'FILES',
      audit: 'AUDIT',
      threats: 'THREATS',
      users: 'USERS',
      settings: 'SETTINGS',
      logout: 'LOGOUT'
    },
    // Common
    common: {
      loading: 'Loading...',
      save: 'SAVE',
      cancel: 'CANCEL',
      delete: 'DELETE',
      edit: 'EDIT',
      search: 'Search...',
      reset: 'RESET',
      export: 'EXPORT',
      prev: '← PREV',
      next: 'NEXT →',
      page: 'Page',
      of: 'of',
      all: 'All',
      yes: 'YES',
      no: 'NO',
      ok: 'OK',
      continue: 'CONTINUE',
      close: 'CLOSE'
    },
    // Status
    status: {
      online: 'ONLINE',
      offline: 'OFFLINE',
      active: 'ACTIVE',
      blocked: 'BLOCKED',
      verified: 'VERIFIED',
      compromised: 'COMPROMISED',
      unchecked: 'UNCHECKED',
      success: 'SUCCESS',
      denied: 'DENIED',
      error: 'ERROR'
    },
    // Auth
    auth: {
      login: 'LOGIN',
      loginTitle: 'AUTHORIZATION',
      username: 'Username',
      password: 'Password',
      loginButton: 'SIGN IN',
      quickLogin: 'QUICK LOGIN',
      forgotPassword: 'Forgot password?',
      demoMode: 'DEMO MODE',
      demoReset: 'RESET DEMO',
      demoResetDesc: 'Unblock accounts and reset threat scores',
      blockedAccounts: 'blocked'
    },
    // Dashboard
    dashboard: {
      adminControl: 'ADMIN CONTROL',
      userPanel: 'USER PANEL',
      welcome: 'WELCOME',
      refresh: 'REFRESH',
      threats24h: 'THREATS / 24H',
      blocked: 'BLOCKED',
      active24h: 'ACTIVE / 24H',
      totalFiles: 'FILES',
      threatMonitor: 'THREAT MONITOR',
      protectionConfig: 'PROTECTION CONFIG',
      unblockAll: 'UNBLOCK ALL USERS',
      yourThreatScore: 'YOUR THREAT SCORE',
      yourFiles: 'YOUR FILES',
      detectedThreats: 'DETECTED THREATS',
      attackSimulation: 'ATTACK SIMULATION',
      authenticated: 'AUTHENTICATED'
    },
    // Files
    files: {
      title: 'FILES',
      subtitle: 'Encrypted file management',
      secureUpload: 'SECURE UPLOAD',
      dropFiles: 'DROP FILES OR CLICK TO SELECT',
      maxSize: 'MAX 50 MB PER FILE • AES-256 ENCRYPTION',
      encrypting: 'ENCRYPTING...',
      uploading: 'UPLOADING...',
      complete: 'COMPLETE',
      verifyAll: 'VERIFY ALL',
      scanning: 'SCANNING...',
      noFiles: 'NO FILES FOUND',
      file: 'FILE',
      size: 'SIZE',
      owner: 'OWNER',
      integrity: 'INTEGRITY',
      visibility: 'VISIBILITY',
      date: 'DATE',
      actions: 'ACTIONS',
      public: 'PUBLIC',
      private: 'PRIVATE',
      keyMissing: 'KEY MISSING',
      download: 'Download',
      verify: 'Verify integrity',
      deleteFile: 'Delete'
    },
    // Audit
    audit: {
      title: 'AUDIT',
      subtitle: 'System event log',
      totalRecords: 'TOTAL RECORDS',
      actionType: 'ACTION TYPE',
      user: 'USER',
      time: 'TIME',
      action: 'ACTION',
      resource: 'RESOURCE',
      ip: 'IP',
      noRecords: 'NO RECORDS FOUND',
      details: 'DETAILS',
      userAgent: 'USER AGENT',
      resourceId: 'RESOURCE ID',
      from: 'FROM',
      to: 'TO',
      exportCsv: 'EXPORT CSV',
      exporting: 'EXPORTING...'
    },
    // Threats
    threats: {
      title: 'THREATS',
      subtitle: 'Detection and response system',
      threats24h: 'THREATS 24H',
      critical: 'CRITICAL',
      high: 'HIGH',
      blockedAccounts: 'BLOCKED ACCOUNTS',
      threatsLast24h: 'THREATS LAST 24H',
      byType: 'BY TYPE',
      topThreatUsers: 'TOP THREAT USERS',
      severity: 'SEVERITY',
      type: 'TYPE',
      description: 'DESCRIPTION',
      noThreats: 'NO THREATS DETECTED',
      resolve: 'RESOLVE',
      resolveThreat: 'RESOLVE THREAT',
      resolutionType: 'RESOLUTION TYPE',
      falsePositive: 'False Positive',
      confirmed: 'Confirmed',
      mitigated: 'Mitigated',
      notes: 'NOTES',
      medium: 'MEDIUM',
      low: 'LOW'
    },
    // Users
    users: {
      title: 'USERS',
      subtitle: 'Access control management',
      total: 'TOTAL',
      admins: 'ADMINS',
      usersCount: 'USERS',
      guests: 'GUESTS',
      blockedCount: 'BLOCKED',
      accessMatrix: 'ACCESS MATRIX',
      resourceLabel: 'RESOURCE',
      admin: 'ADMIN',
      userRole: 'USER',
      guest: 'GUEST',
      email: 'EMAIL',
      role: 'ROLE',
      threatScore: 'THREAT SCORE',
      lastActivity: 'LAST ACTIVITY',
      changeRole: 'CHANGE ROLE',
      newRole: 'NEW ROLE',
      administrator: 'Administrator',
      block: 'BLOCK',
      unblock: 'UNBLOCK',
      noUsers: 'NO USERS FOUND'
    },
    // Settings
    settings: {
      title: 'SETTINGS',
      subtitle: 'System configuration',
      cloudProviders: 'CLOUD PROVIDERS',
      help: 'HELP',
      appearance: 'APPEARANCE',
      theme: 'THEME',
      darkTheme: 'Dark theme',
      lightTheme: 'Light theme',
      language: 'LANGUAGE',
      ukrainian: 'Українська',
      english: 'English',
      localstack: 'LOCALSTACK',
      localstackDesc: 'Local AWS S3 emulation',
      minio: 'MINIO',
      minioDesc: 'S3-compatible storage',
      external: 'EXTERNAL',
      externalDesc: 'Real cloud APIs',
      warning: 'WARNING',
      externalWarning: 'Connecting to real AWS/GCP/Azure may result in account suspension',
      activate: 'ACTIVATE',
      test: 'TEST',
      activated: 'ACTIVATED',
      testSuccess: 'CONNECTION SUCCESSFUL',
      testFailed: 'CONNECTION FAILED',
      helpTitle: 'SHIELDCLOUD DOCUMENTATION',
      architecture: 'ARCHITECTURE',
      features: 'FEATURES',
      attacks: 'ATTACKS'
    },
    // Sidebar
    sidebar: {
      systemStatus: 'SYSTEM STATUS',
      threatScore: 'THREAT SCORE'
    },
    // Attacks
    attacks: {
      massDownload: 'MASS DOWNLOAD',
      massDelete: 'MASS DELETE',
      rapidRequests: 'RAPID REQUESTS',
      unauthorizedAccess: 'UNAUTHORIZED ACCESS',
      privilegeEscalation: 'PRIVILEGE ESCALATION',
      dataExfiltration: 'DATA EXFILTRATION',
      danger: 'DANGER',
      description: 'DESCRIPTION',
      protection: 'PROTECTION',
      protectionTriggered: 'PROTECTION TRIGGERED!'
    },
    // Messages
    messages: {
      confirmDelete: 'Delete file',
      confirmBlock: 'Block this user?',
      confirmUnblock: 'Unblock this user?',
      confirmDeleteUser: 'Delete user? This action cannot be undone.',
      accountBlocked: 'ACCOUNT BLOCKED',
      warningActivity: 'WARNING: SUSPICIOUS ACTIVITY',
      statusNormal: 'STATUS: NORMAL',
      selectAttack: '// SELECT ATTACK...'
    }
  }
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('shieldcloud-language')
    return saved || 'uk'
  })

  useEffect(() => {
    localStorage.setItem('shieldcloud-language', language)
  }, [language])

  // Функція для отримання перекладу за ключем (наприклад, 'nav.dashboard')
  const t = (key) => {
    const keys = key.split('.')
    let result = translations[language]
    for (const k of keys) {
      result = result?.[k]
    }
    return result || key
  }

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'uk' ? 'en' : 'uk')
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
