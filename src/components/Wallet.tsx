import { useState, type FormEvent } from 'react'
import {
  Wallet as WalletIcon,
  Send,
  History,
  Lock,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  ReceiptText,
  FileText,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { scanAddress, feeRatePerVByte, broadcast, type ScanResult } from '../lib/rpc'
import { isValidAddress, prlToAtoms, explorerTx, explorerAddress, type Account } from '../lib/pearl'
import { buildSignedTx, type SignedTx } from '../lib/tx'

const short = (s: string, n = 10) => (s && s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s)
const copy = async (t: string) => {
  try {
    await navigator.clipboard.writeText(t)
    toast.success('已复制到剪贴板')
  } catch {
    toast.error('复制失败')
  }
}
const COMPACT =
  'inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-black/5'
const LINK = 'inline-flex items-center gap-1 font-mono underline-offset-2 hover:underline'

type Tab = 'balance' | 'send' | 'history'

export default function Wallet({
  account,
  onLock,
  onActivity,
}: {
  account: Account
  onLock: () => void
  onActivity: () => void
}) {
  const [tab, setTab] = useState<Tab>('balance')
  // 同一地址的请求由 TanStack Query 去重 + 缓存（StrictMode 双 mount 也只发一次）
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['scan', account.address],
    queryFn: () => scanAddress(account.address),
  })
  const err = error ? (error as Error).message : null

  return (
    <div className="card" onClick={onActivity}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.1em] text-inksoft">我的地址</div>
          <div className="mt-1 flex items-center">
            <a
              href={explorerAddress(account.address)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINK} text-sm text-ink`}
              title={account.address}
            >
              {short(account.address, 13)}
              <ExternalLink size={12} className="opacity-60" />
            </a>
            <button className="mini" title="复制地址" onClick={() => copy(account.address)}>
              <Copy size={12} />
            </button>
          </div>
        </div>
        <button className={COMPACT} onClick={onLock}>
          <Lock size={14} /> 锁定
        </button>
      </div>

      <div className="mt-4 flex gap-7 border-b border-line">
        <button className={tab === 'balance' ? 'tab tab-on' : 'tab'} onClick={() => setTab('balance')}>
          <WalletIcon size={15} /> 余额
        </button>
        <button className={tab === 'send' ? 'tab tab-on' : 'tab'} onClick={() => setTab('send')}>
          <Send size={15} /> 转账
        </button>
        <button className={tab === 'history' ? 'tab tab-on' : 'tab'} onClick={() => setTab('history')}>
          <History size={15} /> 历史
        </button>
      </div>

      {err && (
        <div className="note-warn mt-4 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          {err}
        </div>
      )}

      <div className="mt-5">
        {tab === 'balance' && (
          <div className="space-y-3">
            <div className="relative flex flex-col items-center py-7">
              <div className="balance-glow" />
              <div className="balance flex items-center text-6xl leading-none text-ink">
                {data ? (
                  data.balance.toFixed(4)
                ) : isLoading ? (
                  <Loader2 size={40} className="animate-spin text-inksoft" />
                ) : (
                  '—'
                )}
                {data && <span className="ml-2 align-baseline font-sans text-base font-normal text-inksoft">PRL</span>}
              </div>
              {data && (
                <div className="mt-3 font-mono text-xs tracking-wide text-inksoft">
                  {data.utxos.length} UTXO · {data.balance.toFixed(8)}
                </div>
              )}
            </div>
            <button className="btn" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              {isFetching ? '刷新中…' : '刷新余额'}
            </button>
          </div>
        )}

        {tab === 'send' && <Send_ account={account} data={data} onSent={() => void refetch()} />}

        {tab === 'history' && (
          <div>
            {!data && isLoading && (
              <div className="flex items-center gap-2 text-xs text-inksoft">
                <Loader2 size={14} className="animate-spin" /> 加载中…
              </div>
            )}
            {data && data.history.length === 0 && <div className="text-xs text-inksoft">暂无交易</div>}
            {data && data.history.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-inksoft">
                    <th className="py-2 font-medium">方向</th>
                    <th className="py-2 font-medium">金额 (PRL)</th>
                    <th className="py-2 font-medium">确认</th>
                    <th className="py-2 font-medium">txid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((t, i) => {
                    const incoming = t.delta >= 0
                    const color = incoming ? 'text-moss' : 'text-clay'
                    return (
                      <tr key={t.txid + i} className="border-b border-line/60 last:border-0">
                        <td className={`py-2.5 font-medium ${color}`}>
                          <span className="inline-flex items-center gap-1">
                            {incoming ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                            {incoming ? '转入' : '转出'}
                          </span>
                        </td>
                        <td className={`py-2.5 font-mono tabular-nums ${color}`}>
                          {incoming ? '+' : '-'}
                          {Math.abs(t.delta).toFixed(8)}
                        </td>
                        <td className="py-2.5 font-mono tabular-nums text-inksoft">{t.confirmations}</td>
                        <td className="py-2.5">
                          <a
                            href={explorerTx(t.txid)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${LINK} text-xs text-inksoft hover:text-ink`}
                            title={`在浏览器查看 ${t.txid}`}
                          >
                            {short(t.txid, 7)}
                            <ExternalLink size={11} className="opacity-60" />
                          </a>
                          <button className="mini" title="复制 txid" onClick={() => copy(t.txid)}>
                            <Copy size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type Review = SignedTx & { to: string; amount: string }

function Send_({ account, data, onSent }: { account: Account; data?: ScanResult; onSent: () => void }) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState<{ txid: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function build(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setResult(null)
    setReview(null)
    setBuilding(true)
    try {
      if (!isValidAddress(to)) throw new Error('收款地址无效')
      const amountAtoms = prlToAtoms(amount)
      if (amountAtoms <= 0n) throw new Error('金额必须大于 0')
      if (!data?.utxos?.length) throw new Error('没有可用 UTXO（先刷新余额）')
      const feeRate = await feeRatePerVByte()
      const signed = buildSignedTx({
        account,
        utxos: data.utxos,
        toAddress: to.trim(),
        amountAtoms,
        feeRatePerVByte: feeRate,
      })
      setReview({ ...signed, to: to.trim(), amount })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBuilding(false)
    }
  }

  async function confirmBroadcast() {
    if (!review) return
    setBusy(true)
    setErr(null)
    try {
      const txid = await broadcast(review.hex)
      setResult({ txid })
      setReview(null)
      setTo('')
      setAmount('')
      setTimeout(onSent, 1500)
    } catch (e) {
      setErr('广播失败：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={build}>
        <label className="label">收款地址</label>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="prl1p…" className="field mono" />
        <label className="label">金额 (PRL)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          inputMode="decimal"
          className="field"
        />
        {err && (
          <div className="note-err mt-3 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            {err}
          </div>
        )}
        <button type="submit" disabled={building} className="btn mt-5">
          {building ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {building ? '构造中…' : '构造交易'}
        </button>
      </form>

      {review && (
        <div className="space-y-2 rounded-2xl border border-line bg-[#fcf8ef] p-4">
          <div className="flex items-center gap-2 font-display text-base font-medium">
            <ReceiptText size={18} className="text-inksoft" /> 请核对后再广播
          </div>
          <div className="text-xs text-inksoft">
            转给 <code className="font-mono text-ink">{short(review.to, 12)}</code>
          </div>
          <div className="text-xs text-inksoft">
            金额 <b className="text-ink">{review.amount} PRL</b> · 手续费 {review.fee} PRL · 找零 {review.change} PRL
          </div>
          <div className="text-xs text-inksoft">
            {review.inputs} 输入 · {review.vsize} vB · txid {short(review.txid, 8)}
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-inksoft">查看 raw tx hex</summary>
            <code className="mt-1 block break-all font-mono text-[11px] text-inksoft">{review.hex}</code>
          </details>
          <div className="flex gap-2.5 pt-1">
            <button onClick={confirmBroadcast} disabled={busy} className="btn flex-1">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {busy ? '广播中…' : '确认广播'}
            </button>
            <button onClick={() => setReview(null)} disabled={busy} className={COMPACT}>
              <X size={15} /> 取消
            </button>
          </div>
        </div>
      )}

      {result?.txid && (
        <div className="note-ok flex flex-wrap items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          已广播 txid：
          <a href={explorerTx(result.txid)} target="_blank" rel="noopener noreferrer" className={`${LINK} hover:opacity-80`}>
            {short(result.txid, 12)}
            <ExternalLink size={12} className="opacity-60" />
          </a>
          <button className="mini" title="复制 txid" onClick={() => copy(result.txid)}>
            <Copy size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
