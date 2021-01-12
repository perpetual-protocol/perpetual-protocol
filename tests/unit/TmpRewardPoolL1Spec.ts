import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { ERC20FakeInstance, FeeRewardPoolMockInstance, TmpRewardPoolL1Instance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployErc20Fake, deployTmpRewardPoolL1 } from "../helper/contract"
import { deployFeeRewardPoolMock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("TmpRewardPoolL1Spec", () => {
    let admin: string
    let alice: string
    let tmpRewardPool: TmpRewardPoolL1Instance
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
        tmpRewardPool = await deployTmpRewardPoolL1()

        await usdt.transfer(alice, toFullDigit(2000))
        await usdc.transfer(alice, toFullDigit(2000))
    })

    describe("transferToFeeRewardPool()", () => {
        it("feeRewardPool should receive one token", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await usdt.transfer(tmpRewardPool.address, toFullDigit(1000))
            const receipt = await tmpRewardPool.transferToFeeRewardPool()

            expectEvent.inTransaction(receipt.tx, tmpRewardPool, "FeeTransferred", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
                amount: toFullDigit(1000),
            })
            expect(await usdt.balanceOf(tmpRewardPool.address)).to.eq(toFullDigit(0))
            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
        })

        it("one feeRewardPool CAN receive two tokens", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await tmpRewardPool.addFeeRewardPool(usdc.address, feeRewardPoolMock2.address)
            await usdt.transfer(tmpRewardPool.address, toFullDigit(1000))
            await usdc.transfer(tmpRewardPool.address, toFullDigit(2000))

            const receipt = await tmpRewardPool.transferToFeeRewardPool()

            expectEvent.inTransaction(
                receipt.tx,
                tmpRewardPool,
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
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await usdt.transfer(tmpRewardPool.address, toFullDigit(1000))
            await tmpRewardPool.addFeeRewardPool(usdc.address, feeRewardPoolMock2.address)
            await usdc.transfer(tmpRewardPool.address, toFullDigit(2000))

            const receipt = await tmpRewardPool.transferToFeeRewardPool()

            expectEvent.inTransaction(receipt.tx, tmpRewardPool, "FeeTransferred", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
                amount: toFullDigit(1000),
            })
            expectEvent.inTransaction(receipt.tx, tmpRewardPool, "FeeTransferred", {
                token: usdc.address,
                feeRewardPool: feeRewardPoolMock2.address,
                amount: toFullDigit(2000),
            })
            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
            expect(await usdc.balanceOf(feeRewardPoolMock2.address)).to.eq(toFullDigit(2000))
        })

        it("two feeRewardPool should only receive one token as there is another one token added with no balance", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await tmpRewardPool.addFeeRewardPool(usdc.address, feeRewardPoolMock2.address)
            await usdt.transfer(tmpRewardPool.address, toFullDigit(1000))

            const receipt = await tmpRewardPool.transferToFeeRewardPool()
            expectEvent.inTransaction(receipt.tx, tmpRewardPool, "FeeTransferred", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
                amount: toFullDigit(1000),
            })

            expect(await usdt.balanceOf(feeRewardPoolMock1.address)).to.eq(toFullDigit(1000))
            expect(await usdc.balanceOf(feeRewardPoolMock2.address)).to.eq(toFullDigit(0))
        })

        it("force error, no feeTokens set yet", async () => {
            await expectRevert(tmpRewardPool.transferToFeeRewardPool(), "feeTokens not set yet")
        })

        it("force error, balances of all tokens are zero", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await expectRevert(tmpRewardPool.transferToFeeRewardPool(), "fee is now zero")
        })
    })

    describe("addFeeRewardPool()", () => {
        it("two feeRewardPool should be added", async () => {
            const receipt1 = await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            expectEvent.inTransaction(receipt1.tx, tmpRewardPool, "FeeRewardPoolAdded", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
            })

            const receipt2 = await tmpRewardPool.addFeeRewardPool(usdc.address, feeRewardPoolMock2.address)
            expectEvent.inTransaction(receipt2.tx, tmpRewardPool, "FeeRewardPoolAdded", {
                token: usdc.address,
                feeRewardPool: feeRewardPoolMock2.address,
            })

            expect(await tmpRewardPool.feeRewardPoolMap(usdt.address)).to.eq(feeRewardPoolMock1.address)
            expect(await tmpRewardPool.feeRewardPoolMap(usdc.address)).to.eq(feeRewardPoolMock2.address)

            expect(await tmpRewardPool.feeTokens(1)).to.eq(usdc.address)
            expect(await tmpRewardPool.getFeeTokenLength()).to.eq(2)

            expect(await tmpRewardPool.isFeeTokenExisted(usdt.address)).to.eq(true)
            expect(await tmpRewardPool.isFeeTokenExisted(usdc.address)).to.eq(true)
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, token is zero address", async () => {
            await expectRevert(
                tmpRewardPool.addFeeRewardPool(EMPTY_ADDRESS, feeRewardPoolMock1.address),
                "invalid input",
            )
        })

        it("force error, feeRewardPool is zero address", async () => {
            await expectRevert(tmpRewardPool.addFeeRewardPool(usdt.address, EMPTY_ADDRESS), "invalid input")
        })

        it("force error, feeToken is already existed", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await expectRevert(
                tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock2.address),
                "token is already existed",
            )
        })
    })

    describe("removeFeeRewardPool()", () => {
        it("one feeRewardPool should be removed", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            const receipt1 = await tmpRewardPool.removeFeeRewardPool(usdt.address)

            expectEvent.inTransaction(receipt1.tx, tmpRewardPool, "FeeRewardPoolRemoved", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
            })
            expect(await tmpRewardPool.getFeeTokenLength()).to.eq(0)
            expect(await tmpRewardPool.feeRewardPoolMap(usdt.address)).to.eq(EMPTY_ADDRESS)
            expect(await tmpRewardPool.isFeeTokenExisted(usdt.address)).to.eq(false)
        })

        it("two feeRewardPool are added but only one should be removed", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await tmpRewardPool.addFeeRewardPool(usdc.address, feeRewardPoolMock2.address)

            const receipt1 = await tmpRewardPool.removeFeeRewardPool(usdt.address)
            expectEvent.inTransaction(receipt1.tx, tmpRewardPool, "FeeRewardPoolRemoved", {
                token: usdt.address,
                feeRewardPool: feeRewardPoolMock1.address,
            })
            expect(await tmpRewardPool.getFeeTokenLength()).to.eq(1)
            expect(await tmpRewardPool.feeRewardPoolMap(usdc.address)).to.eq(feeRewardPoolMock2.address)
            expect(await tmpRewardPool.feeTokens(0)).to.eq(usdc.address)

            expect(await tmpRewardPool.isFeeTokenExisted(usdt.address)).to.eq(false)
            expect(await tmpRewardPool.isFeeTokenExisted(usdc.address)).to.eq(true)
        })

        it("feeRewardPool is added, removed and then added again", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await tmpRewardPool.removeFeeRewardPool(usdt.address)
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock2.address)

            expect(await tmpRewardPool.getFeeTokenLength()).to.eq(1)
            expect(await tmpRewardPool.feeRewardPoolMap(usdt.address)).to.eq(feeRewardPoolMock2.address)
            expect(await tmpRewardPool.feeTokens(0)).to.eq(usdt.address)
        })

        it("should transfer reward to FeeRewardPool before removeFeeRewardPool", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await usdt.transfer(tmpRewardPool.address, 1)

            // TODO expect tollPool call usdt.transfer(feeRewardPoolMock1), feeRewardPoolMock1.notifyRewardAmount
            // let's use ethers/waffle when writing new unit test. it's hard to write unit test without mock lib
            await tmpRewardPool.removeFeeRewardPool(usdt.address)
            expect(await usdt.balanceOf(tmpRewardPool.address)).eq(0)
        })

        it("force error, onlyOwner", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await expectRevert(
                tmpRewardPool.removeFeeRewardPool(usdt.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, token is zero address", async () => {
            await tmpRewardPool.addFeeRewardPool(usdt.address, feeRewardPoolMock1.address)
            await expectRevert(tmpRewardPool.removeFeeRewardPool(EMPTY_ADDRESS), "invalid input")
        })

        it("force error, feeToken does not exist", async () => {
            await expectRevert(tmpRewardPool.removeFeeRewardPool(usdt.address), "token does not exist")
        })
    })
})
