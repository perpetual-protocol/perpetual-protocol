import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { ERC20FakeInstance, MultiTokenMediatorMockInstance, TollPoolInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import {
    deployClientBridge,
    deployErc20Fake,
    deployMockAMBBridge,
    deployMockMultiToken,
    deployTollPool,
} from "../helper/contract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("tollPoolSpec", () => {
    let admin: string
    let alice: string
    let tmpRewardPoolMock: string
    let tokenMediator: MultiTokenMediatorMockInstance
    let tollPool: TollPoolInstance
    let usdt: ERC20FakeInstance
    let usdc: ERC20FakeInstance

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        tmpRewardPoolMock = addresses[2]

        usdt = await deployErc20Fake(toFullDigit(2000000))
        usdc = await deployErc20Fake(toFullDigit(2000000))

        tokenMediator = await deployMockMultiToken()
        const ambBridge = await deployMockAMBBridge()
        const clientBridge = await deployClientBridge(ambBridge.address, tokenMediator.address, admin)

        tollPool = await deployTollPool(admin, clientBridge.address)

        await usdt.approve(tollPool.address, toFullDigit(2000000))
        await usdc.approve(tollPool.address, toFullDigit(2000000))
    })

    describe("transferToTmpRewardPool()", () => {
        beforeEach(async () => {})

        it("tmpRewardPool should receive all the balance of one token in the tollPool contract", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
            await tollPool.addFeeToken(usdt.address)
            await tollPool.addFeeToken(usdc.address)

            await usdt.transfer(tollPool.address, toFullDigit(1000))
            const receipt = await tollPool.transferToTmpRewardPool({ from: admin })
            expectEvent.inTransaction(receipt.tx, tollPool, "TokenTransferred")
            expect(await usdt.balanceOf(tokenMediator.address)).to.eq(toFullDigit(1000))
        })

        it("tmpRewardPool should receive all the balances of tokens in the tollPool contract", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
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
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
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
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
            await expectRevert(tollPool.transferToTmpRewardPool(), "feeTokens not set yet")
        })

        it("force error, the amount of all registered token is zero", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
            await tollPool.addFeeToken(usdt.address)
            await expectRevert(tollPool.transferToTmpRewardPool(), "fee is now zero")
        })
    })

    describe("setTmpRewardPool()", () => {
        it("tmpRewardPool should be set", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
            expect(await tollPool.tmpRewardPoolL1()).to.eq(tmpRewardPoolMock)
        })

        it("tmpRewardPool should be updated", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
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
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
            await expectRevert(tollPool.setTmpRewardPool(tmpRewardPoolMock), "input is the same as the current one")
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

        it("should transfer to tmpRewardPool via clientBridge before removeFeeToken", async () => {
            await tollPool.setTmpRewardPool(tmpRewardPoolMock)
            await tollPool.addFeeToken(usdt.address)
            await usdt.transfer(tollPool.address, 1)

            // TODO expect tollPool call clientBridge.erc20Transfer(tmpRewardPool)
            // let's use ethers/waffle when writing new unit test. it's hard to write unit test without mock lib
            await tollPool.removeFeeToken(usdt.address)
            expect(await usdt.balanceOf(tollPool.address)).eq(0)
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
