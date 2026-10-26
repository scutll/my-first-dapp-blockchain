"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address, Hash } from "viem";
import { getAddress, isAddress, parseUnits } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { ESCROW_CHAIN_ID, EscrowOrder, sameAddress } from "~~/types/escrow";
import { getParsedError } from "~~/utils/scaffold-eth";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type CreateOrderInput = {
  seller: string;
  amount: string;
  deadlineMinutes: string;
  description: string;
};

/**
 * 全部 Escrow 写交易。每笔写操作都等待收据成功后才算完成，
 * 随后主动失效 readContract / balance 查询，让页面重新读链。
 */
export function useEscrowActions() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: ESCROW_CHAIN_ID });
  const queryClient = useQueryClient();

  const { data: escrowInfo } = useDeployedContractInfo({ contractName: "Escrow" });
  const { data: tokenInfo } = useDeployedContractInfo({ contractName: "hclToken" });
  const { data: arbiter } = useScaffoldReadContract({ contractName: "Escrow", functionName: "arbiter" });
  const { data: tokenDecimals } = useScaffoldReadContract({ contractName: "hclToken", functionName: "decimals" });

  const { writeContractAsync: writeEscrow } = useScaffoldWriteContract({ contractName: "Escrow" });
  const { writeContractAsync: writeToken } = useScaffoldWriteContract({ contractName: "hclToken" });

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<Hash | null>(null);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetFeedback = () => {
    setError(null);
    setLastHash(null);
    setLastCreatedOrderId(null);
  };

  const refreshReads = () => {
    // 只刷新读合约/余额，避免重启耗时的事件历史扫描。
    queryClient.invalidateQueries({ queryKey: ["readContract"] });
    queryClient.invalidateQueries({ queryKey: ["balance"] });
  };

  /** 每次发交易前重新向钱包确认链与账户，防止异步流程中切账户/切链 */
  const ensureWallet = async (expected?: Address) => {
    if (!walletClient) throw new Error("请先连接钱包");
    const chainId = await walletClient.getChainId();
    if (chainId !== ESCROW_CHAIN_ID) {
      throw new Error(`钱包未连接 POTOS 测试网（chainId ${ESCROW_CHAIN_ID}），请先切换网络`);
    }
    if (expected) {
      const [current] = await walletClient.getAddresses();
      if (!sameAddress(current, expected)) {
        throw new Error("钱包账户已切换，请重新确认当前订单后再操作");
      }
    }
  };

  const run = async (key: string, initialStep: string, fn: () => Promise<Hash | undefined>) => {
    resetFeedback();
    setPendingAction(key);
    setPendingStep(initialStep);
    try {
      const hash = await fn();
      if (!hash) throw new Error("交易未发送或未确认");
      setLastHash(hash);
      return hash;
    } catch (e) {
      setError(getParsedError(e));
      return undefined;
    } finally {
      setPendingAction(null);
      setPendingStep(null);
      refreshReads();
    }
  };

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

  const dispute = async (order: EscrowOrder) => {
    if (!sameAddress(address, order.buyer) && !sameAddress(address, order.seller)) {
      resetFeedback();
      return setError("只有该订单的买家或卖家可以发起争议");
    }
    return run(`dispute:${order.id}`, "等待钱包确认 dispute…", async () => {
      await ensureWallet(address);
      return writeEscrow({ functionName: "dispute", args: [order.id] });
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
        return writeEscrow({ functionName: "resolve", args: [order.id, sellerWins] });
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
      return writeEscrow({ functionName: "refund", args: [order.id] });
    });
  };

  return {
    createOrder,
    pay,
    confirm,
    dispute,
    resolve,
    refund,
    pendingAction,
    pendingStep,
    lastHash,
    lastCreatedOrderId,
    error,
    clearError: () => setError(null),
  };
}

export type EscrowActions = ReturnType<typeof useEscrowActions>;
