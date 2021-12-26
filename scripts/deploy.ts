import hre from "hardhat";

async function main() {
  const TokenMarketplace = await hre.ethers.getContractFactory(
    "TokenMarketplace"
  );
  const tokenMarketplace = await TokenMarketplace.deploy();

  await tokenMarketplace.deployed();

  console.log("TokenMarketplace deployed to:", tokenMarketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
