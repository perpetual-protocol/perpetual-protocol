import { artifacts, web3 } from "@nomiclabs/buidler"
import BN from "bn.js"
import {
    AMBBridgeMockContract,
    AMBBridgeMockInstance,
    AmmFakeContract,
    AmmFakeInstance,
    AmmReaderContract,
    AmmReaderInstance,
    BalancerMockContract,
    BalancerMockInstance,
    ChainlinkL1FakeContract,
    ChainlinkL1FakeInstance,
    ChainlinkPriceFeedFakeContract,
    ChainlinkPriceFeedFakeInstance,
    ClearingHouseFakeContract,
    ClearingHouseFakeInstance,
    ClearingHouseViewerContract,
    ClearingHouseViewerInstance,
    ClientBridgeContract,
    ClientBridgeInstance,
    CUsdtMockContract,
    CUsdtMockInstance,
    ERC20FakeContract,
    ERC20FakeInstance,
    ExchangeWrapperContract,
    ExchangeWrapperInstance,
    ExchangeWrapperMockContract,
    ExchangeWrapperMockInstance,
    FeeRewardPoolL1FakeContract,
    FeeRewardPoolL1FakeInstance,
    FeeTokenPoolDispatcherL1Contract,
    FeeTokenPoolDispatcherL1Instance,
    InflationMonitorFakeContract,
    InflationMonitorFakeInstance,
    InsuranceFundFakeContract,
    InsuranceFundFakeInstance,
    KeeperRewardL1Contract,
    KeeperRewardL1Instance,
    KeeperRewardL2Contract,
    KeeperRewardL2Instance,
    L2PriceFeedFakeContract,
    L2PriceFeedFakeInstance,
    L2PriceFeedMockContract,
    L2PriceFeedMockInstance,
    MetaTxGatewayContract,
    MetaTxGatewayInstance,
    MinterContract,
    MinterInstance,
    MultiTokenMediatorMockContract,
    MultiTokenMediatorMockInstance,
    PerpRewardVestingFakeContract,
    PerpRewardVestingFakeInstance,
    PerpTokenContract,
    PerpTokenInstance,
    RewardsDistributionFakeContract,
    RewardsDistributionFakeInstance,
    RootBridgeContract,
    RootBridgeInstance,
    StakedPerpTokenFakeContract,
    StakedPerpTokenFakeInstance,
    StakingReserveFakeContract,
    StakingReserveFakeInstance,
    SupplyScheduleFakeContract,
    SupplyScheduleFakeInstance,
    TollPoolContract,
    TollPoolInstance,
} from "../../types/truffle"
import { Decimal, toFullDigit } from "./number"

const L2PriceFeedMock = artifacts.require("L2PriceFeedMock") as L2PriceFeedMockContract
const ERC20Fake = artifacts.require("ERC20Fake") as ERC20FakeContract
const AmmFake = artifacts.require("AmmFake") as AmmFakeContract
const AmmReader = artifacts.require("AmmReader") as AmmReaderContract
const ClearingHouseViewer = artifacts.require("ClearingHouseViewer") as ClearingHouseViewerContract
const ClearingHouseFake = artifacts.require("ClearingHouseFake") as ClearingHouseFakeContract
const InsuranceFund = artifacts.require("InsuranceFundFake") as InsuranceFundFakeContract
const RewardsDistributionFake = artifacts.require("RewardsDistributionFake") as RewardsDistributionFakeContract
const PerpToken = artifacts.require("PerpToken") as PerpTokenContract
const StakingReserveFake = artifacts.require("StakingReserveFake") as StakingReserveFakeContract
const ExchangeWrapperMock = artifacts.require("ExchangeWrapperMock") as ExchangeWrapperMockContract
const ExchangeWrapper = artifacts.require("ExchangeWrapper") as ExchangeWrapperContract
const ChainlinkL1Fake = artifacts.require("ChainlinkL1Fake") as ChainlinkL1FakeContract
const L2PriceFeedFake = artifacts.require("L2PriceFeedFake") as L2PriceFeedFakeContract
const SupplyScheduleFake = artifacts.require("SupplyScheduleFake") as SupplyScheduleFakeContract
const InflationMonitor = artifacts.require("InflationMonitorFake") as InflationMonitorFakeContract
const Minter = artifacts.require("Minter") as MinterContract
const CUsdtMock = artifacts.require("CUsdtMock") as CUsdtMockContract
const BalancerMock = artifacts.require("BalancerMock") as BalancerMockContract
const RootBridge = artifacts.require("RootBridge") as RootBridgeContract
const MultiTokenMediatorMock = artifacts.require("MultiTokenMediatorMock") as MultiTokenMediatorMockContract
const AMBBridgeMock = artifacts.require("AMBBridgeMock") as AMBBridgeMockContract
const MetaTxGateway = artifacts.require("MetaTxGateway") as MetaTxGatewayContract
const KeeperRewardL1 = artifacts.require("KeeperRewardL1") as KeeperRewardL1Contract
const KeeperRewardL2 = artifacts.require("KeeperRewardL2") as KeeperRewardL2Contract
const StakedPerpToken = artifacts.require("StakedPerpTokenFake") as StakedPerpTokenFakeContract
const PerpRewardVesting = artifacts.require("PerpRewardVestingFake") as PerpRewardVestingFakeContract
const TollPool = artifacts.require("TollPool") as TollPoolContract
const FeeTokenPoolDispatcherL1 = artifacts.require("FeeTokenPoolDispatcherL1") as FeeTokenPoolDispatcherL1Contract
const ClientBridge = artifacts.require("ClientBridge") as ClientBridgeContract
const FeeRewardPoolL1 = artifacts.require("FeeRewardPoolL1Fake") as FeeRewardPoolL1FakeContract
const ChainlinkPriceFeedFake = artifacts.require("ChainlinkPriceFeedFake") as ChainlinkPriceFeedFakeContract

export enum Side {
    BUY = 0,
    SELL = 1,
}

export enum Dir {
    ADD_TO_AMM = 0,
    REMOVE_FROM_AMM = 1,
}

export enum PnlCalcOption {
    SPOT_PRICE = 0,
    TWAP = 1,
}

export interface StakeBalance {
    totalBalance: { d: number | BN | string }
    stakeBalanceForCurrentEpoch: { d: number | BN | string }
    stakeBalanceForNextEpoch: { d: number | BN | string }
}

export interface EpochReward {
    reward: { d: number | BN | string }
    timeWeightedStake: { d: number | BN | string }
}

// typechain can't handle array of struct correctly, it will return every thing as string
// https://github.com/ethereum-ts/TypeChain/issues/139
export interface PositionCost {
    side: string
    size: { d: number | BN | string }
    baseAssetReserve: { d: number | BN | string }
    quoteAssetReserve: { d: number | BN | string }
}

export interface AmmSettings {
    spreadRatio: { d: number | BN | string }
    tollRatio: { d: number | BN | string }
    tradeLimitRatio: { d: number | BN | string }
}

export interface AmmPrice {
    price: { d: number | BN | string }
    amount: { d: number | BN | string }
    fee: { d: number | BN | string }
    spread: { d: number | BN | string }
}

export async function deployAmm(params: {
    deployer: string
    quoteAssetTokenAddr: string
    priceFeedAddr: string
    fluctuation: BN
    priceFeedKey?: string
    fundingPeriod?: BN
    baseAssetReserve?: BN
    quoteAssetReserve?: BN
    tollRatio?: BN
    spreadRatio?: BN
}): Promise<AmmFakeInstance> {
    const {
        deployer,
        quoteAssetTokenAddr,
        priceFeedAddr,
        fluctuation,
        fundingPeriod = new BN(8 * 60 * 60), // 8hr
        baseAssetReserve = toFullDigit(100),
        quoteAssetReserve = toFullDigit(1000),
        priceFeedKey = "ETH",
        tollRatio = new BN(0),
        spreadRatio = new BN(0),
    } = params
    return AmmFake.new(
        quoteAssetReserve,
        baseAssetReserve,
        toFullDigit(0.9), // tradeLimitRatio
        fundingPeriod,
        priceFeedAddr,
        web3.utils.asciiToHex(priceFeedKey),
        quoteAssetTokenAddr,
        fluctuation,
        tollRatio,
        spreadRatio,
        { from: deployer },
    )
}

export async function deployAmmReader(): Promise<AmmReaderInstance> {
    return await AmmReader.new()
}

export async function deployClearingHouse(
    initMarginRatio: Decimal,
    maintenanceMarginRatio: Decimal,
    liquidationFeeRatio: Decimal,
    insuranceFund: string,
    trustedForwarder: string,
): Promise<ClearingHouseFakeInstance> {
    const instance = await ClearingHouseFake.new()
    await instance.initialize(
        initMarginRatio.d.toString(),
        maintenanceMarginRatio.d.toString(),
        liquidationFeeRatio.d.toString(),
        insuranceFund,
        trustedForwarder,
    )
    return instance
}

export async function deployClearingHouseViewer(clearingHouse: string): Promise<ClearingHouseViewerInstance> {
    const instance = await ClearingHouseViewer.new(clearingHouse)
    return instance
}

export async function deployErc20Fake(
    initSupply: BN = new BN(0),
    name = "name",
    symbol = "symbol",
    decimal: BN = new BN(18),
): Promise<ERC20FakeInstance> {
    const instance = await ERC20Fake.new()
    await instance.initializeERC20Fake(initSupply, name, symbol, decimal)
    return instance
}

export async function deployPerpToken(initSupply: BN): Promise<PerpTokenInstance> {
    return await PerpToken.new(initSupply)
}

export async function deployL2MockPriceFeed(defaultPrice: BN): Promise<L2PriceFeedMockInstance> {
    return L2PriceFeedMock.new(defaultPrice)
}

export async function deployInsuranceFund(exchange: string, minter: string): Promise<InsuranceFundFakeInstance> {
    const instance = await InsuranceFund.new()
    await instance.initialize()
    await instance.setExchange(exchange)
    await instance.setMinter(minter)
    return instance
}

export async function deployExchangeWrapper(
    balancerPoolAddr: string,
    compoundCUsdtAddr: string,
    perpToken: string,
): Promise<ExchangeWrapperInstance> {
    const instance = await ExchangeWrapper.new()
    await instance.initialize(balancerPoolAddr, compoundCUsdtAddr, perpToken)
    return instance
}

export async function deployMockExchangeWrapper(): Promise<ExchangeWrapperMockInstance> {
    return await ExchangeWrapperMock.new()
}

export async function deployMockBalancer(perpAddr: string, cUSDTAddr: string): Promise<BalancerMockInstance> {
    const instance = await BalancerMock.new()
    instance.initialize(perpAddr, cUSDTAddr)
    return instance
}

export async function deployMockCUsdt(): Promise<CUsdtMockInstance> {
    const instance = await CUsdtMock.new()
    await instance.initializeERC20Fake(toFullDigit(100000), "CToken", "CUsdt", 8)
    return instance
}

export async function deployStakingReserve(
    perpToken: string,
    supplySchedule: string,
    clearingHouse: string,
    vestingPeriod: BN,
): Promise<StakingReserveFakeInstance> {
    const instance = await StakingReserveFake.new()
    await instance.initialize(perpToken, supplySchedule, clearingHouse, vestingPeriod)
    return instance
}

export async function deployRewardsDistribution(
    minter: string,
    stakingReserve: string,
): Promise<RewardsDistributionFakeInstance> {
    const instance = await RewardsDistributionFake.new()
    await instance.initialize(minter, stakingReserve)
    return instance
}

export async function deployL2PriceFeed(clientBridge: string, keeper: string): Promise<L2PriceFeedFakeInstance> {
    const instance = await L2PriceFeedFake.new()
    await instance.initialize(clientBridge, keeper)
    return instance
}

export async function deployChainlinkL1(
    rootBridgeAddress: string,
    priceFeedL2Address: string,
): Promise<ChainlinkL1FakeInstance> {
    const instance = await ChainlinkL1Fake.new()
    await instance.initialize(rootBridgeAddress, priceFeedL2Address)
    return instance
}

export async function deployChainlinkPriceFeed(): Promise<ChainlinkPriceFeedFakeInstance> {
    const instance = await ChainlinkPriceFeedFake.new()
    await instance.initialize()
    return instance
}

export async function deploySupplySchedule(
    minter: string,
    inflationRate: BN,
    decayRate: BN,
    mintDuration: BN,
): Promise<SupplyScheduleFakeInstance> {
    const instance = await SupplyScheduleFake.new()
    await instance.initialize(minter, inflationRate, decayRate, mintDuration)
    return instance
}

export async function deployInflationMonitor(minter: string): Promise<InflationMonitorFakeInstance> {
    const instance = await InflationMonitor.new()
    await instance.initialize(minter)
    return instance
}

export async function deployMinter(perpToken: string): Promise<MinterInstance> {
    const instance = await Minter.new()
    await instance.initialize(perpToken)
    return instance
}

export async function deployRootBridge(ambBridge: string, tokenMediator: string): Promise<RootBridgeInstance> {
    const instance = await RootBridge.new()
    await instance.initialize(ambBridge, tokenMediator)
    return instance
}

export async function deployClientBridge(
    ambBridge: string,
    tokenMediator: string,
    trustedForwarder: string,
): Promise<ClientBridgeInstance> {
    const instance = await ClientBridge.new()
    await instance.initialize(ambBridge, tokenMediator, trustedForwarder)
    return instance
}

export async function deployMockMultiToken(): Promise<MultiTokenMediatorMockInstance> {
    const instance = await MultiTokenMediatorMock.new()
    return instance
}

export async function deployMockAMBBridge(): Promise<AMBBridgeMockInstance> {
    const instance = await AMBBridgeMock.new()
    return instance
}

export async function deployMetaTxGateway(
    name: string,
    version: string,
    chainIdL1: number,
): Promise<MetaTxGatewayInstance> {
    const instance = await MetaTxGateway.new()
    instance.initialize(name, version, chainIdL1)
    return instance
}

export async function deployL1KeeperReward(perpToken: string): Promise<KeeperRewardL1Instance> {
    const instance = await KeeperRewardL1.new()
    await instance.initialize(perpToken)
    return instance
}

export async function deployL2KeeperReward(perpToken: string): Promise<KeeperRewardL2Instance> {
    const instance = await KeeperRewardL2.new()
    await instance.initialize(perpToken)
    return instance
}

export async function deployStakedPerpToken(
    perpToken: string,
    feeRewardPool: string,
): Promise<StakedPerpTokenFakeInstance> {
    const instance = await StakedPerpToken.new()
    await instance.initialize(perpToken, feeRewardPool)
    return instance
}

export async function deployPerpRewardVesting(
    perpToken: string,
    vestingPeriod: BN = new BN(12 * 7 * 24 * 60 * 60),
): Promise<PerpRewardVestingFakeInstance> {
    const instance = await PerpRewardVesting.new()
    await instance.initialize(perpToken, vestingPeriod)
    return instance
}

export async function deployTollPool(clearingHouse: string, clientBridge: string): Promise<TollPoolInstance> {
    const instance = await TollPool.new()
    await instance.initialize(clearingHouse, clientBridge)
    return instance
}

export async function deployFeeTokenPoolDispatcherL1(): Promise<FeeTokenPoolDispatcherL1Instance> {
    const instance = await FeeTokenPoolDispatcherL1.new()
    await instance.initialize()
    return instance
}

export async function deployFeeRewardPoolL1(
    erc20: string,
    stakedPerpToken: string,
    feeTokenPoolDispatcherL1: string,
): Promise<FeeRewardPoolL1FakeInstance> {
    const instance = await FeeRewardPoolL1.new()
    await instance.initialize(erc20, stakedPerpToken, feeTokenPoolDispatcherL1)
    return instance
}
