import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { filesApi } from '../api/client'
import {
  encryptFile,
  decryptFile,
  saveFileKey,
  getFileKey,
  removeFileKey,
  downloadFile,
  createDownloadBlob,
  isWebCryptoSupported
} from '../utils/crypto'

// Іконки для типів файлів
function FileIcon({ filename }) {
  const ext = filename.split('.').pop()?.toLowerCase()

  const getColor = () => {
    if (['pdf'].includes(ext)) return 'text-[#FF6B6B]'
    if (['doc', 'docx'].includes(ext)) return 'text-[#4ECDC4]'
    if (['xls', 'xlsx'].includes(ext)) return 'text-[#2ECC71]'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'text-[#9B59B6]'
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'text-[#FF9400]'
    if (['mp3', 'wav', 'flac'].includes(ext)) return 'text-[#FCA316]'
    if (['mp4', 'avi', 'mkv', 'mov'].includes(ext)) return 'text-[#95122C]'
    return 'text-[#D0E0E1]'
  }

  return (
    <svg className={`w-8 h-8 ${getColor()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

// Форматування розміру
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// Бейдж статусу цілісності
function IntegrityBadge({ status }) {
  const config = {
    verified: { label: 'VERIFIED', color: 'text-[#2ECC71] border-[#2ECC71]' },
    compromised: { label: 'COMPROMISED', color: 'text-[#FF6B6B] border-[#FF6B6B]' },
    unchecked: { label: 'UNCHECKED', color: 'text-[#D0E0E1] border-[#D0E0E1]' }
  }

  const { label, color } = config[status] || config.unchecked

  return (
    <span className={`badge ${color} bg-transparent`}>
      {label}
    </span>
  )
}

// Компонент завантаження файлів
function FileUpload({ onUpload, uploading }) {
  const [dragActive, setDragActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const inputRef = useRef(null)

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])

  const handleFiles = async (files) => {
    if (!isWebCryptoSupported()) {
      alert('Ваш браузер не підтримує шифрування. Використовуйте сучасний браузер.')
      return
    }

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`Файл ${file.name} занадто великий (максимум 50 MB)`)
        continue
      }

      try {
        setStatus('ENCRYPTING...')
        setProgress(20)

        // Клієнтське шифрування
        const encrypted = await encryptFile(file)

        setStatus('UPLOADING...')
        setProgress(50)

        // Формуємо FormData
        const formData = new FormData()
        formData.append('file', new Blob([encrypted.encryptedData]), file.name)
        formData.append('client_iv', encrypted.ivBase64)
        formData.append('original_name', file.name)
        formData.append('is_public', 'false')

        // Завантажуємо
        const response = await filesApi.upload(formData, (progressEvent) => {
          const percent = 50 + Math.round((progressEvent.loaded * 50) / progressEvent.total)
          setProgress(percent)
        })

        // Зберігаємо ключ локально
        saveFileKey(response.data.file.id, encrypted.keyBase64)

        setProgress(100)
        setStatus('COMPLETE')

        onUpload()

        setTimeout(() => {
          setProgress(0)
          setStatus('')
        }, 1500)
      } catch (error) {
        console.error('Помилка завантаження:', error)
        setStatus('ERROR: ' + (error.response?.data?.error || error.message))
        setTimeout(() => {
          setProgress(0)
          setStatus('')
        }, 3000)
      }
    }
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#FF9400] text-lg">◈</span>
        <h3 className="text-[#F3F4F5] font-bold tracking-wider">SECURE UPLOAD</h3>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-[#FF9400] bg-[#FF9400]/10'
            : 'border-[#95122C]/50 hover:border-[#FF9400]/50 hover:bg-[#95122C]/10'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />

        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#FF9400] to-[#95122C] rounded-lg flex items-center justify-center cut-corner-sm">
          <svg className="w-8 h-8 text-[#100C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <p className="text-[#F3F4F5] font-bold tracking-wide mb-1">
          DROP FILES OR CLICK TO SELECT
        </p>
        <p className="text-[#D0E0E1] text-xs tracking-wider">
          MAX 50 MB PER FILE • AES-256 ENCRYPTION
        </p>

        {progress > 0 && (
          <div className="mt-6 max-w-xs mx-auto">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold tracking-wider text-[#FF9400]">{status}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FilesPage() {
  const { user, isAdmin } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [verifying, setVerifying] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1 })

  useEffect(() => {
    loadFiles()
    // Авто-оновлення кожні 10 секунд
    const interval = setInterval(loadFiles, 10000)
    return () => clearInterval(interval)
  }, [pagination.page, search])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await filesApi.list({
        page: pagination.page,
        per_page: 20,
        search: search || undefined
      })
      setFiles(response.data.files)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Помилка завантаження файлів:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (file) => {
    try {
      setDownloading(file.id)

      // Отримуємо ключ
      const keyBase64 = getFileKey(file.id)
      if (!keyBase64) {
        alert('Ключ для дешифрування не знайдено. Файл був зашифрований на іншому пристрої.')
        return
      }

      // Завантажуємо файл
      const response = await filesApi.download(file.id)

      // Отримуємо IV з заголовка
      const ivBase64 = response.headers['x-client-iv']

      // Дешифруємо
      const decrypted = await decryptFile(
        new Uint8Array(await response.data.arrayBuffer()),
        ivBase64,
        keyBase64
      )

      // Скачуємо
      const blob = createDownloadBlob(decrypted)
      downloadFile(blob, file.original_name)
    } catch (error) {
      console.error('Помилка скачування:', error)
      alert('Помилка скачування: ' + (error.message || 'Невідома помилка'))
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(`Видалити файл "${file.original_name}"?`)) return

    try {
      await filesApi.delete(file.id)
      removeFileKey(file.id)
      loadFiles()
    } catch (error) {
      console.error('Помилка видалення:', error)
      alert('Помилка видалення: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleVerify = async (file) => {
    try {
      setVerifying(file.id)
      const response = await filesApi.verify(file.id)

      // Оновлюємо файл у списку
      setFiles(files.map(f =>
        f.id === file.id
          ? { ...f, integrity_status: response.data.status, last_verified_at: response.data.checked_at }
          : f
      ))

      if (response.data.status === 'compromised') {
        alert('УВАГА! Файл було скомпрометовано!')
      }
    } catch (error) {
      console.error('Помилка перевірки:', error)
      alert('Помилка перевірки: ' + (error.response?.data?.error || error.message))
    } finally {
      setVerifying(null)
    }
  }

  const handleVerifyAll = async () => {
    if (!confirm('Перевірити цілісність всіх файлів? Це може зайняти деякий час.')) return

    try {
      setVerifying('all')
      const response = await filesApi.verifyAll()

      alert(
        `Перевірено: ${response.data.total}\n` +
        `Цілісні: ${response.data.verified}\n` +
        `Скомпрометовані: ${response.data.compromised}`
      )

      loadFiles()
    } catch (error) {
      console.error('Помилка масової перевірки:', error)
      alert('Помилка: ' + (error.response?.data?.error || error.message))
    } finally {
      setVerifying(null)
    }
  }

  const handleVisibilityChange = async (file) => {
    try {
      await filesApi.changeVisibility(file.id, !file.is_public)
      setFiles(files.map(f =>
        f.id === file.id ? { ...f, is_public: !f.is_public } : f
      ))
    } catch (error) {
      console.error('Помилка зміни видимості:', error)
    }
  }

  const canDownload = (file) => {
    return getFileKey(file.id) !== null
  }

  const canModify = (file) => {
    return isAdmin() || file.owner?.id === user?.id
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FF9400] to-[#95122C] flex items-center justify-center cut-corner-sm">
              <span className="text-[#100C00] text-xl">◇</span>
            </div>
            <h1 className="text-2xl font-black text-[#F3F4F5] tracking-wider">ФАЙЛИ</h1>
          </div>
          <p className="text-[#D0E0E1] text-sm tracking-wide">
            ENCRYPTED FILE MANAGEMENT SYSTEM
          </p>
        </div>

        {isAdmin() && (
          <button
            onClick={handleVerifyAll}
            disabled={verifying === 'all'}
            className="btn btn-secondary"
          >
            <span className="mr-2">◆</span>
            {verifying === 'all' ? 'SCANNING...' : 'VERIFY ALL'}
          </button>
        )}
      </div>

      {/* Завантаження */}
      {(isAdmin() || user?.role === 'user') && (
        <FileUpload onUpload={loadFiles} uploading={uploading} />
      )}

      {/* Пошук */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#FF9400]">◈</span>
            <input
              type="text"
              placeholder="SEARCH FILES..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination(p => ({ ...p, page: 1 }))
              }}
              className="form-input pl-10"
            />
          </div>
        </div>
      </div>

      {/* Таблиця файлів */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#FF9400] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#D0E0E1] text-sm tracking-wider">LOADING FILES...</p>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#95122C]/20 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-[#95122C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="text-[#D0E0E1] font-bold tracking-wider">NO FILES FOUND</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#95122C]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">File</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Size</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Owner</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Visibility</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[#FF9400] tracking-wider uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file.id} className="border-b border-[#95122C]/30 hover:bg-[#95122C]/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <FileIcon filename={file.original_name} />
                        <div className="ml-3">
                          <p className="font-bold text-[#F3F4F5] truncate max-w-xs">
                            {file.original_name}
                          </p>
                          {!canDownload(file) && (
                            <p className="text-[10px] text-[#FCA316] tracking-wider">KEY MISSING</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-sm font-mono">{formatSize(file.file_size)}</td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-sm">{file.owner?.username?.toUpperCase() || '—'}</td>
                    <td className="px-4 py-3">
                      <IntegrityBadge status={file.integrity_status} />
                    </td>
                    <td className="px-4 py-3">
                      {canModify(file) ? (
                        <button
                          onClick={() => handleVisibilityChange(file)}
                          className={`badge cursor-pointer ${
                            file.is_public
                              ? 'text-[#4ECDC4] border-[#4ECDC4] bg-transparent'
                              : 'text-[#D0E0E1] border-[#D0E0E1] bg-transparent'
                          }`}
                        >
                          {file.is_public ? 'PUBLIC' : 'PRIVATE'}
                        </button>
                      ) : (
                        <span className={`badge ${
                          file.is_public
                            ? 'text-[#4ECDC4] border-[#4ECDC4] bg-transparent'
                            : 'text-[#D0E0E1] border-[#D0E0E1] bg-transparent'
                        }`}>
                          {file.is_public ? 'PUBLIC' : 'PRIVATE'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#D0E0E1] text-xs">
                      {new Date(file.created_at).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloading === file.id || !canDownload(file)}
                          className="btn btn-sm btn-secondary"
                          title={canDownload(file) ? 'Скачати' : 'Ключ відсутній'}
                        >
                          {downloading === file.id ? (
                            <span className="animate-spin">◌</span>
                          ) : (
                            '↓'
                          )}
                        </button>

                        {canModify(file) && (
                          <>
                            <button
                              onClick={() => handleVerify(file)}
                              disabled={verifying === file.id}
                              className="btn btn-sm btn-secondary"
                              title="Перевірити цілісність"
                            >
                              {verifying === file.id ? '◌' : '✓'}
                            </button>

                            <button
                              onClick={() => handleDelete(file)}
                              className="btn btn-sm btn-danger"
                              title="Видалити"
                            >
                              ✕
                            </button>
                          </>
                        )}
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
    </div>
  )
}
