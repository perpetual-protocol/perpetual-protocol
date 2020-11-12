import { expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import {
    AmmMockInstance,
    ERC20FakeInstance,
    InsuranceFundFakeContract,
    InsuranceFundFakeInstance,
} from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployErc20Fake } from "../helper/contract"
import { deployAmmMock } from "../helper/mockContract"
import { toFullDigit } from "../helper/number"

use(assertionHelper)

const InsuranceFund = artifacts.require("InsuranceFundFake") as InsuranceFundFakeContract

describe("InsuranceFund Spec", () => {
    let insuranceFund: InsuranceFundFakeInstance
    let amm1!: AmmMockInstance
    let amm2: AmmMockInstance
    let amm3: AmmMockInstance
    let amm4: AmmMockInstance
    let quoteToken1: ERC20FakeInstance
    let quoteToken2: ERC20FakeInstance
    let quoteToken3: ERC20FakeInstance

    beforeEach(async () => {
        insuranceFund = await InsuranceFund.new()
        await insuranceFund.initialize()

        quoteToken1 = await deployErc20Fake(toFullDigit(0), "NAME1", "SYMBOL1")
        quoteToken2 = await deployErc20Fake(toFullDigit(0), "NAME2", "SYMBOL2")
        quoteToken3 = await deployErc20Fake(toFullDigit(0), "NAME3", "SYMBOL3")

        amm1 = await deployAmmMock()
        amm2 = await deployAmmMock()
        amm3 = await deployAmmMock()
        amm4 = await deployAmmMock()

        await amm1.mockSetQuoteAsset(quoteToken1.address)
        await amm2.mockSetQuoteAsset(quoteToken2.address)
        await amm3.mockSetQuoteAsset(quoteToken3.address)
        await amm4.mockSetQuoteAsset(quoteToken1.address)

        const amms = await insuranceFund.getAllAmms()
        expect(amms.length).eq(0)
    })

    describe("amm management", () => {
        it("addAmm", async () => {
            await insuranceFund.addAmm(amm1.address)

            const amms = await insuranceFund.getAllAmms()
            expect(amms.length).eq(1)
            expect(amm1.address).to.eq(amms[0])
        })

        it("force error, amm already added", async () => {
            await insuranceFund.addAmm(amm1.address)
            await expectRevert(insuranceFund.addAmm(amm1.address), "amm already added")
        })

        it("removeAmm", async () => {
            await insuranceFund.addAmm(amm1.address)
            await insuranceFund.addAmm(amm2.address)
            await insuranceFund.removeAmm(amm1.address)

            const amms = await insuranceFund.getAllAmms()
            expect(amm2.address).to.eq(amms[0])
            expect(amms.length).eq(1)
        })

        it("amms, supportedQuoteToken and ammMetadata has being removed if there's no other amm", async () => {
            await insuranceFund.addAmm(amm1.address)
            await insuranceFund.removeAmm(amm1.address)

            const amms = await insuranceFund.getAllAmms()
            expect(amms.length).eq(0)
        })

        it("force error, remove non existed amm", async () => {
            await expectRevert(insuranceFund.removeAmm(amm1.address), "amm not existed")
        })

        // it("isExistedAmm")
    })
})
