import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { AMOUNT, paidOrderFixture } from "./fixtures";

/** C：超时退款、争议、仲裁裁决 */
describe("Escrow - 退款、争议与仲裁（C）", function () {
  it("deadline 之前 refund 失败，deadline 之后 refund 成功并退回买家", async function () {
    const { token, escrow, buyer, escrowAddr } = await loadFixture(paidOrderFixture);

    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("not yet to arrive deadline");

    await time.increase(3601);

    const before = await token.balanceOf(buyer.address);
    await escrow.connect(buyer).refund(0);
    const after = await token.balanceOf(buyer.address);

    expect(after - before).to.equal(AMOUNT);
    expect(await token.balanceOf(escrowAddr)).to.equal(0);
    const order = await escrow.getOrder(0);
    expect(order.status).to.equal(3);
  });

  it("非仲裁人调用 resolve 失败", async function () {
    const { escrow, buyer, stranger } = await loadFixture(paidOrderFixture);

    await escrow.connect(buyer).dispute(0);
    await expect(escrow.connect(stranger).resolve(0, true)).to.be.revertedWith("Escrow: caller is not the arbiter");
  });

  it("dispute 后仲裁人 resolve(false) 退款给买家，状态变为 Refunded", async function () {
    const { token, escrow, buyer, arbiter, escrowAddr } = await loadFixture(paidOrderFixture);

    await escrow.connect(buyer).dispute(0);
    expect((await escrow.getOrder(0)).status).to.equal(4);

    const before = await token.balanceOf(buyer.address);
    await expect(escrow.connect(arbiter).resolve(0, false)).to.emit(escrow, "OrderResolved").withArgs(0, false);
    const after = await token.balanceOf(buyer.address);

    expect(after - before).to.equal(AMOUNT);
    expect(await token.balanceOf(escrowAddr)).to.equal(0);
    expect((await escrow.getOrder(0)).status).to.equal(3);
  });

  it("dispute 后仲裁人 resolve(true) 放款给卖家，状态变为 Completed", async function () {
    const { token, escrow, buyer, seller, arbiter, escrowAddr } = await loadFixture(paidOrderFixture);

    await escrow.connect(buyer).dispute(0);
    expect((await escrow.getOrder(0)).status).to.equal(4);

    const before = await token.balanceOf(seller.address);
    await expect(escrow.connect(arbiter).resolve(0, true)).to.emit(escrow, "OrderResolved").withArgs(0, true);
    const after = await token.balanceOf(seller.address);

    expect(after - before).to.equal(AMOUNT);
    expect(await token.balanceOf(escrowAddr)).to.equal(0);
    expect((await escrow.getOrder(0)).status).to.equal(2);
  });
});
