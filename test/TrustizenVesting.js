const { expect } = require("chai");
const moment = require('moment');

describe("TrustizenVesting", function () {
  let Trusticoin;
  let TrusticoinVesting;
  let trusticoin;

  let owner;
  let seedAddress;
  let otherAddresses;

  let trusticoinParams = {
    name: "Trusticoin",
    symbol: "TTC",
    totalSupply: 1000000000
  };

  let expectedVestingData = [
    { month:  0, withdrawableAmount:  2500000 },
    { month:  1, withdrawableAmount:  2500000 },
    { month:  2, withdrawableAmount:  2500000 },
    { month:  3, withdrawableAmount:  2500000 },
    { month:  4, withdrawableAmount:  5138888 },
    { month:  5, withdrawableAmount:  7777777 },
    { month:  6, withdrawableAmount: 10416666 },
    { month:  7, withdrawableAmount: 13055555 },
    { month:  8, withdrawableAmount: 15694444 },
    { month:  9, withdrawableAmount: 18333333 },
    { month: 10, withdrawableAmount: 20972222 },
    { month: 11, withdrawableAmount: 23611111 },
    { month: 12, withdrawableAmount: 26250000 },
    { month: 13, withdrawableAmount: 28888888 },
    { month: 14, withdrawableAmount: 31527777 },
    { month: 15, withdrawableAmount: 34166666 },
    { month: 16, withdrawableAmount: 36805555 },
    { month: 17, withdrawableAmount: 39444444 },
    { month: 18, withdrawableAmount: 42083333 },
    { month: 19, withdrawableAmount: 44722222 },
    { month: 20, withdrawableAmount: 47361111 },
    { month: 21, withdrawableAmount: 50000000 }
  ];

  let baseTime = 1640995200 - 7 * 3600;  // => UTC Timestamp
  let vestingTotalAmount = expectedVestingData[expectedVestingData.length - 1].withdrawableAmount;
  let cliff = 7776000;  // 1648771200 - 1640995200
  let duration = 47347200;  // 1696118400 - 1648771200
  let months = 18;

  let tgePercentage = 0.05;
  let tgeAmount = vestingTotalAmount * tgePercentage;

  let startTime = baseTime;
  const slicePeriodSeconds = duration / months;
  const revokable = true;
  const amount = vestingTotalAmount;

  before(async function () {
    Trusticoin = await ethers.getContractFactory("Token");
    TrusticoinVesting = await ethers.getContractFactory("MockTokenVesting");
  });

  beforeEach(async function () {
    [owner, seedAddress, ...otherAddresses] = await ethers.getSigners();
    trusticoin = await Trusticoin.deploy(trusticoinParams.name, trusticoinParams.symbol, trusticoinParams.totalSupply);
    await trusticoin.deployed();
  })

  describe("Vesting for Seed", function () {
    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await trusticoin.balanceOf(owner.address);
      expect(await trusticoin.totalSupply()).to.equal(ownerBalance);
    });

    it("Should vest tokens gradually", async function () {
      // deploy vesting contract
      const trusticoinVesting = await TrusticoinVesting.deploy(trusticoin.address);
      await trusticoinVesting.deployed();

      expect((await trusticoinVesting.getToken()).toString()).to.equal(
        trusticoin.address
      );

      // send tokens to vesting contract
      await expect(trusticoin.transfer(trusticoinVesting.address, vestingTotalAmount))
        .to.emit(trusticoin, "Transfer")
        .withArgs(owner.address, trusticoinVesting.address, vestingTotalAmount);
      const vestingContractBalance = await trusticoin.balanceOf(
        trusticoinVesting.address
      );
      expect(vestingContractBalance).to.equal(vestingTotalAmount);
      expect(await trusticoinVesting.getWithdrawableAmount()).to.equal(vestingTotalAmount);

      //
      const beneficiary = seedAddress;

      // create new vesting schedule
      await trusticoinVesting.createVestingSchedule(
        beneficiary.address,
        startTime + cliff, 0,
        // startTime, cliff,
        duration,
        slicePeriodSeconds,
        revokable,
        vestingTotalAmount - tgeAmount
      );
      expect(await trusticoinVesting.getVestingSchedulesCount()).to.be.equal(1);

      // compute vesting schedule id
      const vestingScheduleId =
        await trusticoinVesting.computeVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      console.log(
        0,
        startTime,
        moment(startTime * 1e3).format("DD-MM-YYYY HH:mm:ss"),
        tgeAmount,
        0
      );

      for (var i = 1; i < expectedVestingData.length; i++) {
        let vestedAmount0 = await trusticoinVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId);

        await trusticoinVesting.setCurrentTime(
          startTime + expectedVestingData[i].month * slicePeriodSeconds + 1
        );

        let vestedAmount1 = await trusticoinVesting
          .connect(beneficiary)
          .computeReleasableAmount(vestingScheduleId);

        let timestamp = startTime + (expectedVestingData[i].month - 1) * slicePeriodSeconds + 1;

        console.log(
          i,
          timestamp,
          moment(timestamp * 1e3).format("DD-MM-YYYY HH:mm:ss"),
          vestedAmount1.toNumber() + tgeAmount,
          vestedAmount1 - vestedAmount0
        );
      }
    })
  })
})
