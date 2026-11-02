"use client";

import type { Address } from "viem";
import { getAddress, isAddress, parseUnits } from "viem";
import type { EscrowTx } from "~~/hooks/escrow/useEscrowTx";
import { EscrowOrder, sameAddress } from "~~/types/escrow";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type CreateOrderInput = {
  seller: string;
  amount: string;
  deadlineMinutes: string;
  description: string;
};

/** B：创建订单、approve + deposit 付款、确认收货 */
export function useOrderActions(tx: EscrowTx) {
  const {
    address,
    publicClient,
    escrowInfo,
    tokenInfo,
    tokenDecimals,
    writeEscrow,
    writeToken,
    run,
    ensureWallet,
    setPendingStep,
    setLastCreatedOrderId,
    resetFeedback,
    setError,
  } = tx;

  const createOrder = async (input: CreateOrderInput) => {
    resetFeedback();
    if (!address) return setError("请先连接钱包");
    if (!escrowInfo || !tokenInfo) return setError("合约信息未加载，请刷新页面");
    if (tokenDecimals === undefined) return setError("代币精度未加载，请稍后重试");

    const sellerText = input.seller.trim();
    if (!isAddress(sellerText) || sameAddress(sellerText, ZERO_ADDRESS)) {
      return setError("请输入有效的卖家地址（不能是零地址）");
    }
    if (sameAddress(sellerText, address)) return setError("卖家不能是当前买家");

    const amountNumber = Number(input.amount);
    if (!input.amount.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      return setError("金额必须大于 0");
    }
    const minutes = Number(input.deadlineMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) return setError("期限必须大于 0 分钟");

    let seller: Address;
    let amount: bigint;
    try {
      seller = getAddress(sellerText);
      amount = parseUnits(input.amount.trim(), tokenDecimals);
    } catch {
      return setError("金额格式不正确（小数位不能超过代币精度）");
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.ceil(minutes * 60));

    return run("create", "等待钱包确认 createOrder…", async () => {
      await ensureWallet(address);
      const hash = await writeEscrow({
        functionName: "createOrder",
        args: [seller, tokenInfo.address, amount, deadline, input.description.trim()],
      });
      if (!hash) throw new Error("createOrder 未发送");

      // 收据已确认：按课程要求用 orderCount 查询新订单 ID（不把交易哈希当订单 ID）。
      if (publicClient && escrowInfo) {
        const count = await publicClient.readContract({
          address: escrowInfo.address,
          abi: escrowInfo.abi,
          functionName: "orderCount",
        });
        if (typeof count === "bigint" && count > 0n) setLastCreatedOrderId(count - 1n);
      }
      return hash;
    });
  };

  const pay = async (order: EscrowOrder) => {
    if (!sameAddress(address, order.buyer)) {
      resetFeedback();
      return setError("只有该订单的买家可以付款");
    }

    return run(`pay:${order.id}`, "步骤 1/2：检查授权额度…", async () => {
      await ensureWallet(order.buyer);
      if (!publicClient || !escrowInfo || !tokenInfo) throw new Error("合约或 RPC 未就绪");
      if (!sameAddress(order.token, tokenInfo.address)) {
        throw new Error("该订单结算代币不是 hclToken，当前页面不支持");
      }

      const allowance = await publicClient.readContract({
        address: order.token,
        abi: tokenInfo.abi,
        functionName: "allowance",
        args: [order.buyer, escrowInfo.address],
      });

      if (allowance < order.amount) {
        setPendingStep("步骤 1/2：请在钱包中确认 approve 授权…");
        const approveHash = await writeToken({
          functionName: "approve",
          args: [escrowInfo.address, order.amount],
        });
        if (!approveHash) throw new Error("approve 未发送");
        setPendingStep("approve 已确认，准备 deposit 付款…");
        await ensureWallet(order.buyer);
      } else {
        setPendingStep("授权额度已充足，跳过 approve");
      }

      setPendingStep("步骤 2/2：请在钱包中确认 deposit 付款…");
      const depositHash = await writeEscrow({ functionName: "deposit", args: [order.id] });
      if (!depositHash) throw new Error("deposit 未发送");
      return depositHash;
    });
  };

  const confirm = async (order: EscrowOrder) => {
    if (!sameAddress(address, order.buyer)) {
      resetFeedback();
      return setError("只有该订单的买家可以确认收货");
    }
    return run(`confirm:${order.id}`, "等待钱包确认 confirm…", async () => {
      await ensureWallet(order.buyer);
      return writeEscrow({ functionName: "confirm", args: [order.id] });
    });
  };

  return { createOrder, pay, confirm };
}
