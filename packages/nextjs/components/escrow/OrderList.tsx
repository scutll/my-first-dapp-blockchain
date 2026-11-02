"use client";

import type { Address } from "viem";
import { formatUnits } from "viem";
import { OrderDisputeActions } from "~~/components/escrow/OrderDisputeActions";
import { OrderPaymentActions } from "~~/components/escrow/OrderPaymentActions";
import { Address as AddressView } from "~~/components/scaffold-eth";
import { useOrderRoles } from "~~/hooks/escrow/useOrderRoles";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import type { EscrowActions } from "~~/types/escrow";
import { EscrowOrder, formatDeadline, sameAddress, statusBadge, statusLabel } from "~~/types/escrow";
import { getParsedError } from "~~/utils/scaffold-eth";

type OrderListProps = {
  orderIds: bigint[];
  actions: EscrowActions;
  isLoading: boolean;
  eventStatus: string;
  eventError: unknown;
};

/** A：订单列表容器与事件同步状态展示 */
export const OrderList = ({ orderIds, actions, isLoading, eventStatus, eventError }: OrderListProps) => {
  const { data: arbiter } = useScaffoldReadContract({ contractName: "Escrow", functionName: "arbiter" });
  const { data: decimals } = useScaffoldReadContract({ contractName: "hclToken", functionName: "decimals" });
  const { data: symbol } = useScaffoldReadContract({ contractName: "hclToken", functionName: "symbol" });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">订单列表</h2>
        <span className="badge badge-outline">{orderIds.length} 笔订单</span>
      </div>

      {eventStatus === "pending" && (
        <div className="alert alert-info py-2 text-xs">
          <span className="loading loading-spinner loading-xs" />
          <span>
            OrderCreated 历史事件按 10 区块/批同步中；列表已用 orderCount() 补全，每笔订单状态逐笔从 getOrder(id) 读取。
          </span>
        </div>
      )}
      {eventStatus === "error" && (
        <div className="alert alert-warning py-2 text-xs">
          <span>事件历史读取失败，已降级为 orderCount() 补全订单 ID。原因：{getParsedError(eventError)}</span>
        </div>
      )}
      {eventStatus === "success" && orderIds.length > 0 && (
        <p className="text-xs opacity-60">订单 ID 来自 OrderCreated 历史事件，并与 orderCount() 交叉校验。</p>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      )}

      {!isLoading && orderIds.length === 0 && (
        <div className="card bg-base-100 border border-dashed border-base-300">
          <div className="card-body items-center text-center py-12">
            <p className="font-medium">当前没有订单</p>
            <p className="text-sm opacity-60">连接买家钱包后，在左侧创建第一笔托管订单。</p>
          </div>
        </div>
      )}

      {orderIds.map(id => (
        <OrderCard
          key={id.toString()}
          id={id}
          actions={actions}
          arbiter={arbiter}
          decimals={decimals}
          symbol={symbol}
        />
      ))}
    </section>
  );
};

type OrderCardProps = {
  id: bigint;
  actions: EscrowActions;
  arbiter?: Address;
  decimals?: number;
  symbol?: string;
};

/** A：单笔订单读取、加载/错误分支与数据组装 */
const OrderCard = ({ id, actions, arbiter, decimals, symbol }: OrderCardProps) => {
  const { data, isLoading, error } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [id],
  });

  if (isLoading) return <div className="skeleton h-44 w-full" />;

  if (error || !data) {
    return (
      <div className="card bg-base-100 border border-error/40">
        <div className="card-body py-4">
          <p className="font-semibold">订单 #{id.toString()} 读取失败</p>
          <p className="text-xs opacity-70">{error ? getParsedError(error) : "getOrder 返回空数据"}</p>
        </div>
      </div>
    );
  }

  const order: EscrowOrder = {
    id,
    buyer: data.buyer,
    seller: data.seller,
    token: data.token,
    amount: data.amount,
    deadline: data.deadline,
    status: Number(data.status),
    description: data.description,
  };

  return <OrderCardContent order={order} actions={actions} arbiter={arbiter} decimals={decimals} symbol={symbol} />;
};

type OrderCardContentProps = {
  order: EscrowOrder;
  actions: EscrowActions;
  arbiter?: Address;
  decimals?: number;
  symbol?: string;
};

/** A 的订单展示 + C 的角色计算 + B/C 的操作按钮 */
const OrderCardContent = ({ order, actions, arbiter, decimals, symbol }: OrderCardContentProps) => {
  const roles = useOrderRoles(order, arbiter);
  const { data: tokenInfo } = useDeployedContractInfo({ contractName: "hclToken" });

  // 历史订单 #0 使用了其他代币；不要用 hclToken 的符号误导展示。
  const isActiveToken = !tokenInfo || sameAddress(order.token, tokenInfo.address);
  const busy = actions.pendingAction !== null;
  const isPending = actions.pendingAction?.endsWith(`:${order.id}`) ?? false;
  const deadlinePassed = BigInt(Math.floor(Date.now() / 1000)) > order.deadline;

  // 只用于“无可用操作”提示；真正的按钮条件在 B/C 的 button 组件中。
  const hasPaymentAction = roles.isBuyer && (order.status === 0 || order.status === 1);
  const hasDisputeAction =
    (order.status === 1 && (roles.isBuyer || roles.isSeller)) ||
    (order.status === 1 && roles.isBuyer && deadlinePassed) ||
    (order.status === 4 && roles.isArbiter);
  const hasAction = hasPaymentAction || hasDisputeAction;

  return (
    <article className="card bg-base-100 shadow-md border border-base-300">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">订单 #{order.id.toString()}</h3>
            <span className={`badge ${statusBadge(order.status)}`}>{statusLabel(order.status)}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {roles.isBuyer && <span className="badge badge-primary badge-sm">你是买家</span>}
            {roles.isSeller && <span className="badge badge-secondary badge-sm">你是卖家</span>}
            {roles.isArbiter && <span className="badge badge-accent badge-sm">你是仲裁者</span>}
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <span className="opacity-60">买家：</span>
            <AddressView address={order.buyer} format="short" size="sm" />
          </div>
          <div>
            <span className="opacity-60">卖家：</span>
            <AddressView address={order.seller} format="short" size="sm" />
          </div>
          <div>
            <span className="opacity-60">金额：</span>
            <span className="font-mono">
              {formatUnits(order.amount, decimals ?? 18)} {isActiveToken ? (symbol ?? "") : ""}
            </span>
            <span className="text-xs opacity-50">（最小单位 {order.amount.toString()}）</span>
            {!isActiveToken && <span className="badge badge-warning badge-sm ml-2">其他代币</span>}
          </div>
          <div>
            <span className="opacity-60">截止：</span>
            <span className="font-mono">{formatDeadline(order.deadline)}</span>
            {order.status === 1 && deadlinePassed && <span className="badge badge-warning badge-sm ml-2">已到期</span>}
          </div>
          <div className="sm:col-span-2">
            <span className="opacity-60">描述：</span>
            <span>{order.description || "—"}</span>
          </div>
          {!isActiveToken && (
            <div className="sm:col-span-2 text-xs text-warning">
              该订单结算代币为 {order.token}，不是当前 hclToken；金额精度暂按 18 位显示。
            </div>
          )}
        </div>

        {isPending && actions.pendingStep && (
          <div className="alert alert-info py-2 text-sm">
            <span className="loading loading-spinner loading-sm" />
            <span>{actions.pendingStep}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-base-300 pt-3">
          {!roles.isConnected && <span className="text-xs opacity-60">连接钱包后显示可用操作。</span>}
          {roles.isConnected && roles.wrongNetwork && (
            <span className="text-xs text-warning">请先在顶部切换到 POTOS 测试网，交易按钮已禁用。</span>
          )}
          {roles.canTransact && !hasAction && (
            <span className="text-xs opacity-60">
              {order.status >= 2
                ? "订单已结束，无可用操作。"
                : roles.isBuyer || roles.isSeller
                  ? "当前状态无可执行操作。"
                  : "当前账户与该订单无角色关系。"}
            </span>
          )}

          <OrderPaymentActions
            order={order}
            actions={actions}
            isBuyer={roles.isBuyer}
            canTransact={roles.canTransact}
            busy={busy}
          />
          <OrderDisputeActions
            order={order}
            actions={actions}
            isBuyer={roles.isBuyer}
            isSeller={roles.isSeller}
            isArbiter={roles.isArbiter}
            canTransact={roles.canTransact}
            deadlinePassed={deadlinePassed}
            busy={busy}
          />
        </div>
      </div>
    </article>
  );
};
