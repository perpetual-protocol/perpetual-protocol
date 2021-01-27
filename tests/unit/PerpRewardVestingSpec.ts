import { web3 } from "@nomiclabs/buidler"
import { expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { use } from "chai"
import { PerpRewardVestingFakeInstance, PerpTokenInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployPerpRewardVesting, deployPerpToken } from "../helper/contract"
import { toFullDigit, toFullDigitStr } from "../helper/number"

use(assertionHelper)

describe("PerpRewardVestingSpec", () => {
    const RANDOM_BYTES32_1 = "0x7c1b1e7c2eaddafdf52250cba9679e5b30014a9d86a0e2af17ec4cee24a5fc80"
    const RANDOM_BYTES32_2 = "0xb6801f31f93d990dfe65d67d3479c3853d5fafd7a7f2b8fad9e68084d8d409e0"
    const RANDOM_BYTES32_3 = "0x43bd90E4CC93D6E40580507102Cc7B1Bc8A25284a7f2b8fad9e68084d8d409e0"
    let admin: string
    let alice: string
    let bob: string
    let perpRewardVesting: PerpRewardVestingFakeInstance
    let perpToken: PerpTokenInstance
    let vestingPeriod: BN

    async function forwardBlockTimestamp(time: number): Promise<void> {
        const timestamp = await perpRewardVesting.mock_getCurrentTimestamp()
        const blockNumber = await perpRewardVesting.mock_getCurrentBlockNumber()
        const movedBlocks = time / 15 < 1 ? 1 : time / 15

        await perpRewardVesting.mock_setBlockTimestamp(timestamp.addn(time))
        await perpRewardVesting.mock_setBlockNumber(blockNumber.addn(movedBlocks))
    }

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        bob = addresses[2]

        perpToken = await deployPerpToken(toFullDigit(2000000))
        perpRewardVesting = await deployPerpRewardVesting(perpToken.address)
        // 12 * 7 * 24 * 60 * 60 = 7,257,600
        vestingPeriod = new BN(7257600)

        await perpToken.approve(perpRewardVesting.address, toFullDigit(2000000), { from: admin })
    })

    describe("seedAllocations()", () => {
        it("verify balances after seeding", async () => {
            const timestamp = (await perpRewardVesting.mock_getCurrentTimestamp()).addn(86400 * 7 * 12)
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })

            expect(await perpToken.balanceOf(admin)).to.eq(toFullDigit(1000000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(1000000))
            expect(await perpRewardVesting.weekMerkleRoots(new BN(1))).to.eq(RANDOM_BYTES32_1)
            expect(await perpRewardVesting.merkleRootTimestampMap(new BN(1))).to.eq(timestamp)
            expect(await perpRewardVesting.merkleRootIndexes(new BN(0))).to.eq(new BN(1))
        })
    })

    describe("claimWeek()", () => {
        it("alice claims her own share", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                from: alice,
            })

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(500000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(500000))
            expect(await perpRewardVesting.claimed(new BN(1), alice)).to.eq(true)
        })

        it("admin claims alice's share", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                from: admin,
            })

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(500000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(500000))
            expect(await perpRewardVesting.claimed(new BN(1), alice)).to.eq(true)
        })

        it("alice & bob both claim their shares", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                from: alice,
            })

            await perpRewardVesting.claimWeek(bob, new BN(1), toFullDigit(300000), [RANDOM_BYTES32_1], {
                from: bob,
            })

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(500000))
            expect(await perpToken.balanceOf(bob)).to.eq(toFullDigit(300000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(200000))
            expect(await perpRewardVesting.claimed(new BN(1), alice)).to.eq(true)
            expect(await perpRewardVesting.claimed(new BN(1), bob)).to.eq(true)
        })

        it("there are three allocations and alice claims two of them", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(3), RANDOM_BYTES32_1, toFullDigit(600000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(5), RANDOM_BYTES32_3, toFullDigit(700000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                from: alice,
            })

            await perpRewardVesting.claimWeek(alice, new BN(5), toFullDigit(700000), [RANDOM_BYTES32_3], {
                from: alice,
            })

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1200000))
            expect(await perpRewardVesting.claimed(new BN(3), alice)).to.eq(false)

            await perpRewardVesting.claimWeek(alice, new BN(3), toFullDigit(600000), [RANDOM_BYTES32_2], {
                from: alice,
            })

            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(1800000))
        })

        it("force error, invalid claim, claim not yet available", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(60)

            await expectRevert(
                perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                    from: alice,
                }),
                "Invalid claim",
            )
        })

        it("force error, invalid claim, input week is invalid", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await expectRevert(
                perpRewardVesting.claimWeek(alice, new BN(0), toFullDigit(500000), [RANDOM_BYTES32_1], {
                    from: alice,
                }),
                "Invalid claim",
            )
        })

        it("force error, claiming twice", async () => {
            await perpRewardVesting.seedAllocations(new BN(1), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                from: alice,
            })

            await expectRevert(
                perpRewardVesting.claimWeek(alice, new BN(1), toFullDigit(500000), [RANDOM_BYTES32_1], {
                    from: alice,
                }),
                "Claimed already",
            )
        })

        // we do not verify if the claimed amount is valid or not; we suppose this is verified by MerkleRedeemUpgradeSafe.sol
        it.skip("force error, claimed amount larger than the available quota", async () => {})
    })

    describe("claimWeeks()", () => {
        // when testing claimWeeks(), input all inputs as strings s.t. Claims[] will not cause error
        it("alice claims her two shares", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_2, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            await perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice })
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(200000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(1300000))
            expect(await perpRewardVesting.claimed("2", alice)).to.eq(true)
            expect(await perpRewardVesting.claimed("7", alice)).to.eq(true)
        })

        it("admin claims alice's two shares", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_2, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            await perpRewardVesting.claimWeeks(alice, claimsArr, { from: admin })
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(200000))
            expect(await perpRewardVesting.claimed("2", alice)).to.eq(true)
            expect(await perpRewardVesting.claimed("7", alice)).to.eq(true)
        })

        it("alice & bob both claim their three shares", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(5), RANDOM_BYTES32_2, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_3, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "5",
                    balance: toFullDigitStr(150000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(200000),
                    merkleProof: [RANDOM_BYTES32_3],
                },
            ]

            await perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice })
            await perpRewardVesting.claimWeeks(bob, claimsArr, { from: bob })
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(450000))
            expect(await perpToken.balanceOf(bob)).to.eq(toFullDigit(450000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(1100000))
        })

        it("alice & bob both claim two of their three shares", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(5), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_3, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            const aliceClaimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "5",
                    balance: toFullDigitStr(150000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            const bobClaimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(200000),
                    merkleProof: [RANDOM_BYTES32_3],
                },
            ]

            await perpRewardVesting.claimWeeks(alice, aliceClaimsArr, { from: alice })
            await perpRewardVesting.claimWeeks(bob, bobClaimsArr, { from: bob })
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(250000))
            expect(await perpToken.balanceOf(bob)).to.eq(toFullDigit(300000))
            expect(await perpToken.balanceOf(perpRewardVesting.address)).to.eq(toFullDigit(1450000))
            expect(await perpRewardVesting.claimed("7", alice)).to.eq(false)
            expect(await perpRewardVesting.claimed("5", bob)).to.eq(false)
        })

        it("force error, alice has two shares and both are not yet available", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(60)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_2, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(60)

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            await expectRevert(perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice }), "Invalid claim")
        })

        it("force error, alice has three shares and the latest one is not yet available", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(5), RANDOM_BYTES32_2, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_3, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(30)

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "5",
                    balance: toFullDigitStr(150000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(200000),
                    merkleProof: [RANDOM_BYTES32_3],
                },
            ]

            await expectRevert(perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice }), "Invalid claim")
        })

        it("force error, claimWeeks() twice", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_2, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            await perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice })
            await expectRevert(perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice }), "Claimed already")
        })

        it("force error, claiming twice, first claimWeek() then claimWeeks()", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_2, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            await perpRewardVesting.claimWeek(alice, new BN(2), toFullDigit(100000), [RANDOM_BYTES32_1], {
                from: alice,
            })

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "6",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            await expectRevert(perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice }), "Claimed already")
        })

        it("force error, claiming twice, first claimWeeks() then claimWeek()", async () => {
            await perpRewardVesting.seedAllocations(new BN(2), RANDOM_BYTES32_1, toFullDigit(500000), { from: admin })
            await forwardBlockTimestamp(30)

            await perpRewardVesting.seedAllocations(new BN(7), RANDOM_BYTES32_2, toFullDigit(1000000), { from: admin })
            await forwardBlockTimestamp(Number(vestingPeriod))

            const claimsArr = [
                {
                    week: "2",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_1],
                },
                {
                    week: "7",
                    balance: toFullDigitStr(100000),
                    merkleProof: [RANDOM_BYTES32_2],
                },
            ]

            await perpRewardVesting.claimWeeks(alice, claimsArr, { from: alice })
            await expectRevert(
                perpRewardVesting.claimWeek(alice, new BN(2), toFullDigit(100000), [RANDOM_BYTES32_1], {
                    from: alice,
                }),
                "Claimed already",
            )
        })
    })
})
