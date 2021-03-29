import { expectRevert } from "@openzeppelin/test-helpers"
import { default as BN } from "bn.js"
import { use } from "chai"
import { web3 } from "hardhat"
import {
    AMBBridgeMockInstance,
    ClientBridgeInstance,
    ERC20FakeInstance,
    MultiTokenMediatorMockInstance,
} from "../../../types/truffle"
import { assertionHelper } from "../../helper/assertion-plugin"
import { deployClientBridge, deployErc20Fake, deployMockAMBBridge, deployMockMultiToken } from "../../helper/contract"
import { toDecimal, toFullDigit } from "../../helper/number"

use(assertionHelper)

describe("ClientBridgeSpec Spec", () => {
    let admin: string
    let alice: string
    let trustForwarder: string

    let clientBridge: ClientBridgeInstance
    let quoteToken: ERC20FakeInstance
    let ambBridgeMock: AMBBridgeMockInstance
    let multiTokenMediatorMock: MultiTokenMediatorMockInstance

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        trustForwarder = addresses[2]
        ambBridgeMock = await deployMockAMBBridge()
        multiTokenMediatorMock = await deployMockMultiToken()
        clientBridge = await deployClientBridge(ambBridgeMock.address, multiTokenMediatorMock.address, trustForwarder)
        quoteToken = await deployErc20Fake(toFullDigit(10000), "NAME", "SYMBOL", new BN("6"))
    })

    describe("withdraw with minimum amount", () => {
        beforeEach(async () => {
            await clientBridge.setMinWithdrawalAmount(quoteToken.address, toDecimal(10))
        })

        it("same as minimum withdrawal amount", async () => {
            await quoteToken.approve(clientBridge.address, toFullDigit(10), { from: admin })
            await clientBridge.erc20Transfer(quoteToken.address, alice, toDecimal(10), { from: admin })

            // verify balance of the token bridge
            const digit = new BN(10).pow(await quoteToken.decimals())
            const aTen = new BN(10)
            expect(await quoteToken.balanceOf(multiTokenMediatorMock.address)).eq(aTen.mul(digit))
        })

        it("more than minimum withdrawal amount", async () => {
            await quoteToken.approve(clientBridge.address, toFullDigit(100), { from: admin })
            await clientBridge.erc20Transfer(quoteToken.address, alice, toDecimal(100), { from: admin })

            // verify balance of the token bridge
            const digit = new BN(10).pow(await quoteToken.decimals())
            const aHundred = new BN(100)
            expect(await quoteToken.balanceOf(multiTokenMediatorMock.address)).eq(aHundred.mul(digit))
        })

        it("force error, less than minimum withdrawal amount", async () => {
            await expectRevert(
                clientBridge.erc20Transfer(quoteToken.address, alice, toDecimal(9.9)),
                "amount is too small",
            )
        })
    })

    it("set minimum withdrawal amount", async () => {
        await clientBridge.setMinWithdrawalAmount(quoteToken.address, toDecimal(100))
        expect(await clientBridge.minWithdrawalAmountMap(quoteToken.address)).eq(toFullDigit(100))

        // can be overridden
        await clientBridge.setMinWithdrawalAmount(quoteToken.address, toDecimal(5))
        expect(await clientBridge.minWithdrawalAmountMap(quoteToken.address)).eq(toFullDigit(5))
    })
})
