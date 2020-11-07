import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BN } from "bn.js"
import { use } from "chai"
import {
    AMBBridgeMockInstance,
    ERC20FakeInstance,
    MultiTokenMediatorMockInstance,
    RootBridgeInstance,
} from "../../../types"
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

    it("callOtherSideFunction - approve", async () => {
        const encodedFunctionCall = web3.eth.abi.encodeFunctionCall(
            {
                name: "approve",
                type: "function",
                inputs: [
                    { type: "address", name: "spender" },
                    { type: "uint256", name: "amount" },
                ],
            },
            [alice, toFullDigit(100).toString()],
        )

        // call `approve` of erc20
        // the first parameter should be a contract on the other side, but it's difficult to test
        // in the implementation of AMBBridgeMock, we do like this, `_contract.call(_data)`
        // the contract of the 1st parameter will execute the data of 2nd parameter directly
        // in that way, we could verify our function should be called correctly on the other side.
        const receipt = await rootBridge.callOtherSideFunction(quoteToken.address, encodedFunctionCall, "6000000")
        expectEvent.inTransaction(receipt.tx, quoteToken, "Approval")
        // ambBridgeMock is the one who call `approve` so the spender of allowance is ambBridgeMock
        expect(await quoteToken.allowance(ambBridgeMock.address, alice)).to.eq(toFullDigit(100))
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
})
