import hre from "hardhat";

async function main() {
  const TokenMarketplace = await hre.ethers.getContractFactory(
    "TokenMarketplace"
  );
  const tokenMarketplace = await TokenMarketplace.deploy(
    "0xaa6DBD57DC168B8BC1BE2B273582486ed1Ea5Fb4"
  );

  console.log("TokenMarketplace deployed to:", tokenMarketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
