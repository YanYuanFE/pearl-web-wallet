import * as btc from '@scure/btc-signer'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

export interface Account {
  priv: Uint8Array
  xonly: Uint8Array
  address: string
  script: Uint8Array
}

// Pearl 网络参数：本质是比特币 Taproot，仅 bech32 前缀换成 prl（已对账官方钱包验证）
export const NETWORK = { bech32: 'prl', pubKeyHash: 0x00, scriptHash: 0x05, wif: 0x80 }
// HD 路径（BIP86，coinType=808276，已与 oyster 对账一致）
export const path = (i = 0): string => `m/86'/808276'/0'/0/${i}`
export const ATOMS = 100_000_000 // 1 PRL = 1e8 atoms（8 位小数）

// 官方区块浏览器跳转链接
export const EXPLORER = 'https://explorer.pearlresearch.ai'
export const explorerTx = (txid: string): string => `${EXPLORER}/tx/${txid}?network=mainnet`
export const explorerAddress = (addr: string): string => `${EXPLORER}/address/${addr}?network=mainnet`

const norm = (mn: string): string => mn.trim().replace(/\s+/g, ' ')

export function isValidMnemonic(mn: string): boolean {
  return validateMnemonic(norm(mn), wordlist)
}

// 助记词 → 第 index 个账户的私钥 / x-only 公钥 / Taproot 地址
export function deriveAccount(mnemonic: string, index = 0): Account {
  const seed = mnemonicToSeedSync(norm(mnemonic), '')
  const node = HDKey.fromMasterSeed(seed).derive(path(index))
  if (!node.privateKey || !node.publicKey) throw new Error('派生失败')
  const xonly = node.publicKey.slice(1) // 去 02/03 前缀 → x-only 内部公钥
  const p = btc.p2tr(xonly, undefined, NETWORK)
  if (!p.address) throw new Error('生成地址失败')
  return { priv: node.privateKey, xonly, address: p.address, script: p.script }
}

export function isValidAddress(addr: string): boolean {
  try {
    btc.Address(NETWORK).decode(addr.trim())
    return true
  } catch {
    return false
  }
}

// PRL(字符串/数字) → atoms(bigint)，按字符串解析避免浮点误差
export function prlToAtoms(prl: string | number): bigint {
  const s = String(prl).trim()
  if (!/^\d+(\.\d{1,8})?$/.test(s)) throw new Error('金额格式不对（最多 8 位小数）')
  const [int, frac = ''] = s.split('.')
  return BigInt(int) * BigInt(ATOMS) + BigInt(frac.padEnd(8, '0'))
}
export const atomsToPrl = (a: bigint): string => (Number(a) / ATOMS).toFixed(8)
