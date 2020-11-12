import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { AMBBridgeMockInstance, L2PriceFeedFakeInstance } from "../../types/truffle"
import { deployL2PriceFeed, deployMockAMBBridge } from "../helper/contract"
import { toFullDigit } from "../helper/number"

describe("L2PriceFeed Spec", () => {
    let addresses: string[]
    let admin: string
    let l2PriceFeed!: L2PriceFeedFakeInstance
    let ambBridge: AMBBridgeMockInstance

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        ambBridge = await deployMockAMBBridge()
        l2PriceFeed = await deployL2PriceFeed(ambBridge.address, admin)
        await ambBridge.mockSetMessageSender(admin)
    })

    function toBytes32(str: string): string {
        const paddingLen = 32 - str.length
        const hex = web3.utils.asciiToHex(str)
        return hex + "00".repeat(paddingLen)
    }

    function fromBytes32(str: string): string {
        return web3.utils.hexToUtf8(str)
    }

    describe("addAggregator", () => {
        it("addAggregator", async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            expect(fromBytes32(await l2PriceFeed.priceFeedKeys(0))).eq("ETH")
        })

        it("add multi aggregators", async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            await l2PriceFeed.addAggregator(toBytes32("BTC"))
            await l2PriceFeed.addAggregator(toBytes32("LINK"))
            expect(fromBytes32(await l2PriceFeed.priceFeedKeys(0))).eq("ETH")
            expect(fromBytes32(await l2PriceFeed.priceFeedKeys(2))).eq("LINK")
        })
    })

    describe("removeAggregator", () => {
        it("remove 1 aggregator when there's only 1", async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            await l2PriceFeed.removeAggregator(toBytes32("ETH"))

            // cant use expectRevert because the error message is different between CI and local env
            let error
            try {
                await l2PriceFeed.priceFeedKeys(0)
            } catch (e) {
                error = e
            }
            expect(error).not.eq(undefined)
        })

        it("remove 1 aggregator when there're 2", async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            await l2PriceFeed.addAggregator(toBytes32("BTC"))
            await l2PriceFeed.removeAggregator(toBytes32("ETH"))
            expect(fromBytes32(await l2PriceFeed.priceFeedKeys(0))).eq("BTC")
            expect(await l2PriceFeed.getPriceFeedLength(toBytes32("ETH"))).eq(0)
        })
    })

    describe("setLatestData/getPrice/getLatestTimestamp", () => {
        beforeEach(async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            await l2PriceFeed.mockSetMsgSender(ambBridge.address)
        })

        it("setLatestData", async () => {
            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()
            const dataTimestamp = currentTime.addn(15)
            const r = await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), dataTimestamp, 1)
            await expectEvent.inTransaction(r.tx, l2PriceFeed, "PriceFeedDataSet", {
                key: new BN(toBytes32("ETH")),
                price: toFullDigit(400),
                timestamp: dataTimestamp,
                roundId: "1",
            })
            expect(await l2PriceFeed.getPriceFeedLength(toBytes32("ETH"))).eq(1)

            const price = await l2PriceFeed.getPrice(toBytes32("ETH"))
            expect(price).eq(toFullDigit(400))
            const timestamp = await l2PriceFeed.getLatestTimestamp(toBytes32("ETH"))
            expect(timestamp).eq(dataTimestamp)
        })

        it("set multiple data", async () => {
            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()

            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), currentTime.addn(15), 100)
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(410), currentTime.addn(30), 101)
            const r = await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(420), currentTime.addn(45), 102)
            await expectEvent.inTransaction(r.tx, l2PriceFeed, "PriceFeedDataSet")
            expect(await l2PriceFeed.getPriceFeedLength(toBytes32("ETH"))).eq(3)

            const price = await l2PriceFeed.getPrice(toBytes32("ETH"))
            expect(price).eq(toFullDigit(420))
            const timestamp = await l2PriceFeed.getLatestTimestamp(toBytes32("ETH"))
            expect(timestamp).eq(currentTime.addn(45))
        })

        it("getPrice after remove the aggregator", async () => {
            await l2PriceFeed.mockSetMsgSender(admin)
            await l2PriceFeed.addAggregator(toBytes32("BTC"), { from: admin })

            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()

            await l2PriceFeed.mockSetMsgSender(ambBridge.address)
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), currentTime.addn(15), 100)
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(410), currentTime.addn(30), 101)
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(420), currentTime.addn(45), 102)

            await l2PriceFeed.mockSetMsgSender(admin)
            await l2PriceFeed.removeAggregator(toBytes32("ETH"))

            await expectRevert(l2PriceFeed.getPrice(toBytes32("ETH")), "key not existed")
            await expectRevert(l2PriceFeed.getLatestTimestamp(toBytes32("ETH")), "key not existed")
        })

        it("round id can be the same", async () => {
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), 1000, 100)
            const r = await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), 1001, 100)
            await expectEvent.inTransaction(r.tx, l2PriceFeed, "PriceFeedDataSet")
        })

        it("force error, get data with no price feed data", async () => {
            await l2PriceFeed.mockSetMsgSender(admin)
            expect(await l2PriceFeed.getPriceFeedLength(toBytes32("ETH"))).eq(0)
            expect(await l2PriceFeed.getLatestTimestamp(toBytes32("ETH"))).eq(0)

            await expectRevert(l2PriceFeed.getPrice(toBytes32("ETH")), "no price data")
            await expectRevert(l2PriceFeed.getTwapPrice(toBytes32("ETH"), 1), "Not enough history")
            await expectRevert(l2PriceFeed.getPreviousPrice(toBytes32("ETH"), 0), "Not enough history")
            await expectRevert(l2PriceFeed.getPreviousTimestamp(toBytes32("ETH"), 0), "Not enough history")
        })

        it("force error, aggregator should be set first", async () => {
            await expectRevert(
                l2PriceFeed.setLatestData(toBytes32("BTC"), toFullDigit(400), 1000, 100),
                "key not existed",
            )
        })

        it("force error, timestamp should be larger", async () => {
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), 1000, 100)
            await expectRevert(
                l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), 999, 101),
                "incorrect timestamp",
            )
        })

        it("force error, timestamp can't be the same", async () => {
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), 1000, 100)
            await expectRevert(
                l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), 1000, 101),
                "incorrect timestamp",
            )
        })
    })

    describe("twap", () => {
        beforeEach(async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            await ambBridge.mockSetMessageSender(admin)
            await l2PriceFeed.mockSetMsgSender(ambBridge.address)

            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(15))
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), currentTime.addn(15), 1)
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(30))
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(405), currentTime.addn(30), 2)
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(45))
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(410), currentTime.addn(45), 3)
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(60))
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
            const price = await l2PriceFeed.getTwapPrice(toBytes32("ETH"), 45)
            expect(price).to.eq(toFullDigit(405))
        })

        it("asking interval more than aggregator has", async () => {
            const price = await l2PriceFeed.getTwapPrice(toBytes32("ETH"), 46)
            expect(price).to.eq(toFullDigit(405))
        })

        it("asking interval less than aggregator has", async () => {
            const price = await l2PriceFeed.getTwapPrice(toBytes32("ETH"), 44)
            expect(price).to.eq("405113636363636363636")
        })

        it("given variant price period", async () => {
            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(30))
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(420), currentTime.addn(30), 4)
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(50))

            // twap price should be (400 * 15) + (405 * 15) + (410 * 45) + (420 * 20) / 95 = 409.74
            const price = await l2PriceFeed.getTwapPrice(toBytes32("ETH"), 95)
            expect(price).to.eq("409736842105263157894")
        })

        it("latest price update time is earlier than the request, return the latest price", async () => {
            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(100))

            // latest update time is base + 30, but now is base + 145 and asking for (now - 45)
            // should return the latest price directly
            const price = await l2PriceFeed.getTwapPrice(toBytes32("ETH"), 45)
            expect(price).to.eq(toFullDigit(410))
        })

        it("get 0 while interval is zero", async () => {
            await expectRevert(l2PriceFeed.getTwapPrice(toBytes32("ETH"), 0), "interval can't be 0")
        })
    })

    describe("getPreviousPrice/getPreviousTimestamp", () => {
        let baseTimestamp: BN
        beforeEach(async () => {
            await l2PriceFeed.addAggregator(toBytes32("ETH"))
            await l2PriceFeed.mockSetMsgSender(ambBridge.address)

            const currentTime = await l2PriceFeed.mock_getCurrentTimestamp()
            baseTimestamp = currentTime
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(400), currentTime.addn(15), 1)
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(405), currentTime.addn(30), 2)
            await l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(410), currentTime.addn(45), 3)
            await l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(60))
        })

        it("get previous price (latest)", async () => {
            const price = await l2PriceFeed.getPreviousPrice(toBytes32("ETH"), 0)
            expect(price).to.eq(toFullDigit(410))
            const timestamp = await l2PriceFeed.getPreviousTimestamp(toBytes32("ETH"), 0)
            expect(timestamp).to.eq(baseTimestamp.addn(45))
        })

        it("get previous price", async () => {
            const price = await l2PriceFeed.getPreviousPrice(toBytes32("ETH"), 2)
            expect(price).to.eq(toFullDigit(400))
            const timestamp = await l2PriceFeed.getPreviousTimestamp(toBytes32("ETH"), 2)
            expect(timestamp).to.eq(baseTimestamp.addn(15))
        })

        it("force error, get previous price", async () => {
            await expectRevert(l2PriceFeed.getPreviousPrice(toBytes32("ETH"), 10), "Not enough history")
            await expectRevert(l2PriceFeed.getPreviousTimestamp(toBytes32("ETH"), 10), "Not enough history")
        })
    })
})
