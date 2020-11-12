import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { PerpTokenInstance } from "types/truffle"
import { deployPerpToken } from "../helper/contract"
import { toFullDigit } from "../helper/number"

use(chaiAsPromised)

describe("PerpToken Unit Test", () => {
    let addresses: string[]
    let admin: string
    let alice: string
    let bob: string
    let carol: string
    let perpToken: PerpTokenInstance

    const initialValue = 100_000_000

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        bob = addresses[2]
        carol = addresses[3]

        perpToken = await deployPerpToken(toFullDigit(initialValue))
    })

    describe("basic ERC20", () => {
        beforeEach(async () => {
            const receipt = await perpToken.transfer(alice, toFullDigit(1000), { from: admin })
            expectEvent(receipt, "Transfer")
        })

        it("approveAndAllowance", async () => {
            await perpToken.approve(bob, toFullDigit(10), { from: alice })
            const allowed = await perpToken.allowance(alice, bob)
            expect(allowed).to.eq(toFullDigit(10))
        })

        it("balance of alice should be 1000", async () => {
            const balance = await perpToken.balanceOf(alice)
            expect(balance).to.eq(toFullDigit(1000))
        })

        it("balance of no body should be zero", async () => {
            const balance = await perpToken.balanceOf(carol)
            expect(balance).to.eq(0)
        })

        it("total supply", async () => {
            const totalSupply = await perpToken.totalSupply()
            expect(totalSupply).to.eq(toFullDigit(initialValue))
        })

        it("transfer", async () => {
            await perpToken.transfer(bob, toFullDigit(100), { from: alice })
            expect(await perpToken.balanceOf(bob)).to.eq(toFullDigit(100))
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(900))
        })

        it("force error, transferFrom but not enough allowance", async () => {
            // 1. Transfer from non-approved allowance, failed.
            await expectRevert(
                perpToken.transferFrom(alice, bob, toFullDigit(10), { from: alice }),
                "ERC20: transfer amount exceeds allowance",
            )

            // Approve 10 of allowance
            let receipt = await perpToken.approve(bob, toFullDigit(10), { from: alice })
            expectEvent(receipt, "Approval")

            // 2. Transfer from not enough allowance, failed.
            await expectRevert(
                perpToken.transferFrom(alice, bob, toFullDigit(15)),
                "ERC20: transfer amount exceeds allowance",
            )

            // 3. Transfer from success
            receipt = await perpToken.transferFrom(alice, carol, toFullDigit(8), { from: bob })
            expectEvent(receipt, "Transfer")
            expect(await perpToken.balanceOf(alice)).to.eq(toFullDigit(992)) // 1000 - 8
            expect(await perpToken.allowance(alice, bob)).to.eq(toFullDigit(2))
            expect(await perpToken.balanceOf(carol)).to.eq(toFullDigit(8))
        })

        it("force error, transferFrom but not enough balance", async () => {
            // 1. Transfer from non-approved allowance, failed.
            await expectRevert(
                perpToken.transferFrom(bob, carol, toFullDigit(10), { from: bob }),
                "ERC20: transfer amount exceeds balance",
            )

            // Approve 10 of allowance
            const receipt = await perpToken.approve(bob, toFullDigit(10), { from: alice })
            expectEvent(receipt, "Approval")

            // 2. Transfer from enough allowance but not enough balance to transfer, failed.
            await expectRevert(
                perpToken.transferFrom(bob, carol, toFullDigit(100), { from: bob }),
                "ERC20: transfer amount exceeds balance",
            )
            expect(await perpToken.allowance(alice, bob)).to.eq(toFullDigit(10))
        })
    })
})
