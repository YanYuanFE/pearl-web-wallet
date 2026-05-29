# Pearl Web Wallet · 珠光

一个**纯客户端、非托管**的 Pearl (PRL) 网页钱包。仿 [pearlwallet.xyz](https://pearlwallet.xyz) 的自托管思路，但**去掉了它的开发者 tip（10 bps / 最低 1 PRL）—— 你只付网络矿工费**。

界面采用「Nacre / 珠光」亮色设计：暖牡蛎奶白底 + 颗粒质感 + 珠光虹彩点睛，余额以 Fraunces 衬线大字陈列。

> ⚠️ **真金白银**：这是能动用真实资产的钱包。首次使用务必先小额自转测试（见[上线前必做](#上线前必做)）。助记词请离线纸质备份。

---

## 特性

- 🔑 **助记词只在浏览器内**派生密钥、签名交易 —— 永不上传、永不出本机
- 🔒 助记词经 **PBKDF2-SHA256（60 万次）+ AES-256-GCM** 加密存于 `localStorage`（MetaMask 同款加密栈）
- 💸 **零抽成**：转账只付网络矿工费，无平台 tip
- 📊 余额 / 交易历史 / 转账三件套
- 🧾 转账**先本地构造并签名、摊开 raw tx 供核对**，确认后才广播
- ⏱️ 解锁后 10 分钟无操作**自动上锁**
- 🌐 链上数据 / 广播经同源 `/rpc` 代理到公共节点，**代理不接触任何密钥**

---

## 技术栈

React 18 · TypeScript · Vite 6 · TailwindCSS v4 · [@scure/btc-signer](https://github.com/paulmillr/scure-btc-signer) · [@noble/curves](https://github.com/paulmillr/noble-curves) · [@scure/bip32](https://github.com/paulmillr/scure-bip32) / [bip39](https://github.com/paulmillr/scure-bip39)

```
浏览器 (React + @scure/btc-signer，客户端签名)
  ├─ 密钥派生 / Taproot 签名 / 加密 vault：全部在浏览器完成
  └─ fetch('/rpc') ──┬── 本地 dev：Vite 代理
                     └── 线上：Vercel Serverless 函数 (api/rpc.js)
                              │
                              └──> https://rpc.pearlwallet.xyz （只读 + 广播，公开数据）
```

---

## 已验证的链上技术事实

通过逆向 + 与官方 `oyster` 钱包对账验证（详见 `src/lib/pearl.ts`）：

| 项 | 结论 |
|----|------|
| 地址 | **比特币 Taproot**（BIP341 TapTweak）+ bech32m，HRP = `prl` |
| 派生路径 | `m/86'/808276'/0'/0/<index>`（BIP86，coinType 808276，已与 oyster 对账一致）|
| 交易格式 | 比特币 segwit（version 1），`@scure/btc-signer` 直接兼容 |
| 金额单位 | 1 PRL = 1e8 atoms（8 位小数）|
| 数据 RPC | `searchrawtransactions` / `sendrawtransaction` / `estimatefee` / `getblockcount` |
| 钱包模型 | 单地址（`index 0`），找零回同一地址 —— 与挖矿收款地址一致，简单且不丢币 |

---

## 安全模型

- **非托管**：服务器（含 Vercel 函数）永远看不到助记词，只转发公开 RPC 流量。
- 助记词只在**解锁期间**存在于浏览器内存；锁定 / 超时立即清除。
- `vault`（加密助记词）存 `localStorage`；删除浏览器数据或点「删除本机钱包」即清空（**链上资产不受影响，凭助记词随时恢复**）。
- 生产环境 CSP 锁死 `connect-src 'self'` —— 即使页面被注入恶意代码，也**无法把助记词发往外部**。
- ⚠️ 把「输助记词的钱包」放到公网仍有「代码交付信任」风险（你的部署账号若被黑，可能被推恶意代码）。**务必开访问保护 + 账号 2FA**，详见[部署](#部署到-vercel)。

---

## 本地运行

需要 Node 18+（已测 v24）。

```bash
npm install
npm run dev          # http://localhost:5180
```

`npm run dev` 会用 Vite 把 `/rpc` 代理到公共 Pearl 节点（服务端转发，绕开浏览器 CORS）。

构建 / 类型检查：

```bash
npm run build        # tsc --noEmit && vite build → dist/
npm run typecheck    # 仅类型检查
npm run preview      # 本地预览构建产物（注意：preview 不带 /rpc 代理，需线上或 vercel dev）
```

---

## 部署到 Vercel

仓库已内置 `vercel.json`（`/rpc` 重写到 `api/rpc.js` + 严格 CSP/安全头）与 `api/rpc.js`（无密钥的 RPC 代理，**只放行钱包用到的 6 个方法**，防被当成开放代理滥用）。Vercel 会自动识别 Vite。

### 方式 A：Vercel CLI

```bash
npm i -g vercel        # 或用 npx vercel
vercel                 # 首次：登录 + 关联项目，全默认即可
vercel --prod          # 部署生产
```

### 方式 B：GitHub 导入

1. 把仓库推到 GitHub。
2. Vercel 控制台 → **Add New → Project → Import**。
3. 框架自动识别为 **Vite**：Build `vite build`、Output `dist`、`api/` 自动成为 Serverless 函数。无需额外配置。

### 部署后必做：开访问保护

Vercel 控制台 → 项目 → **Settings → Deployment Protection**：

- **Vercel Authentication**（免费，限你的 Vercel 账号可访问）——推荐
- 或 **Password Protection**（部分需 Pro 套餐）

> 不加保护就别用自定义域名、也别外传那串 `*.vercel.app` URL。这是一个钱包，别让任何人随手打开。

### 关于公共 RPC 依赖

数据与广播默认走 `rpc.pearlwallet.xyz`（公共节点，配置在 `api/rpc.js` 与 `vite.config.ts`）。它可能限流或下线。若要更可靠，可改成自建 Pearl 全节点的 RPC（改这两处的 upstream 即可）。

---

## 首次使用

打开站点（本地 `http://localhost:5180` 或你的 Vercel 域名）：

1. **导入** → 粘贴 12 词助记词。页面会**实时显示派生地址**，请**核对它等于你已知的收款地址**再继续。
2. 设一个 **app 密码**（≥8 位）→ 助记词被加密保存到本机。
3. 之后用 app 密码**解锁**。
4. **余额 / 历史**自动从公共节点加载。
5. **转账** → 填地址 + 金额 → 点「构造交易（先不广播）」→ 核对 raw tx（手续费 / 找零 / hex）→「确认广播」。

---

## 上线前必做

交易**签名机器已离线验证**（Taproot key-path + BIP340 Schnorr，地址 / 脚本均与官方钱包对账无误），但「Pearl 网络是否接受该 sighash」**只能靠一次真实广播确认**。

👉 **第一笔务必小额自转**（如 0.1 PRL 转回自己地址）：UI 会先展示 raw tx，确认无误再广播；**到账即证明整条链路 100% 正确**，之后放心使用。若被拒（不会丢钱，只是不被接受），把报错贴出来排查。

---

## 项目结构

```
pearl-web-wallet/
├── index.html              入口（含 Google Fonts：Fraunces / Noto Serif·Sans SC / JetBrains Mono）
├── vite.config.ts          Vite + React + Tailwind v4；dev 下 /rpc 代理
├── tsconfig.json
├── vercel.json             /rpc → /api/rpc 重写 + CSP/安全头
├── api/
│   └── rpc.js              Vercel Serverless RPC 代理（无密钥，方法白名单）
└── src/
    ├── main.tsx
    ├── App.tsx             视图路由（导入 / 解锁 / 钱包）+ 自动上锁 + 珠光氛围层
    ├── index.css           Tailwind v4 入口 + Nacre 设计系统（色板 / 字体 / 颗粒 / 虹彩 / 动效）
    ├── components/
    │   ├── Onboarding.tsx  导入助记词 + 实时校验派生地址 + 设密码
    │   ├── Unlock.tsx      密码解锁 / 删除本机钱包
    │   └── Wallet.tsx      余额陈列 / 转账（构造→核对→广播）/ 历史
    └── lib/
        ├── pearl.ts        网络参数 / HD 派生 / 地址编码 / 金额换算
        ├── tx.ts           选币 + 构造 + Taproot 签名（@scure/btc-signer）
        ├── rpc.ts          公共节点读取（UTXO / 余额 / 历史）+ 广播
        └── vault.ts        浏览器加密 vault（WebCrypto PBKDF2 + AES-GCM）
```

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 余额显示「同步中 / 错误」 | 公共 RPC 临时抖动，点「刷新余额」重试 |
| 导入后余额为 0，但你确实有币 | 核对**导入页显示的派生地址**是否等于你的真实地址；不等说明助记词不对 |
| 线上字体没加载 | CSP 需放行 `fonts.googleapis.com` / `fonts.gstatic.com`（`vercel.json` 已配）|
| `npm run preview` 下 `/rpc` 404 | preview 无代理；用 `vercel dev` 或直接部署到 Vercel |
| 广播报错 `sighash` / 被拒 | 见[上线前必做](#上线前必做)，先小额自转排查 |

---

## 免责声明

本项目供个人自用，不构成任何投资或安全建议。加密资产操作不可逆，**助记词一旦泄露即丧失全部资产**。使用前请自行审计代码，并务必离线备份助记词。作者不对任何资产损失负责。
