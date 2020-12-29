import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import { FeeRewardPoolMockInstance, PerpTokenInstance, StakedPerpTokenFakeInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployPerpToken, deployStakedPerpToken } from "../helper/contract"
import { deployFeeRewardPoolMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

describe.only("StakedPerpTokenSpec", () => {
    let admin: string
    let alice: string
    let stakedPerpToken: StakedPerpTokenFakeInstance
    let perpToken: PerpTokenInstance
    let feeRewardPoolMock: FeeRewardPoolMockInstance
    let cooldownPeriod: number

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
        feeRewardPoolMock = await deployFeeRewardPoolMock()
        stakedPerpToken = await deployStakedPerpToken(perpToken.address, feeRewardPoolMock.address)

        await perpToken.transfer(alice, toFullDigit(2000))
        await perpToken.approve(stakedPerpToken.address, toFullDigit(2000), { from: alice })
        await perpToken.approve(stakedPerpToken.address, toFullDigit(5000), { from: admin })

        cooldownPeriod = (await stakedPerpToken.COOLDOWN_PERIOD()).toNumber()
    })

    describe("stake()", () => {
        it("alice stakes 100; her balance of sPerp should increase and event be fired", async () => {
            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            const receipt = await stakedPerpToken.stake(toDecimal(100), { from: alice })

            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(100))
            await expectEvent.inTransaction(receipt.tx, stakedPerpToken, "Staked")
            await expectEvent.inTransaction(receipt.tx, feeRewardPoolMock, "NotificationReceived")

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1900))
        })

        it("alice stakes 100 and then stakes 400", async () => {
            const prevBlockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            await stakedPerpToken.stake(toDecimal(400), { from: alice })
            expect(await stakedPerpToken.balanceOfAt(alice, prevBlockNumber)).to.eq(toFullDigit(100))

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(500))
            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(500))

            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(500))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(500))

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1500))
        })

        it("alice stakes 100 & admin stakes 300 in the same block", async () => {
            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await stakedPerpToken.stake(toDecimal(300), { from: admin })

            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.balanceOf(admin)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.balanceOfAt(admin, blockNumber)).to.eq(toFullDigit(300))

            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(400))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(400))
        })

        it("alice stakes 100 and after one block admin stakes 300", async () => {
            const blockNumberOfAlice = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumberOfAdmin = await stakedPerpToken.mock_getCurrentBlockNumber()
            await stakedPerpToken.stake(toDecimal(300), { from: admin })

            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumberOfAlice)).to.eq(toFullDigit(100))
            expect(await stakedPerpToken.balanceOfAt(alice, blockNumberOfAdmin)).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.balanceOf(admin)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.balanceOfAt(admin, blockNumberOfAdmin)).to.eq(toFullDigit(300))

            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(400))
            expect(await stakedPerpToken.totalSupplyAt(blockNumberOfAdmin)).to.eq(toFullDigit(400))
        })

        it("force error, amount is zero", async () => {
            await expectRevert(stakedPerpToken.stake(toDecimal(0), { from: alice }), "Amount is 0")
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
            await expectEvent.inTransaction(receipt.tx, stakedPerpToken, "Unstaked")
            await expectEvent.inTransaction(receipt.tx, feeRewardPoolMock, "NotificationReceived")

            expect(await stakedPerpToken.stakerCooldown(alice)).to.eq(blockNumber.addn(cooldownPeriod))
            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(100))

            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(0))

            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(0))

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1900))
        })

        it("alice stakes 100, 200 and then unstakes", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(300))

            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(0))

            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(0))

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1700))
        })

        it("alice stakes 100, 200, unstakes and then admin stakes 300", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.stake(toDecimal(300), { from: admin })

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.stakerWithdrawPendingBalance(admin)).to.eq(toFullDigit(0))

            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOf(admin)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.totalSupply()).to.eq(toFullDigit(300))

            expect(await stakedPerpToken.balanceOfAt(alice, blockNumber)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOfAt(admin, blockNumber)).to.eq(toFullDigit(300))
            expect(await stakedPerpToken.totalSupplyAt(blockNumber)).to.eq(toFullDigit(300))

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1700))
        })

        it("alice stakes 100, unstakes and then stakes 200 in the same block", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })
            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(300))
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1700))
        })

        it("alice stakes 100, unstakes and then stakes 200 not in the same block/after cool down period", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })
            await forwardBlockTimestamp(cooldownPeriod * 2)
            await stakedPerpToken.stake(toDecimal(200), { from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(300))
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1700))
        })

        it("force error, alice unstakes and then unstakes again", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await stakedPerpToken.unstake({ from: alice })

            await forwardBlockTimestamp(15)
            await expectRevert(stakedPerpToken.unstake({ from: alice }), "Need to withdraw first")
        })

        it("force error, alice unstakes without previous staking", async () => {
            await expectRevert(stakedPerpToken.unstake({ from: alice }), "Amount is 0")
        })
    })

    describe("withdraw()", () => {
        it("alice stakes 100, unstakes and then withdraw", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })

            await forwardBlockTimestamp(15 * cooldownPeriod)
            const receipt = await stakedPerpToken.withdraw({ from: alice })
            await expectEvent.inTransaction(receipt.tx, stakedPerpToken, "Withdrawn")

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.stakerCooldown(alice)).to.eq(toFullDigit(0))

            // alice should have 0 sPERP
            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(0))
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(2000))
        })

        it("force error, alice stakes 100, unstakes and then withdraw within cooling down period", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })

            await forwardBlockTimestamp(15 * cooldownPeriod - 1)
            await expectRevert(stakedPerpToken.withdraw({ from: alice }), "Still in cooldown")
        })

        it("force error, alice withdraw without previous staking", async () => {
            await expectRevert(stakedPerpToken.withdraw({ from: alice }), "Amount is 0")
        })

        it("force error, alice withdraw without previous unstaking", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await forwardBlockTimestamp(15 * cooldownPeriod)
            await expectRevert(stakedPerpToken.withdraw({ from: alice }), "Amount is 0")
        })
    })
})
