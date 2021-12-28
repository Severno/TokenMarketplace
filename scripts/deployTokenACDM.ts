import hre from "hardhat";

async function main() {
  const AcademyToken = await hre.ethers.getContractFactory("AcademyToken");
  const academyToken = await AcademyToken.deploy("Academy", "ACDM");

  console.log(hre.network);
  console.log("AcademyToken deployed to:", academyToken.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
