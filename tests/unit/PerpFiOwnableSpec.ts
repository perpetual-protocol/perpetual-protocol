import { artifacts, web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import {
    PerpFiOwnableFakeContract,
    PerpFiOwnableFakeInstance,
    PerpFiOwnableUpgradeFakeContract,
    PerpFiOwnableUpgradeFakeInstance,
} from "types/truffle"

const PerpFiOwnableUpgradeFake = artifacts.require("PerpFiOwnableUpgradeFake") as PerpFiOwnableUpgradeFakeContract
const PerpFiOwnableFake = artifacts.require("PerpFiOwnableFake") as PerpFiOwnableFakeContract

describe("PerpFiOwnable UT", () => {
    let perpFiOwnable: PerpFiOwnableFakeInstance

    let addresses: string[]
    let admin: string
    let alice: string

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        perpFiOwnable = (await PerpFiOwnableFake.new()) as PerpFiOwnableFakeInstance
    })

    it("transfer ownership", async () => {
        await perpFiOwnable.setOwner(alice)
        const r = await perpFiOwnable.updateOwner({ from: alice })
        expectEvent.inTransaction(r.tx, perpFiOwnable, "OwnershipTransferred", {
            previousOwner: admin,
            newOwner: alice,
        })
    })

    it("transfer ownership and set owner to another", async () => {
        await perpFiOwnable.setOwner(alice)
        const r = await perpFiOwnable.updateOwner({ from: alice })
        expectEvent.inTransaction(r.tx, perpFiOwnable, "OwnershipTransferred")

        // only owner can set owner, now owner is alice
        await perpFiOwnable.setOwner(admin, { from: alice })
        expect(await perpFiOwnable.candidate()).eq(admin)
    })

    it("force error, only owner can call setOwner", async () => {
        await expectRevert(perpFiOwnable.setOwner(alice, { from: alice }), "PerpFiOwnable: caller is not the owner")
    })

    it("force error set current owner", async () => {
        await expectRevert(perpFiOwnable.setOwner(admin), "PerpFiOwnable: same as original")
    })

    it("force error, update owner but caller not the new owner", async () => {
        await perpFiOwnable.setOwner(alice)
        await expectRevert(perpFiOwnable.updateOwner({ from: admin }), "PerpFiOwnable: not the new owner")
    })

    it("force error, update owner without set a new owner first", async () => {
        await expectRevert(perpFiOwnable.updateOwner({ from: admin }), "PerpFiOwnable: candidate is zero address")
    })

    it("force error, can not update twice", async () => {
        await perpFiOwnable.setOwner(alice)
        const r = await perpFiOwnable.updateOwner({ from: alice })
        expectEvent.inTransaction(r.tx, perpFiOwnable, "OwnershipTransferred")
        await expectRevert(perpFiOwnable.updateOwner({ from: alice }), "PerpFiOwnable: candidate is zero address")
    })
})

describe("PerpFiOwnableUpgrade UT", () => {
    let perpFiOwnable: PerpFiOwnableUpgradeFakeInstance

    let addresses: string[]
    let admin: string
    let alice: string

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        perpFiOwnable = (await PerpFiOwnableUpgradeFake.new()) as PerpFiOwnableUpgradeFakeInstance
        await perpFiOwnable.initialize()
    })

    it("transfer ownership", async () => {
        await perpFiOwnable.setOwner(alice)
        const r = await perpFiOwnable.updateOwner({ from: alice })
        expectEvent.inTransaction(r.tx, perpFiOwnable, "OwnershipTransferred", {
            previousOwner: admin,
            newOwner: alice,
        })
    })

    it("transfer ownership and set owner to another", async () => {
        await perpFiOwnable.setOwner(alice)
        const r = await perpFiOwnable.updateOwner({ from: alice })
        expectEvent.inTransaction(r.tx, perpFiOwnable, "OwnershipTransferred")

        // only owner can set owner, now owner is alice
        await perpFiOwnable.setOwner(admin, { from: alice })
        expect(await perpFiOwnable.candidate()).eq(admin)
    })

    it("force error, only owner can call setOwner", async () => {
        await expectRevert(
            perpFiOwnable.setOwner(alice, { from: alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    })

    it("force error set current owner", async () => {
        await expectRevert(perpFiOwnable.setOwner(admin), "PerpFiOwnableUpgrade: same as original")
    })

    it("force error, update owner but caller not the new owner", async () => {
        await perpFiOwnable.setOwner(alice)
        await expectRevert(perpFiOwnable.updateOwner({ from: admin }), "PerpFiOwnableUpgrade: not the new owner")
    })

    it("force error, update owner without set a new owner first", async () => {
        await expectRevert(
            perpFiOwnable.updateOwner({ from: admin }),
            "PerpFiOwnableUpgrade: candidate is zero address",
        )
    })

    it("force error, can not update twice", async () => {
        await perpFiOwnable.setOwner(alice)
        const r = await perpFiOwnable.updateOwner({ from: alice })
        expectEvent.inTransaction(r.tx, perpFiOwnable, "OwnershipTransferred")
        await expectRevert(
            perpFiOwnable.updateOwner({ from: alice }),
            "PerpFiOwnableUpgrade: candidate is zero address",
        )
    })
})
