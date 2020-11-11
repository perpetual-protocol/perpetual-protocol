import { web3 } from "@nomiclabs/buidler"
import { expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import chaiAsPromised from "chai-as-promised"
import {
    BalancerMockInstance,
    CErc20Contract,
    CUsdtMockInstance,
    ERC20Contract,
    ERC20FakeInstance,
    ERC20Instance,
    ExchangeWrapperContract,
    ExchangeWrapperInstance,
    PerpTokenContract,
    PerpTokenInstance,
    TetherTokenContract,
    TetherTokenInstance,
} from "../../types"
import { deployErc20Fake, deployExchangeWrapper, deployMockBalancer, deployMockCUsdt } from "../helper/contract"
import { toDecimal, toFullDigit } from "../helper/number"
use(chaiAsPromised)

const ExchangeWrapper = artifacts.require("ExchangeWrapper") as ExchangeWrapperContract
const PerpToken = artifacts.require("PerpToken") as PerpTokenContract
const CErc20 = artifacts.require("CErc20") as CErc20Contract
const ERC20 = artifacts.require("ERC20") as ERC20Contract
const TetherToken = artifacts.require("TetherToken") as TetherTokenContract

describe("ExchangeWrapper UT", () => {
    let addresses: string[]
    let admin: string
    let alice: string

    let exchangeWrapper: ExchangeWrapperInstance
    let tether: TetherTokenInstance
    let usdc: TetherTokenInstance
    let erc20Fake: ERC20FakeInstance
    let CUsdt: CUsdtMockInstance
    let balancer: BalancerMockInstance

    before(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        tether = await TetherToken.new(toFullDigit(1000), "Tether", "USDT", 6)
        usdc = await TetherToken.new(toFullDigit(1000), "USDC", "USDC", 6)
        erc20Fake = await deployErc20Fake(toFullDigit(10000), "NAME", "SYMBOL")
        CUsdt = await deployMockCUsdt()
        balancer = await deployMockBalancer(erc20Fake.address, CUsdt.address)

        await CUsdt.mockSetUnderlying(tether.address)
        exchangeWrapper = await deployExchangeWrapper(balancer.address, CUsdt.address, erc20Fake.address)
    })

    it("getSpotPrice, usdc in", async () => {
        // tether 6 decimals, erc20Fake 18 decimals
        // spot price will be n*(e-(18-6))*e18 = n*(e-12)*e18 = n*e6
        // assuming n = 1 here
        await balancer.mockSetSpotPrice("1000000")
        const r = await exchangeWrapper.getSpotPrice(usdc.address, erc20Fake.address)
        expect(r).to.eq(toFullDigit(1))
    })

    it("getSpotPrice, usdc out", async () => {
        // tether 6 decimals, erc20Fake 18 decimals
        // spot price will be n*(e(18-6))*e18 = n*(e12)*e18 = n*e30
        // assuming n = 1 here
        await balancer.mockSetSpotPrice(toFullDigit(1000000000000))
        const r = await exchangeWrapper.getSpotPrice(erc20Fake.address, usdc.address)
        expect(r).to.eq(toFullDigit(1))
    })

    it("getSpotPrice, tether in", async () => {
        // cToken 8 decimals, erc20Fake 18 decimals
        // spot price will be n*(e-(18-8))*e18 = n*(e-10)*e18 = n*e8
        // assuming n = 1 here
        await balancer.mockSetSpotPrice("100000000")
        // set exchange ratio of cToken to 0.01, which means cUSDT:USDT = 1:1
        // 0.01 represents the decimal difference 8 decimals of cUSDT and 6 decimals of USDT
        await CUsdt.mockSetExchangeRateStored(toFullDigit(0.01))
        const r = await exchangeWrapper.getSpotPrice(tether.address, erc20Fake.address)
        expect(r).to.eq(toFullDigit(1))
    })

    it("getSpotPrice, tether out", async () => {
        // cToken 8 decimals, erc20Fake 18 decimals
        // spot price will be n*(e(18-8))*e18 = n*(e10)*e18 = n*e28
        // assuming n = 1 here
        await balancer.mockSetSpotPrice(toFullDigit(10000000000))
        // set exchange ratio of cToken to 0.01, which means cUSDT:USDT = 1:1
        // 0.01 represents the decimal difference 8 decimals of cUSDT and 6 decimals of USDT
        await CUsdt.mockSetExchangeRateStored(toFullDigit(0.01))
        await CUsdt.mockSetExchangeRateStored(toFullDigit(0.01))
        const r = await exchangeWrapper.getSpotPrice(erc20Fake.address, tether.address)
        expect(r).to.eq(toFullDigit(1))
    })

    it("getSpotPrice, erc20 in/out", async () => {
        const spotPrice = await exchangeWrapper.getSpotPrice(erc20Fake.address, erc20Fake.address)
        expect(spotPrice).to.eq(toFullDigit(1))
    })

    it("getSpotPrice, usdc in/out", async () => {
        const spotPrice = await exchangeWrapper.getSpotPrice(usdc.address, usdc.address)
        expect(spotPrice).to.eq(toFullDigit(1))
    })

    it("getSpotPrice, usdt in/out", async () => {
        const spotPrice = await exchangeWrapper.getSpotPrice(tether.address, tether.address)
        expect(spotPrice).to.eq(toFullDigit(1))
    })

    it("force error, only owner can setBalancerPool", async () => {
        await expectRevert(
            exchangeWrapper.setBalancerPool(alice, { from: alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    })
    it("force error, only owner can setCompoundCUsdt", async () => {
        await expectRevert(
            exchangeWrapper.setCompoundCUsdt(alice, { from: alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    })
    it("force error, only owner can approve", async () => {
        await expectRevert(
            exchangeWrapper.approve(alice, alice, toDecimal(10), { from: alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    })
})

// kovan
// Perp Token: 0xbe216554aF577Ae8F6CE7415D2d08A224b3Cdc1b
// Compound:
//  cUSDT : 0x3f0a0ea2f86bae6362cf9799b523ba06647da018
//  USDT: 0x07de306ff27a2b630b1141956844eb1552b956b5
// Balancer:
//  Perp/cUSDT : 0x081D79E1c970DF4efF76aF11352121B06C779945
describe.skip("ExchangeWrapper testing code on Kovan", () => {
    let addresses: string[]
    let admin: string
    let exchangeWrapper: ExchangeWrapperInstance
    let perpToken: PerpTokenInstance
    let cToken: ERC20Instance
    let cUSDT: string
    let balancerPool: string
    let usdt: string
    let erc20: ERC20Instance

    before(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        // perpToken = await deployPerpToken(toFullDigit(1000000))
        perpToken = await PerpToken.at("0xbe216554aF577Ae8F6CE7415D2d08A224b3Cdc1b")

        // Compound
        usdt = "0x07de306ff27a2b630b1141956844eb1552b956b5"
        cUSDT = "0x3f0a0ea2f86bae6362cf9799b523ba06647da018"
        cToken = await ERC20.at(cUSDT)
        erc20 = await ERC20.at(usdt)
        // balancer
        balancerPool = "0x081D79E1c970DF4efF76aF11352121B06C779945" // Perp/cUSDT

        // exchangeWrapper = await ExchangeWrapper.at("0xc83B115a58b91fc8ab319F4953CbBEBA3b55836D")
        exchangeWrapper = await deployExchangeWrapper(balancerPool, cUSDT, perpToken.address)
        console.log(exchangeWrapper.address)

        await perpToken.approve(exchangeWrapper.address, toFullDigit(5000000))
        await erc20.approve(exchangeWrapper.address, toFullDigit(1000000))
    })

    async function balanceOf(): Promise<void> {
        const perp = await perpToken.balanceOf(exchangeWrapper.address)
        const ctoken = await cToken.balanceOf(exchangeWrapper.address)
        const token = await erc20.balanceOf(exchangeWrapper.address)
        console.log("perp ", perp.toString(), "cusdt ", ctoken.toString(), "usdt ", token.toString())
    }

    beforeEach(async () => {
        await balanceOf()
    })

    afterEach(async () => {
        await balanceOf()
    })

    it("getSpotPrice, usdt in", async () => {
        const r = await exchangeWrapper.getSpotPrice(usdt, perpToken.address)
        console.log(r.d.toString())
        // 0.02847868160384
    })

    it("getSpotPrice, usdt out", async () => {
        const r = await exchangeWrapper.getSpotPrice(perpToken.address, usdt)
        console.log(r.d.toString())
        // 35.117516937919847382
    })

    it("swapInput, usdt out", async () => {
        // gas consumption: 410,499
        const r = await exchangeWrapper.swapInput(perpToken.address, usdt, toDecimal(50), toDecimal(0), toDecimal(0))

        console.log("tx", r.tx)
        console.log(r.logs[0].event)
        console.log(r.logs[0].args[0].toString())
        console.log(r.logs[0].args[1].toString())
        console.log(r.logs[1].event)
        console.log(r.logs[1].args[0].toString())
        console.log(r.logs[1].args[1].toString())
        console.log(r.logs[2].event)
        console.log(r.logs[2].args[0].toString())
        console.log(r.logs[2].args[1].toString())
        // BalancerSwap
        // 50000000000000000000
        // 70985940
        // CompoundRedeem
        // 70985940
        // 1495797
    })

    it("swapInput, usdt in", async () => {
        // gas consumption: 410,499
        const r = await exchangeWrapper.swapInput(usdt, perpToken.address, toDecimal(0.5), toDecimal(0), toDecimal(0))

        console.log("tx", r.tx)
        console.log(r.logs[0].event)
        console.log(r.logs[0].args[0].toString())
        console.log(r.logs[0].args[1].toString())
        console.log(r.logs[1].event)
        console.log(r.logs[1].args[0].toString())
        console.log(r.logs[1].args[1].toString())
        console.log(r.logs[2].event)
        console.log(r.logs[2].args[0].toString())
        console.log(r.logs[2].args[1].toString())
    })

    it("swapOutput, usdt out", async () => {
        // gas consumption: 431,645
        const r = await exchangeWrapper.swapOutput(
            perpToken.address,
            usdt,
            toDecimal(0.5),
            toDecimal(10000),
            toDecimal(0),
        )

        console.log("tx", r.tx)
        console.log(r.logs[0].event)
        console.log(r.logs[0].args[0].toString())
        console.log(r.logs[0].args[1].toString())
        console.log(r.logs[1].event)
        console.log(r.logs[1].args[0].toString())
        console.log(r.logs[1].args[1].toString())
        console.log(r.logs[2].event)
        console.log(r.logs[2].args[0].toString())
        console.log(r.logs[2].args[1].toString())
        // BalancerSwap
        // 16829970323559010254
        // 23728463
        // CompoundRedeem
        // 23728463
        // 500000
    })

    it("swapOutput, usdt in", async () => {
        // gas consumption: 431,645
        const r = await exchangeWrapper.swapOutput(
            usdt,
            perpToken.address,
            toDecimal(50),
            toDecimal(1000000),
            toDecimal(0),
        )

        console.log("tx", r.tx)
        console.log(r.logs[0].event)
        console.log(r.logs[0].args[0].toString())
        console.log(r.logs[0].args[1].toString())
        console.log(r.logs[1].event)
        console.log(r.logs[1].args[0].toString())
        console.log(r.logs[1].args[1].toString())
        console.log(r.logs[2].event)
        console.log(r.logs[2].args[0].toString())
        console.log(r.logs[2].args[1].toString())
    })
})
