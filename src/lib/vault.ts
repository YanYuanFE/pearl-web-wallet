// 浏览器内加密 vault：助记词用 app 密码加密（WebCrypto PBKDF2-SHA256 + AES-256-GCM），存 localStorage。
// MetaMask 同款做法 —— 助记词永不明文落盘、永不出浏览器。
const KEY = 'pearl-vault'
const ITER = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

interface VaultFile {
  v: number
  kdf: string
  salt: string
  iv: string
  ct: string
  address: string | null
  createdAt: string
}
export interface VaultMeta {
  exists: boolean
  address?: string | null
  createdAt?: string
}

const b64 = (u8: Uint8Array): string => btoa(String.fromCharCode(...u8))
// 显式分配 ArrayBuffer 支撑，满足 WebCrypto 的 BufferSource 类型
const ub64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function vaultExists(): boolean {
  return !!localStorage.getItem(KEY)
}

export function vaultMeta(): VaultMeta {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { exists: false }
  const v = JSON.parse(raw) as VaultFile
  return { exists: true, address: v.address, createdAt: v.createdAt }
}

// 加密助记词并保存。address 仅作展示用元信息。
export async function createVault(mnemonic: string, password: string, address: string | null): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic)))
  const vault: VaultFile = {
    v: 1,
    kdf: `PBKDF2-SHA256-${ITER}`,
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(ct),
    address: address ?? null,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(KEY, JSON.stringify(vault))
}

// 用密码解密，返回助记词；密码错会抛错（GCM 认证失败）
export async function unlockVault(password: string): Promise<string> {
  const v = JSON.parse(localStorage.getItem(KEY)!) as VaultFile
  const key = await deriveKey(password, ub64(v.salt))
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(v.iv) }, key, ub64(v.ct))
    return dec.decode(pt)
  } catch {
    throw new Error('密码错误')
  }
}

export function destroyVault(): void {
  localStorage.removeItem(KEY)
}
