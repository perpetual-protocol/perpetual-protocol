import { default as BN } from "bn.js"
import {
    AmmFakeInstance,
    ClearingHouseFakeInstance,
    ClearingHouseViewerInstance,
    ERC20FakeInstance,
    ExchangeWrapperMockInstance,
    InflationMonitorFakeInstance,
    InsuranceFundFakeInstance,
    L2PriceFeedMockInstance,
    MetaTxGatewayInstance,
    MinterInstance,
    PerpTokenInstance,
    RewardsDistributionFakeInstance,
    StakingReserveFakeInstance,
    SupplyScheduleFakeInstance,
} from "../../types"
import {
    deployAmm,
    deployClearingHouse,
    deployClearingHouseViewer,
    deployErc20Fake,
    deployInflationMonitor,
    deployInsuranceFund,
    deployL2MockPriceFeed,
    deployMetaTxGateway,
    deployMinter,
    deployMockExchangeWrapper,
    deployPerpToken,
    deployRewardsDistribution,
    deployStakingReserve,
    deploySupplySchedule,
} from "./contract"
import { toDecimal, toFullDigit } from "./number"

export interface PerpContracts {
    metaTxGateway: MetaTxGatewayInstance
    quoteToken: ERC20FakeInstance
    priceFeed: L2PriceFeedMockInstance
    perpToken: PerpTokenInstance
    supplySchedule: SupplyScheduleFakeInstance
    stakingReserve: StakingReserveFakeInstance
    exchangeWrapper: ExchangeWrapperMockInstance
    insuranceFund: InsuranceFundFakeInstance
    clearingHouse: ClearingHouseFakeInstance
    rewardsDistribution: RewardsDistributionFakeInstance
    amm: AmmFakeInstance
    clearingHouseViewer: ClearingHouseViewerInstance
    inflationMonitor: InflationMonitorFakeInstance
    minter: MinterInstance
}

export interface ContractDeployArgs {
    sender: string
    quoteTokenAmount?: BN
    perpInitSupply?: BN
    perpRewardVestingPeriod?: BN
    perpInflationRate?: BN
    perpMintDuration?: BN
    perpDecayRate?: BN
    tollRatio?: BN
    spreadRatio?: BN
    quoteAssetReserve?: BN
    baseAssetReserve?: BN
    startSchedule?: boolean
}

const quoteTokenDecimals = 6

const DEFAULT_CONTRACT_DEPLOY_ARGS: ContractDeployArgs = {
    sender: "",
    quoteTokenAmount: toFullDigit(20000000, quoteTokenDecimals),
    perpInitSupply: toFullDigit(1000000),
    perpRewardVestingPeriod: new BN(0),
    perpInflationRate: toFullDigit(0.01), // 1%
    perpMintDuration: new BN(7 * 24 * 60 * 60), // 1 week
    perpDecayRate: new BN(0),
    tollRatio: new BN(0),
    spreadRatio: new BN(0),
    quoteAssetReserve: toFullDigit(1000),
    baseAssetReserve: toFullDigit(100),
    startSchedule: true,
}

export async function fullDeploy(args: ContractDeployArgs): Promise<PerpContracts> {
    const {
        sender,
        quoteTokenAmount = DEFAULT_CONTRACT_DEPLOY_ARGS.quoteTokenAmount,
        perpInitSupply = DEFAULT_CONTRACT_DEPLOY_ARGS.perpInitSupply,
        perpRewardVestingPeriod = DEFAULT_CONTRACT_DEPLOY_ARGS.perpRewardVestingPeriod,
        perpInflationRate = DEFAULT_CONTRACT_DEPLOY_ARGS.perpInflationRate,
        perpDecayRate = DEFAULT_CONTRACT_DEPLOY_ARGS.perpDecayRate,
        perpMintDuration = DEFAULT_CONTRACT_DEPLOY_ARGS.perpMintDuration,
        tollRatio = DEFAULT_CONTRACT_DEPLOY_ARGS.tollRatio,
        spreadRatio = DEFAULT_CONTRACT_DEPLOY_ARGS.spreadRatio,
        quoteAssetReserve = DEFAULT_CONTRACT_DEPLOY_ARGS.quoteAssetReserve,
        baseAssetReserve = DEFAULT_CONTRACT_DEPLOY_ARGS.baseAssetReserve,
        startSchedule = DEFAULT_CONTRACT_DEPLOY_ARGS.startSchedule,
    } = args
    const metaTxGateway = await deployMetaTxGateway("Perp", "1", 1234) // default buidler evm chain ID
    const quoteToken = await deployErc20Fake(quoteTokenAmount, "Tether", "USDT", new BN(quoteTokenDecimals))
    const priceFeed = await deployL2MockPriceFeed(toFullDigit(100))

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const perpToken = await deployPerpToken(perpInitSupply!)
    const minter = await deployMinter(perpToken.address)
    const inflationMonitor = await deployInflationMonitor(minter.address)
    const exchangeWrapper = await deployMockExchangeWrapper()
    const supplySchedule = await deploySupplySchedule(
        minter.address,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        perpInflationRate!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        perpDecayRate!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        perpMintDuration!,
    )

    const insuranceFund = await deployInsuranceFund(exchangeWrapper.address, minter.address)

    const clearingHouse = await deployClearingHouse(
        toDecimal(0.05),
        toDecimal(0.05),
        toDecimal(0.05),
        insuranceFund.address,
        metaTxGateway.address,
    )
    await metaTxGateway.addToWhitelists(clearingHouse.address)
    const clearingHouseViewer = await deployClearingHouseViewer(clearingHouse.address)

    const stakingReserve = await deployStakingReserve(
        perpToken.address,
        supplySchedule.address,
        clearingHouse.address,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        perpRewardVestingPeriod!,
    )
    await clearingHouse.setFeePool(stakingReserve.address)

    const rewardsDistribution = await deployRewardsDistribution(minter.address, stakingReserve.address)

    // deploy an amm with Q100/B1000 liquidity
    const amm = await deployAmm({
        deployer: sender,
        quoteAssetTokenAddr: quoteToken.address,
        priceFeedAddr: priceFeed.address,
        fundingPeriod: new BN(86400), // to make calculation easier we set fundingPeriod = 1 day
        fluctuation: toFullDigit(0),
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        quoteAssetReserve: quoteAssetReserve!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        baseAssetReserve: baseAssetReserve!,
        tollRatio,
        spreadRatio,
    })

    await amm.setGlobalShutdown(insuranceFund.address)
    await amm.setCounterParty(clearingHouse.address)
    await insuranceFund.addAmm(amm.address)
    await stakingReserve.setRewardsDistribution(rewardsDistribution.address)
    await insuranceFund.setBeneficiary(clearingHouse.address)
    await insuranceFund.setInflationMonitor(inflationMonitor.address)
    await perpToken.addMinter(minter.address)
    await minter.setSupplySchedule(supplySchedule.address)
    await minter.setRewardsDistribution(rewardsDistribution.address)
    await minter.setInflationMonitor(inflationMonitor.address)
    await minter.setInsuranceFund(insuranceFund.address)

    if (startSchedule) {
        await supplySchedule.startSchedule()
    }
    await amm.setOpen(true)

    return {
        metaTxGateway,
        quoteToken,
        priceFeed,
        perpToken,
        supplySchedule,
        stakingReserve,
        exchangeWrapper,
        insuranceFund,
        clearingHouse,
        rewardsDistribution,
        amm,
        clearingHouseViewer,
        inflationMonitor,
        minter,
    }
}
