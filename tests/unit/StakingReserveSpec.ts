import { web3 } from "hardhat"
import { expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { PerpTokenMockInstance, StakingReserveInstance } from "../../types/truffle"
import { deployStakingReserve } from "../helper/contract"
import { deployPerpTokenMock } from "../helper/mockContract"

// skip, won't be in v1
describe.skip("StakingReserve Spec", () => {
    let admin: string
    let alice: string
    let perpToken: PerpTokenMockInstance
    let clearingHouse: string
    let stakingReserve: StakingReserveInstance
    let vestingPeriod: number

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        clearingHouse = addresses[2]
        const supplyScheduleMock = addresses[2]
        vestingPeriod = 1

        perpToken = await deployPerpTokenMock()
        stakingReserve = await deployStakingReserve(
            perpToken.address,
            supplyScheduleMock,
            clearingHouse,
            new BN(vestingPeriod),
        )
        await stakingReserve.setRewardsDistribution(admin)
    })

    describe("claimFeesAndVestedReward", () => {
        it("can't claim if there's no reward", async () => {
            await expectRevert(stakingReserve.claimFeesAndVestedReward(), "no vested reward or fee")
        })
    })
})
