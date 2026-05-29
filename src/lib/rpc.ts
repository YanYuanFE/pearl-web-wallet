export interface Utxo {
  txid: string
  vout: number
  value: number
  confirmations: number
}
export interface HistoryItem {
  txid: string
  time?: number
  confirmations: number
  outToUs: number
}
export interface ScanResult {
  balance: number
  utxos: Utxo[]
  history: HistoryItem[]
}

interface RpcError extends Error {
  code?: number
}

// 所有链上数据走 /rpc（dev 由 Vite、线上由 Serverless 转发到公共节点，不携带任何密钥）
async function call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const r = await fetch('/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
  const j = await r.json()
  if (j.error) {
    const err: RpcError = Object.assign(new Error(j.error.message), { code: j.error.code })
    throw err
  }
  return j.result as T
}

export const getHeight = (): Promise<number> => call<number>('getblockcount')

// 某地址的所有交易（verbose）。地址无记录时节点报错，归一成空数组。
async function addressTxs(address: string, count = 1000): Promise<any[]> {
  try {
    return await call<any[]>('searchrawtransactions', [address, 1, 0, count])
  } catch (e) {
    const err = e as RpcError
    if (/No information|-5/.test(err.message) || err.code === -5) return []
    throw e
  }
}

const isOursFor = (address: string) => (spk: any): boolean =>
  spk?.address === address || (spk?.addresses || []).includes(address)

// 汇总单个地址的 UTXO / 余额 / 历史
export async function scanAddress(address: string): Promise<ScanResult> {
  const txs = await addressTxs(address)
  const isOurs = isOursFor(address)
  const received = new Map<string, Utxo>()
  const spent = new Set<string>()
  const history: HistoryItem[] = []

  for (const tx of txs) {
    let outToUs = 0
    for (const vo of tx.vout ?? []) {
      if (isOurs(vo.scriptPubKey)) {
        received.set(`${tx.txid}:${vo.n}`, {
          txid: tx.txid,
          vout: vo.n,
          value: vo.value,
          confirmations: tx.confirmations ?? 0,
        })
        outToUs += vo.value
      }
    }
    for (const vi of tx.vin ?? []) if (vi.txid) spent.add(`${vi.txid}:${vi.vout}`)
    history.push({ txid: tx.txid, time: tx.time, confirmations: tx.confirmations ?? 0, outToUs })
  }

  const utxos: Utxo[] = []
  let balance = 0
  for (const [op, u] of received) {
    if (spent.has(op)) continue
    utxos.push(u)
    balance += u.value
  }
  utxos.sort((a, b) => b.value - a.value)
  history.sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
  return { balance, utxos, history }
}

// estimatefee 返回 PRL/kB → atoms/vByte（最低 1）
export async function feeRatePerVByte(): Promise<number> {
  try {
    const f = await call<number>('estimatefee', [6])
    return Math.max(1, Math.round((Number(f) * 1e8) / 1000))
  } catch {
    return 1
  }
}

export const broadcast = (hex: string): Promise<string> => call<string>('sendrawtransaction', [hex])
