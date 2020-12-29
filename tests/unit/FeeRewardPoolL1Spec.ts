import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { ERC20FakeInstance, FeeRewardPoolL1FakeInstance, StakedPerpTokenMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployErc20Fake, deployFeeRewardPoolL1 } from "../helper/contract"
import { deployStakedPerpTokenMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

const ONE_DAY = 24 * 60 * 60

describe("FeeRewardPoolL1Spec", () => {
    let admin: string
    let alice: string
    let bob: string
    let tmpRewardPool: string
    let stakedPerpToken: StakedPerpTokenMockInstance
    let feeRewardPool: FeeRewardPoolL1FakeInstance
    let usdt: ERC20FakeInstance

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
        bob = addresses[2]
        tmpRewardPool = addresses[3]

        usdt = await deployErc20Fake(toFullDigit(2000000))
        stakedPerpToken = await deployStakedPerpTokenMock()
        feeRewardPool = await deployFeeRewardPoolL1(usdt.address, stakedPerpToken.address, tmpRewardPool)

        await feeRewardPool.mock_setStakedPerpTokenAddr(admin)
        await usdt.transfer(feeRewardPool.address, toFullDigit(20000))
    })

    describe("notifyRewardAmount()", () => {
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

            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp)

            // rewardRateInDuration: 86,400 / 86,400 = 1
            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(1))
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

            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()
            await forwardBlockTimestamp(ONE_DAY)

            const rewardAmount = ONE_DAY * 2
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp.addn(ONE_DAY))

            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(2))

            // lastTimeRewardApplicable() = periodFinish == blockTimestamp()
            // timeInterval = ONE_DAY, totalSupply = 10 * ONE_DAY
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * ONE_DAY ~= 0.1
            expect(await feeRewardPool.rewardMultiplier()).to.eq("99999999999964800")
        })

        it("second time calling notifyRewardAmount(), the calling time > periodFinish", async () => {
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })

            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()
            await forwardBlockTimestamp(ONE_DAY + 1)

            const rewardAmount = ONE_DAY * 2
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp.addn(ONE_DAY + 1))

            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(2))

            // lastTimeRewardApplicable() = periodFinish
            // timeInterval = ONE_DAY, totalSupply = 10 * ONE_DAY
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * ONE_DAY ~= 0.1
            expect(await feeRewardPool.rewardMultiplier()).to.eq("99999999999964800")
        })

        it("second time calling notifyRewardAmount(), the calling time < periodFinish", async () => {
            // rewardRateInDuration: 86,400 / 86,400 = 1
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })

            const timestamp = await feeRewardPool.mock_getCurrentTimestamp()
            await forwardBlockTimestamp(ONE_DAY / 4)

            const rewardAmount = ONE_DAY * 2
            await feeRewardPool.notifyRewardAmount(toDecimal(rewardAmount), { from: tmpRewardPool })

            expect(await feeRewardPool.lastUpdateTime()).to.eq(timestamp.addn(ONE_DAY / 4))

            // remainingTime: ONE_DAY - ONE_DAY / 4
            // leftover: 1 * (ONE_DAY * 3 / 4)
            // rewardRateInDuration: (ONE_DAY * 2 + (ONE_DAY * 3 / 4) ) / ONE_DAY = 2.75
            expect(await feeRewardPool.rewardRateInDuration()).to.eq(toFullDigit(2.75))

            // timeInterval = ONE_DAY / 4
            // totalSupply = 10 * ONE_DAY
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

    describe("notifyStake()", () => {
        beforeEach(async () => {
            await stakedPerpToken.mock_setTotalSupply(toFullDigit(10 * ONE_DAY))
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })
            // rewardRateInDuration: ONE_DAY / ONE_DAY = 1
        })

        it("alice stakes 10% of the total sPerp", async () => {
            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY))
            await feeRewardPool.notifyStake(alice)

            // timeInterval = ONE_DAY / 4
            // totalSupply = 10 * ONE_DAY
            // rewardRateInDuration = 1
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * (ONE_DAY / 4) ~= 0.025
            expect(await feeRewardPool.rewardMultiplier()).to.eq("24999999999991200")

            // balance: ONE_DAY
            // rewardMultiplier ~= 0.025
            // stakerRewardMultiplier(staker) = 0 (during the calculation of rewards, this is not yet modified)
            // rewards(staker) = 0
            // ONE_DAY * 0.025 ~= 21600
            expect(await feeRewardPool.rewards(alice)).to.eq("2159999999999239680000")
            expect(await feeRewardPool.stakerRewardMultiplier(alice)).to.eq("24999999999991200")
        })

        it("alice stakes 10% & bob stakes 20% at the same period and the same time", async () => {
            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY))
            await stakedPerpToken.mock_setBalance(bob, toFullDigit(ONE_DAY * 2))
            await feeRewardPool.notifyStake(alice)
            await feeRewardPool.notifyStake(bob)

            // notifies alice's stake & bob's stake are the same:
            // timeInterval = ONE_DAY / 4
            // totalSupply = 10 * ONE_DAY
            // rewardRateInDuration = 1
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * (ONE_DAY / 4) ~= 0.025
            expect(await feeRewardPool.rewardMultiplier()).to.eq("24999999999991200")

            // alice's rewards:
            // balance: ONE_DAY
            // rewardMultiplier ~= 0.025
            // stakerRewardMultiplier(staker) = 0
            // rewards(staker) = 0
            // ONE_DAY * 0.025 ~= 2160

            // bob's rewards:
            // balance: ONE_DAY * 2
            // the rest is the same as the above
            expect(await feeRewardPool.rewards(alice)).to.eq("2159999999999239680000")
            expect(await feeRewardPool.rewards(bob)).to.eq("4319999999998479360000")

            // stakerRewardMultiplier(staker) = rewardMultiplier
            expect(await feeRewardPool.stakerRewardMultiplier(alice)).to.eq("24999999999991200")
            expect(await feeRewardPool.stakerRewardMultiplier(bob)).to.eq("24999999999991200")
        })

        it("alice stakes 10% & bob stakes 20% at the same period but not exactly the same time", async () => {
            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY))
            await feeRewardPool.notifyStake(alice)

            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(bob, toFullDigit(ONE_DAY * 2))
            await feeRewardPool.notifyStake(bob)

            // timeInterval = ONE_DAY / 2
            // totalSupply = 10 * ONE_DAY
            // rewardRateInDuration = 1
            // rewardMultiplier = 0 + (1 / (10 * ONE_DAY)) * (ONE_DAY / 2) ~= 0.05
            expect(await feeRewardPool.rewardMultiplier()).to.eq("49999999999982400")

            // alice's balances remain the same as the above case
            expect(await feeRewardPool.rewards(alice)).to.eq("2159999999999239680000")
            expect(await feeRewardPool.stakerRewardMultiplier(alice)).to.eq("24999999999991200")

            // bob's rewards:
            // balance: ONE_DAY * 2
            // rewardMultiplier ~= 0.05
            // stakerRewardMultiplier(staker) = 0
            // rewards(staker) = 0
            // ONE_DAY * 0.025 ~= 2160
            expect(await feeRewardPool.rewards(bob)).to.eq("8639999999996958720000")
            expect(await feeRewardPool.stakerRewardMultiplier(bob)).to.eq("49999999999982400")
        })
    })

    describe("notifyRewardAmount() & notifyStake() in multiple periods", () => {
        beforeEach(async () => {
            await stakedPerpToken.mock_setTotalSupply(toFullDigit(10 * ONE_DAY))
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })
            // lastUpdateTime = original value

            // alice stakes 10%
            await forwardBlockTimestamp(ONE_DAY / 4)
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY))
            await feeRewardPool.notifyStake(alice)
            // rewards(alice) ~= 2160
            // rewardMultiplier ~= 0.025
            // lastUpdateTime = original value + ONE_DAY / 4
        })

        it("alice stakes 10% twice in two periods", async () => {
            await forwardBlockTimestamp((ONE_DAY * 3) / 4)
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY * 2), { from: tmpRewardPool })
            // rewardRateInDuration = 2

            // lastUpdateTime = original value + ONE_DAY / 4
            // timeInterval = ONE_DAY * 3 / 4
            // totalSupply = 10 * ONE_DAY
            // rewardRateInDuration = 1 (during the calculation this value is not changed yet)
            // rewardMultiplier ~= 0.025 + (1 / 10 * ONE_DAY) * 3 * ONE_DAY / 4 ~= 0.1
            expect(await feeRewardPool.rewardMultiplier()).to.eq("99999999999964800")

            await forwardBlockTimestamp(ONE_DAY / 5)
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY * 2))
            await feeRewardPool.notifyStake(alice)

            // timeInterval = ONE_DAY / 5
            // totalSupply = 10 * ONE_DAY
            // rewardRateInDuration = 2
            // rewardMultiplier ~= 0.1 + (2 / 10 * ONE_DAY) * ONE_DAY / 5 ~= 0.14
            expect(await feeRewardPool.rewardMultiplier()).to.eq("139999999999950720")

            // balance: ONE_DAY * 2
            // rewardMultiplier ~= 0.14
            // stakerRewardMultiplier(staker) ~= 0.025
            // rewards(staker) ~= 2160
            // ONE_DAY * 2 * (0.14 - 0.025) + 2160 ~= 22032
            expect(await feeRewardPool.rewards(alice)).to.eq("22031999999992244736000")

            expect(await feeRewardPool.stakerRewardMultiplier(alice)).to.eq("139999999999950720")
        })

        // TODO
        it.skip("alice stakes 10% & bob stakes 20% at one period of the same time, and then alice stakes 10% again in the next period", async () => {
            await stakedPerpToken.mock_setBalance(bob, toFullDigit(ONE_DAY * 2))
            await feeRewardPool.notifyStake(bob)

            await forwardBlockTimestamp((ONE_DAY * 3) / 4)
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY * 2), { from: tmpRewardPool })
            // rewardRateInDuration: ONE_DAY * 2 / ONE_DAY = 2

            await forwardBlockTimestamp(ONE_DAY / 5)
            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY * 2))
            await feeRewardPool.notifyStake(alice)
        })
    })

    describe("withdrawReward()", () => {
        beforeEach(async () => {
            await stakedPerpToken.mock_setTotalSupply(toFullDigit(10 * ONE_DAY))
            await feeRewardPool.notifyRewardAmount(toDecimal(ONE_DAY), { from: tmpRewardPool })
        })

        it("alice withdraws reward right after notifyStake()", async () => {
            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY))
            await feeRewardPool.notifyStake(alice)
            // rewards(alice) ~= 2160
            // rewardMultiplier ~= 0.025
            // lastUpdateTime = original value + ONE_DAY / 4

            const receipt = await feeRewardPool.withdrawReward({ from: alice })
            expectEvent.inTransaction(receipt.tx, feeRewardPool, "RewardWithdrawn", {
                staker: alice,
                amount: "2159999999999239680000",
            })
            // lastUpdateTime = original value + ONE_DAY / 4

            expect(await feeRewardPool.rewards(alice)).to.eq(0)
            expect(await usdt.balanceOf(alice)).to.eq("2159999999999239680000")

            // timeInterval = 0
            // rewardMultiplier ~= 0.025 + 0 ~= 0.025
            expect(await feeRewardPool.rewardMultiplier()).to.eq("24999999999991200")
            expect(await feeRewardPool.stakerRewardMultiplier(alice)).to.eq("24999999999991200")
        })

        // TODO
        it.skip("alice & bob withdraw reward of different amount in the same period as staking but not exactly the same time", async () => {
            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(alice, toFullDigit(ONE_DAY))
            await feeRewardPool.notifyStake(alice)

            await forwardBlockTimestamp(ONE_DAY / 4)

            await stakedPerpToken.mock_setBalance(bob, toFullDigit(ONE_DAY * 2))
            await feeRewardPool.notifyStake(bob)

            await forwardBlockTimestamp(ONE_DAY / 4)
        })

        it("force error, rewards is 0", async () => {
            await expectRevert(feeRewardPool.withdrawReward({ from: alice }), "reward is 0")
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
