import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import {
    ERC20FakeInstance,
    MultiTokenMediatorMockInstance,
    TmpRewardPoolMockInstance,
    TollPoolInstance,
} from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import {
    deployClientBridge,
    deployErc20Fake,
    deployMockAMBBridge,
    deployMockMultiToken,
    deployTollPool,
} from "../helper/contract"
import { deployTmpRewardPoolMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("tollPoolSpec", () => {
    let admin: string
    let alice: string
    let tokenMediator: MultiTokenMediatorMockInstance
    let tollPool: TollPoolInstance
    let usdt: ERC20FakeInstance
    let usdc: ERC20FakeInstance
    let tmpRewardPoolMock: TmpRewardPoolMockInstance

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        usdt = await deployErc20Fake(toFullDigit(2000000))
        usdc = await deployErc20Fake(toFullDigit(2000000))

        tokenMediator = await deployMockMultiToken()
        const ambBridge = await deployMockAMBBridge()
        const clientBridge = await deployClientBridge(ambBridge.address, tokenMediator.address, admin)

        tollPool = await deployTollPool(admin, clientBridge.address)
        tmpRewardPoolMock = await deployTmpRewardPoolMock()

        await usdt.approve(tollPool.address, toFullDigit(2000000))
        await usdc.approve(tollPool.address, toFullDigit(2000000))
    })

    describe("notifyTokenAmount()", () => {
        beforeEach(async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await tollPool.addFeeToken(usdt.address)
        })

        it("should emit event", async () => {
            const receipt = await tollPool.notifyTokenAmount(usdt.address, toDecimal(1000))
            expectEvent.inTransaction(receipt.tx, tollPool, "TokenReceived", {
                token: usdt.address,
                amount: toFullDigit(1000),
            })
        })

        it("force error, invalid token", async () => {
            await expectRevert(
                tollPool.notifyTokenAmount(tmpRewardPoolMock.address, toDecimal(1000)),
                "token does not exist",
            )
        })

        it("force error, not called by clearingHouse", async () => {
            await expectRevert(
                tollPool.notifyTokenAmount(usdt.address, toDecimal(1000), { from: alice }),
                "only clearingHouse",
            )
        })

        it("force error, token amount is zero", async () => {
            await expectRevert(tollPool.notifyTokenAmount(usdt.address, toDecimal(0)), "invalid input")
        })
    })

    describe("transferToTmpRewardPool()", () => {
        beforeEach(async () => {})

        it("tmpRewardPool should receive all the balance of one token in the tollPool contract", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await tollPool.addFeeToken(usdt.address)
            await tollPool.addFeeToken(usdc.address)

            await usdt.transfer(tollPool.address, toFullDigit(1000))
            const receipt = await tollPool.transferToTmpRewardPool({ from: admin })
            expectEvent.inTransaction(receipt.tx, tollPool, "TokenTransferred")
            expect(await usdt.balanceOf(tokenMediator.address)).to.eq(toFullDigit(1000))
        })

        it("tmpRewardPool should receive all the balances of tokens in the tollPool contract", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await tollPool.addFeeToken(usdt.address)
            await tollPool.addFeeToken(usdc.address)

            await usdt.transfer(tollPool.address, toFullDigit(1000))
            await usdc.transfer(tollPool.address, toFullDigit(2000))

            const receipt = await tollPool.transferToTmpRewardPool({ from: admin })
            expectEvent.inTransaction(receipt.tx, tollPool, "TokenTransferred")
            expect(await usdt.balanceOf(tokenMediator.address)).to.eq(toFullDigit(1000))
            expect(await usdc.balanceOf(tokenMediator.address)).to.eq(toFullDigit(2000))
        })

        it("tmpRewardPool should receive usdt but not usdc, since the balance of usdc is 0", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await tollPool.addFeeToken(usdt.address)
            await tollPool.addFeeToken(usdc.address)

            await usdt.transfer(tollPool.address, toFullDigit(1000))
            await tollPool.transferToTmpRewardPool({ from: admin })
            expect(await usdt.balanceOf(tokenMediator.address)).to.eq(toFullDigit(1000))
        })

        it("force error, tmpRewardPoolL1 not yet set", async () => {
            await expectRevert(tollPool.transferToTmpRewardPool(), "tmpRewardPoolL1 not yet set")
        })

        it("force error, feeTokens not yet set", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await expectRevert(tollPool.transferToTmpRewardPool(), "feeTokens not set yet")
        })

        it("force error, the amount of all registered token is zero", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await tollPool.addFeeToken(usdt.address)
            await expectRevert(tollPool.transferToTmpRewardPool(), "fee is now zero")
        })
    })

    describe("setTmpRewardPool()", () => {
        it("tmpRewardPool should be set", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            expect(await tollPool.tmpRewardPoolL1()).to.eq(tmpRewardPoolMock.address)
        })

        it("tmpRewardPool should be updated", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await tollPool.setTmpRewardPool(alice)
            expect(await tollPool.tmpRewardPoolL1()).to.eq(alice)
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                tollPool.setTmpRewardPool(EMPTY_ADDRESS, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, input is zero address", async () => {
            await expectRevert(tollPool.setTmpRewardPool(EMPTY_ADDRESS), "invalid input")
        })

        it("force error, tmpRewardPool already existed", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock.address)
            await expectRevert(
                tollPool.setTmpRewardPool(tmpRewardPoolMock.address),
                "input is the same as the current one",
            )
        })
    })

    describe("addFeeToken()", () => {
        it("feeTokens should be set", async () => {
            await tollPool.addFeeToken(usdt.address)
            await tollPool.addFeeToken(usdc.address)
            expect(await tollPool.feeTokens(0)).to.eq(usdt.address)
            expect(await tollPool.feeTokens(1)).to.eq(usdc.address)
            expect(await tollPool.isFeeTokenExisted(usdt.address)).to.eq(true)
            expect(await tollPool.isFeeTokenExisted(usdc.address)).to.eq(true)
        })

        it("force error, onlyOwner", async () => {
            await expectRevert(
                tollPool.addFeeToken(usdt.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, token is already existed", async () => {
            await tollPool.addFeeToken(usdt.address)
            await expectRevert(tollPool.addFeeToken(usdt.address), "token is already existed")
        })

        it("force error, input is zero address", async () => {
            await expectRevert(tollPool.addFeeToken(EMPTY_ADDRESS), "invalid input")
        })
    })

    describe("removeFeeToken()", () => {
        it("feeTokens should be removed", async () => {
            await tollPool.addFeeToken(usdt.address)
            await tollPool.removeFeeToken(usdt.address)
            expect(await tollPool.isFeeTokenExisted(usdt.address)).to.eq(false)
            expect(await tollPool.getFeeTokenLength()).to.eq(0)
        })

        it("feeTokens should be removed and can be added again", async () => {
            await tollPool.addFeeToken(usdt.address)
            await tollPool.addFeeToken(usdc.address)

            await tollPool.removeFeeToken(usdt.address)
            await tollPool.addFeeToken(usdt.address)
            expect(await tollPool.feeTokens(0)).to.eq(usdc.address)
            expect(await tollPool.feeTokens(1)).to.eq(usdt.address)
        })

        it("force error, onlyOwner", async () => {
            await tollPool.addFeeToken(usdt.address)
            await expectRevert(
                tollPool.removeFeeToken(usdt.address, { from: alice }),
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("force error, token does not exist", async () => {
            await expectRevert(tollPool.removeFeeToken(usdt.address), "token does not exist")
        })

        it("force error, input is zero address", async () => {
            await tollPool.addFeeToken(usdt.address)
            await expectRevert(tollPool.removeFeeToken(EMPTY_ADDRESS), "invalid input")
        })
    })
})
