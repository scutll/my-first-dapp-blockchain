"use client";

import type { Address } from "viem";
import { formatUnits } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { Address as AddressView } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { ESCROW_CHAIN_ID, sameAddress } from "~~/types/escrow";

export const WalletPanel = () => {
  const { address, chain, chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const { data: arbiter } = useScaffoldReadContract({ contractName: "Escrow", functionName: "arbiter" });
  const { data: symbol } = useScaffoldReadContract({ contractName: "hclToken", functionName: "symbol" });
  const { data: decimals } = useScaffoldReadContract({ contractName: "hclToken", functionName: "decimals" });
  const { data: balance } = useScaffoldReadContract({
    contractName: "hclToken",
    functionName: "balanceOf",
    args: [address as Address],
    query: { enabled: Boolean(address) },
  });
  const { data: escrowInfo } = useDeployedContractInfo({ contractName: "Escrow" });
  const { data: tokenInfo } = useDeployedContractInfo({ contractName: "hclToken" });

  const wrongNetwork = isConnected && chainId !== ESCROW_CHAIN_ID;
  const isArbiter = sameAddress(address, arbiter);
  const balanceText = balance !== undefined && decimals !== undefined ? formatUnits(balance, decimals) : "—";

  return (
    <section className="card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">钱包与角色</h2>
          <span className={`badge ${isConnected ? "badge-success" : "badge-ghost"}`}>
            {isConnected ? "已连接" : "只读模式"}
          </span>
        </div>

        {wrongNetwork && (
          <div className="alert alert-warning py-2">
            <span>钱包网络不是 POTOS 测试网（chainId {ESCROW_CHAIN_ID}），交易按钮已禁用。</span>
            <button
              className="btn btn-xs btn-warning"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: ESCROW_CHAIN_ID })}
            >
              {isSwitching ? "切换中…" : "切换网络"}
            </button>
          </div>
        )}

        {!isConnected && (
          <div className="alert alert-info py-2 text-sm">
            未连接钱包也可以查看链上订单；连接 MetaMask 后才能创建、付款、争议或仲裁。
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase opacity-60 mb-1">当前账户</p>
            {address ? <AddressView address={address} format="short" /> : <span className="opacity-60">—</span>}
          </div>
          <div>
            <p className="text-xs uppercase opacity-60 mb-1">连接网络</p>
            <p className="font-mono text-sm">{isConnected ? `${chain?.name ?? "未知网络"} (${chainId})` : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase opacity-60 mb-1">仲裁者 arbiter()</p>
            {arbiter ? <AddressView address={arbiter} format="short" /> : <span className="opacity-60">读取中…</span>}
          </div>
          <div>
            <p className="text-xs uppercase opacity-60 mb-1">当前身份</p>
            <p className="text-sm">
              {!isConnected ? "未连接" : isArbiter ? "仲裁者 C（可裁决争议订单）" : "买家 / 卖家（角色按每笔订单判定）"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase opacity-60 mb-1">hclToken 余额</p>
            <p className="font-mono text-sm">{isConnected ? `${balanceText} ${symbol ?? ""}` : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase opacity-60 mb-1">代币精度</p>
            <p className="font-mono text-sm">{decimals !== undefined ? `${decimals} decimals` : "—"}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs opacity-70 border-t border-base-300 pt-3">
          <span>Escrow：{escrowInfo ? <AddressView address={escrowInfo.address} format="short" /> : "读取中…"}</span>
          <span>hclToken：{tokenInfo ? <AddressView address={tokenInfo.address} format="short" /> : "读取中…"}</span>
        </div>
      </div>
    </section>
  );
};
