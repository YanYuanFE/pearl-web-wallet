import * as btc from '@scure/btc-signer'
import { NETWORK, ATOMS, type Account } from './pearl'
import type { Utxo } from './rpc'

// taproot 单输入/输出大致 vByte，用于费用估算
const V_OVERHEAD = 11
const V_IN = 58
const V_OUT = 43
const DUST = 330n // taproot 输出粉尘阈值（atoms）

const toAtoms = (prl: number): bigint => BigInt(Math.round(prl * ATOMS))

export interface BuildParams {
  account: Account
  utxos: Utxo[]
  toAddress: string
  amountAtoms: bigint
  feeRatePerVByte: number
}
export interface SignedTx {
  hex: string
  txid: string
  vsize: number
  fee: number
  change: number
  inputs: number
}

// 构造并签名一笔交易（找零回自己地址）。返回 raw hex，不广播。
export function buildSignedTx({ account, utxos, toAddress, amountAtoms, feeRatePerVByte }: BuildParams): SignedTx {
  const feeRate = BigInt(feeRatePerVByte)
  const estFee = (nIn: number, nOut: number): bigint => BigInt(V_OVERHEAD + nIn * V_IN + nOut * V_OUT) * feeRate

  // 按面额从大到小选币，覆盖 金额 + 估算手续费
  const sorted = [...utxos].sort((a, b) => b.value - a.value)
  const selected: Utxo[] = []
  let inSum = 0n
  for (const u of sorted) {
    selected.push(u)
    inSum += toAtoms(u.value)
    if (inSum >= amountAtoms + estFee(selected.length, 2)) break
  }

  let fee = estFee(selected.length, 2)
  if (inSum < amountAtoms + fee) {
    throw new Error(`余额不足：需 ${Number(amountAtoms + fee) / ATOMS} PRL，可用 ${Number(inSum) / ATOMS} PRL`)
  }

  let change = inSum - amountAtoms - fee
  if (change < DUST) {
    // 找零太小，省去找零输出，余下并入手续费
    fee = estFee(selected.length, 1)
    change = inSum - amountAtoms - fee
    if (change < 0n) throw new Error('余额不足以覆盖手续费')
    if (change < DUST) {
      fee = inSum - amountAtoms
      change = 0n
    }
  }

  const tx = new btc.Transaction({ version: 1 }) // 与 Pearl 链上交易格式一致
  for (const u of selected) {
    tx.addInput({
      txid: u.txid,
      index: u.vout,
      witnessUtxo: { script: account.script, amount: toAtoms(u.value) },
      tapInternalKey: account.xonly,
    })
  }
  tx.addOutputAddress(toAddress, amountAtoms, NETWORK)
  if (change >= DUST) tx.addOutputAddress(account.address, change, NETWORK)

  tx.sign(account.priv)
  tx.finalize()

  return {
    hex: tx.hex,
    txid: tx.id,
    vsize: tx.vsize,
    fee: Number(fee) / ATOMS,
    change: Number(change) / ATOMS,
    inputs: selected.length,
  }
}
