import { artifacts } from "@nomiclabs/buidler"
import {
    AmmMockContract,
    AmmMockInstance,
    ChainlinkAggregatorMockContract,
    ChainlinkAggregatorMockInstance,
    ChainlinkL1MockContract,
    ChainlinkL1MockInstance,
    ClearingHouseMockContract,
    ClearingHouseMockInstance,
    FeeRewardPoolMockContract,
    FeeRewardPoolMockInstance,
    PerpTokenMockContract,
    PerpTokenMockInstance,
    RootBridgeMockContract,
    RootBridgeMockInstance,
    StakedPerpTokenMockContract,
    StakedPerpTokenMockInstance,
} from "../../types/truffle"

const AmmMock = artifacts.require("AmmMock") as AmmMockContract
const ChainlinkAggregatorMock = artifacts.require("ChainlinkAggregatorMock") as ChainlinkAggregatorMockContract
const ChainlinkL1Mock = artifacts.require("ChainlinkL1Mock") as ChainlinkL1MockContract
const ClearingHouseMock = artifacts.require("ClearingHouseMock") as ClearingHouseMockContract
const FeeRewardPoolMock = artifacts.require("FeeRewardPoolMock") as FeeRewardPoolMockContract
const PerpTokenMock = artifacts.require("PerpTokenMock") as PerpTokenMockContract
const RootBridgeMock = artifacts.require("RootBridgeMock") as RootBridgeMockContract
const StakedPerpTokenMock = artifacts.require("StakedPerpTokenMock") as StakedPerpTokenMockContract

export async function deployAmmMock(): Promise<AmmMockInstance> {
    return AmmMock.new()
}

export async function deployChainlinkAggregatorMock(): Promise<ChainlinkAggregatorMockInstance> {
    return ChainlinkAggregatorMock.new()
}

export async function deployChainlinkL1Mock(): Promise<ChainlinkL1MockInstance> {
    return ChainlinkL1Mock.new()
}

export async function deployClearingHouseMock(): Promise<ClearingHouseMockInstance> {
    return ClearingHouseMock.new()
}

export async function deployFeeRewardPoolMock(): Promise<FeeRewardPoolMockInstance> {
    return FeeRewardPoolMock.new()
}

export async function deployPerpTokenMock(): Promise<PerpTokenMockInstance> {
    return PerpTokenMock.new()
}

export async function deployRootBridgeMock(): Promise<RootBridgeMockInstance> {
    return RootBridgeMock.new()
}

export async function deployStakedPerpTokenMock(): Promise<StakedPerpTokenMockInstance> {
    return StakedPerpTokenMock.new()
}
