import { web3 } from "@nomiclabs/buidler"
import BN from "bn.js"
import { expect } from "chai"
import { ERC20SimpleInstance } from "../../types"
import { deployErc20 } from "../helper/contract"

describe("ERC20Test", () => {
    let accounts: string[]
    let erc20: ERC20SimpleInstance

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()
        erc20 = await deployErc20(new BN("10000"), "Test Token", "TTK")
    })

    describe("balanceOf()", () => {
        it("should have balance", async () => {
            const balance = await erc20.balanceOf(accounts[0])
            expect(balance.toNumber()).to.eq(10000)
        })
    })
})
