import { useState, type FormEvent } from 'react'
import { LockKeyhole, Lock, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { unlockVault, vaultMeta, destroyVault } from '../lib/vault'

const short = (s?: string | null, n = 12) => (s && s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s ?? '')

export default function Unlock({ onUnlocked }: { onUnlocked: (mnemonic: string) => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const meta = vaultMeta()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      onUnlocked(await unlockVault(password))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function wipe() {
    if (confirm('确认删除本机加密钱包？删除后需用助记词重新导入（链上资产不受影响）。')) {
      destroyVault()
      location.reload()
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h2 className="flex items-center gap-2 font-display text-2xl font-medium tracking-tight">
        <LockKeyhole size={20} className="text-inksoft" />
        解锁钱包
      </h2>
      {meta.address && (
        <div className="mt-1.5 text-xs text-inksoft">
          地址 <code className="font-mono text-slate-700">{short(meta.address)}</code>
        </div>
      )}
      <label className="label">App 密码</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        autoComplete="current-password"
        className="field"
      />
      {err && (
        <div className="note-err mt-3 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          {err}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn mt-5">
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" /> 解锁中…
          </>
        ) : (
          <>
            <Lock size={16} /> 解锁
          </>
        )}
      </button>
      <button type="button" onClick={wipe} className="btn-ghost mt-2.5">
        <Trash2 size={15} /> 删除本机钱包
      </button>
    </form>
  )
}
