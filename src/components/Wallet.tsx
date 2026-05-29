import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { scanAddress, feeRatePerVByte, broadcast, type ScanResult } from '../lib/rpc'
import { isValidAddress, prlToAtoms, type Account } from '../lib/pearl'
import { buildSignedTx, type SignedTx } from '../lib/tx'

const short = (s: string, n = 10) => (s && s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s)
const copy = (t: string) => navigator.clipboard?.writeText(t)
const COMPACT = 'rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-black/5'

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
  const [data, setData] = useState<ScanResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setData(await scanAddress(account.address))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [account.address])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="card" onClick={onActivity}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.1em] text-inksoft">我的地址</div>
          <div className="mt-1 flex items-center">
            <code className="font-mono text-sm text-ink" title={account.address}>
              {short(account.address, 13)}
            </code>
            <button className="mini" onClick={() => copy(account.address)}>
              复制
            </button>
          </div>
        </div>
        <button className={COMPACT} onClick={onLock}>
          锁定
        </button>
      </div>

      <div className="mt-5 flex gap-7 border-b border-line">
        <button className={tab === 'balance' ? 'tab tab-on' : 'tab'} onClick={() => setTab('balance')}>
          余额
        </button>
        <button className={tab === 'send' ? 'tab tab-on' : 'tab'} onClick={() => setTab('send')}>
          转账
        </button>
        <button className={tab === 'history' ? 'tab tab-on' : 'tab'} onClick={() => setTab('history')}>
          历史
        </button>
      </div>

      {err && <div className="note-warn mt-4">{err}</div>}

      <div className="mt-5">
        {tab === 'balance' && (
          <div className="space-y-4">
            <div className="relative flex flex-col items-center py-7">
              <div className="balance-glow" />
              <div className="balance text-6xl leading-none text-ink">
                {data ? data.balance.toFixed(4) : loading ? '·' : '—'}
                <span className="ml-2 align-baseline font-sans text-base font-normal text-inksoft">PRL</span>
              </div>
              {data && (
                <div className="mt-3 font-mono text-xs tracking-wide text-inksoft">
                  {data.utxos.length} UTXO · {data.balance.toFixed(8)}
                </div>
              )}
            </div>
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? '刷新中…' : '刷新余额'}
            </button>
          </div>
        )}

        {tab === 'send' && <Send account={account} data={data} onSent={load} />}

        {tab === 'history' && (
          <div>
            {!data && <div className="text-xs text-inksoft">加载中…</div>}
            {data && data.history.length === 0 && <div className="text-xs text-inksoft">暂无交易</div>}
            {data && data.history.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-inksoft">
                    <th className="py-2 font-medium">方向</th>
                    <th className="py-2 font-medium">收到 (PRL)</th>
                    <th className="py-2 font-medium">确认</th>
                    <th className="py-2 font-medium">txid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((t, i) => (
                    <tr key={t.txid + i} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 font-medium text-moss">{t.outToUs > 0 ? '收款' : '—'}</td>
                      <td className="py-2.5 font-mono tabular-nums text-ink">{t.outToUs ? t.outToUs.toFixed(8) : '—'}</td>
                      <td className="py-2.5 font-mono tabular-nums text-inksoft">{t.confirmations}</td>
                      <td className="py-2.5">
                        <code className="font-mono text-xs text-inksoft" title={t.txid}>
                          {short(t.txid, 7)}
                        </code>
                        <button className="mini" onClick={() => copy(t.txid)}>
                          复制
                        </button>
                      </td>
                    </tr>
                  ))}
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

function Send({ account, data, onSent }: { account: Account; data: ScanResult | null; onSent: () => void }) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ txid: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function build(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setResult(null)
    setReview(null)
    try {
      if (!isValidAddress(to)) throw new Error('收款地址无效')
      const amountAtoms = prlToAtoms(amount)
      if (amountAtoms <= 0n) throw new Error('金额必须大于 0')
      if (!data?.utxos?.length) throw new Error('没有可用 UTXO（先刷新余额）')
      const feeRate = await feeRatePerVByte()
      // 浏览器本地构造并签名，但先不广播
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
    <div className="space-y-4">
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
        {err && <div className="note-err mt-3">{err}</div>}
        <button type="submit" className="btn mt-5">
          构造交易（先不广播）
        </button>
      </form>

      {review && (
        <div className="space-y-2 rounded-2xl border border-line bg-[#fcf8ef] p-4">
          <div className="font-display text-base font-medium">请核对后再广播</div>
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
              {busy ? '广播中…' : '确认广播'}
            </button>
            <button onClick={() => setReview(null)} disabled={busy} className={COMPACT}>
              取消
            </button>
          </div>
        </div>
      )}

      {result?.txid && (
        <div className="note-ok">
          已广播 ✓ txid：<code className="font-mono">{short(result.txid, 12)}</code>
          <button className="mini" onClick={() => copy(result.txid)}>
            复制
          </button>
        </div>
      )}
    </div>
  )
}
