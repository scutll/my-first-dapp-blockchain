# POTOS Escrow 托管交易 DApp

基于 [Scaffold-ETH 2](https://scaffoldeth.io) 的 ERC20 托管交易前端（课程路线 B）。买家 A、卖家 B、仲裁者 C 使用各自的 MetaMask 钱包访问同一 POTOS 测试网、同一 Escrow 与同一 hclToken 合约。

- 前端：Next.js 15、TypeScript、Wagmi、Viem、RainbowKit
- 合约：Solidity `Escrow` + ERC20 `hclToken`
- 交易：全部由用户钱包签名，不使用服务端私钥
- 页面入口：`packages/nextjs/app/page.tsx`

## 1. 当前 POTOS 部署

以下地址和值均于 2026-10-26 通过 POTOS RPC 实际读取确认。

| 项 | 值 |
|---|---|
| Chain ID | `60600` |
| RPC | `https://rpc-testnet.potos.hk` |
| 区块浏览器 | `https://scan-testnet.potos.hk` |
| 原生代币 | `POT` |
| Escrow | `0xb12144e78B285174b097D708F8e69805D0d55f0c` |
| hclToken | `0x73a5b5d6b63f0CbA4e20f23C005B02262EAaaD05` |
| hclToken symbol / decimals | `hcl202430552384` / `18` |
| 仲裁者 `arbiter()` | `0x763fA94821570DDD4631c8Bf303d4e94845eB841` |
| Escrow 部署区块 / 交易 | `2670277` / `0x4f7761facc3a43778de4537eb3e35756d2ca09f2f43ce2f72e6dfc27f22a750a` |
| hclToken 部署区块 / 交易 | `2670276` / `0x9298c769ead0b32485903686cefb5b751c19c9cc6aae37649656f2c26392867a` |
| hclToken owner | `0x1cb23145DB502D482914c9809038CD57e0BA95f1` |
| 截至 2026-10-26 `orderCount()` | `3`（新订单从 `#3` 开始） |

> 说明：仓库中的 Hardhat 源码保留了课程原始的 `MXLToken` 代币实现；当前前端按照实际测试的 `hclToken` 部署连接，两者 ERC20 ABI 兼容。若从 Hardhat 源码重新部署，会产生新的代币地址和名称，需重新生成 `deployedContracts.ts` 并同步更新前端。

## 2. 已实现功能

| 编号 | 功能 | 实现要点 |
|---|---|---|
| F1 | 钱包与角色 | RainbowKit 连接/切换 MetaMask；显示地址、网络、仲裁者、当前身份、hclToken 余额；错链提示并禁用交易 |
| F2 | 订单列表 | 从 `OrderCreated` 历史事件发现订单 ID，逐笔 `getOrder(id)` 读当前状态；`orderCount()` 交叉校验/补全；POTOS 按 10 区块/批扫描 |
| F3 | 创建订单 | 输入卖家、完整代币金额、期限（分钟）、描述；`decimals()` + `parseUnits` 转最小单位；期限转 Unix 秒 |
| F4 | 付款 | 单按钮执行 `approve` → `deposit` 两笔交易；授权收据成功后才付款；allowance 足够时跳过 approve；失败可重试 |
| F5 | 确认收货 | 仅买家、仅 `Paid`；等待收据后重新读链 |
| F6 | 发起争议 | 仅该单买家/卖家、仅 `Paid` |
| F7 | 仲裁裁决 | 仅 `arbiter()`、仅 `Disputed`；`resolve(id, true/false)` |
| F8 | 状态与错误 | 每笔写操作等待收据；禁用重复点击；拒签、revert、余额/授权不足、错链、未部署、日志失败均有提示 |
| 可选 | 超时退款 | 仅买家、仅 `Paid` 且 `block.timestamp > deadline` 时显示 `refund(id)` |

### 权限矩阵

| 订单状态 | 买家 A | 卖家 B | 仲裁者 C |
|---|---|---|---|
| `Created (0)` | 付款 | — | — |
| `Paid (1)` | 确认收货、争议、超时退款（到期后） | 争议 | — |
| `Disputed (4)` | — | — | 判卖家胜、判买家胜 |
| `Completed (2)` / `Refunded (3)` | — | — | — |

`confirm` / `dispute` 只要求 `Paid`，不额外限制必须在 deadline 前；`refund` 才要求超过 deadline。前端按钮只是用户体验，最终限制由合约执行。

## 3. 本地启动

要求：Node.js ≥ 20.18.3，Yarn 3。

```bash
cd my-first-dapp
yarn install
yarn start
```

打开 <http://localhost:3000>。`yarn start` 等价于 `yarn workspace @se-2/nextjs dev`。

合约已部署，正常演示**不需要**重新 `yarn deploy`。仅需本地开发时：

```bash
yarn compile
yarn hardhat:test
yarn next:check-types
yarn next:lint
```

## 4. MetaMask 配置与测试币

在 MetaMask 添加网络：

| 字段 | 值 |
|---|---|
| 网络名称 | POTOS Testnet |
| RPC URL | `https://rpc-testnet.potos.hk` |
| Chain ID | `60600` |
| 货币符号 | `POT` |
| 区块浏览器 | `https://scan-testnet.potos.hk` |

A/B/C 三个账户都需要少量 POT 作为 gas。hclToken 只由 owner 增发：

- owner：`0x1cb23145DB502D482914c9809038CD57e0BA95f1`
- 用 owner 钱包打开 `/debug`，选择 `hclToken`，调用 `mint(to, value)`
- 给 A 发放 100 个代币时，`value = 100 * 10^18`（即 `100000000000000000000`）

## 5. 现场演示八步

当前 Escrow 已有历史订单 `#0`、`#1`、`#2`，新订单会从 `#3` 开始。以下用“第一笔新订单 / 第二笔新订单”表述，实际 ID 以页面显示为准。

| 步骤 | 用户 | 操作 | 预期结果 |
|---|---|---|---|
| 1 | A | 创建第一笔新订单：卖家 B、30 个 hclToken、期限 30 分钟 | 列表出现 `Created`，A 看到“付款” |
| 2 | A | 点击付款，依次确认 `approve` 与 `deposit` 两次 MetaMask 弹窗 | 首次未授权时两次确认；订单变 `Paid`；A 看到“确认收货/争议”，B 看到“争议” |
| 3 | B | 切换钱包查看第一笔订单 | B 看不到“确认收货” |
| 4 | A | 创建第二笔新订单并付款 | 第二笔变 `Paid` |
| 5 | B | 对第二笔发起争议 | 第二笔变 `Disputed`；A/B 均无仲裁按钮 |
| 6 | C | 用仲裁者钱包 `0x763f…B841` 打开页面 | 仅 C 在第二笔看到仲裁按钮 |
| 7 | C | 对第二笔点击“判买家胜（退款）” | 第二笔变 `Refunded`，代币退回 A |
| 8 | A | 对第一笔点击“确认收货” | 第一笔变 `Completed`，B 收到 30 个 hclToken |

演示时可在区块浏览器中核对：钱包签名记录、订单状态、A/B/C 的 hclToken 余额变化、`OrderPaid` / `OrderCompleted` / `OrderDisputed` / `OrderResolved` 事件。

## 6. 真实链上凭证（已核验）

浏览器链接格式：`https://scan-testnet.potos.hk/tx/<交易哈希>`。

### 6.1 部署与初始化

| 操作 | 区块 | 交易哈希 | 发送账户 |
|---|---:|---|---|
| 部署 hclToken | 2670276 | `0x9298c769ead0b32485903686cefb5b751c19c9cc6aae37649656f2c26392867a` | `0x1cb23145DB502D482914c9809038CD57e0BA95f1` |
| 部署 Escrow（arbiter = `0x763f…B841`） | 2670277 | `0x4f7761facc3a43778de4537eb3e35756d2ca09f2f43ce2f72e6dfc27f22a750a` | `0x1cb23145DB502D482914c9809038CD57e0BA95f1` |
| owner 增发 100 hclToken | 2670289 | `0x40a6adfa74a6d52ada409a36e2ce7efafc3ab4435ca3714c70a96a77fd506fc0` | `0x1cb23145DB502D482914c9809038CD57e0BA95f1` |

### 6.2 历史订单交易

历史订单 #0 使用另一个代币地址（`0xaf1a…e2cf`），仅创建未付款；#1、#2 使用 hclToken。它们早于本次前端交付，是新页面的历史数据。

| 操作 | 订单 | 区块 | 交易哈希 | 发送账户 |
|---|---|---:|---|---|
| 创建订单 | #0 | 2670295 | `0x23eadf79a83a0f6b87620d3fcc60d410c8b20f82da2ed6c9660184cb1b42ef9c` | `0x1cb2…95f1`（买家） |
| 创建订单 | #1 | 2670443 | `0x4afa7b9f71538f459b98bdecd48efdb281dc26dbe513d8db7939886846596119` | `0x1cb2…95f1`（买家） |
| approve | #1 | 2670410 | `0x49c73609d83c3a73c0cd1e3fe0f7c78417798a3aeb5df09349b4a52f567ddf89` | `0x1cb2…95f1`（买家） |
| deposit | #1 | 2670464 | `0xcee1ebfde5db3461301a76fc7ae74dade16efd61f66d48a87ff8236f629710ca` | `0x1cb2…95f1`（买家） |
| confirm | #1 | 2670504 | `0x4b074255b03ee6baed3756f7b42915e93525d948c87b171424c9b5aa090cc9cc` | `0x1cb2…95f1`（买家） |
| 创建订单 | #2 | 2670545 | `0xd845b79e7dc37cb673679ccdff4b9a4ce01b4798d5ad7e089088c96a811c1870` | `0x1cb2…95f1`（买家） |
| approve | #2 | 2670566 | `0xadc931d0274c5fab6586695c485059a7a55bf738e755e99f5bcf7df2088d7efd` | `0x1cb2…95f1`（买家） |
| deposit | #2 | 2670579 | `0x2222233084ea4421c7980dda79fa801f4895e6d1053c00b0a7da307990c3bdd1` | `0x1cb2…95f1`（买家） |
| dispute | #2 | 2670610 | `0x689a30825fe6419e4a974225174d4d4635431d279f3bda96e1b796eaa912d917` | `0x1cb2…95f1`（买家） |
| resolve(false) | #2 | 2672289 | `0x41369bd6594b1402426912f363ee04f80842075fc398f6f61c2bddae16e61bc7` | `0x763f…B841`（仲裁者） |

订单 #1 最终为 `Completed`，#2 最终为 `Refunded`（退款给买家），#0 仍为 `Created`。

### 6.3 本次八步演示记录

以下交易需在真实现场演示时填写；未执行前保持“待实测”，不得伪造。

| 步骤 | 操作 | 交易哈希 | 发送账户 | 状态 |
|---|---|---|---|---|
| 1 | 创建第一笔新订单 | 待实测 | 待实测 | 待实测 |
| 2a | 第一笔 approve | 待实测 | 待实测 | 待实测 |
| 2b | 第一笔 deposit | 待实测 | 待实测 | 待实测 |
| 3 | 切换 B 查看 | — | — | 待实测 |
| 4a | 创建第二笔新订单 | 待实测 | 待实测 | 待实测 |
| 4b | 第二笔 approve | 待实测 | 待实测 | 待实测 |
| 4c | 第二笔 deposit | 待实测 | 待实测 | 待实测 |
| 5 | 第二笔 dispute | 待实测 | 待实测 | 待实测 |
| 6 | C 查看仲裁按钮 | — | — | 待实测 |
| 7 | 第二笔 resolve(false) | 待实测 | 待实测 | 待实测 |
| 8 | 第一笔 confirm | 待实测 | 待实测 | 待实测 |

## 7. 实现说明与已知限制

1. **日志范围**：POTOS RPC 的 `eth_getLogs` 实际只稳定返回区间前约 10 个区块，因此 `useEscrowOrders` 明确设置 `blocksBatchSize: 10`，从 Escrow 真实部署区块 `2670277` 开始扫描。
2. **首次加载**：从部署区块到最新区块约 1.8 万个区块，历史事件需要分批同步，可能需要一段时间。页面同时用 `orderCount()` 补全订单 ID，所以事件同步未完成时列表仍可显示；每笔状态始终逐笔 `getOrder(id)` 读取。
3. **金额精度**：页面读取 `decimals()`（当前 18），创建订单用完整代币个数输入并 `parseUnits`。历史订单中 #0 使用非 hclToken 代币，页面会标注该异常。
4. **approve + deposit**：付款按钮先读 `allowance`；不足时先发 `approve`，收据成功后再发 `deposit`。若 approve 成功但 deposit 失败，订单仍为 `Created`，再次点击会复用已有 allowance。
5. **账户安全**：每笔交易前后重新向钱包查询 chainId 和当前地址，避免异步流程中切换账户/网络导致错发交易。
6. **生成文件**：`packages/nextjs/contracts/deployedContracts.ts` 由工具生成，未手动修改 ABI。当前文件中的 `deployedOnBlock` 元数据可能沿用了旧部署值，实际事件扫描起点以 `packages/nextjs/types/escrow.ts` 的 `ESCROW_DEPLOY_BLOCK = 2670277n` 为准。
7. **Hardhat 源码与当前部署的差异**：仓库 `contracts/MXLToken.sol` 与 `deploy/` 脚本是课程原始 `MXLToken` 流程；当前前端连接的是已部署的 `hclToken`（同 ERC20 ABI）。若重新部署，需要同步调整代币名称/仲裁者并重新生成 `deployedContracts.ts`。
8. **未由代码模型执行的项目**：真实 MetaMask 签名、POTOS 浏览器截图和本次八步演示的交易哈希需在用户钱包环境完成；未执行前均标注“待实测”。

## 8. 目录

```text
packages/
├── hardhat/
│   ├── contracts/Escrow.sol          # 托管合约
│   ├── contracts/MXLToken.sol        # 课程原始 ERC20 源码
│   ├── deploy/01_deploy_token.ts
│   └── deploy/02_deploy_escrow.ts
└── nextjs/
    ├── app/page.tsx                  # Escrow 单页入口
    ├── components/escrow/
    │   ├── WalletPanel.tsx           # 钱包、网络、仲裁者、余额
    │   ├── CreateOrderForm.tsx       # 创建订单
    │   └── OrderList.tsx             # 订单列表 + 全部角色按钮
    ├── hooks/escrow/
    │   ├── useEscrowOrders.ts        # 事件 + orderCount 订单发现
    │   └── useEscrowActions.ts       # 全部写交易
    ├── types/escrow.ts               # 订单类型、状态、部署区块
    └── contracts/deployedContracts.ts# 自动生成的地址/ABI
```
