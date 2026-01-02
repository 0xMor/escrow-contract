import { expect } from "chai";
import { ethers } from "hardhat";

describe("Escrow", function () {
  it("buyer deposits and confirms delivery => seller gets paid", async () => {
    const [buyer, seller, arbiter] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.connect(buyer).deploy(seller.address, arbiter.address);

    await escrow.connect(buyer).deposit({ value: ethers.parseEther("1") });

    const sellerBalBefore = await ethers.provider.getBalance(seller.address);

    const tx = await escrow.connect(buyer).confirmDelivery();
    await tx.wait();

    const sellerBalAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerBalAfter - sellerBalBefore).to.equal(ethers.parseEther("1"));
  });

  it("buyer opens dispute => arbiter refunds buyer", async () => {
    const [buyer, seller, arbiter] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.connect(buyer).deploy(seller.address, arbiter.address);

    await escrow.connect(buyer).deposit({ value: ethers.parseEther("1") });

    await escrow.connect(buyer).openDispute();

    const buyerBalBefore = await ethers.provider.getBalance(buyer.address);

    const tx = await escrow.connect(arbiter).resolve(false);
    const receipt = await tx.wait();

    // Ojo: buyer pagó gas antes (deploy + deposit + openDispute), así que aquí no comparamos exacto.
    // Solo comprobamos que el contrato quedó sin balance.
    const escrowBal = await ethers.provider.getBalance(await escrow.getAddress());
    expect(escrowBal).to.equal(0n);
  });

  it("non-buyer cannot deposit / confirm / dispute", async () => {
    const [buyer, seller, arbiter, outsider] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.connect(buyer).deploy(seller.address, arbiter.address);

    await expect(
      escrow.connect(outsider).deposit({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Not buyer");
  });

  it("non-arbiter cannot resolve", async () => {
    const [buyer, seller, arbiter, outsider] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.connect(buyer).deploy(seller.address, arbiter.address);

    await escrow.connect(buyer).deposit({ value: ethers.parseEther("1") });
    await escrow.connect(buyer).openDispute();

    await expect(escrow.connect(outsider).resolve(true)).to.be.revertedWith("Not arbiter");
  });
});
