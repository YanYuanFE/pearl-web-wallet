// Vercel Serverless Function：把 /rpc 转发到公共 Pearl 节点。
// 只转发公开的只读/广播请求，不接触任何密钥（助记词永远只在浏览器）。
const UPSTREAM = 'https://rpc.pearlwallet.xyz/'

// 只放行钱包实际用到的方法，避免你的函数被当成开放 RPC 代理滥用
const ALLOWED = new Set([
  'getblockcount',
  'getbestblockhash',
  'searchrawtransactions',
  'sendrawtransaction',
  'estimatefee',
  'getrawtransaction',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const body = req.body || {}
  if (!ALLOWED.has(body.method)) {
    return res.status(403).json({ error: `method not allowed: ${body.method}` })
  }
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: body.id ?? 1,
        method: body.method,
        params: body.params ?? [],
      }),
    })
    const text = await upstream.text()
    res.setHeader('content-type', 'application/json')
    return res.status(upstream.status).send(text)
  } catch (e) {
    return res.status(502).json({ error: 'upstream error: ' + e.message })
  }
}
