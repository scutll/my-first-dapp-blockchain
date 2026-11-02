import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export const AMOUNT = ethers.parseUnits("30", 18);

export async function deployFixture() {
  const [deployer, buyer, seller, arbiter, stranger] = await ethers.getSigners();
  const token = await ethers.deployContract("MXLToken");
  await token.mint(buyer.address, ethers.parseUnits("100", 18)); // deployer 是 owner
  const escrow = await ethers.deployContract("Escrow", [arbiter.address]);
  const deadline = (await time.latest()) + 3600;
  const tokenAddr = await token.getAddress();
  const escrowAddr = await escrow.getAddress();
  return { token, escrow, deployer, buyer, seller, arbiter, stranger, deadline, tokenAddr, escrowAddr };
}

export async function paidOrderFixture() {
  const base = await deployFixture();
  const { token, escrow, buyer, seller, deadline, tokenAddr, escrowAddr } = base;
  await escrow.connect(buyer).createOrder(seller.address, tokenAddr, AMOUNT, deadline, "一本书");
  await token.connect(buyer).approve(escrowAddr, AMOUNT);
  await escrow.connect(buyer).deposit(0);
  return base;
}
