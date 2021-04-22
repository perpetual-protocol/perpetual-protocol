import { web3 } from "hardhat"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import {
    ChainlinkL1MockInstance,
    ClearingHouseMockInstance,
    KeeperRewardL1Instance,
    KeeperRewardL2Instance,
    PerpTokenInstance,
} from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployL1KeeperReward, deployL2KeeperReward, deployPerpToken } from "../helper/contract"
import { deployChainlinkL1Mock, deployClearingHouseMock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

describe("Keeper reward L1/L2 Spec", () => {
    let addresses: string[]
    let admin: string
    let fakeAmm: string
    let alice: string
    let chainlinkL1Mock!: ChainlinkL1MockInstance
    let clearingHouseMock!: ClearingHouseMockInstance
    let KeeperRewardL1: KeeperRewardL1Instance
    let KeeperRewardL2: KeeperRewardL2Instance
    let perpToken: PerpTokenInstance
    const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        fakeAmm = addresses[1]
        alice = addresses[2]

        addresses = await web3.eth.getAccounts()
        chainlinkL1Mock = await deployChainlinkL1Mock()
        clearingHouseMock = await deployClearingHouseMock()
        perpToken = await deployPerpToken(toFullDigit(1000))
        KeeperRewardL1 = await deployL1KeeperReward(perpToken.address)
        KeeperRewardL2 = await deployL2KeeperReward(perpToken.address)
    })

    // ClearingHouse
    // 3e09fa10  =>  payFunding(address)
    // 36405257  =>  settlePosition(address)
    // ChainlinkL1
    // f463e18e  =>  updateLatestRoundData(bytes32)

    describe("KeeperRewardBase", () => {
        it("setKeeperFunction, set single task", async () => {
            await KeeperRewardL1.setKeeperFunctions(["0x3e09fa10"], [clearingHouseMock.address], [toFullDigit(1)])

            const task = await KeeperRewardL1.tasksMap("0x3e09fa10")
            expect(task[0]).eq(clearingHouseMock.address)
            expect(task[1]).eq(toFullDigit(1))
        })

        it("setKeeperFunction, set multi tasks", async () => {
            await KeeperRewardL1.setKeeperFunctions(
                ["0x3e09fa10", "0x36405257", "0xf463e18e"],
                [clearingHouseMock.address, clearingHouseMock.address, chainlinkL1Mock.address],
                [toFullDigit(1), toFullDigit(5), toFullDigit(10)],
            )

            const task0 = await KeeperRewardL1.tasksMap("0x3e09fa10")
            expect(task0[0]).eq(clearingHouseMock.address)
            expect(task0[1]).eq(toFullDigit(1))

            const task2 = await KeeperRewardL1.tasksMap("0xf463e18e")
            expect(task2[0]).eq(chainlinkL1Mock.address)
            expect(task2[1]).eq(toFullDigit(10))
        })

        it("setKeeperFunction, can set empty contract address", async () => {
            await KeeperRewardL1.setKeeperFunctions(
                ["0x3e09fa10", "0x36405257"],
                [clearingHouseMock.address, EMPTY_ADDRESS],
                [toFullDigit(1), toFullDigit(5)],
            )
            const task = await KeeperRewardL1.tasksMap("0x36405257")
            expect(task[0]).eq(EMPTY_ADDRESS)
        })

        it("force error, setKeeperFunction, set 3 func selectors, 3 addresses but 2 amount", async () => {
            await expectRevert(
                KeeperRewardL1.setKeeperFunctions(
                    ["0x3e09fa10", "0x36405257", "0xf463e18e"],
                    [clearingHouseMock.address, clearingHouseMock.address, chainlinkL1Mock.address],
                    [toFullDigit(1), toFullDigit(5)],
                ),
                "inconsistent input size",
            )
        })

        it("force error, setKeeperFunction, set 2 func selectors, 3 addresses but 3 amount", async () => {
            await expectRevert(
                KeeperRewardL1.setKeeperFunctions(
                    ["0x3e09fa10", "0x36405257"],
                    [clearingHouseMock.address, clearingHouseMock.address, chainlinkL1Mock.address],
                    [toFullDigit(1), toFullDigit(5), toFullDigit(5)],
                ),
                "inconsistent input size",
            )
        })
    })

    describe("KeeperRewardL1/L2", () => {
        beforeEach(async () => {
            await perpToken.transfer(KeeperRewardL1.address, toFullDigit(100), { from: admin })
            await perpToken.transfer(KeeperRewardL2.address, toFullDigit(100), { from: admin })

            // f463e18e  =>  updateLatestRoundData(bytes32)
            await KeeperRewardL1.setKeeperFunctions(["0xf463e18e"], [chainlinkL1Mock.address], [toFullDigit(2)])
            // 3e09fa10  =>  payFunding(address)
            await KeeperRewardL2.setKeeperFunctions(["0x3e09fa10"], [clearingHouseMock.address], [toFullDigit(1)])
        })

        it("call payFunding through KeeperRewardL2", async () => {
            const r = await KeeperRewardL2.payFunding(fakeAmm, { from: alice })
            await expectEvent.inTransaction(r.tx, KeeperRewardL2, "KeeperCalled", {
                keeper: alice,
                func: "0x3e09fa10",
                reward: toFullDigit(1),
            })
            await expectEvent.inTransaction(r.tx, clearingHouseMock, "TestEventForPayFunding")
            expect(await perpToken.balanceOf(alice)).eq(toFullDigit(1))
        })

        it("call updatePriceFeed through KeeperRewardL1", async () => {
            const r = await KeeperRewardL1.updatePriceFeed(fakeAmm, { from: alice })
            await expectEvent.inTransaction(r.tx, KeeperRewardL1, "KeeperCalled", {
                keeper: alice,
                func: "0xf463e18e",
                reward: toFullDigit(2),
            })
            await expectEvent.inTransaction(r.tx, chainlinkL1Mock, "PriceUpdated")
            expect(await perpToken.balanceOf(alice)).eq(toFullDigit(2))
        })

        it("change reward amount and call payFunding through KeeperRewardL2", async () => {
            await KeeperRewardL2.setKeeperFunctions(["0x3e09fa10"], [clearingHouseMock.address], [toFullDigit(5)])

            const r = await KeeperRewardL2.payFunding(fakeAmm, { from: alice })
            await expectEvent.inTransaction(r.tx, KeeperRewardL2, "KeeperCalled", {
                keeper: alice,
                func: "0x3e09fa10",
                reward: toFullDigit(5),
            })
            await expectEvent.inTransaction(r.tx, clearingHouseMock, "TestEventForPayFunding")
            expect(await perpToken.balanceOf(alice)).eq(toFullDigit(5))
        })

        it("change contract address and call payFunding through KeeperRewardL2", async () => {
            const clearingHouseMock2 = await deployClearingHouseMock()
            await KeeperRewardL2.setKeeperFunctions(["0x3e09fa10"], [clearingHouseMock2.address], [toFullDigit(5)])

            const r = await KeeperRewardL2.payFunding(fakeAmm, { from: alice })
            await expectEvent.inTransaction(r.tx, KeeperRewardL2, "KeeperCalled", {
                keeper: alice,
                func: "0x3e09fa10",
                reward: toFullDigit(5),
            })
            await expectEvent.inTransaction(r.tx, clearingHouseMock2, "TestEventForPayFunding")
            expect(await perpToken.balanceOf(alice)).eq(toFullDigit(5))
        })

        it("force error, set contract address of task `payFunding` to zero in KeeperRewardL2", async () => {
            await KeeperRewardL2.setKeeperFunctions(["0x3e09fa10"], [EMPTY_ADDRESS], [toFullDigit(1)])
            await expectRevert(KeeperRewardL2.payFunding(fakeAmm), "cannot find contract addr")
        })

        it("force error, set contract address of task `updatePriceFeed` to zero in KeeperRewardL1", async () => {
            await KeeperRewardL1.setKeeperFunctions(["0xf463e18e"], [EMPTY_ADDRESS], [toFullDigit(1)])
            await expectRevert(KeeperRewardL1.updatePriceFeed(fakeAmm, { from: alice }), "cannot find contract addr")
        })

        it("force error, set contract address which doesn't support `payFunding` function in KeeperRewardL2", async () => {
            await KeeperRewardL2.setKeeperFunctions(["0x3e09fa10"], [chainlinkL1Mock.address], [toFullDigit(1)])
            await expectRevert(
                KeeperRewardL2.payFunding(fakeAmm),
                "function selector was not recognized and there's no fallback function",
            )
        })
    })
})
