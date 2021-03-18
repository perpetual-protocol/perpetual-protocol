import { web3 } from "hardhat"
import { expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { expect } from "chai"
import { MinterInstance, PerpTokenMockInstance, SupplyScheduleFakeInstance } from "../../types/truffle"
import { deployMinter, deploySupplySchedule } from "../helper/contract"
import { deployPerpTokenMock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

// skip, won't be in v1
describe.skip("Supply Schedule Unit Test", () => {
    let admin: string
    let alice: string
    let perpToken: PerpTokenMockInstance
    let supplySchedule: SupplyScheduleFakeInstance
    let minter: MinterInstance

    const inflationRate = toFullDigit(0.01)
    const decayRate = toFullDigit(0.01)
    const mintDuration = new BN(7 * 24 * 60 * 60) // 7 days
    const supplyDecayPeriod = new BN(7 * 24 * 60 * 60 * 209) // 209 weeks

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        perpToken = await deployPerpTokenMock()
        minter = await deployMinter(perpToken.address)
        supplySchedule = await deploySupplySchedule(minter.address, inflationRate, decayRate, mintDuration)
    })

    async function gotoNextMintTime(): Promise<void> {
        const nextMintTime = await supplySchedule.nextMintTime()
        await supplySchedule.mock_setBlockTimestamp(nextMintTime)
    }

    describe("isMintable", () => {
        it("is not mintable before start", async () => {
            expect(await supplySchedule.isMintable()).be.false
        })

        it("is not mintable before start", async () => {
            await supplySchedule.startSchedule()
            expect(await supplySchedule.isMintable()).be.false
            await gotoNextMintTime()
            expect(await supplySchedule.isMintable()).be.true
        })
    })

    describe("startSchedule", async () => {
        it("can't start by account which is not owner", async () => {
            await expectRevert(
                supplySchedule.startSchedule({ from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("start after a while", async () => {
            expect(await supplySchedule.supplyDecayEndTime()).eq(0)
            await supplySchedule.startSchedule()
            const now = await supplySchedule.mock_getCurrentTimestamp()
            const supplyDecayEndTime = now.add(supplyDecayPeriod)
            expect(await supplySchedule.supplyDecayEndTime()).eq(supplyDecayEndTime)
        })
    })

    describe("mintableSupply", () => {
        it("zero when it's not mintable", async () => {
            expect(await supplySchedule.mintableSupply()).eq(0)
        })

        it("based on inflationRate before decay end", async () => {
            await supplySchedule.startSchedule()
            await gotoNextMintTime()
            await perpToken.setTotalSupply(toFullDigit(100))

            // 100 * 1% = 1
            expect(await supplySchedule.mintableSupply()).eq(toFullDigit(1))
        })

        it("will keeps the fixed inflationRate after decay end", async () => {
            await supplySchedule.startSchedule()
            const now = await supplySchedule.mock_getCurrentTimestamp()
            const supplyDecayEndTime = now.add(supplyDecayPeriod)
            await supplySchedule.mock_setBlockTimestamp(supplyDecayEndTime)
            await perpToken.setTotalSupply(toFullDigit(100))

            // 100 * 0.04749% ~= 0.04749
            expect(await supplySchedule.mintableSupply()).eq("47497069730730000")
        })
    })
})
