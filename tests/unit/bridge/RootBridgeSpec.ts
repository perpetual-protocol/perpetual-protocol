import { web3 } from "@nomiclabs/buidler"
import { expectEvent } from "@openzeppelin/test-helpers"
import { utils } from "ethers"
import { AMBBridgeMockInstance, MultiTokenMediatorMockInstance, RootBridgeInstance } from "../../../types/truffle"
import {
    deployL2MockPriceFeed,
    deployMockAMBBridge,
    deployMockMultiToken,
    deployRootBridge,
} from "../../helper/contract"
import { toDecimal, toFullDigit } from "../../helper/number"

describe("RootBridge Spec", () => {
    let admin: string
    let alice: string

    let rootBridge: RootBridgeInstance
    let ambBridgeMock: AMBBridgeMockInstance
    let multiTokenMediatorMock: MultiTokenMediatorMockInstance

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        ambBridgeMock = await deployMockAMBBridge()
        multiTokenMediatorMock = await deployMockMultiToken()
        rootBridge = await deployRootBridge(ambBridgeMock.address, multiTokenMediatorMock.address)
    })

    it("updatePriceFeed", async () => {
        const price = toDecimal(400)
        const timestamp = "123456789"
        const roundId = "999"

        const priceFeed = await deployL2MockPriceFeed(toFullDigit(400))
        await rootBridge.setPriceFeed(admin)
        const receipt = await rootBridge.updatePriceFeed(
            priceFeed.address,
            utils.formatBytes32String("ETH"),
            price,
            timestamp,
            roundId,
        )
        await expectEvent.inTransaction(receipt.tx, priceFeed, "PriceFeedDataSet", {
            price: price.d,
            timestamp: timestamp,
            roundId: roundId,
        })
    })
})
