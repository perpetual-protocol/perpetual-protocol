import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import { ChainlinkL1MockInstance, ChainlinkL2Instance, L2PriceFeedMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployChainlinkL2, deployL2MockPriceFeed } from "../helper/contract"
import { deployChainlinkL1Mock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

describe("chainlinkL2 Spec", () => {
    let addresses: string[]
    let admin: string
    let chainlinkL2!: ChainlinkL2Instance
    let l2PriceFeedMock!: L2PriceFeedMockInstance
    let chainlinkMock1!: ChainlinkL1MockInstance
    let chainlinkMock2!: ChainlinkL1MockInstance
    let chainlinkMock3!: ChainlinkL1MockInstance
    const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        chainlinkMock1 = await deployChainlinkL1Mock()
        chainlinkMock2 = await deployChainlinkL1Mock()
        chainlinkMock3 = await deployChainlinkL1Mock()

        l2PriceFeedMock = await deployL2MockPriceFeed(toFullDigit(10))
        chainlinkL2 = await deployChainlinkL2(l2PriceFeedMock.address)
    })

    function stringToBytes32(str: string): string {
        return web3.utils.asciiToHex(str)
    }

    function fromBytes32(str: string): string {
        return web3.utils.hexToUtf8(str)
    }

    describe("setPriceFeed()", () => {
        it("set the address of PriceFeedL2", async () => {
            const receipt = await chainlinkL2.setPriceFeed(admin)
            await expectEvent.inTransaction(receipt.tx, chainlinkL2, "PriceFeedChanged", { priceFeed: admin })
            expect(await chainlinkL2.priceFeedAddress()).eq(admin)
        })

        it("force error, PriceFeedL2 address cannot be address(0)", async () => {
            await expectRevert(chainlinkL2.setPriceFeed(EMPTY_ADDRESS), "empty address")
        })
    })

    describe("addAggregator", () => {
        it("getAggregator with existed aggregator key", async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            expect(fromBytes32(await chainlinkL2.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL2.getAggregator(stringToBytes32("ETH"))).eq(chainlinkMock1.address)

            const ethAggregator = await chainlinkL2.aggregatorMap(stringToBytes32("ETH"))
            expect(ethAggregator[0]).eq(chainlinkMock1.address)
            expect(ethAggregator[1]).eq(8)
            expect(ethAggregator[2]).not.eq(0)
        })

        it("getAggregator with non-existed aggregator key", async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            expect(await chainlinkL2.getAggregator(stringToBytes32("BTC"))).eq(EMPTY_ADDRESS)
        })

        it("add multi aggregators", async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            await chainlinkL2.addAggregator(stringToBytes32("BTC"), chainlinkMock2.address)
            await chainlinkL2.addAggregator(stringToBytes32("LINK"), chainlinkMock3.address)
            expect(fromBytes32(await chainlinkL2.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL2.getAggregator(stringToBytes32("ETH"))).eq(chainlinkMock1.address)
            expect(fromBytes32(await chainlinkL2.priceFeedKeys(2))).eq("LINK")
            expect(await chainlinkL2.getAggregator(stringToBytes32("LINK"))).eq(chainlinkMock3.address)
        })

        it("force error, addAggregator with zero address", async () => {
            await expectRevert(chainlinkL2.addAggregator(stringToBytes32("ETH"), EMPTY_ADDRESS), "empty address")
        })
    })

    describe("removeAggregator", () => {
        it("remove 1 aggregator when there's only 1", async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            await chainlinkL2.removeAggregator(stringToBytes32("ETH"))

            // cant use expectRevert because the error message is different between CI and local env
            let error
            try {
                await chainlinkL2.priceFeedKeys(0)
            } catch (e) {
                error = e
            }
            expect(error).not.eq(undefined)

            expect(await chainlinkL2.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
        })

        it("remove 1 aggregator when there're 2", async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            await chainlinkL2.addAggregator(stringToBytes32("BTC"), chainlinkMock1.address)
            await chainlinkL2.removeAggregator(stringToBytes32("ETH"))
            expect(fromBytes32(await chainlinkL2.priceFeedKeys(0))).eq("BTC")
            expect(await chainlinkL2.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
            expect(await chainlinkL2.getAggregator(stringToBytes32("BTC"))).eq(chainlinkMock1.address)
        })
    })

    describe("updateLatestRoundData()", () => {
        beforeEach(async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            await chainlinkMock1.mockAddAnswer(8, 12345678, 1, 144000000000, 1)
        })

        it("get latest data", async () => {
            const receipt = await chainlinkL2.updateLatestRoundData(stringToBytes32("ETH"))

            await expectEvent.inTransaction(receipt.tx, chainlinkL2, "PriceUpdated", {
                price: "123456780000000000",
                timestamp: "144000000000",
                roundId: "8",
            })

            // price: chainlink default is 8 digit, the value from our contract will be converted to 18 digits
            await expectEvent.inTransaction(receipt.tx, l2PriceFeedMock, "PriceFeedDataSet", {
                price: "123456780000000000",
                timestamp: "144000000000",
                roundId: "8",
            })
        })

        // expectRevert section
        it("force error, get non-existing aggregator", async () => {
            const _wrongPriceFeedKey = "Ha"
            await expectRevert(chainlinkL2.updateLatestRoundData(stringToBytes32(_wrongPriceFeedKey)), "empty address")
        })

        it("force error, timestamp equal to 0", async () => {
            await chainlinkMock1.mockAddAnswer(8, 41, 1, 0, 1)
            await expectRevert(chainlinkL2.updateLatestRoundData(stringToBytes32("ETH")), "incorrect timestamp")
        })

        it("force error, same timestamp as previous", async () => {
            // first update should pass
            await chainlinkL2.updateLatestRoundData(stringToBytes32("ETH"))
            const aggregators = await chainlinkL2.aggregatorMap(stringToBytes32("ETH"))
            // index 2 is timestamp
            expect(aggregators[2]).eq("144000000000")
            // second update with the same timestamp should fail
            await expectRevert(chainlinkL2.updateLatestRoundData(stringToBytes32("ETH")), "incorrect timestamp")
        })
    })
})
