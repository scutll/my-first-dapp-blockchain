"use client";

import { useDisputeActions } from "~~/hooks/escrow/useDisputeActions";
import { useEscrowTx } from "~~/hooks/escrow/useEscrowTx";
import { useOrderActions } from "~~/hooks/escrow/useOrderActions";
import type { EscrowActions } from "~~/types/escrow";

export type { CreateOrderInput, EscrowActions } from "~~/types/escrow";

/**
 * 组合入口：保持页面原有 API 不变。
 * B 的订单写操作与 C 的争议/仲裁操作共享同一个交易实例与状态。
 */
export function useEscrowActions(): EscrowActions {
  const tx = useEscrowTx();
  const orderActions = useOrderActions(tx);
  const disputeActions = useDisputeActions(tx);

  return {
    ...orderActions,
    ...disputeActions,
    pendingAction: tx.pendingAction,
    pendingStep: tx.pendingStep,
    lastHash: tx.lastHash,
    lastCreatedOrderId: tx.lastCreatedOrderId,
    error: tx.error,
    clearError: tx.clearError,
  };
}
