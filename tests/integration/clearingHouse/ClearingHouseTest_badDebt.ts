import { default as BigNumber } from "bn.js"
import { use } from "chai"
import { web3 } from "hardhat"
import {
    AmmFakeInstance,
    ClearingHouseFakeInstance,
    ERC20FakeInstance,
    InsuranceFundFakeInstance,
    L2PriceFeedMockInstance,
    RewardsDistributionFakeInstance,
    SupplyScheduleFakeInstance,
} from "../../../types/truffle"
import { assertionHelper } from "../../helper/assertion-plugin"
import { Side } from "../../helper/contract"
import { fullDeploy } from "../../helper/deploy"
import { toDecimal, toFullDigit } from "../../helper/number"

use(assertionHelper)

describe("Bad Debt Test", () => {
    let addresses: string[]
    let admin: string

    let amm: AmmFakeInstance
    let insuranceFund: InsuranceFundFakeInstance
    let quoteToken: ERC20FakeInstance
    let mockPriceFeed!: L2PriceFeedMockInstance
    let rewardsDistribution: RewardsDistributionFakeInstance
    let clearingHouse: ClearingHouseFakeInstance
    let supplySchedule: SupplyScheduleFakeInstance

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

    async function syncAmmPriceToOracle() {
        const marketPrice = await amm.getSpotPrice()
        await mockPriceFeed.setPrice(marketPrice.d)
    }

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]

        const contracts = await fullDeploy({ sender: admin })
        amm = contracts.amm
        insuranceFund = contracts.insuranceFund
        quoteToken = contracts.quoteToken
        mockPriceFeed = contracts.priceFeed
        rewardsDistribution = contracts.rewardsDistribution
        clearingHouse = contracts.clearingHouse
        supplySchedule = contracts.supplySchedule

        await quoteToken.transfer(addresses[1], toFullDigit(5000, +(await quoteToken.decimals())))
        await approve(addresses[1], clearingHouse.address, 5000)

        for (let i = 2; i < 20; i++) {
            await quoteToken.transfer(addresses[i], toFullDigit(10, +(await quoteToken.decimals())))
            await approve(addresses[i], clearingHouse.address, 10)
        }
        await quoteToken.transfer(insuranceFund.address, toFullDigit(50000, +(await quoteToken.decimals())))

        await amm.setCap(toDecimal(0), toDecimal(0))

        await syncAmmPriceToOracle()
    })

    it("bad debt simulation", async () => {
        let balanceBefore = new BigNumber("0")
        for (let i = 1; i < 20; i++) {
            balanceBefore = balanceBefore.add(await quoteToken.balanceOf(addresses[i]))
        }
        const spotPriceBefore = new BigNumber((await amm.getSpotPrice()).d)

        console.log(`balanceBefore: ${balanceBefore.toString()}`)
        console.log(`spot price before: ${spotPriceBefore.toString()}`)

        // hacker open small long/short
        for (let i = 2; i < 20; i++) {
            if (i % 2 == 0) {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(10), toDecimal(0), {
                    from: addresses[i],
                })
            } else {
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(10), toDecimal(10), toDecimal(0), {
                    from: addresses[i],
                })
            }
        }

        // hacker drop spot price
        for (let i = 0; i < 5; i++) {
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(10), toDecimal(0), {
                from: addresses[1],
            })
        }

        // hacker close
        for (let i = 2; i < 20; i++) {
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: addresses[i] })
            await forwardBlockTimestamp(1)
        }

        // hacker pump spot price
        while (
            new BigNumber((await clearingHouse.getPosition(amm.address, addresses[1])).size.d)
                .abs()
                .gt(new BigNumber("0"))
        ) {
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: addresses[1] })
        }

        let balanceAfter = new BigNumber("0")
        for (let i = 1; i < 20; i++) {
            balanceAfter = balanceAfter.add(await quoteToken.balanceOf(addresses[i]))
        }
        const spotPriceAfter = new BigNumber((await amm.getSpotPrice()).d)

        console.log(`balanceAfter: ${balanceAfter.toString()}`)
        console.log(`spot price before: ${spotPriceAfter.toString()}`)
        console.log(`bad debt: ${balanceAfter.sub(balanceBefore).toString()}`)

        expect(balanceAfter.gt(balanceBefore))
        expect(spotPriceAfter.sub(new BigNumber("1")).eq(spotPriceBefore))
    })
})
