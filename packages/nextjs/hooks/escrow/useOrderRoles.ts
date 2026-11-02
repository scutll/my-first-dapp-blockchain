"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { ESCROW_CHAIN_ID, EscrowOrder, sameAddress } from "~~/types/escrow";

/** C：根据当前账户、订单买卖双方与 arbiter() 统一计算角色和可交易性 */
export function useOrderRoles(order: EscrowOrder, arbiter?: Address) {
  const { address, chainId, isConnected } = useAccount();
  const wrongNetwork = isConnected && chainId !== ESCROW_CHAIN_ID;

  return {
    address,
    isConnected,
    isBuyer: sameAddress(address, order.buyer),
    isSeller: sameAddress(address, order.seller),
    isArbiter: sameAddress(address, arbiter),
    wrongNetwork,
    canTransact: isConnected && !wrongNetwork,
  };
}
