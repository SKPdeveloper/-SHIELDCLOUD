/**
 * Клієнтське шифрування з використанням Web Crypto API
 * Алгоритм: AES-256-GCM
 */

// Генерація випадкового AES-256 ключа
export async function generateKey() {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  )
}

// Генерація випадкового IV (12 байт для AES-GCM)
export function generateIV() {
  return window.crypto.getRandomValues(new Uint8Array(12))
}

// Експорт ключа в raw формат
export async function exportKey(key) {
  const rawKey = await window.crypto.subtle.exportKey('raw', key)
  return new Uint8Array(rawKey)
}

// Імпорт ключа з raw формату
export async function importKey(rawKey) {
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Шифрування даних
export async function encryptData(data, key, iv) {
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  )
  return new Uint8Array(encrypted)
}

// Дешифрування даних
export async function decryptData(encryptedData, key, iv) {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encryptedData
  )
  return new Uint8Array(decrypted)
}

// Конвертація ArrayBuffer в Base64
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Конвертація Base64 в ArrayBuffer
export function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Шифрування файлу (повний процес)
export async function encryptFile(file) {
  // Читаємо файл
  const fileBuffer = await file.arrayBuffer()

  // Генеруємо ключ та IV
  const key = await generateKey()
  const iv = generateIV()

  // Шифруємо
  const encryptedData = await encryptData(fileBuffer, key, iv)

  // Експортуємо ключ
  const rawKey = await exportKey(key)

  return {
    encryptedData,
    iv,
    key: rawKey,
    ivBase64: arrayBufferToBase64(iv),
    keyBase64: arrayBufferToBase64(rawKey)
  }
}

// Дешифрування файлу (повний процес)
export async function decryptFile(encryptedData, ivBase64, keyBase64) {
  // Конвертуємо з base64
  const iv = base64ToArrayBuffer(ivBase64)
  const rawKey = base64ToArrayBuffer(keyBase64)

  // Імпортуємо ключ
  const key = await importKey(rawKey)

  // Дешифруємо
  const decryptedData = await decryptData(encryptedData, key, iv)

  return decryptedData
}

// Збереження ключа в localStorage
export function saveFileKey(fileId, keyBase64) {
  localStorage.setItem(`file_key_${fileId}`, keyBase64)
}

// Отримання ключа з localStorage
export function getFileKey(fileId) {
  return localStorage.getItem(`file_key_${fileId}`)
}

// Видалення ключа з localStorage
export function removeFileKey(fileId) {
  localStorage.removeItem(`file_key_${fileId}`)
}

// Перевірка підтримки Web Crypto API
export function isWebCryptoSupported() {
  return !!(window.crypto && window.crypto.subtle)
}

// Створення Blob для скачування
export function createDownloadBlob(data, mimeType = 'application/octet-stream') {
  return new Blob([data], { type: mimeType })
}

// Скачування файлу
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
