import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { ERC20FakeInstance, FeeRewardPoolMockInstance, FeeTokenPoolDispatcherL1Instance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployErc20Fake, deployFeeTokenPoolDispatcherL1 } from "../helper/contract"
import { deployFeeRewardPoolMock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("FeeTokenPoolDispatcherL1Spec", () => {
    let admin: string
    let alice: string
    let feeTokenPoolDispatcher: FeeTokenPoolDispatcherL1Instance
    let feeRewardPoolMock1: FeeRewardPoolMockInstance
    let feeRewardPoolMock2: FeeRewardPoolMockInstance
    let usdt: ERC20FakeInstance
    let usdc: ERC20FakeInstance

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        usdt = await deployErc20Fake(toFullDigit(2000000))
        usdc = await deployErc20Fake(toFullDigit(2000000))
        feeRewardPoolMock1 = await deployFeeRewardPoolMock()
        feeRewardPoolMock2 = await deployFeeRewardPoolMock()
        feeTokenPoolDispatcher = await deployFeeTokenPoolDispatcherL1()
        await feeRewardPoolMock1.setToken(usdt.address)
        await feeRewardPoolMock2.setToken(usdc.address)

        await usdt.transfer(alice, toFullDigit(2000))
        await usdc.transfer(alice, toFullDigit(2000))
    })

    describe("transferToFeeRewardPool()", () => {
        it("feeRewardPool should receive one token", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await usdt.transfer(feeTokenPoolDispatcher.address, toFullDigit(1000))
            const receipt = await feeTokenPoolDispatcher.transferToFeeRewardPool()

            expectEvent.inTransaction(receipt.tx, feeTokenPoolDispatcher, "FeeTransferred", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
                amount: toFullDigit(1000),
            })
            expect(await usdt.balanceOf(feeTokenPoolDispatcher.address)).to.eq(toFullDigit(0))
            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
        })

        it("one feeRewardPool CAN receive two tokens", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock2.address)
            await usdt.transfer(feeTokenPoolDispatcher.address, toFullDigit(1000))
            await usdc.transfer(feeTokenPoolDispatcher.address, toFullDigit(2000))

            const receipt = await feeTokenPoolDispatcher.transferToFeeRewardPool()

            expectEvent.inTransaction(
                receipt.tx,
                feeTokenPoolDispatcher,
                "FeeTransferred",
                {
                    token: usdt.address,
                    feeRewardPool: feeRewardPoolMock1.address,
                    amount: toFullDigit(1000),
                },
                {
                    token: usdc.address,
                    feeRewardPool: feeRewardPoolMock2.address,
                    amount: toFullDigit(2000),
                },
            )
            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
            expect(await usdc.balanceOf(feeRewardPoolMock2.address)).to.eq(toFullDigit(2000))
        })

        it("two feeRewardPool should receive two tokens", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await usdt.transfer(feeTokenPoolDispatcher.address, toFullDigit(1000))
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock2.address)
            await usdc.transfer(feeTokenPoolDispatcher.address, toFullDigit(2000))

            const receipt = await feeTokenPoolDispatcher.transferToFeeRewardPool()

            expectEvent.inTransaction(receipt.tx, feeTokenPoolDispatcher, "FeeTransferred", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
                amount: toFullDigit(1000),
            })
            expectEvent.inTransaction(receipt.tx, feeTokenPoolDispatcher, "FeeTransferred", {
                token: usdc.address,
                feeRewardPool: feeRewardPoolMock2.address,
                amount: toFullDigit(2000),
            })
            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
            expect(await usdc.balanceOf(feeRewardPoolMock2.address)).to.eq(toFullDigit(2000))
        })

        it("two feeRewardPool should only receive one token as there is another one token added with no balance", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock2.address)
            await usdt.transfer(feeTokenPoolDispatcher.address, toFullDigit(1000))

            const receipt = await feeTokenPoolDispatcher.transferToFeeRewardPool()
            expectEvent.inTransaction(receipt.tx, feeTokenPoolDispatcher, "FeeTransferred", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
                amount: toFullDigit(1000),
            })

            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
            expect(await usdc.balanceOf(feeRewardPoolMock2.address)).to.eq(toFullDigit(0))
        })

        it("force error, no feeTokens set yet", async () => {
            await expectRevert(feeTokenPoolDispatcher.transferToFeeRewardPool(), "feeTokens not set yet")
        })

        it("force error, balances of all tokens are zero", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await expectRevert(feeTokenPoolDispatcher.transferToFeeRewardPool(), "fee is now zero")
        })
    })

    describe("addFeeRewardPool()", () => {
        it("two feeRewardPool should be added", async () => {
            const receipt1 = await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            expectEvent.inTransaction(receipt1.tx, feeTokenPoolDispatcher, "FeeRewardPoolAdded", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
            })

            const receipt2 = await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock2.address)
            expectEvent.inTransaction(receipt2.tx, feeTokenPoolDispatcher, "FeeRewardPoolAdded", {
                token: usdc.address,
                feeRewardPool: feeRewardPoolMock2.address,
            })

            expect(await feeTokenPoolDispatcher.feeRewardPoolMap(usdt.address)).to.eq(feeRewardPoolMock1.address)
            expect(await feeTokenPoolDispatcher.feeRewardPoolMap(usdc.address)).to.eq(feeRewardPoolMock2.address)

            expect(await feeTokenPoolDispatcher.feeTokens(1)).to.eq(usdc.address)
            expect(await feeTokenPoolDispatcher.getFeeTokenLength()).to.eq(2)

            expect(await feeTokenPoolDispatcher.isFeeTokenExisted(usdt.address)).to.eq(true)
            expect(await feeTokenPoolDispatcher.isFeeTokenExisted(usdc.address)).to.eq(true)
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, feeRewardPool is zero address", async () => {
            await expectRevert(feeTokenPoolDispatcher.addFeeRewardPool(EMPTY_ADDRESS), "invalid input")
        })

        it("force error, feeToken is already existed", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await expectRevert(
                feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address),
                "token is already existed",
            )
        })
    })

    describe("removeFeeRewardPool()", () => {
        it("one feeRewardPool should be removed", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            const receipt1 = await feeTokenPoolDispatcher.removeFeeRewardPool(feeRewardPoolMock1.address)

            expectEvent.inTransaction(receipt1.tx, feeTokenPoolDispatcher, "FeeRewardPoolRemoved", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
            })
            expect(await feeTokenPoolDispatcher.getFeeTokenLength()).to.eq(0)
            expect(await feeTokenPoolDispatcher.feeRewardPoolMap(usdt.address)).to.eq(EMPTY_ADDRESS)
            expect(await feeTokenPoolDispatcher.isFeeTokenExisted(usdt.address)).to.eq(false)
        })

        it("two feeRewardPool are added but only one should be removed", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock2.address)

            const receipt1 = await feeTokenPoolDispatcher.removeFeeRewardPool(feeRewardPoolMock1.address)
            expectEvent.inTransaction(receipt1.tx, feeTokenPoolDispatcher, "FeeRewardPoolRemoved", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
            })
            expect(await feeTokenPoolDispatcher.getFeeTokenLength()).to.eq(1)
            expect(await feeTokenPoolDispatcher.feeRewardPoolMap(usdc.address)).to.eq(feeRewardPoolMock2.address)
            expect(await feeTokenPoolDispatcher.feeTokens(0)).to.eq(usdc.address)

            expect(await feeTokenPoolDispatcher.isFeeTokenExisted(usdt.address)).to.eq(false)
            expect(await feeTokenPoolDispatcher.isFeeTokenExisted(usdc.address)).to.eq(true)
        })

        it("feeRewardPool is added, removed and then added again", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await feeTokenPoolDispatcher.removeFeeRewardPool(feeRewardPoolMock1.address)
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock2.address)

            expect(await feeTokenPoolDispatcher.getFeeTokenLength()).to.eq(1)
            expect(await feeTokenPoolDispatcher.feeRewardPoolMap(usdt.address)).to.eq(EMPTY_ADDRESS)
            expect(await feeTokenPoolDispatcher.feeRewardPoolMap(usdc.address)).to.eq(feeRewardPoolMock2.address)
            expect(await feeTokenPoolDispatcher.feeTokens(0)).to.eq(usdc.address)
        })

        it("should transfer reward to FeeRewardPool before removeFeeRewardPool", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await usdt.transfer(feeTokenPoolDispatcher.address, 1)

            // TODO expect tollPool call usdt.transfer(feeRewardPoolMock1), feeRewardPoolMock1.notifyRewardAmount
            // let's use ethers/waffle when writing new unit test. it's hard to write unit test without mock lib
            await feeTokenPoolDispatcher.removeFeeRewardPool(feeRewardPoolMock1.address)
            expect(await usdt.balanceOf(feeTokenPoolDispatcher.address)).eq(0)
        })

        it("force error, onlyOwner", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await expectRevert(
                feeTokenPoolDispatcher.removeFeeRewardPool(feeRewardPoolMock1.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, token is zero address", async () => {
            await feeTokenPoolDispatcher.addFeeRewardPool(feeRewardPoolMock1.address)
            await expectRevert(feeTokenPoolDispatcher.removeFeeRewardPool(EMPTY_ADDRESS), "invalid input")
        })

        it("force error, feeToken does not exist", async () => {
            await expectRevert(
                feeTokenPoolDispatcher.removeFeeRewardPool(feeRewardPoolMock1.address),
                "token does not exist",
            )
        })
    })
})
