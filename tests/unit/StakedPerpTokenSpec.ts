import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import { FeeRewardPoolMockInstance, PerpTokenInstance, StakedPerpTokenFakeInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployPerpToken, deployStakedPerpToken } from "../helper/contract"
import { deployFeeRewardPoolMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("StakedPerpTokenSpec", () => {
    let admin: string
    let alice: string
    let stakedPerpToken: StakedPerpTokenFakeInstance
    let perpToken: PerpTokenInstance
    let feeRewardPoolMock1: FeeRewardPoolMockInstance
    let feeRewardPoolMock2: FeeRewardPoolMockInstance
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
        feeRewardPoolMock1 = await deployFeeRewardPoolMock()
        feeRewardPoolMock2 = await deployFeeRewardPoolMock()
        stakedPerpToken = await deployStakedPerpToken(perpToken.address, feeRewardPoolMock1.address)

        await perpToken.transfer(alice, toFullDigit(2000))
        await perpToken.approve(stakedPerpToken.address, toFullDigit(2000), { from: alice })
        await perpToken.approve(stakedPerpToken.address, toFullDigit(5000), { from: admin })

        cooldownPeriod = (await stakedPerpToken.COOLDOWN_PERIOD()).toNumber()
    })

    describe("assert ERC20 config", () => {
        it("check name, symbol & decimals", async () => {
            expect(await stakedPerpToken.name()).to.eq("Staked Perpetual")
            expect(await stakedPerpToken.symbol()).to.eq("sPERP")
            expect(await stakedPerpToken.decimals()).to.eq(18)
        })
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
            await expectEvent.inTransaction(receipt.tx, feeRewardPoolMock1, "NotificationReceived")

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

        it("force error, no stakeModule", async () => {
            await stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address)
            await expectRevert(stakedPerpToken.stake(toDecimal(100), { from: alice }), "no stakeModule")
        })
    })

    describe("unstake()", () => {
        it("alice stakes 100 and then unstakes", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })

            await forwardBlockTimestamp(15)

            const blockNumber = await stakedPerpToken.mock_getCurrentBlockNumber()
            const timestamp = await stakedPerpToken.mock_getCurrentTimestamp()
            const receipt = await stakedPerpToken.unstake({ from: alice })
            await expectEvent.inTransaction(receipt.tx, stakedPerpToken, "Unstaked")
            await expectEvent.inTransaction(receipt.tx, feeRewardPoolMock1, "NotificationReceived")

            expect(await stakedPerpToken.stakerCooldown(alice)).to.eq(timestamp.addn(cooldownPeriod))
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
            const receipt = await stakedPerpToken.stake(toDecimal(200), { from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(300))
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1700))

            expectEvent(receipt, "Staked", {
                amount: toFullDigit(300),
            })
        })

        it("alice stakes 100, unstakes and then stakes 200 not in the same block/after cool down period", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await forwardBlockTimestamp(15)
            await stakedPerpToken.unstake({ from: alice })
            await forwardBlockTimestamp(cooldownPeriod * 2)
            const receipt = await stakedPerpToken.stake(toDecimal(200), { from: alice })

            expect(await stakedPerpToken.stakerWithdrawPendingBalance(alice)).to.eq(toFullDigit(0))
            expect(await stakedPerpToken.balanceOf(alice)).to.eq(toFullDigit(300))
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1700))
            expectEvent(receipt, "Staked", {
                amount: toFullDigit(300),
            })
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

        it("force error, no stakeModule", async () => {
            await stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address)
            await expectRevert(stakedPerpToken.unstake({ from: alice }), "no stakeModule")
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

            await forwardBlockTimestamp(cooldownPeriod - 1)
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

        it("force error, alice stakes 100, unstakes and then withdraw twice", async () => {
            await stakedPerpToken.stake(toDecimal(100), { from: alice })
            await stakedPerpToken.unstake({ from: alice })
            await forwardBlockTimestamp(cooldownPeriod)
            await stakedPerpToken.withdraw({ from: alice })
            await expectRevert(stakedPerpToken.withdraw({ from: alice }), "Amount is 0")
        })
    })

    describe("addStakeModule()", () => {
        it("stakeModules should be set", async () => {
            await stakedPerpToken.addStakeModule(feeRewardPoolMock2.address)
            expect(await stakedPerpToken.stakeModules(0)).to.eq(feeRewardPoolMock1.address)
            expect(await stakedPerpToken.stakeModules(1)).to.eq(feeRewardPoolMock2.address)
            expect(await stakedPerpToken.isStakeModuleExisted(feeRewardPoolMock1.address)).to.eq(true)
            expect(await stakedPerpToken.isStakeModuleExisted(feeRewardPoolMock2.address)).to.eq(true)
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                stakedPerpToken.addStakeModule(feeRewardPoolMock1.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, stakeModule is already existed", async () => {
            await expectRevert(stakedPerpToken.addStakeModule(feeRewardPoolMock1.address), "invalid input")
        })

        it("force error, input is zero address", async () => {
            await expectRevert(stakedPerpToken.addStakeModule(EMPTY_ADDRESS), "invalid input")
        })
    })

    describe("removeStakeModule()", () => {
        it("stakeModule should be removed", async () => {
            await stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address)
            expect(await stakedPerpToken.isStakeModuleExisted(feeRewardPoolMock1.address)).to.eq(false)
            expect(await stakedPerpToken.getStakeModuleLength()).to.eq(0)
        })

        it("stakeModules should be removed and can be added again", async () => {
            await stakedPerpToken.addStakeModule(feeRewardPoolMock2.address)
            await stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address)
            await stakedPerpToken.addStakeModule(feeRewardPoolMock1.address)
            expect(await stakedPerpToken.stakeModules(0)).to.eq(feeRewardPoolMock2.address)
            expect(await stakedPerpToken.stakeModules(1)).to.eq(feeRewardPoolMock1.address)
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, stakeModule does not exist", async () => {
            await expectRevert(
                stakedPerpToken.removeStakeModule(feeRewardPoolMock2.address),
                "stakeModule does not exist",
            )
        })

        it("force error, input is zero address", async () => {
            await expectRevert(stakedPerpToken.removeStakeModule(EMPTY_ADDRESS), "stakeModule does not exist")
        })

        it("force error, no stakeModule", async () => {
            await stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address)
            await expectRevert(
                stakedPerpToken.removeStakeModule(feeRewardPoolMock1.address),
                "stakeModule does not exist",
            )
        })
    })
})
