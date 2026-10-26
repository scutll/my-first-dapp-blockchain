"use client";

import type { NextPage } from "next";
import { CreateOrderForm } from "~~/components/escrow/CreateOrderForm";
import { OrderList } from "~~/components/escrow/OrderList";
import { WalletPanel } from "~~/components/escrow/WalletPanel";
import { useEscrowActions } from "~~/hooks/escrow/useEscrowActions";
import { useEscrowOrders } from "~~/hooks/escrow/useEscrowOrders";
import { ESCROW_CHAIN_ID } from "~~/types/escrow";
import { getBlockExplorerTxLink } from "~~/utils/scaffold-eth";

const Home: NextPage = () => {
  const actions = useEscrowActions();
  const { orderIds, isLoading, eventStatus, eventError } = useEscrowOrders();
  const explorerLink = actions.lastHash ? getBlockExplorerTxLink(ESCROW_CHAIN_ID, actions.lastHash) : "";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">POTOS Escrow 托管交易</h1>
        <p className="text-sm opacity-70 max-w-3xl">
          买家 A、卖家 B、仲裁者 C 使用各自的 MetaMask 钱包访问同一 POTOS 测试网、同一 Escrow 与 hclToken
          合约。买家创建订单并 approve + deposit 付款，确认收货后代币划给卖家；发生争议时由 arbiter()
          指定账户裁决退款或放款。
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge badge-outline">ERC20 托管</span>
          <span className="badge badge-outline">Chain ID {ESCROW_CHAIN_ID}</span>
          <span className="badge badge-outline">approve → deposit</span>
          <span className="badge badge-outline">争议仲裁</span>
        </div>
      </header>

      <WalletPanel />

      <div className="flex flex-col gap-3">
        {actions.pendingAction && actions.pendingStep && (
          <div className="alert alert-info">
            <span className="loading loading-spinner loading-sm" />
            <span>{actions.pendingStep}</span>
          </div>
        )}

        {!actions.pendingAction && actions.error && (
          <div className="alert alert-error">
            <span className="whitespace-pre-wrap text-sm">{actions.error}</span>
            <button className="btn btn-ghost btn-xs" onClick={actions.clearError}>
              关闭
            </button>
          </div>
        )}

        {!actions.pendingAction && !actions.error && actions.lastHash && (
          <div className="alert alert-success">
            <span className="text-sm">
              交易已确认
              {actions.lastCreatedOrderId !== null
                ? `，新订单 #${actions.lastCreatedOrderId.toString()} 已写入链上`
                : ""}
              。
            </span>
            <span className="font-mono text-xs opacity-70">
              {actions.lastHash.slice(0, 10)}…{actions.lastHash.slice(-6)}
            </span>
            {explorerLink && (
              <a className="link text-sm" href={explorerLink} target="_blank" rel="noreferrer">
                区块浏览器
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <CreateOrderForm actions={actions} />
        <OrderList
          orderIds={orderIds}
          actions={actions}
          isLoading={isLoading}
          eventStatus={eventStatus}
          eventError={eventError}
        />
      </div>

      <section className="card bg-base-200/60 border border-base-300">
        <div className="card-body py-4 text-sm">
          <h2 className="font-semibold">现场演示提示</h2>
          <p className="opacity-70">
            A 创建订单 → A 点击付款并依次确认 approve、deposit 两次钱包弹窗 → B 切换钱包查看 → B 对已付款订单发起争议 →
            C 切换仲裁者钱包裁决 → A 对无争议订单确认收货。所有按钮均按当前账户与链上状态实时判定， 完整八步与角色说明见
            README。
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
