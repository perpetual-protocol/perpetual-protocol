import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { ERC20FakeInstance, FeeRewardPoolL1FakeInstance, StakedPerpTokenMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployErc20Fake, deployFeeRewardPoolL1 } from "../helper/contract"
import { deployStakedPerpTokenMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"
const ONE_DAY = 24 * 60 * 60

describe.only("FeeRewardPoolL1Spec", () => {
    let admin: string
    let alice: string
    let tmpRewardPool: string
    let stakedPerpToken: StakedPerpTokenMockInstance
    let feeRewardPool: FeeRewardPoolL1FakeInstance
    let usdt: ERC20FakeInstance
    let usdc: ERC20FakeInstance

    async function forwardBlockTimestamp(time: number): Promise<void> {
        const timestamp = await feeRewardPool.mock_getCurrentTimestamp()
        const blockNumber = await feeRewardPool.mock_getCurrentBlockNumber()
        const movedBlocks = time / 15 < 1 ? 1 : time / 15

        await feeRewardPool.mock_setBlockTimestamp(timestamp.addn(time))
        await feeRewardPool.mock_setBlockNumber(blockNumber.addn(movedBlocks))
    }

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        tmpRewardPool = addresses[2]

        usdt = await deployErc20Fake(toFullDigit(2000000))
        stakedPerpToken = await deployStakedPerpTokenMock()
        feeRewardPool = await deployFeeRewardPoolL1(usdt.address, stakedPerpToken.address, tmpRewardPool)

        await feeRewardPool.mock_setStakedPerpTokenAddr(admin)
        await usdt.transfer(alice, toFullDigit(2000))
    })

    describe.only("notifyRewardAmount()", () => {
        beforeEach(async () => {
            await stakedPerpToken.mock_setTotalSupply(toFullDigit(ONE_DAY * 10))
        })

        it("first time calling notifyRewardAmount() when totalSupply is 0, should emit event", async () => {
            await stakedPerpToken.mock_setTotalSupply(0)

            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()
            const periodFinish = timestamp.addn(ONE_DAY)

            const rewardAmount = ONE_DAY
            const receipt = await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })
            expectEvent.inTransaction(receipt.tx, feeRewardPool, "RewardTransferred", {
                amount: toFullDigit(rewardAmount),
            })

            // rewardRateInDuration: 86,400 / 86,400 = 1
            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(1))
            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp)
            expect(await feeRewardPool.periodFinish()).to.eq(periodFinish)

            // rewardMultiplier: totalSupply = 0, rewardMultiplier = 0, hence = 0
            expect(await feeRewardPool.rewardMultiplier()).to.eq(0)
        })

        it("first time calling notifyRewardAmount() when totalSupply is not 0", async () => {
            const rewardAmount = ONE_DAY
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            // timeInterval: periodFinish = 0, lastUpdateTime = 0, hence = 0
            // rewardMultiplier: rewardMultiplier = 0, hence 0 + ? * 0 = 0
            expect(await feeRewardPool.rewardMultiplier()).to.eq(0)
        })

        it("second time calling notifyRewardAmount(), the calling time == periodFinish", async () => {
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })

            await forwardBlockTimestamp(ONE_DAY)
            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()

            const rewardAmount = ONE_DAY * 2
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(2))
            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp)

            // lastTimeRewardApplicable() = periodFinish == blockTimestamp()
            // timeInterval = ONE_DAY, totalSupply = 10 * ONE_DAY
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * ONE_DAY ~= 0.1
            expect(await feeRewardPool.rewardMultiplier()).to.eq("99999999999964800")
        })

        it("second time calling notifyRewardAmount(), the calling time > periodFinish", async () => {
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })

            await forwardBlockTimestamp(ONE_DAY + 1)
            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()

            const rewardAmount = ONE_DAY * 2
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(2))
            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp)

            // lastTimeRewardApplicable() = periodFinish
            // timeInterval = ONE_DAY, totalSupply = 10 * ONE_DAY
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * ONE_DAY ~= 0.1
            expect(await feeRewardPool.rewardMultiplier()).to.eq("99999999999964800")
        })

        it("second time calling notifyRewardAmount(), the calling time < periodFinish", async () => {
            // rewardRateInDuration: 86,400 / 86,400 = 1
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })

            await forwardBlockTimestamp(ONE_DAY / 4)
            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()

            const rewardAmount = ONE_DAY * 2
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            // remainingTime: ONE_DAY - ONE_DAY / 4
            // leftover: 1 * (ONE_DAY * 3 / 4)
            // rewardRateInDuration: (ONE_DAY * 2 + (ONE_DAY * 3 / 4) ) / ONE_DAY = 2.75
            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(2.75))
            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp)

            // lastTimeRewardApplicable() = blockTimestamp() == ONE_DAY / 4
            // timeInterval = ONE_DAY / 4, totalSupply = 10 * ONE_DAY
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * (ONE_DAY / 4) ~= 0.025
            expect(await feeRewardPool.rewardMultiplier()).to.eq("24999999999991200")
        })

        it("force error, not called by tmpRewardPool", async () => {
            await expectRevert(feeRewardPool.notifyRewardAmount(toDecimal(100), { from: alice }), "only tmpRewardPool")
        })

        it("force error, token amount is zero", async () => {
            await expectRevert(feeRewardPool.notifyRewardAmount(toDecimal(0), { from: tmpRewardPool }), "invalid input")
        })
    })

    // reward[account] = balanceOf(account).mulD(getRewardMultiplier().subD(stakerRewardMultiplier[account])).addD(rewards[account])
    // rewardMultiplier.addD(rewardRateInDuration.divD(totalSupply()).mulScalar(timeInterval));
    describe("notifyStake()", () => {
        beforeEach(async () => {
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })
            await stakedPerpToken.mock_setTotalSupply(toFullDigit(10000))
        })

        it("alice stakes 10% of the total sPerp", async () => {
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(1000))
            await feeRewardPool.notifyStake(alice)

            // rewardRateInDuration
            // lastUpdateTime
            // rewards
            // rewardMultiplier
            // stakerRewardMultiplier ( == rewardMultiplier)

            // forwardTimestamp to check earned() of alice remains the same
        })

        it("alice stakes 10% & bob stakes 20% of the total sPerp at the same period and the same time", async () => {
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(1000))
            await feeRewardPool.notifyStake(alice)

            // rewardRateInDuration
            // lastUpdateTime
            // rewards
            // rewardMultiplier
            // stakerRewardMultiplier ( == rewardMultiplier)
        })

        it("alice stakes 10% & bob stakes 20% of the total sPerp at the same period but not exactly the same time", async () => {
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(1000))
            await feeRewardPool.notifyStake(alice)

            // because of timeInterval, values of Alice and Bob will be different
            // rewardRateInDuration
            // lastUpdateTime
            // rewards
            // rewardMultiplier
            // stakerRewardMultiplier ( == rewardMultiplier)
        })

        it("alice stakes 10% & bob stakes 20% of the total sPerp at one period and then alice stakes again in the next period", async () => {
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(1000))
            await feeRewardPool.notifyStake(alice)

            // rewardRateInDuration
            // lastUpdateTime
            // rewards
            // rewardMultiplier
            // stakerRewardMultiplier ( == rewardMultiplier)
        })
    })

    describe("withdrawReward()", () => {
        beforeEach(async () => {
            await feeRewardPool.notifyRewardAmount(toDecimal(1000))
        })

        it("withdraw reward in the same period as staking", async () => {
            await feeRewardPool.notifyStake(alice)

            const receipt = await feeRewardPool.withdrawReward()
            expectEvent.inTransaction(receipt.tx, feeRewardPool, "RewardWithdrawn", {
                staker: alice,
                amount: toFullDigit(0),
            })

            // lastUpdateTime
            // rewards = 0
            // rewardMultiplier
            // stakerRewardMultiplier ( == rewardMultiplier)
            // usdt.balanceof(msgSender)
            // check event

            expect(await feeRewardPool.rewards(alice)).to.eq(0)
            expect(await usdt.balanceOf(alice)).to.eq(toFullDigit(1))
        })

        it("withdraw reward in the next period of staking", async () => {
            await feeRewardPool.notifyStake(alice)

            const receipt = await feeRewardPool.withdrawReward()
            expectEvent.inTransaction(receipt.tx, feeRewardPool, "RewardWithdrawn", {
                staker: alice,
                amount: toFullDigit(0),
            })

            // lastUpdateTime
            // rewards = 0
            // rewardMultiplier
            // stakerRewardMultiplier ( == rewardMultiplier)
            // usdt.balanceof(msgSender)
            // check event

            expect(await feeRewardPool.rewards(alice)).to.eq(0)
            expect(await usdt.balanceOf(alice)).to.eq(toFullDigit(1))
        })

        it("force error, rewards is 0", async () => {
            const receipt = await feeRewardPool.withdrawReward()
            expectEvent.inTransaction(receipt.tx, feeRewardPool, "RewardWithdrawn", {
                staker: alice,
                amount: toFullDigit(0),
            })

            expect(await feeRewardPool.rewards(alice)).to.eq(0)
        })
    })

    describe("setDuration()", () => {
        it("duration should be updated", async () => {
            await feeRewardPool.setDuration(toFullDigit(20))
            expect(await feeRewardPool.duration()).to.eq(toFullDigit(20))
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                feeRewardPool.setDuration(20, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, duration is 0", async () => {
            await expectRevert(feeRewardPool.setDuration(0), "invalid input")
        })
    })
})
