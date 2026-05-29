import { useState, useRef, useCallback } from 'react'
import { vaultExists } from './lib/vault'
import { deriveAccount, type Account } from './lib/pearl'
import Onboarding from './components/Onboarding'
import Unlock from './components/Unlock'
import Wallet from './components/Wallet'

const AUTO_LOCK_MS = 10 * 60 * 1000 // 10 分钟无操作自动上锁

export default function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [hasVault, setHasVault] = useState(vaultExists())
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lock = useCallback(() => {
    setAccount(null)
    if (lockTimer.current) clearTimeout(lockTimer.current)
  }, [])

  const bumpTimer = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current)
    lockTimer.current = setTimeout(lock, AUTO_LOCK_MS)
  }, [lock])

  const onUnlocked = useCallback(
    (mnemonic: string) => {
      setAccount(deriveAccount(mnemonic, 0)) // 私钥进内存，助记词随即被丢弃
      setHasVault(true)
      bumpTimer()
    },
    [bumpTimer]
  )

  let view
  if (account) view = <Wallet account={account} onLock={lock} onActivity={bumpTimer} />
  else if (hasVault) view = <Unlock onUnlocked={onUnlocked} />
  else view = <Onboarding onUnlocked={onUnlocked} />

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="iridescence" />
      <div className="grain" />
      <div className="relative z-10 mx-auto max-w-xl px-5 py-10 sm:py-14">
        <header className="reveal mb-7 flex items-center justify-between" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-2.5">
            <span className="pearl-dot" />
            <span className="font-display text-2xl font-medium tracking-tight text-ink">
              Pearl <span className="text-inksoft">钱包</span>
            </span>
          </div>
          <span className="pill">本地 · 客户端签名</span>
        </header>

        <div className="reveal" style={{ animationDelay: '90ms' }}>
          {view}
        </div>

        <footer
          className="reveal mt-7 text-center text-[11px] leading-relaxed text-inksoft"
          style={{ animationDelay: '180ms' }}
        >
          助记词经 PBKDF2 + AES-GCM 加密存于本机 · 签名在浏览器完成 · 无手续费抽成
        </footer>
      </div>
    </div>
  )
}
