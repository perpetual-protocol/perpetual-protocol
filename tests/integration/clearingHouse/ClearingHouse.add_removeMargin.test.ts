import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BigNumber } from "bn.js"
import { expect, use } from "chai"
import { artifacts, web3 } from "hardhat"
import {
    AmmFakeInstance,
    ClearingHouseFakeInstance,
    ClearingHouseViewerInstance,
    ERC20FakeInstance,
    InsuranceFundFakeInstance,
    L2PriceFeedMockInstance,
    RewardsDistributionFakeInstance,
    SupplyScheduleFakeInstance,
    TraderWalletContract,
} from "../../../types/truffle"
import { assertionHelper } from "../../helper/assertion-plugin"
import { Side } from "../../helper/contract"
import { fullDeploy } from "../../helper/deploy"
import { toDecimal, toFullDigit } from "../../helper/number"

use(assertionHelper)

const TraderWallet = artifacts.require("TraderWallet") as TraderWalletContract
const EMPTY_STRING_IN_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"

describe("ClearingHouse add/remove margin Test", () => {
    let addresses: string[]
    let admin: string
    let alice: string
    let bob: string

    let amm: AmmFakeInstance
    let insuranceFund: InsuranceFundFakeInstance
    let quoteToken: ERC20FakeInstance
    let mockPriceFeed!: L2PriceFeedMockInstance
    let rewardsDistribution: RewardsDistributionFakeInstance
    let clearingHouse: ClearingHouseFakeInstance
    let clearingHouseViewer: ClearingHouseViewerInstance
    let supplySchedule: SupplyScheduleFakeInstance

    async function gotoNextFundingTime(): Promise<void> {
        const nextFundingTime = await amm.nextFundingTime()
        await amm.mock_setBlockTimestamp(nextFundingTime)
    }

    async function forwardBlockTimestamp(time: number): Promise<void> {
        const now = await supplySchedule.mock_getCurrentTimestamp()
        const newTime = now.addn(time)
        await rewardsDistribution.mock_setBlockTimestamp(newTime)
        await amm.mock_setBlockTimestamp(newTime)
        await supplySchedule.mock_setBlockTimestamp(newTime)
        await clearingHouse.mock_setBlockTimestamp(newTime)
        const movedBlocks = time / 15 < 1 ? 1 : time / 15

        const blockNumber = new BigNumber(await amm.mock_getCurrentBlockNumber())
        const newBlockNumber = blockNumber.addn(movedBlocks)
        await rewardsDistribution.mock_setBlockNumber(newBlockNumber)
        await amm.mock_setBlockNumber(newBlockNumber)
        await supplySchedule.mock_setBlockNumber(newBlockNumber)
        await clearingHouse.mock_setBlockNumber(newBlockNumber)
    }

    async function approve(account: string, spender: string, amount: number): Promise<void> {
        await quoteToken.approve(spender, toFullDigit(amount, +(await quoteToken.decimals())), { from: account })
    }

    async function transfer(from: string, to: string, amount: number): Promise<void> {
        await quoteToken.transfer(to, toFullDigit(amount, +(await quoteToken.decimals())), { from })
    }

    async function syncAmmPriceToOracle() {
        const marketPrice = await amm.getSpotPrice()
        await mockPriceFeed.setPrice(marketPrice.d)
    }

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        bob = addresses[2]
        carol = addresses[3]
        relayer = addresses[4]

        const contracts = await fullDeploy({ sender: admin })
        metaTxGateway = contracts.metaTxGateway
        amm = contracts.amm
        insuranceFund = contracts.insuranceFund
        quoteToken = contracts.quoteToken
        mockPriceFeed = contracts.priceFeed
        rewardsDistribution = contracts.rewardsDistribution
        stakingReserve = contracts.stakingReserve
        clearingHouse = contracts.clearingHouse
        clearingHouseViewer = contracts.clearingHouseViewer
        supplySchedule = contracts.supplySchedule
        clearingHouse = contracts.clearingHouse

        // Each of Alice & Bob have 5000 DAI
        await quoteToken.transfer(alice, toFullDigit(5000, +(await quoteToken.decimals())))
        await quoteToken.transfer(bob, toFullDigit(5000, +(await quoteToken.decimals())))
        await quoteToken.transfer(insuranceFund.address, toFullDigit(5000, +(await quoteToken.decimals())))

        await amm.setCap(toDecimal(0), toDecimal(0))

        await syncAmmPriceToOracle()
    })

    describe("add/remove margin", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 2000)
            await approve(bob, clearingHouse.address, 2000)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(10), toDecimal(37.5), {
                from: alice,
            })

            const clearingHouseQuoteTokenBalance = await quoteToken.balanceOf(clearingHouse.address)
            expect(clearingHouseQuoteTokenBalance).eq(toFullDigit(60, +(await quoteToken.decimals())))
            const allowance = await quoteToken.allowance(alice, clearingHouse.address)
            expect(allowance).to.eq(toFullDigit(2000 - 60, +(await quoteToken.decimals())))
        })

        it("add margin", async () => {
            const receipt = await clearingHouse.addMargin(amm.address, toDecimal(80), { from: alice })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: alice,
                amm: amm.address,
                amount: toFullDigit(80),
                fundingPayment: "0",
            })
            await expectEvent.inTransaction(receipt.tx, quoteToken, "Transfer", {
                from: alice,
                to: clearingHouse.address,
                value: toFullDigit(80, +(await quoteToken.decimals())),
            })
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(140))
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).to.eq(
                toFullDigit(140),
            )
        })

        it("add margin even if there is no position opened yet", async () => {
            const r = await clearingHouse.addMargin(amm.address, toDecimal(1), { from: bob })
            expectEvent.inTransaction(r.tx, clearingHouse, "MarginChanged")
        })

        it("remove margin", async () => {
            // remove margin 20
            const receipt = await clearingHouse.removeMargin(amm.address, toDecimal(20), {
                from: alice,
            })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: alice,
                amm: amm.address,
                amount: toFullDigit(-20),
                fundingPayment: "0",
            })
            await expectEvent.inTransaction(receipt.tx, quoteToken, "Transfer", {
                from: clearingHouse.address,
                to: alice,
                value: toFullDigit(20, +(await quoteToken.decimals())),
            })

            // 60 - 20
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(40))
            // 60 - 20
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).to.eq(
                toFullDigit(40),
            )
        })

        it("remove margin after pay funding", async () => {
            // given the underlying twap price is 25.5, and current snapShot price is 1600 / 62.5 = 25.6
            await mockPriceFeed.setTwapPrice(toFullDigit(25.5))

            // when the new fundingRate is 10% which means underlyingPrice < snapshotPrice
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.1))

            // remove margin 20
            const receipt = await clearingHouse.removeMargin(amm.address, toDecimal(20), {
                from: alice,
            })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: alice,
                amm: amm.address,
                amount: toFullDigit(-20),
                fundingPayment: toFullDigit(3.75),
            })
        })

        it("force error, remove margin - no enough margin", async () => {
            // margin is 60, try to remove more than 60
            const removedMargin = 61

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(removedMargin), { from: alice }),
                "margin is not enough",
            )
        })

        it("force error, remove margin - no enough margin ratio (4%)", async () => {
            const removedMargin = 36

            // remove margin 36
            // remain margin -> 60 - 36 = 24
            // margin ratio -> 24 / 600 = 4%
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(removedMargin), { from: alice }),
                "Margin ratio not meet criteria",
            )
        })

        it("force error, remove margin - no position opened yet and neither is there any margin", async () => {
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "margin is not enough",
            )
        })

        it("force error, remove margin - no position opened yet but there is margin (edge case)", async () => {
            await clearingHouse.addMargin(amm.address, toDecimal(1), { from: bob })

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "positionSize is 0",
            )
            // NOTE: in this scenario, users have to open a small position to removeMargin
        })
    })
})
