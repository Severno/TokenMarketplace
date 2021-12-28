import hre from "hardhat";

async function main() {
  const TokenMarketplace = await hre.ethers.getContractFactory(
    "TokenMarketplace"
  );
  const tokenMarketplace = await TokenMarketplace.deploy(
    "0x47d57944afc78275230452ad3c22eda6600d9062"
  );

  console.log("TokenMarketplace deployed to:", tokenMarketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
