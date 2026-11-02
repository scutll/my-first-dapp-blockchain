"use client";

import type { EscrowActions } from "~~/types/escrow";
import type { EscrowOrder } from "~~/types/escrow";

type OrderPaymentActionsProps = {
  order: EscrowOrder;
  actions: EscrowActions;
  isBuyer: boolean;
  canTransact: boolean;
  busy: boolean;
};

/** B：买家的付款（approve → deposit）与确认收货按钮 */
export const OrderPaymentActions = ({ order, actions, isBuyer, canTransact, busy }: OrderPaymentActionsProps) => {
  if (!canTransact || !isBuyer) return null;

  return (
    <>
      {order.status === 0 && (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => actions.pay(order)}>
          付款（approve → deposit）
        </button>
      )}
      {order.status === 1 && (
        <button className="btn btn-success btn-sm" disabled={busy} onClick={() => actions.confirm(order)}>
          确认收货
        </button>
      )}
    </>
  );
};
