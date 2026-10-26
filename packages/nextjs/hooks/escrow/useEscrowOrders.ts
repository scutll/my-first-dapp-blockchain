"use client";

import { useMemo } from "react";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { ESCROW_DEPLOY_BLOCK } from "~~/types/escrow";

/**
 * 订单发现：以 OrderCreated 历史事件为主（POTOS 每次最多扫 10 个区块），
 * 同时用 orderCount() 交叉校验/补全，保证事件同步未完成时列表也不为空。
 */
export function useEscrowOrders() {
  const { data: orderCount } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "orderCount",
  });

  const {
    data: createdEvents,
    status: eventStatus,
    error: eventError,
    refetch: refetchEvents,
  } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    fromBlock: ESCROW_DEPLOY_BLOCK,
    watch: true,
    blocksBatchSize: 10,
  });

  const orderIds = useMemo(() => {
    const ids = new Map<string, bigint>();

    for (const event of createdEvents ?? []) {
      const id = (event?.args as { id?: bigint } | undefined)?.id;
      if (typeof id === "bigint") ids.set(id.toString(), id);
    }

    // 事件历史可能仍在分批同步；orderCount 是从 0 开始的累计数量，可用于补全与降级。
    if (typeof orderCount === "bigint") {
      for (let id = 0n; id < orderCount; id++) ids.set(id.toString(), id);
    }

    return [...ids.values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [createdEvents, orderCount]);

  return {
    orderIds,
    orderCount,
    eventStatus,
    eventError,
    refetchEvents,
    isLoading: orderCount === undefined && orderIds.length === 0,
  };
}
