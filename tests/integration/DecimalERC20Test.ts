import { artifacts, web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import BN from "bn.js"
import {
    DecimalERC20FakeContract,
    DecimalERC20FakeInstance,
    ERC20FakeInstance,
    ERC20MinimalFakeContract,
    ERC20MinimalFakeInstance,
    TetherTokenContract,
    TetherTokenInstance,
} from "../../types"
import { deployErc20Fake } from "../helper/contract"
import { toDecimal, toFullDigit } from "../helper/number"

const ERC20MinimalFake = artifacts.require("ERC20MinimalFake") as ERC20MinimalFakeContract
const DecimalERC20Fake = artifacts.require("DecimalERC20Fake") as DecimalERC20FakeContract
const TetherToken = artifacts.require("TetherToken") as TetherTokenContract

describe("DecimalERC20", () => {
    let decimalErc20: DecimalERC20FakeInstance
    let erc20: ERC20FakeInstance
    let erc20Minimal: ERC20MinimalFakeInstance
    let tether: TetherTokenInstance
    let admin: string
    let alice: string
    let bob: string
    let decimal: BN
    let digit: BN

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        bob = addresses[2]
        decimalErc20 = await DecimalERC20Fake.new()
        erc20Minimal = await ERC20MinimalFake.new()
    })

    describe("decimal = 8", () => {
        beforeEach(async () => {
            decimal = new BN(8)
            digit = new BN(10).pow(decimal)

            const totalSupply = new BN(1000).mul(digit)
            erc20 = await deployErc20Fake(totalSupply, "NAME", "SYMBOL", decimal)
        })

        it("approve", async () => {
            await decimalErc20.approve(erc20.address, alice, toDecimal(5))
            expect(await erc20.allowance(decimalErc20.address, alice)).eq(new BN(5).mul(digit))
        })

        it("allowance", async () => {
            await erc20.approve(alice, new BN(5).mul(digit), { from: admin })
            expect(await decimalErc20.allowance(erc20.address, admin, alice)).eq(toFullDigit(5))
        })

        it("transfer", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await erc20.transfer(decimalErc20.address, fiveInEightDigit)
            await decimalErc20.transfer(erc20.address, alice, toDecimal(5))
            expect(await erc20.balanceOf(alice)).eq(fiveInEightDigit)
        })

        it("balanceOf", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await erc20.transfer(decimalErc20.address, fiveInEightDigit)
            expect(await decimalErc20.balanceOf(erc20.address, decimalErc20.address)).eq(toFullDigit(5))
        })

        it("transferFrom", async () => {
            await erc20.approve(decimalErc20.address, new BN(5).mul(digit))
            await decimalErc20.transferFrom(erc20.address, admin, alice, toDecimal(5))
            expect(await erc20.balanceOf(alice)).eq(new BN(5).mul(digit))
        })
    })

    describe("decimal = 20", () => {
        beforeEach(async () => {
            decimal = new BN(20)
            digit = new BN(10).pow(decimal)

            const totalSupply = new BN(1000).mul(digit)
            erc20 = await deployErc20Fake(totalSupply, "NAME", "SYMBOL", decimal)
        })

        it("approve", async () => {
            await decimalErc20.approve(erc20.address, alice, toDecimal(5))
            expect(await erc20.allowance(decimalErc20.address, alice)).eq(new BN(5).mul(digit))
        })

        it("allowance", async () => {
            await erc20.approve(alice, new BN(5).mul(digit), { from: admin })
            expect(await decimalErc20.allowance(erc20.address, admin, alice)).eq(toFullDigit(5))
        })

        it("transfer", async () => {
            const five = new BN(5)
            const fiveInTwentyDigit = five.mul(digit)
            await erc20.transfer(decimalErc20.address, fiveInTwentyDigit)
            await decimalErc20.transfer(erc20.address, alice, toDecimal(5))
            expect(await erc20.balanceOf(alice)).eq(fiveInTwentyDigit)
        })

        it("balanceOf", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await erc20.transfer(decimalErc20.address, fiveInEightDigit)
            expect(await decimalErc20.balanceOf(erc20.address, decimalErc20.address)).eq(toFullDigit(5))
        })

        it("transferFrom", async () => {
            await erc20.approve(decimalErc20.address, new BN(5).mul(digit))
            await decimalErc20.transferFrom(erc20.address, admin, alice, toDecimal(5))
            expect(await erc20.balanceOf(alice)).eq(new BN(5).mul(digit))
        })
    })

    describe("IERC20 without decimals", () => {
        beforeEach(async () => {
            erc20Minimal.initializeERC20MinimalFake(toFullDigit(1000))
        })

        it("approve", async () => {
            await expectRevert(
                decimalErc20.approve(erc20Minimal.address, alice, toDecimal(5)),
                "DecimalERC20: get decimals failed",
            )
        })

        it("allowance", async () => {
            await expectRevert(
                decimalErc20.allowance(erc20Minimal.address, admin, alice),
                "DecimalERC20: get decimals failed",
            )
        })

        it("transfer", async () => {
            await erc20Minimal.transfer(decimalErc20.address, toFullDigit(5))
            await expectRevert(
                decimalErc20.transfer(erc20Minimal.address, alice, toDecimal(5)),
                "DecimalERC20: get decimals failed",
            )
        })

        it("balanceOf", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await erc20Minimal.transfer(decimalErc20.address, fiveInEightDigit)
            await expectRevert(
                decimalErc20.balanceOf(erc20Minimal.address, decimalErc20.address),
                "DecimalERC20: get decimals failed",
            )
        })

        it("transferFrom", async () => {
            await erc20Minimal.approve(decimalErc20.address, toFullDigit(5))
            await expectRevert(
                decimalErc20.transferFrom(erc20Minimal.address, admin, alice, toDecimal(5)),
                "DecimalERC20: get decimals failed",
            )
        })
    })

    describe("non-standard ERC20 (tether)", () => {
        beforeEach(async () => {
            tether = await TetherToken.new(toFullDigit(100), "Tether", "USDT", 6)
            decimal = await tether.decimals()
            digit = new BN(10).pow(decimal)
        })

        it("approve", async () => {
            await decimalErc20.approve(tether.address, alice, toDecimal(5))
            expect(await tether.allowance(decimalErc20.address, alice)).eq(new BN(5).mul(digit))
        })

        it("allowance", async () => {
            await tether.approve(alice, new BN(5).mul(digit), { from: admin })
            expect(await decimalErc20.allowance(tether.address, admin, alice)).eq(toFullDigit(5))
        })

        it("transfer", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await tether.transfer(decimalErc20.address, fiveInEightDigit)
            await decimalErc20.transfer(tether.address, alice, toDecimal(5))
            expect(await tether.balanceOf(alice)).eq(fiveInEightDigit)
        })

        it("balanceOf", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await tether.transfer(decimalErc20.address, fiveInEightDigit)
            expect(await decimalErc20.balanceOf(tether.address, decimalErc20.address)).eq(toFullDigit(5))
        })

        it("transferFrom", async () => {
            await tether.approve(decimalErc20.address, new BN(5).mul(digit))
            await decimalErc20.transferFrom(tether.address, admin, alice, toDecimal(5))
            expect(await tether.balanceOf(alice)).eq(new BN(5).mul(digit))
        })

        it("transferFrom with decimals", async () => {
            await tether.transfer(bob, new BN(5).mul(digit))
            await tether.approve(decimalErc20.address, new BN(5).mul(digit), { from: bob })

            await decimalErc20.transferFrom(tether.address, bob, alice, { d: "4999999999999" })
            expect(await tether.balanceOf(alice)).eq("4")
            expect(await tether.balanceOf(bob)).eq("4999996")
        })

        it("transfer with decimals", async () => {
            const five = new BN(5)
            const fiveInEightDigit = five.mul(digit)
            await tether.transfer(decimalErc20.address, fiveInEightDigit)

            await decimalErc20.transfer(tether.address, alice, { d: "4999999999999" })

            expect(await tether.balanceOf(alice)).eq("4")
            expect(await tether.balanceOf(decimalErc20.address)).eq("4999996")
        })

        describe("with fee (same as deflationary token)", () => {
            beforeEach(async () => {
                tether = await TetherToken.new(toFullDigit(1000), "Tether", "USDT", 6)
                decimal = await tether.decimals()
                digit = new BN(10).pow(decimal)
                // set fee ratio to 0.001 and max fee to 10
                await tether.setParams("10", "10")
            })

            it("transfer", async () => {
                const five = new BN(5)
                const fiveInEightDigit = five.mul(digit)
                await tether.transfer(decimalErc20.address, fiveInEightDigit)

                await expectRevert(
                    decimalErc20.transfer(tether.address, alice, toDecimal(1)),
                    "DecimalERC20: balance inconsistent",
                )
            })

            it("transferFrom", async () => {
                await tether.approve(decimalErc20.address, new BN(5).mul(digit))
                await expectRevert(
                    decimalErc20.transferFrom(tether.address, admin, alice, toDecimal(1)),
                    "DecimalERC20: balance inconsistent",
                )
            })
        })
    })

    describe("approve", () => {
        before(async () => {
            erc20 = await deployErc20Fake(toFullDigit(1000), "NAME", "SYMBOL", new BN(18))
        })

        beforeEach(async () => {
            tether = await TetherToken.new(toFullDigit(100), "Tether", "USDT", 6)

            await erc20.approve(alice, toFullDigit(5))
            await tether.approve(alice, toFullDigit(5))
            await decimalErc20.approve(erc20.address, alice, toDecimal(5))
            await decimalErc20.approve(tether.address, alice, toDecimal(5))
        })

        it("re-approve ERC20: approve to 0 and then approve again", async () => {
            await tether.approve(alice, toFullDigit(0))
            const r = await tether.approve(alice, toFullDigit(50))
            expectEvent.inTransaction(r.tx, tether, "Approval")
        })

        it("re-approve ERC20: force error, approve again without resetting to 0", async () => {
            await expectRevert(tether.approve(alice, toFullDigit(50)), "Transaction reverted without a reason")
        })

        it("DecimalERC20: approve", async () => {
            const r = await decimalErc20.approve(tether.address, alice, toDecimal(50))
            expectEvent.inTransaction(r.tx, tether, "Approval")
        })

        it("DecimalERC20: approve many times without resetting to 0", async () => {
            await decimalErc20.approve(tether.address, alice, toDecimal(50))
            const r = await decimalErc20.approve(tether.address, alice, toDecimal(500))
            expectEvent.inTransaction(r.tx, tether, "Approval")
        })

        it("DecimalERC20/general ERC20: approve", async () => {
            const r = await decimalErc20.approve(erc20.address, alice, toDecimal(50))
            expectEvent.inTransaction(r.tx, erc20, "Approval")
        })

        it("DecimalERC20/general ERC20: approve many times without resetting to 0", async () => {
            await decimalErc20.approve(erc20.address, alice, toDecimal(50))
            const r = await decimalErc20.approve(erc20.address, alice, toDecimal(500))
            expectEvent.inTransaction(r.tx, erc20, "Approval")
        })
    })
})
