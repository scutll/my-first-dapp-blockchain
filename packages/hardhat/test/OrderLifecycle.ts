import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { AMOUNT, deployFixture, paidOrderFixture } from "./fixtures";

/** B：创建订单、approve + deposit 付款、确认收货 */
describe("Escrow - 订单创建与付款确认（B）", function () {
  it("createOrder 记录订单并发出事件", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await expect(
      escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书"),
    )
      .to.emit(escrow, "OrderCreated")
      .withArgs(0, buyer.address, seller.address, await token.getAddress(), AMOUNT, deadline);
    const order = await escrow.getOrder(0);
    expect(order.buyer).to.equal(buyer.address);
    expect(order.status).to.equal(0); // Created
    expect(await escrow.orderCount()).to.equal(1);
  });

  it("未 approve 时 deposit 失败", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await expect(escrow.connect(buyer).deposit(0)).to.be.revertedWith("not enough value in allowance");
  });

  it("approve 后 deposit 成功，代币进入 Escrow，状态变为 Paid", async function () {
    const { token, escrow, buyer, seller, deadline, tokenAddr, escrowAddr } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, tokenAddr, AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(escrowAddr, AMOUNT);
    await escrow.connect(buyer).deposit(0);

    expect(await token.balanceOf(escrowAddr)).to.equal(AMOUNT);
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(1);
  });

  it("非买家调用 confirm 失败", async function () {
    const { escrow, stranger } = await loadFixture(paidOrderFixture);
    await expect(escrow.connect(stranger).confirm(0)).to.be.revertedWith("Escrow: caller is not the buyer");
  });

  it("confirm 后卖家收到代币，状态变为 Completed", async function () {
    const { token, escrow, buyer, seller, escrowAddr } = await loadFixture(paidOrderFixture);

    const before = await token.balanceOf(seller.address);
    await escrow.connect(buyer).confirm(0);
    const after = await token.balanceOf(seller.address);

    expect(after - before).to.equal(AMOUNT);
    expect(await token.balanceOf(escrowAddr)).to.equal(0);
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(2);
  });
});
