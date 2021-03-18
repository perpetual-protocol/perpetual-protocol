import { artifacts } from "hardhat"
import { expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import { expect, use } from "chai"
import {
    DecimalFakeContract,
    DecimalFakeInstance,
    MixedDecimalFakeContract,
    MixedDecimalFakeInstance,
    SignedDecimalFakeContract,
    SignedDecimalFakeInstance,
} from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { DEFAULT_TOKEN_DECIMALS, toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

const DecimalFake = artifacts.require("DecimalFake") as DecimalFakeContract
const SignedDecimalFake = artifacts.require("SignedDecimalFake") as SignedDecimalFakeContract
const MixedDecimalFake = artifacts.require("MixedDecimalFake") as MixedDecimalFakeContract

const BN_TOKEN_DIGIT = new BN(10).pow(new BN(DEFAULT_TOKEN_DECIMALS))
const INVALID_INT_256 = "0x8FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
const INT_256_MAX = "0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"

describe("Decimal/SignedDecimal/MixedDecimal", () => {
    let decimal: DecimalFakeInstance
    let signDecimal: SignedDecimalFakeInstance
    let mixedDecimal: MixedDecimalFakeInstance

    before(async () => {
        decimal = (await DecimalFake.new()) as DecimalFakeInstance
        signDecimal = (await SignedDecimalFake.new()) as SignedDecimalFakeInstance
        mixedDecimal = (await MixedDecimalFake.new()) as MixedDecimalFakeInstance
    })

    // we don't test add/sub here, they are all covered by SafeMath
    describe("Decimal", () => {
        it("Mul decimals", async () => {
            const ret = await decimal.mul(toDecimal(100), toDecimal(123))
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul scalar", async () => {
            const ret = await decimal.mulScalar(toDecimal(100), 123)
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul scalar with two 18+ digit number", async () => {
            const ret = await decimal.mulScalar(toDecimal(100), toDecimal(123).d)
            expect(ret).to.eq(toFullDigit(12300).mul(BN_TOKEN_DIGIT))
        })

        it("Div decimals", async () => {
            const ret = await decimal.div(toDecimal(12300), toDecimal(123))
            expect(ret).to.eq(toFullDigit(100))
        })

        it("Div scalar", async () => {
            const ret = await decimal.divScalar(toDecimal(12300), 123)
            expect(ret).to.eq(toFullDigit(100))
        })

        it("Div scalar by a 18+ digit number", async () => {
            const ret = await decimal.divScalar(toDecimal(12300), toDecimal(123).d)
            expect(ret).to.eq(100)
        })
    })

    // we don't test add/sub here, they are all covered by SignedSafeMath
    describe("SignedDecimal", () => {
        it("Mul signDecimal (positive x positive)", async () => {
            const ret = await signDecimal.mul(toDecimal(100), toDecimal(123))
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul signDecimal (positive x negative)", async () => {
            const ret = await signDecimal.mul(toDecimal(100), toDecimal(-123))
            expect(ret).to.eq(toFullDigit(-12300))
        })

        it("Mul signDecimal (negative x negative)", async () => {
            const ret = await signDecimal.mul(toDecimal(-100), toDecimal(-123))
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul signedDecimal by positive scalar", async () => {
            const ret = await signDecimal.mulScalar(toDecimal(100), 123)
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul signedDecimal by negative scalar", async () => {
            const ret = await signDecimal.mulScalar(toDecimal(100), -123)
            expect(ret).to.eq(toFullDigit(-12300))
        })

        it("Mul negative signedDecimal by positive scalar", async () => {
            const ret = await signDecimal.mulScalar(toDecimal(-100), 123)
            expect(ret).to.eq(toFullDigit(-12300))
        })

        it("Mul negative signedDecimal by negative scalar", async () => {
            const ret = await signDecimal.mulScalar(toDecimal(-100), -123)
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul scalar with two 18+ digit number", async () => {
            const ret = await signDecimal.mulScalar(toDecimal(100), toDecimal(123).d)
            expect(ret).to.eq(toFullDigit(12300).mul(BN_TOKEN_DIGIT))
        })

        it("Div signDecimals (positive / positive)", async () => {
            const ret = await signDecimal.div(toDecimal(12300), toDecimal(123))
            expect(ret).to.eq(toFullDigit(100))
        })

        it("Div signDecimals (negative / positive)", async () => {
            const ret = await signDecimal.div(toDecimal(-12300), toDecimal(123))
            expect(ret).to.eq(toFullDigit(-100))
        })

        it("Div signDecimals (negative / negative)", async () => {
            const ret = await signDecimal.div(toDecimal(-12300), toDecimal(-123))
            expect(ret).to.eq(toFullDigit(100))
        })

        it("Div positive signDecimal by positive scalar", async () => {
            const ret = await signDecimal.divScalar(toDecimal(12300), 123)
            expect(ret).to.eq(toFullDigit(100))
        })
        it("Div positive signDecimal by negative scalar", async () => {
            const ret = await signDecimal.divScalar(toDecimal(12300), -123)
            expect(ret).to.eq(toFullDigit(-100))
        })
        it("Div negative signDecimal by positive scalar", async () => {
            const ret = await signDecimal.divScalar(toDecimal(-12300), 123)
            expect(ret).to.eq(toFullDigit(-100))
        })

        it("Div negative signDecimal by negative scalar", async () => {
            const ret = await signDecimal.divScalar(toDecimal(-12300), -123)
            expect(ret).to.eq(toFullDigit(100))
        })

        it("Div scalar by a 18+ digit number", async () => {
            const ret = await signDecimal.divScalar(toDecimal(12300), toDecimal(123).d)
            expect(ret).to.eq(100)
        })
    })

    // we don't test add/sub here, they are all covered by SignedSafeMath
    describe("MixedDecimal", () => {
        it("Mul a positive signDecimal by a decimal", async () => {
            const ret = await mixedDecimal.mul(toDecimal(100), toDecimal(123))
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul a negative signDecimal by a decimal", async () => {
            const ret = await mixedDecimal.mul(toDecimal(-100), toDecimal(123))
            expect(ret).to.eq(toFullDigit(-12300))
        })

        it("Mul a positive mixedDecimal by a scalar", async () => {
            const ret = await mixedDecimal.mulScalar(toDecimal(100), 123)
            expect(ret).to.eq(toFullDigit(12300))
        })

        it("Mul a negative mixedDecimal by a scalar", async () => {
            const ret = await mixedDecimal.mulScalar(toDecimal(-100), 123)
            expect(ret).to.eq(toFullDigit(-12300))
        })

        it("Mul scalar with two 18+ digit number", async () => {
            const ret = await mixedDecimal.mulScalar(toDecimal(100), toDecimal(123).d)
            expect(ret).to.eq(toFullDigit(12300).mul(BN_TOKEN_DIGIT))
        })

        it("Div a positive signDecimal by a decimal", async () => {
            const ret = await mixedDecimal.div(toDecimal(12300), toDecimal(123))
            expect(ret).to.eq(toFullDigit(100))
        })

        it("Div a negative signDecimal by a decimal", async () => {
            const ret = await mixedDecimal.div(toDecimal(-12300), toDecimal(123))
            expect(ret).to.eq(toFullDigit(-100))
        })

        it("Div positive mixedDecimal by a positive scalar", async () => {
            const ret = await mixedDecimal.divScalar(toDecimal(12300), 123)
            expect(ret).to.eq(toFullDigit(100))
        })
        it("Div negative mixedDecimal by a scalar", async () => {
            const ret = await mixedDecimal.divScalar(toDecimal(-12300), 123)
            expect(ret).to.eq(toFullDigit(-100))
        })

        it("Div scalar by a 18+ digit number", async () => {
            const ret = await mixedDecimal.divScalar(toDecimal(12300), toDecimal(123).d)
            expect(ret).to.eq(100)
        })

        it("mul by a (2**255 - 1) scalar", async () => {
            const maxInt = new BN(2).pow(new BN(255)).sub(new BN(1))
            const ret = await mixedDecimal.mulScalar({ d: maxInt.toString() }, 1)
            expect(ret).eq(maxInt.toString())
        })

        it("Force error, mul by a 2**255 decimal", async () => {
            await expectRevert(
                mixedDecimal.mul(toDecimal(1), {
                    d: INVALID_INT_256,
                }),
                "MixedDecimal: uint value is bigger than _INT256_MAX",
            )
        })

        it("Force error, mul by a 2**255 scalar", async () => {
            await expectRevert(
                mixedDecimal.mulScalar(toDecimal(1), INVALID_INT_256),
                "MixedDecimal: uint value is bigger than _INT256_MAX",
            )
        })

        it("Force error, div by a 2**255 scalar", async () => {
            await expectRevert(
                mixedDecimal.divScalar(toDecimal(1), INVALID_INT_256),
                "MixedDecimal: uint value is bigger than _INT256_MAX",
            )
        })
    })
})
