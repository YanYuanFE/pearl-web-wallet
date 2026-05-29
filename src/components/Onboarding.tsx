import { useState, useMemo, type FormEvent } from 'react'
import { KeyRound, ShieldCheck, AlertTriangle, AlertCircle, Lock, Loader2 } from 'lucide-react'
import { isValidMnemonic, deriveAccount } from '../lib/pearl'
import { createVault } from '../lib/vault'

const norm = (s: string) => s.trim().replace(/\s+/g, ' ')

export default function Onboarding({ onUnlocked }: { onUnlocked: (mnemonic: string) => void }) {
  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const valid = useMemo(() => isValidMnemonic(mnemonic), [mnemonic])
  const address = useMemo(() => {
    try {
      return valid ? deriveAccount(norm(mnemonic), 0).address : null
    } catch {
      return null
    }
  }, [mnemonic, valid])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!valid) return setErr('助记词无效（请检查 12 个单词及拼写）')
    if (password.length < 8) return setErr('app 密码至少 8 位')
    if (password !== confirm) return setErr('两次密码不一致')
    setBusy(true)
    try {
      await createVault(norm(mnemonic), password, address)
      onUnlocked(norm(mnemonic))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h2 className="flex items-center gap-2 font-display text-2xl font-medium tracking-tight">
        <KeyRound size={20} className="text-inksoft" />
        导入钱包
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-inksoft">
        输入 12 词助记词，用 app 密码加密保存在本机。助记词永不离开浏览器、永不上传。
      </p>

      <label className="label">12 词助记词</label>
      <textarea
        rows={3}
        value={mnemonic}
        onChange={(e) => setMnemonic(e.target.value)}
        placeholder="word1 word2 word3 …"
        autoComplete="off"
        spellCheck={false}
        className="field mono"
      />
      {mnemonic &&
        (valid ? (
          <div className="note-ok mt-2.5 flex gap-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <div>
              助记词有效 · 派生地址：
              <code className="mt-1 block break-all font-mono text-xs text-emerald-900">{address}</code>
              <span className="mt-1 block font-semibold">请核对是否与你已知的收款地址一致再继续</span>
            </div>
          </div>
        ) : (
          <div className="note-warn mt-2.5 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            助记词尚不完整或无效
          </div>
        ))}

      <label className="label">App 密码（≥8 位，用于解锁）</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="field" />
      <label className="label">确认 App 密码</label>
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="field" />

      {err && (
        <div className="note-err mt-3 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          {err}
        </div>
      )}
      <button type="submit" disabled={busy || !valid} className="btn mt-5">
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" /> 加密中…
          </>
        ) : (
          <>
            <Lock size={16} /> 加密保存并进入
          </>
        )}
      </button>
    </form>
  )
}
