import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import {
    AmmFakeInstance,
    AmmMockInstance,
    ERC20FakeInstance,
    ExchangeWrapperMockInstance,
    InsuranceFundFakeInstance,
    PerpTokenInstance,
} from "../../types"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployErc20Fake, deployMockExchangeWrapper } from "../helper/contract"
import { fullDeploy } from "../helper/deploy"
import { deployAmmMock } from "../helper/mockContract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

describe("InsuranceFund", () => {
    let perpToken: PerpTokenInstance
    let insuranceFund: InsuranceFundFakeInstance
    let mockExchange: ExchangeWrapperMockInstance
    let dao: string
    let bob: string
    let carol: string
    let quoteToken: ERC20FakeInstance
    let quoteToken2: ERC20FakeInstance
    let quoteToken3: ERC20FakeInstance
    let quoteToken4: ERC20FakeInstance
    let amm: AmmFakeInstance
    let amm2: AmmMockInstance
    let amm3: AmmMockInstance
    let amm4: AmmMockInstance

    beforeEach(async () => {
        const accounts = await web3.eth.getAccounts()
        dao = accounts[0]
        bob = accounts[1]
        carol = accounts[2]

        const contracts = await fullDeploy({ sender: dao })
        quoteToken = contracts.quoteToken
        insuranceFund = contracts.insuranceFund
        perpToken = contracts.perpToken
        mockExchange = await deployMockExchangeWrapper()

        await insuranceFund.setBeneficiary(dao, { from: dao })
        await insuranceFund.setExchange(mockExchange.address)
        await mockExchange.mockSetSwapRatio(toDecimal(1))
        await perpToken.addMinter(insuranceFund.address)

        quoteToken2 = await deployErc20Fake(toFullDigit(1000000), "NAME2", "SYMBOL2")
        quoteToken3 = await deployErc20Fake(toFullDigit(1000000), "NAME3", "SYMBOL3")
        quoteToken4 = await deployErc20Fake(toFullDigit(1000000), "NAME4", "SYMBOL4")

        // TODO use instance instead of mock
        amm = contracts.amm
        amm2 = await deployAmmMock()
        amm3 = await deployAmmMock()
        amm4 = await deployAmmMock()

        await amm2.mockSetQuoteAsset(quoteToken2.address)
        await amm3.mockSetQuoteAsset(quoteToken3.address)
        await amm4.mockSetQuoteAsset(quoteToken4.address)
    })

    describe("withdraw", () => {
        beforeEach(async () => {
            await quoteToken.transfer(bob, toFullDigit(1000, +(await quoteToken.decimals())))
            expect(await quoteToken.balanceOf(bob)).to.eq(toFullDigit(1000, +(await quoteToken.decimals())))

            await quoteToken.transfer(insuranceFund.address, toFullDigit(500000, +(await quoteToken.decimals())))
            const balance = await quoteToken.balanceOf(insuranceFund.address)
            expect(balance).to.eq(toFullDigit(500000, +(await quoteToken.decimals())))
        })

        it("withdraw, transfer to withdrawer", async () => {
            const receipt = await insuranceFund.withdraw(quoteToken.address, toDecimal(200), { from: dao })
            expectEvent(receipt, "Withdrawn", {
                withdrawer: dao,
                amount: toFullDigit(200),
            })
        })

        it("force error, withdraw to not allowed address", async () => {
            await expectRevert(
                insuranceFund.withdraw(quoteToken.address, toDecimal(200), { from: carol }),
                "caller is not beneficiary",
            )
        })

        // TODO Add more cases for exchange exception/error
        it("force error, withdraw when exchange exception", async () => {
            // TODO wait for exchangeWrapper implemented
            // await expectRevert(insuranceFund.withdraw(quoteToken.address, toDecimal(200), { from: bob }), error)
        })
    })

    describe("mint staking token when balance is not enough", () => {
        beforeEach(async () => {
            await quoteToken.transfer(mockExchange.address, toFullDigit(100000, +(await quoteToken.decimals())))
            await perpToken.transfer(mockExchange.address, toFullDigit(100000))
            await quoteToken.transfer(insuranceFund.address, toFullDigit(5000, +(await quoteToken.decimals())))

            // set exchange 1 DAI for 1 PERP
            await mockExchange.mockSetSwapRatio(toDecimal(1))
        })

        it("withdraw when pool is drained and mint perp token to pay", async () => {
            // drain the pool of quoteToken first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(5000))

            // withdraw quoteToken again
            const receipt = await insuranceFund.withdraw(quoteToken.address, toDecimal(100))

            // PERP balance is 1,000,000 + 100 = 1,000,100
            expect(await perpToken.totalSupply()).to.eq(toFullDigit(1000100))
            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
        })

        it("withdraw when pool is almost drained and mint perp token to pay", async () => {
            // drain the pool of quoteToken first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(4900))

            // withdraw quoteToken again
            const receipt = await insuranceFund.withdraw(quoteToken.address, toDecimal(200))

            // debt is 200 - 100 = 100
            // PERP balance is 1,000,000 + 100 = 1,000,100
            expect(await perpToken.totalSupply()).to.eq(toFullDigit(1000100))
            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
        })

        it("withdraw when pool is drained and mint perp token with exchange ratio is 2", async () => {
            // set exchange 2DAI for 1 PERP
            await mockExchange.mockSetSwapRatio(toDecimal(2))

            // drain the pool of quoteToken first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(5000))

            // withdraw quoteToken again
            const receipt = await insuranceFund.withdraw(quoteToken.address, toDecimal(100))

            // PERP balance is 1,000,000 + 100 = 1,000,100
            expect(await perpToken.totalSupply()).to.eq(toFullDigit(1000200))
            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
        })
    })

    // Handle withdraw test cases when having multi assets
    describe("withdraw when multi asset", () => {
        beforeEach(async () => {
            await quoteToken.transfer(mockExchange.address, toFullDigit(100000, +(await quoteToken.decimals())))
            await quoteToken2.transfer(mockExchange.address, toFullDigit(100000))
            await quoteToken3.transfer(mockExchange.address, toFullDigit(100000))
            await perpToken.transfer(mockExchange.address, toFullDigit(100000))

            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.addAmm(amm3.address)

            await quoteToken.transfer(insuranceFund.address, toFullDigit(5000, +(await quoteToken.decimals())))
            await quoteToken2.transfer(insuranceFund.address, toFullDigit(4000))
            await quoteToken3.transfer(insuranceFund.address, toFullDigit(3000))

            // set exchange 1 DAI for 1 PERP
            await mockExchange.mockSetSwapRatio(toDecimal(1))
        })

        it("asset 1 is drained, asset 2 should pay first", async () => {
            // drain the pool of quoteToken first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(5000))

            // withdraw quoteToken again
            await insuranceFund.withdraw(quoteToken.address, toDecimal(100))

            // quoteToken2 should pay back for quoteToken, the balance should be 3900
            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
            expect(await quoteToken2.balanceOf(insuranceFund.address)).eq(toFullDigit(3900))
            expect(await quoteToken3.balanceOf(insuranceFund.address)).eq(toFullDigit(3000))
        })

        it("asset 1 is almost drained, asset 2 should pay first", async () => {
            // drain the pool of quoteToken first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(4900))

            // withdraw quoteToken again
            // 200 DAI needs 100 staking token
            // balance of quoteToken is 100 and still has 100 debt
            // quoteToken2 helps to pay the other 100, balance quoteToken2 should be 3900
            await insuranceFund.withdraw(quoteToken.address, toDecimal(200))

            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
            expect(await quoteToken2.balanceOf(insuranceFund.address)).eq(toFullDigit(3900))
            expect(await quoteToken3.balanceOf(insuranceFund.address)).eq(toFullDigit(3000))
        })

        it("asset 1 and 2 is almost drained, asset 3 should pay first", async () => {
            // drain the pool of quoteToken and quoteToken2 first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(4900))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(3900))

            // withdraw quoteToken again
            // balance of quoteToken is 100 and still has 200 debt
            // balance of quoteToken3 is 3000 - 200 = 2800
            await insuranceFund.withdraw(quoteToken.address, toDecimal(300))

            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
            expect(await quoteToken2.balanceOf(insuranceFund.address)).eq(toFullDigit(100))
            expect(await quoteToken3.balanceOf(insuranceFund.address)).eq(toFullDigit(2800))
        })

        it("all the assets is almost drained, mint perp token to pay", async () => {
            // drain the pool of quoteToken and quoteToken2 first.
            await insuranceFund.withdraw(quoteToken.address, toDecimal(4900))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(3900))
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(2900))

            // withdraw quoteToken again
            // balance of quoteToken is 100 and still has 400 debt
            // balance of quoteToken2 is 100 and still has 300 debt
            // balance of quoteToken3 is 100 and still has 200 debt
            // mint 200 perp token
            const receipt = await insuranceFund.withdraw(quoteToken.address, toDecimal(500))

            // PERP supply is 1,000,000 + 200 = 1,000,200
            expect(await perpToken.totalSupply()).to.eq(toFullDigit(1000200))
            expect(await quoteToken.balanceOf(insuranceFund.address)).eq("0")
            expect(await quoteToken2.balanceOf(insuranceFund.address)).eq("0")
            expect(await quoteToken3.balanceOf(insuranceFund.address)).eq("0")
        })
    })

    describe("sorting with multi-asset", () => {
        beforeEach(async () => {
            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.addAmm(amm3.address)
            await insuranceFund.addAmm(amm4.address)

            await quoteToken.transfer(insuranceFund.address, toFullDigit(5000, +(await quoteToken.decimals())))
            await quoteToken2.transfer(insuranceFund.address, toFullDigit(4000))
            await quoteToken3.transfer(insuranceFund.address, toFullDigit(3000))
            await quoteToken4.transfer(insuranceFund.address, toFullDigit(2000))
        })

        it("in descending order", async () => {
            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1.length).to.eq(3)
            expect(order1[0]).to.eq(quoteToken2.address)
            expect(order1[2]).to.eq(quoteToken4.address)

            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken2.address)
            expect(order2.length).to.eq(3)
            expect(order2[0]).to.eq(quoteToken.address)
            expect(order2[2]).to.eq(quoteToken4.address)

            const order4 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken4.address)
            expect(order4.length).to.eq(3)
            expect(order4[0]).to.eq(quoteToken.address)
            expect(order4[2]).to.eq(quoteToken3.address)
        })

        it("in ascending order", async () => {
            // the balance of quoteToken, quoteToken2, quoteToken3, quoteToken4
            // will be 500, 1000, 1500, 2000
            await insuranceFund.withdraw(quoteToken.address, toDecimal(4500))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(3000))
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(1500))

            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1.length).to.eq(3)
            expect(order1[0]).to.eq(quoteToken4.address)
            expect(order1[2]).to.eq(quoteToken2.address)

            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken2.address)
            expect(order2.length).to.eq(3)
            expect(order2[0]).to.eq(quoteToken4.address)
            expect(order2[2]).to.eq(quoteToken.address)

            const order4 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken4.address)
            expect(order4.length).to.eq(3)
            expect(order4[0]).to.eq(quoteToken3.address)
            expect(order4[2]).to.eq(quoteToken.address)
        })

        it("arbitrary order, the excluded one has least/most money", async () => {
            // the balance of quoteToken, quoteToken2, quoteToken3, quoteToken4
            // will be 3000, 1000, 2000, 1500
            await insuranceFund.withdraw(quoteToken.address, toDecimal(2000))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(3000))
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(1000))
            await insuranceFund.withdraw(quoteToken4.address, toDecimal(500))

            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1[0]).to.eq(quoteToken3.address)
            expect(order1[2]).to.eq(quoteToken2.address)

            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken2.address)
            expect(order2[0]).to.eq(quoteToken.address)
            expect(order2[2]).to.eq(quoteToken4.address)
        })

        it("arbitrary order, the excluded one has the same balance as another one", async () => {
            // the balance of quoteToken, quoteToken2, quoteToken3, quoteToken4
            // will be 3000, 1000, 1000, 1500
            await insuranceFund.withdraw(quoteToken.address, toDecimal(2000))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(3000))
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(2000))
            await insuranceFund.withdraw(quoteToken4.address, toDecimal(500))

            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1[0]).to.eq(quoteToken4.address)
            expect(order1[2]).to.eq(quoteToken3.address)

            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken2.address)
            expect(order2[0]).to.eq(quoteToken.address)
            expect(order2[2]).to.eq(quoteToken3.address)
        })

        it("arbitrary order, the excluded one has the same balance as another one and at head/tail", async () => {
            // the balance of quoteToken, quoteToken2, quoteToken3, quoteToken4
            // will be 2000, 2000, 1000, 1500
            await insuranceFund.withdraw(quoteToken.address, toDecimal(3000))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(2000))
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(2000))
            await insuranceFund.withdraw(quoteToken4.address, toDecimal(500))

            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1[0]).to.eq(quoteToken2.address)
            expect(order1[2]).to.eq(quoteToken3.address)

            // the balance of quoteToken, quoteToken2, quoteToken3, quoteToken4
            // will be 1500, 2000, 1000, 1500
            await insuranceFund.withdraw(quoteToken.address, toDecimal(500))
            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken4.address)
            expect(order2[0]).to.eq(quoteToken2.address)
            expect(order2[2]).to.eq(quoteToken3.address)
        })

        it("tokens with diff price", async () => {
            await mockExchange.mockSetSwapRatio(toDecimal(2))
            // the balance of quoteToken, quoteToken2, quoteToken3, quoteToken4
            // will be 2000, 1500, 1000, 2000
            // but the value will be 2000, 750, 500, 1000
            await insuranceFund.withdraw(quoteToken.address, toDecimal(3000))
            await insuranceFund.withdraw(quoteToken2.address, toDecimal(2500))
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(2000))

            // exclude token1 (the first and richest one)
            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1[0]).to.eq(quoteToken4.address)
            expect(order1[2]).to.eq(quoteToken3.address)

            // exclude token2 (the richest one but in the middle of array)
            // balance of tokens 2000, 1500, 1000, 2000
            // but value will be 1000, 1500,  500, 1000
            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken2.address)
            expect(order2[0]).to.eq(quoteToken.address)
            expect(order2[2]).to.eq(quoteToken3.address)

            // exclude token3 (the least one)
            // balance of tokens 1000, 1500, 500, 2000
            // but value will be  500,  750, 500, 1000
            await insuranceFund.withdraw(quoteToken3.address, toDecimal(500))
            await insuranceFund.withdraw(quoteToken.address, toDecimal(1000))
            const order3 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken3.address)
            expect(order3[0]).to.eq(quoteToken4.address)
            expect(order3[2]).to.eq(quoteToken.address)
        })
    })

    describe("sorting with multi-asset with 0 balance", () => {
        beforeEach(async () => {
            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.addAmm(amm3.address)
            await insuranceFund.addAmm(amm4.address)
        })

        it("in descending order", async () => {
            const order1 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken.address)
            expect(order1.length).to.eq(3)
            expect(order1[0]).to.eq(quoteToken2.address)
            expect(order1[2]).to.eq(quoteToken4.address)

            const order2 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken2.address)
            expect(order2.length).to.eq(3)
            expect(order2[0]).to.eq(quoteToken.address)
            expect(order2[2]).to.eq(quoteToken4.address)

            const order4 = await insuranceFund.testGetOrderedQuoteTokens(quoteToken4.address)
            expect(order4.length).to.eq(3)
            expect(order4[0]).to.eq(quoteToken.address)
            expect(order4[2]).to.eq(quoteToken3.address)
        })

        it("order quoteTokens after removing token", async () => {
            await insuranceFund.removeToken(quoteToken.address)

            const orders = await insuranceFund.testGetOrderedQuoteTokens(quoteToken4.address)
            expect(orders[1]).eq(quoteToken3.address)
            expect(orders[0]).eq(quoteToken2.address)
        })
    })

    describe("add/remove tokens", () => {
        it("add token", async () => {
            await insuranceFund.addAmm(amm2.address)
            expect(await insuranceFund.quoteTokens(1)).to.eq(quoteToken2.address)

            await insuranceFund.addAmm(amm3.address)
            expect(await insuranceFund.quoteTokens(2)).to.eq(quoteToken3.address)
        })

        it("add token with existing one", async () => {
            expect(await insuranceFund.getQuoteTokenLength()).to.eq(1)
            const amm5 = await deployAmmMock()
            await amm5.mockSetQuoteAsset(quoteToken.address)
            await insuranceFund.addAmm(amm5.address)
            expect(await insuranceFund.getQuoteTokenLength()).to.eq(1)
        })

        it("remove token", async () => {
            // token array [1, 2, 3, 4]
            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.addAmm(amm3.address)
            await insuranceFund.addAmm(amm4.address)

            // token array [4, 2, 3]
            await insuranceFund.removeToken(quoteToken.address)
            expect(await insuranceFund.quoteTokens(0)).to.eq(quoteToken4.address)
            expect(await insuranceFund.quoteTokens(2)).to.eq(quoteToken3.address)

            // token array [4, 2]
            await insuranceFund.removeToken(quoteToken3.address)
            expect(await insuranceFund.quoteTokens(1)).to.eq(quoteToken2.address)
        })

        it("remove token non-existing token", async () => {
            await insuranceFund.addAmm(amm2.address)
            expect(await insuranceFund.getQuoteTokenLength()).to.eq(2)

            await expectRevert(insuranceFund.removeToken(quoteToken3.address), "token not existed")
        })

        it("remove token and exchange token left to another left quote token pool", async () => {
            await quoteToken2.transfer(insuranceFund.address, toFullDigit(2000))
            await quoteToken.transfer(mockExchange.address, toFullDigit(2000, +(await quoteToken.decimals())))

            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.removeToken(quoteToken2.address)
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq(
                toFullDigit(2000, +(await quoteToken.decimals())),
            )
            expect(await quoteToken2.balanceOf(insuranceFund.address)).to.eq("0")
        })

        it("remove token and exchange token left to the last one (with the most token value), ", async () => {
            await quoteToken2.transfer(insuranceFund.address, toFullDigit(2000))
            await quoteToken3.transfer(insuranceFund.address, toFullDigit(5000))
            await quoteToken4.transfer(insuranceFund.address, toFullDigit(2000))
            await quoteToken3.transfer(mockExchange.address, toFullDigit(2000))

            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.addAmm(amm3.address)
            await insuranceFund.removeToken(quoteToken2.address)
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("0")
            expect(await quoteToken2.balanceOf(insuranceFund.address)).to.eq("0")
            expect(await quoteToken3.balanceOf(insuranceFund.address)).to.eq(toFullDigit(7000))
        })

        it("remove token and no pool left, buy perp", async () => {
            await quoteToken.transfer(insuranceFund.address, toFullDigit(2000, +(await quoteToken.decimals())))
            await perpToken.transfer(mockExchange.address, toFullDigit(2000))

            await insuranceFund.removeToken(quoteToken.address)
            expect(await perpToken.balanceOf(insuranceFund.address)).to.eq(toFullDigit(2000))
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("0")
        })
    })
})
