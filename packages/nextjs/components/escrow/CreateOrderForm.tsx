"use client";

import { FormEvent, useState } from "react";
import { useAccount } from "wagmi";
import type { EscrowActions } from "~~/hooks/escrow/useEscrowActions";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { ESCROW_CHAIN_ID } from "~~/types/escrow";

type CreateOrderFormProps = {
  actions: EscrowActions;
};

const initialState = {
  seller: "",
  amount: "",
  deadlineMinutes: "30",
  description: "",
};

export const CreateOrderForm = ({ actions }: CreateOrderFormProps) => {
  const { isConnected, chainId } = useAccount();
  const [form, setForm] = useState(initialState);

  const { data: symbol } = useScaffoldReadContract({ contractName: "hclToken", functionName: "symbol" });
  const { data: decimals } = useScaffoldReadContract({ contractName: "hclToken", functionName: "decimals" });

  const wrongNetwork = isConnected && chainId !== ESCROW_CHAIN_ID;
  const isCreating = actions.pendingAction === "create";
  const disabled = !isConnected || wrongNetwork || actions.pendingAction !== null;

  const update =
    (key: keyof typeof initialState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(current => ({ ...current, [key]: event.target.value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const hash = await actions.createOrder(form);
    if (hash) {
      setForm(current => ({ ...current, amount: "", description: "" }));
    }
  };

  return (
    <section className="card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body gap-3">
        <div>
          <h2 className="card-title">创建订单</h2>
          <p className="text-xs opacity-70 mt-1">买家固定为当前钱包，结算代币固定为 hclToken。</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="form-control w-full">
            <span className="label-text mb-1">卖家地址 B</span>
            <input
              className="input input-bordered w-full font-mono text-sm"
              value={form.seller}
              onChange={update("seller")}
              placeholder="0x..."
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control w-full">
              <span className="label-text mb-1">金额（{symbol ?? "代币"}）</span>
              <input
                className="input input-bordered w-full"
                type="number"
                min="0"
                step="any"
                value={form.amount}
                onChange={update("amount")}
                placeholder="30"
                required
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-1">期限（分钟）</span>
              <input
                className="input input-bordered w-full"
                type="number"
                min="1"
                step="1"
                value={form.deadlineMinutes}
                onChange={update("deadlineMinutes")}
                required
              />
            </label>
          </div>

          <label className="form-control w-full">
            <span className="label-text mb-1">订单描述</span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              value={form.description}
              onChange={update("description")}
              placeholder="例如：课程演示订单，30 个 hclToken 换取一本书"
              required
            />
          </label>

          <p className="text-xs opacity-60">
            金额按完整代币个数输入，经 decimals()（当前 {decimals ?? "…"} 位）转为最小单位；期限从当前时间起算，
            现场演示建议 30 分钟。
          </p>

          {isCreating && actions.pendingStep && (
            <div className="alert alert-info py-2 text-sm">
              <span className="loading loading-spinner loading-sm" />
              <span>{actions.pendingStep}</span>
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={disabled}>
            {isCreating
              ? "创建中…"
              : !isConnected
                ? "请先连接钱包"
                : wrongNetwork
                  ? "请切换到 POTOS 测试网"
                  : "创建订单"}
          </button>
        </form>
      </div>
    </section>
  );
};
