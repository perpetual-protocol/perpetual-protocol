import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { expect } from "chai"
import {
    MinterInstance,
    PerpTokenInstance,
    RewardsDistributionFakeInstance,
    SupplyScheduleFakeInstance,
} from "types/truffle"
import { fullDeploy } from "../helper/deploy"
import { toDecimal, toFullDigit } from "../helper/number"

describe("PerpToken Test", () => {
    let addresses: string[]
    let admin: string
    let alice: string
    let perpToken: PerpTokenInstance
    let minter: MinterInstance
    let supplySchedule: SupplyScheduleFakeInstance
    let rewardsDistribution!: RewardsDistributionFakeInstance

    const perpInflationRate = toFullDigit(0.005)
    const perpDecayRate = toFullDigit(0.01)
    const mintDuration = new BN(7 * 24 * 60 * 60) // 7 days
    const supplyDecayPeriod = new BN(7 * 24 * 60 * 60 * 209) // 209 weeks
    const perpInitSupply = toFullDigit(100_000_000) // 100M

    async function forwardBlockTimestamp(time: number): Promise<void> {
        const now = await supplySchedule.mock_getCurrentTimestamp()
        await supplySchedule.mock_setBlockTimestamp(now.addn(time))
    }

    async function gotoNextMintTime(): Promise<void> {
        const mintDuration = await supplySchedule.mintDuration()
        await forwardBlockTimestamp(mintDuration.toNumber())
    }

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        const contracts = await fullDeploy({
            sender: admin,
            quoteTokenAmount: toFullDigit(2000000),
            perpInitSupply,
            perpDecayRate,
            perpRewardVestingPeriod: new BN(0),
            perpInflationRate,
            tollRatio: toFullDigit(0.05),
            spreadRatio: toFullDigit(0.05),
        })
        perpToken = contracts.perpToken
        supplySchedule = contracts.supplySchedule
        rewardsDistribution = contracts.rewardsDistribution
        minter = contracts.minter

        await forwardBlockTimestamp(0)
    })

    describe("mintReward", () => {
        it("mintReward too early", async () => {
            await expectRevert(minter.mintReward(), "no supply is mintable")
        })

        it("mintReward success", async () => {
            await forwardBlockTimestamp(mintDuration.toNumber())
            const receipt = await minter.mintReward()

            // 100m * 0.5%
            expectEvent(receipt, "PerpMinted", {
                amount: toFullDigit(500000),
            })
        })

        it("mintReward late but still success", async () => {
            await forwardBlockTimestamp(mintDuration.toNumber() * 2)
            const receipt = await minter.mintReward()

            // 100m * 0.5%
            expectEvent(receipt, "PerpMinted", {
                amount: toFullDigit(500000),
            })
        })

        it("mintReward and distribute to an invalid rewardRecipient", async () => {
            const chad = addresses[10]
            await rewardsDistribution.addRewardsDistribution(chad, toDecimal(1))
            await forwardBlockTimestamp(mintDuration.toNumber())
            await minter.mintReward()
            expect(await perpToken.balanceOf(chad)).eq(toFullDigit(1))
        })

        it("mintReward", async () => {
            const supply = await perpToken.totalSupply()
            await gotoNextMintTime()

            const receipt = await minter.mintReward({ from: admin })
            expectEvent(receipt, "PerpMinted", {
                amount: supply.muln(5).divn(1000),
            })
            const newSupply = await perpToken.totalSupply()

            // should be 100_500_000
            expect(newSupply).to.eq(toFullDigit(100500000))
        })

        it("mintReward twice too early", async () => {
            await gotoNextMintTime()
            await minter.mintReward()

            const nextMintTime = await supplySchedule.nextMintTime()
            await supplySchedule.mock_setBlockTimestamp(nextMintTime.subn(1))

            await expectRevert(minter.mintReward(), "no supply is mintable")
        })

        it("mintReward twice", async () => {
            await gotoNextMintTime()
            await minter.mintReward()

            await gotoNextMintTime()
            await minter.mintReward()

            const newSupply = await perpToken.totalSupply()

            // first minted result: 100_500_000,
            // inflation rate after first minted, 0.5% x (1 - 1%) = 0.495%
            // 100_500_000 x 100.495% = 100_998_747.5 * 10**18
            expect(newSupply).to.eq(toFullDigit(100997475))
        })

        it("mintReward at 4 years later", async () => {
            const now = await supplySchedule.mock_getCurrentTimestamp()
            await supplySchedule.mock_setBlockTimestamp(now.add(supplyDecayPeriod))
            const receipt = await minter.mintReward()

            // 100M * 0.047497% ~= 47497
            expectEvent(receipt, "PerpMinted", {
                amount: "47497069730730000000000",
            })
        })

        it("not reach next mintable time", async () => {
            const supply = await perpToken.totalSupply()

            const nextMintTime = await supplySchedule.nextMintTime()
            await supplySchedule.mock_setBlockTimestamp(nextMintTime.subn(1))

            await expectRevert(minter.mintReward(), "no supply is mintable")

            const newSupply = await perpToken.totalSupply()
            expect(newSupply).to.eq(supply)
        })
    })
})
