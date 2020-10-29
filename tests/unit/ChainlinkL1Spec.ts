import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { ChainlinkL1Instance, ChainlinkL1MockInstance, RootBridgeMockInstance } from "../../types"
import BN from "bn.js"
import { expect, use } from "chai"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployChainlinkL1 } from "../helper/contract"
import { deployChainlinkL1Mock, deployRootBridgeMock } from "../helper/mockContract"

use(assertionHelper)

describe("chainlinkL1 Spec", () => {
    let addresses: string[]
    let chainlinkL1!: ChainlinkL1Instance
    let chainlinkL1Mock!: ChainlinkL1MockInstance
    let rootBridgeMock!: RootBridgeMockInstance
    const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        chainlinkL1Mock = await deployChainlinkL1Mock()
        rootBridgeMock = await deployRootBridgeMock()
    })

    function stringToBytes32(str: string): string {
        return web3.utils.asciiToHex(str)
    }

    function fromBytes32(str: string): string {
        return web3.utils.hexToUtf8(str)
    }

    describe("initialize()", () => {
        it("force error, RootBridge address cannot be address(0)", async () => {
            await expectRevert(deployChainlinkL1(EMPTY_ADDRESS, addresses[1]), "RootBridge address is empty")
        })

        it("force error, PriceFeedL2 address cannot be address(0)", async () => {
            await expectRevert(deployChainlinkL1(addresses[1], EMPTY_ADDRESS), "PriceFeedL2 address is empty")
        })
    })

    describe("setRootBridge(), setPriceFeedL2()", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(rootBridgeMock.address, addresses[1])
        })

        it("set the address of RootBridge", async () => {
            const receipt = await chainlinkL1.setRootBridge(addresses[1])
            expectEvent(receipt, "RootBridgeChanged", { rootBridge: addresses[1] })
            expect(await chainlinkL1.rootBridge()).eq(addresses[1])
        })

        it("set the address of PriceFeedL2", async () => {
            const receipt = await chainlinkL1.setPriceFeedL2(addresses[1])
            expectEvent(receipt, "PriceFeedL2Changed", { priceFeedL2: addresses[1] })
            expect(await chainlinkL1.priceFeedL2Address()).eq(addresses[1])
        })

        // expectRevert section
        it("force error, RootBridge address cannot be address(0)", async () => {
            await expectRevert(chainlinkL1.setRootBridge(EMPTY_ADDRESS), "RootBridge address is empty")
        })

        it("force error, PriceFeedL2 address cannot be address(0)", async () => {
            await expectRevert(chainlinkL1.setPriceFeedL2(EMPTY_ADDRESS), "PriceFeedL2 address is empty")
        })
    })

    describe("addAggregator", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(rootBridgeMock.address, addresses[1])
        })

        it("getAggregator with existed aggregator key", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkL1Mock.address)
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(chainlinkL1Mock.address)
        })

        it("getAggregator with non-existed aggregator key", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkL1Mock.address)
            expect(await chainlinkL1.getAggregator(stringToBytes32("BTC"))).eq(EMPTY_ADDRESS)
        })

        it("add multi aggregators", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkL1Mock.address)
            await chainlinkL1.addAggregator(stringToBytes32("BTC"), addresses[1])
            await chainlinkL1.addAggregator(stringToBytes32("LINK"), addresses[2])
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(chainlinkL1Mock.address)
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(2))).eq("LINK")
            expect(await chainlinkL1.getAggregator(stringToBytes32("LINK"))).eq(addresses[2])
        })
    })

    describe("removeAggregator", () => {
        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(rootBridgeMock.address, addresses[1])
        })

        it("remove 1 aggregator when there's only 1", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkL1Mock.address)
            await chainlinkL1.removeAggregator(stringToBytes32("ETH"))

            // cant use expectRevert because the error message is different between CI and local env
            let error
            try {
                await chainlinkL1.priceFeedKeys(0)
            } catch (e) {
                error = e
            }
            expect(error).not.eq(undefined)

            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
        })

        it("remove 1 aggregator when there're 2", async () => {
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkL1Mock.address)
            await chainlinkL1.addAggregator(stringToBytes32("BTC"), chainlinkL1Mock.address)
            await chainlinkL1.removeAggregator(stringToBytes32("ETH"))
            expect(fromBytes32(await chainlinkL1.priceFeedKeys(0))).eq("BTC")
            expect(await chainlinkL1.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
            expect(await chainlinkL1.getAggregator(stringToBytes32("BTC"))).eq(chainlinkL1Mock.address)
        })
    })

    describe("updateLatestRoundData()", () => {
        const _messageId = 20
        const _messageIdBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000014"

        beforeEach(async () => {
            chainlinkL1 = await deployChainlinkL1(rootBridgeMock.address, addresses[1])
            await chainlinkL1.addAggregator(stringToBytes32("ETH"), chainlinkL1Mock.address)
            await rootBridgeMock.mockSetMessageId(_messageId)
            await chainlinkL1Mock.mockAddAnswer(8, 12345678, 1, 200000000000, 1)
        })

        it("get latest data", async () => {
            const receipt = await chainlinkL1.updateLatestRoundData(stringToBytes32("ETH"))
            expectEvent(receipt, "PriceUpdateMessageIdSent", { messageId: _messageIdBytes32 })
            // reported price should be normalized to 18 decimals
            expect(await rootBridgeMock.price()).eq(new BN("123456780000000000"))
        })

        it("get latest data, a specified keeper is not required", async () => {
            const receipt = await chainlinkL1.updateLatestRoundData(stringToBytes32("ETH"), { from: addresses[1] })
            expectEvent(receipt, "PriceUpdateMessageIdSent", { messageId: _messageIdBytes32 })
        })

        // expectRevert section
        it("force error, get non-existing aggregator", async () => {
            const _wrongPriceFeedKey = "Ha"
            await expectRevert(
                chainlinkL1.updateLatestRoundData(stringToBytes32(_wrongPriceFeedKey)),
                "aggregator not existed",
            )
        })

        it("force error, timestamp equal to 0", async () => {
            await chainlinkL1Mock.mockAddAnswer(8, 41, 1, 0, 1)
            await expectRevert(chainlinkL1.updateLatestRoundData(stringToBytes32("ETH")), "incorrect timestamp")
        })

        it("force error, same timestamp as previous", async () => {
            // first update should pass
            await chainlinkL1.updateLatestRoundData(stringToBytes32("ETH"))
            expect(await chainlinkL1.prevTimestampMap(stringToBytes32("ETH"))).eq(new BN(200000000000))
            // second update with the same timestamp should fail
            await expectRevert(chainlinkL1.updateLatestRoundData(stringToBytes32("ETH")), "incorrect timestamp")
        })
    })
})
