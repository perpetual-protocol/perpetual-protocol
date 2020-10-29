import { web3 } from "@nomiclabs/buidler"
import { expectRevert } from "@openzeppelin/test-helpers"
import { expect } from "chai"
import { RewardsDistributionInstance } from "../../types"
import { deployRewardsDistribution } from "../helper/contract"
import { toDecimal, toFullDigit } from "../helper/number"

describe("RewardsDistributionSpec", () => {
    let accounts: string[]
    let rewardsDistribution: RewardsDistributionInstance

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()
        rewardsDistribution = await deployRewardsDistribution(accounts[1], accounts[2])
    })

    describe("addRewardsDistribution", () => {
        it("add by admin", async () => {
            await rewardsDistribution.addRewardsDistribution(accounts[5], toDecimal(100))
            await rewardsDistribution.addRewardsDistribution(accounts[6], toDecimal(200))

            const recipient0 = await rewardsDistribution.distributions(0)
            expect(recipient0[0]).eq(accounts[5])
            expect(recipient0[1]).eq(toFullDigit(100))

            const recipient1 = await rewardsDistribution.distributions(1)
            expect(recipient1[0]).eq(accounts[6])
            expect(recipient1[1]).eq(toFullDigit(200))
        })
    })

    describe("editRewardsDistribution", () => {
        it("edit by admin", async () => {
            await rewardsDistribution.addRewardsDistribution(accounts[5], toDecimal(100))
            await rewardsDistribution.editRewardsDistribution(0, accounts[6], toDecimal(200))
            const recipient = await rewardsDistribution.distributions(0)
            expect(recipient[0]).eq(accounts[6])
            expect(recipient[1]).eq(toFullDigit(200))
        })

        // expectRevert section
        it("force error, the length of distribution is still 0", async () => {
            await expectRevert(
                rewardsDistribution.editRewardsDistribution(0, accounts[5], toDecimal(200)),
                "index out of bounds",
            )
        })

        it("force error, the index exceeds the current length", async () => {
            await rewardsDistribution.addRewardsDistribution(accounts[5], toDecimal(100))
            await expectRevert(
                rewardsDistribution.editRewardsDistribution(1, accounts[5], toDecimal(200)),
                "index out of bounds",
            )
        })
    })

    describe("removeRewardsDistribution", () => {
        it("remove by admin", async () => {
            await rewardsDistribution.addRewardsDistribution(accounts[5], toDecimal(100))
            await rewardsDistribution.addRewardsDistribution(accounts[6], toDecimal(200))
            await rewardsDistribution.removeRewardsDistribution(0)

            const recipient0 = await rewardsDistribution.distributions(0)
            expect(recipient0[0]).eq(accounts[6])
            expect(recipient0[1]).eq(toFullDigit(200))

            let error
            try {
                await rewardsDistribution.distributions(1)
            } catch (e) {
                error = e
            }
            expect(error).to.exist
        })

        // expectRevert section
        it("force error, the length of distribution is still 0", async () => {
            await expectRevert(rewardsDistribution.removeRewardsDistribution(0), "index out of bounds")
        })

        it("force error, the index exceeds the current length", async () => {
            await rewardsDistribution.addRewardsDistribution(accounts[5], toDecimal(100))
            await expectRevert(rewardsDistribution.removeRewardsDistribution(1), "index out of bounds")
        })
    })
})
