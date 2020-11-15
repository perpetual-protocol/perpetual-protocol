import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BN } from "bn.js"
import { use } from "chai"
import {
    AMBBridgeMockInstance,
    ERC20FakeInstance,
    MultiTokenMediatorMockInstance,
    RootBridgeInstance,
} from "../../../types/truffle"
import { assertionHelper } from "../../helper/assertion-plugin"
import { deployErc20Fake, deployMockAMBBridge, deployMockMultiToken, deployRootBridge } from "../../helper/contract"
import { toDecimal, toFullDigit } from "../../helper/number"

use(assertionHelper)

describe("BaseBridgeSpec Spec", () => {
    let admin: string
    let alice: string

    // let depositProxy!: DepositProxyInstance
    let rootBridge: RootBridgeInstance
    let quoteToken: ERC20FakeInstance
    let ambBridgeMock: AMBBridgeMockInstance
    let multiTokenMediatorMock: MultiTokenMediatorMockInstance

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        ambBridgeMock = await deployMockAMBBridge()
        multiTokenMediatorMock = await deployMockMultiToken()
        rootBridge = await deployRootBridge(ambBridgeMock.address, multiTokenMediatorMock.address)
        quoteToken = await deployErc20Fake(toFullDigit(10000), "NAME", "SYMBOL", new BN("6"))
    })

    it("setAMBBridge", async () => {
        const receipt = await rootBridge.setAMBBridge(alice)
        expect(await rootBridge.ambBridge()).eq(alice)
        await expectEvent.inTransaction(receipt.tx, rootBridge, "BridgeChanged", { bridge: alice })
    })

    it("setMultiTokenMediator", async () => {
        const receipt = await rootBridge.setMultiTokenMediator(alice)
        expect(await rootBridge.multiTokenMediator()).eq(alice)
        await expectEvent.inTransaction(receipt.tx, rootBridge, "MultiTokenMediatorChanged", { mediator: alice })
    })

    it("multiTokenTransfer", async () => {
        await quoteToken.approve(rootBridge.address, toFullDigit(100))
        const receipt = await rootBridge.erc20Transfer(quoteToken.address, alice, toDecimal(100))

        await expectEvent.inTransaction(receipt.tx, rootBridge, "Relayed", {
            token: quoteToken.address,
            receiver: alice,
            amount: toFullDigit(100),
        })

        // verify balance of the token bridge
        const digit = new BN(10).pow(await quoteToken.decimals())
        const aHundred = new BN(100)
        expect(await quoteToken.balanceOf(multiTokenMediatorMock.address)).eq(aHundred.mul(digit))
    })

    it("should fail when multiTokenMediator is not implementing relayTokens()", async () => {
        await rootBridge.setMultiTokenMediator(quoteToken.address)
        await quoteToken.approve(rootBridge.address, toFullDigit(100))
        await expectRevert(
            rootBridge.erc20Transfer(quoteToken.address, alice, toDecimal(100)),
            "Transaction reverted: function selector was not recognized and there's no fallback function",
        )
    })

    it("force error, only owner can setAMBBridge", async () => {
        await expectRevert(
            rootBridge.setAMBBridge(alice, { from: alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    })

    it("force error, only owner can multiTokenMediator", async () => {
        await expectRevert(
            rootBridge.setMultiTokenMediator(alice, { from: alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    })

    it("force error, transfer zero amount", async () => {
        await expectRevert(rootBridge.erc20Transfer(quoteToken.address, alice, toDecimal(0)), "amount is zero")
    })
})
