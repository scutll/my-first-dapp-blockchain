"use client";

import type { EscrowActions } from "~~/types/escrow";
import type { EscrowOrder } from "~~/types/escrow";

type OrderDisputeActionsProps = {
  order: EscrowOrder;
  actions: EscrowActions;
  isBuyer: boolean;
  isSeller: boolean;
  isArbiter: boolean;
  canTransact: boolean;
  deadlinePassed: boolean;
  busy: boolean;
};

/** C：发起争议、超时退款、仲裁裁决按钮 */
export const OrderDisputeActions = ({
  order,
  actions,
  isBuyer,
  isSeller,
  isArbiter,
  canTransact,
  deadlinePassed,
  busy,
}: OrderDisputeActionsProps) => {
  if (!canTransact) return null;

  const showDispute = order.status === 1 && (isBuyer || isSeller);
  const showRefund = order.status === 1 && isBuyer && deadlinePassed;
  const showResolve = order.status === 4 && isArbiter;

  return (
    <>
      {showDispute && (
        <button className="btn btn-error btn-outline btn-sm" disabled={busy} onClick={() => actions.dispute(order)}>
          发起争议
        </button>
      )}
      {showRefund && (
        <button className="btn btn-warning btn-outline btn-sm" disabled={busy} onClick={() => actions.refund(order)}>
          超时退款
        </button>
      )}
      {showResolve && (
        <>
          <button className="btn btn-success btn-sm" disabled={busy} onClick={() => actions.resolve(order, true)}>
            判卖家胜（放款）
          </button>
          <button className="btn btn-warning btn-sm" disabled={busy} onClick={() => actions.resolve(order, false)}>
            判买家胜（退款）
          </button>
        </>
      )}
    </>
  );
};
