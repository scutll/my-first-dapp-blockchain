"use client";

import type { EscrowTx } from "~~/hooks/escrow/useEscrowTx";
import { EscrowOrder, sameAddress } from "~~/types/escrow";

/** C：发起争议、仲裁裁决、超时退款 */
export function useDisputeActions(tx: EscrowTx) {
  const { address, arbiter, run, ensureWallet, resetFeedback, setError } = tx;

  const dispute = async (order: EscrowOrder) => {
    if (!sameAddress(address, order.buyer) && !sameAddress(address, order.seller)) {
      resetFeedback();
      return setError("只有该订单的买家或卖家可以发起争议");
    }
    return run(`dispute:${order.id}`, "等待钱包确认 dispute…", async () => {
      await ensureWallet(address);
      return tx.writeEscrow({ functionName: "dispute", args: [order.id] });
    });
  };

  const resolve = async (order: EscrowOrder, sellerWins: boolean) => {
    if (!sameAddress(address, arbiter)) {
      resetFeedback();
      return setError("只有仲裁者可以裁决");
    }
    return run(
      `resolve-${sellerWins}:${order.id}`,
      sellerWins ? "等待钱包确认：判卖家胜并放款…" : "等待钱包确认：判买家胜并退款…",
      async () => {
        if (!arbiter) throw new Error("仲裁者地址未加载");
        await ensureWallet(arbiter);
        return tx.writeEscrow({ functionName: "resolve", args: [order.id, sellerWins] });
      },
    );
  };

  const refund = async (order: EscrowOrder) => {
    if (!sameAddress(address, order.buyer)) {
      resetFeedback();
      return setError("只有该订单的买家可以超时退款");
    }
    if (BigInt(Math.floor(Date.now() / 1000)) <= order.deadline) {
      resetFeedback();
      return setError("尚未超过订单截止时间，不能退款");
    }
    return run(`refund:${order.id}`, "等待钱包确认 refund…", async () => {
      await ensureWallet(order.buyer);
      return tx.writeEscrow({ functionName: "refund", args: [order.id] });
    });
  };

  return { dispute, resolve, refund };
}
