import type { Address } from "viem";

/** POTOS 测试网与 Escrow 部署信息（与 deployedContracts.ts / deployments 保持一致） */
export const ESCROW_CHAIN_ID = 60600;
export const ESCROW_DEPLOY_BLOCK = 2670277n;

/** 与 Escrow.Status 枚举顺序严格一致 */
export const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "待付款 Created",
  1: "已付款 Paid",
  2: "已完成 Completed",
  3: "已退款 Refunded",
  4: "争议中 Disputed",
};

export const ORDER_STATUS_BADGE: Record<number, string> = {
  0: "badge-warning",
  1: "badge-info",
  2: "badge-success",
  3: "badge-ghost",
  4: "badge-error",
};

/** 链上 getOrder 的完整字段；id 为订单编号，amount 为代币最小单位 */
export type EscrowOrder = {
  id: bigint;
  buyer: Address;
  seller: Address;
  token: Address;
  amount: bigint;
  deadline: bigint;
  status: number;
  description: string;
};

export const statusLabel = (status: number) => ORDER_STATUS_LABELS[status] ?? `未知状态 ${status}`;
export const statusBadge = (status: number) => ORDER_STATUS_BADGE[status] ?? "badge-neutral";

/** 固定 UTC 输出，避免服务端/客户端本地时区不同导致 hydration 不一致 */
export const formatDeadline = (deadline: bigint) =>
  `${new Date(Number(deadline) * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC`;

export const sameAddress = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
