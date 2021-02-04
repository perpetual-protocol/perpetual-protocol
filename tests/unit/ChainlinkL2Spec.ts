import { web3 } from "@nomiclabs/buidler"
import { expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import { ChainlinkL1MockInstance, ChainlinkL2FakeInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployChainlinkL2 } from "../helper/contract"
import { deployChainlinkL1Mock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

describe("chainlinkL2 Spec", () => {
    const CHAINLINK_DECIMAL = 8

    let addresses: string[]
    let chainlinkL2!: ChainlinkL2FakeInstance
    let chainlinkMock1!: ChainlinkL1MockInstance
    let chainlinkMock2!: ChainlinkL1MockInstance
    let chainlinkMock3!: ChainlinkL1MockInstance
    const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        chainlinkMock1 = await deployChainlinkL1Mock()
        chainlinkMock2 = await deployChainlinkL1Mock()
        chainlinkMock3 = await deployChainlinkL1Mock()

        chainlinkL2 = await deployChainlinkL2()
    })

    function stringToBytes32(str: string): string {
        return web3.utils.asciiToHex(str)
    }

    function fromBytes32(str: string): string {
        return web3.utils.hexToUtf8(str)
    }

    describe("addAggregator", () => {
        it("getAggregator with existed aggregator key", async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            expect(fromBytes32(await chainlinkL2.priceFeedKeys(0))).eq("ETH")
            expect(await chainlinkL2.getAggregator(stringToBytes32("ETH"))).eq(chainlinkMock1.address)
            expect(await chainlinkL2.priceFeedDecimalMap(stringToBytes32("ETH"))).eq(8)
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

    describe("twap", () => {
        beforeEach(async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            const currentTime = await chainlinkL2.mock_getCurrentTimestamp()
            await chainlinkMock1.mockAddAnswer(0, toFullDigit(400, CHAINLINK_DECIMAL), currentTime, currentTime, 0)
            const firstTimestamp = currentTime.addn(15)
            await chainlinkMock1.mockAddAnswer(
                1,
                toFullDigit(405, CHAINLINK_DECIMAL),
                firstTimestamp,
                firstTimestamp,
                1,
            )
            const secondTimestamp = firstTimestamp.addn(15)
            await chainlinkMock1.mockAddAnswer(
                2,
                toFullDigit(410, CHAINLINK_DECIMAL),
                secondTimestamp,
                secondTimestamp,
                2,
            )
            const thirdTimestamp = secondTimestamp.addn(15)
            await chainlinkL2.mock_setBlockTimestamp(thirdTimestamp)
        })

        // aggregator's answer
        // timestamp(base + 0)  : 400
        // timestamp(base + 15) : 405
        // timestamp(base + 30) : 410
        // now = base + 45
        //
        //  --+------+-----+-----+-----+-----+-----+
        //          base                          now

        it("twap price", async () => {
            const price = await chainlinkL2.getTwapPrice(stringToBytes32("ETH"), 45)
            expect(price).to.eq(toFullDigit(405))
        })

        it("asking interval more than aggregator has", async () => {
            const price = await chainlinkL2.getTwapPrice(stringToBytes32("ETH"), 46)
            expect(price).to.eq(toFullDigit(405))
        })

        it("asking interval less than aggregator has", async () => {
            const price = await chainlinkL2.getTwapPrice(stringToBytes32("ETH"), 44)
            expect(price).to.eq("405113636360000000000")
        })

        it("given variant price period", async () => {
            const currentTime = await chainlinkL2.mock_getCurrentTimestamp()
            await chainlinkMock1.mockAddAnswer(
                4,
                toFullDigit(420, CHAINLINK_DECIMAL),
                currentTime.addn(30),
                currentTime.addn(30),
                4,
            )
            await chainlinkL2.mock_setBlockTimestamp(currentTime.addn(50))

            // twap price should be (400 * 15) + (405 * 15) + (410 * 45) + (420 * 20) / 95 = 409.74
            const price = await chainlinkL2.getTwapPrice(stringToBytes32("ETH"), 95)
            expect(price).to.eq("409736842100000000000")
        })

        it("latest price update time is earlier than the request, return the latest price", async () => {
            const currentTime = await chainlinkL2.mock_getCurrentTimestamp()
            await chainlinkL2.mock_setBlockTimestamp(currentTime.addn(100))

            // latest update time is base + 30, but now is base + 145 and asking for (now - 45)
            // should return the latest price directly
            const price = await chainlinkL2.getTwapPrice(stringToBytes32("ETH"), 45)
            expect(price).to.eq(toFullDigit(410))
        })

        it("force error, interval is zero", async () => {
            await expectRevert(chainlinkL2.getTwapPrice(stringToBytes32("ETH"), 0), "interval can't be 0")
        })
    })

    describe("getPreviousPrice/getPreviousTimestamp", () => {
        beforeEach(async () => {
            await chainlinkL2.addAggregator(stringToBytes32("ETH"), chainlinkMock1.address)
            await chainlinkMock1.mockAddAnswer(0, toFullDigit(400, CHAINLINK_DECIMAL), 100, 100, 0)
            await chainlinkMock1.mockAddAnswer(1, toFullDigit(405, CHAINLINK_DECIMAL), 150, 150, 1)
            await chainlinkMock1.mockAddAnswer(2, toFullDigit(410, CHAINLINK_DECIMAL), 200, 200, 2)
        })

        it("get previous price (latest)", async () => {
            const price = await chainlinkL2.getPreviousPrice(stringToBytes32("ETH"), 0)
            expect(price).to.eq(toFullDigit(410))
            const timestamp = await chainlinkL2.getPreviousTimestamp(stringToBytes32("ETH"), 0)
            expect(timestamp).to.eq(200)
        })

        it("get previous price", async () => {
            const price = await chainlinkL2.getPreviousPrice(stringToBytes32("ETH"), 2)
            expect(price).to.eq(toFullDigit(400))
            const timestamp = await chainlinkL2.getPreviousTimestamp(stringToBytes32("ETH"), 2)
            expect(timestamp).to.eq(100)
        })

        it("force error, get previous price", async () => {
            await expectRevert(chainlinkL2.getPreviousPrice(stringToBytes32("ETH"), 10), "Not enough history")
            await expectRevert(chainlinkL2.getPreviousTimestamp(stringToBytes32("ETH"), 10), "Not enough history")
        })
    })
})
