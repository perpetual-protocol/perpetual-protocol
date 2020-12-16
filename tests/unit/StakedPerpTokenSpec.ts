import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { PerpTokenInstance, RewardPoolMockInstance, StakedPerpTokenFakeInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployPerpToken, deployStakedPerpToken } from "../helper/contract"
import { deployRewardPoolMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

describe.only("StakedPerpTokenSpec", () => {
    let admin: string
    let alice: string
    let stakedPerpToken: StakedPerpTokenFakeInstance
    let perpToken: PerpTokenInstance
    let rewardPoolMock: RewardPoolMockInstance

    async function forwardBlockTimestamp(time: number): Promise<void> {
        const timestamp = await stakedPerpToken.mock_getCurrentTimestamp()
        const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
        const movedBlocks = time / 15 < 1 ? 1 : time / 15

        await stakedPerpToken.mock_setBlockTimestamp(timestamp.addn(time))
        await stakedPerpToken.mock_setBlockNumber(blockNumber.addn(movedBlocks))
    }

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        perpToken = await deployPerpToken(toFullDigit(2000000))
        rewardPoolMock = await deployRewardPoolMock()
        stakedPerpToken = await deployStakedPerpToken(perpToken.address, rewardPoolMock.address)

        await perpToken.transfer(alice, toFullDigit(2000))
        await perpToken.approve(stakedPerpToken.address, toFullDigit(2000), { from: alice })
        await perpToken.transfer(alice, toFullDigit(5000))
        await perpToken.approve(stakedPerpToken.address, toFullDigit(5000), { from: admin })
    })

    describe("stake()", () => {
        it("alice stakes 100", async () => {
            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            const receipt = await stakedPerpToken.stake(toDecimal(100), { from: alice })

            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(100))
            await expectEvent.inTransaction(receipt.tx, stakedPerpToken, "Stake")
            await expectEvent.inTransaction(receipt.tx, rewardPoolMock, "NotificationReceived")
        })

        it("alice stakes 100 and then stakes 400", async () => {
            const prevBlockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(400), { from: alice })

            expect(await stakedPerpToken.balanceOfAt(alice, prevBlockNumber)).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(500))
            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(500))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(500))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(500))
        })

        it("alice stakes 100 & admin stakes 300 in the same block", async () => {
            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await stakedPerpToken.stake(toDecimal(300), { from: admin })

            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.latestBalance(admin)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.balanceOfAt(admin, blockNumber)).to.eq(toFullDigit(300))

            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(400))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(400))
        })

        it("alice stakes 100 and after one block admin stakes 300", async () => {
            const blockNumberOfAlice = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumberOfAdmin = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(300), { from: admin })

            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumberOfAlice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumberOfAdmin)).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.latestBalance(admin)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.balanceOfAt(admin, blockNumberOfAdmin)).to.eq(toFullDigit(300))

            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(400))
            expect(await stakedPerpToken.totalSupplyAt(blockNumberOfAdmin)).to.eq(toFullDigit(400))
        })

        it("force error, amount is zero", async () => {
            await expectRevert(stakedPerpToken.stake(toDecimal(0), { from: alice }), "Amount is 0.")
        })

        it("force error, balance is insufficient", async () => {
            await expectRevert(
                stakedPerpToken.stake(toDecimal(6000), { from: alice }),
                "DecimalERC20: transferFrom failed",
            )
        })
    })

    describe("unstake()", () => {
        it("alice stakes 100 and then unstakes", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            const receipt = await stakedPerpToken.unstake({ from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(0))
            await expectEvent.inTransaction(receipt.tx, stakedPerpToken, "Unstake")
            await expectEvent.inTransaction(receipt.tx, rewardPoolMock, "NotificationReceived")
        })

        it("alice stakes 100, 200 and then unstakes", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.unstake({ from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(0))
        })

        it("alice stakes 100, 200, unstakes and then admin stakes 300", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            await forwardBlockTimestamp(15)

            await stakedPerpToken.unstake({ from: alice })

            await forwardBlockTimestamp(15)

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(300), { from: admin })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.stakerWithdrawPendingBalance(admin)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.latestBalance(admin)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOfAt(admin, blockNumber)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(300))
        })

        it("force error, alice stakes 100, unstakes and then stakes 400", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.unstake({ from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.latestBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.latestTotalSupply()).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(0))
        })

        it("force error, alice unstakes and then unstakes again", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await stakedPerpToken.unstake({ from: alice })
            await expectRevert(stakedPerpToken.unstake({ from: alice }), "Still in cooldown.")

            await forwardBlockTimestamp(15)
            await expectRevert(stakedPerpToken.unstake({ from: alice }), "Still in cooldown.")
        })

        it("force error, alice unstakes without previous staking", async () => {
            await expectRevert(stakedPerpToken.unstake({ from: alice }), "Amount is 0.")
        })
    })

    describe.skip("withdraw()", () => {
        it("", async () => {
            await expectRevert(stakedPerpToken, "no vested reward or fee")
        })
    })
})
