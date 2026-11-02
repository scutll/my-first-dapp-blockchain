"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { ESCROW_CHAIN_ID, sameAddress } from "~~/types/escrow";
import { getParsedError } from "~~/utils/scaffold-eth";

/**
 * 共享交易基础设施：钱包/合约/RPC、pending 状态、收据等待、
 * 账户与网络二次校验、读查询刷新。B/C 的 action hooks 共用同一实例。
 */
export function useEscrowTx() {
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

  return {
    address,
    walletClient,
    publicClient,
    escrowInfo,
    tokenInfo,
    arbiter,
    tokenDecimals,
    writeEscrow,
    writeToken,
    pendingAction,
    pendingStep,
    lastHash,
    lastCreatedOrderId,
    error,
    setPendingStep,
    setLastCreatedOrderId,
    setError,
    resetFeedback,
    refreshReads,
    ensureWallet,
    run,
    clearError: () => setError(null),
  };
}

export type EscrowTx = ReturnType<typeof useEscrowTx>;
