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
    PerpTokenMockContract,
    PerpTokenMockInstance,
    RewardPoolMockContract,
    RewardPoolMockInstance,
    RootBridgeMockContract,
    RootBridgeMockInstance,
} from "../../types/truffle"

const AmmMock = artifacts.require("AmmMock") as AmmMockContract
const ChainlinkAggregatorMock = artifacts.require("ChainlinkAggregatorMock") as ChainlinkAggregatorMockContract
const RootBridgeMock = artifacts.require("RootBridgeMock") as RootBridgeMockContract
const PerpTokenMock = artifacts.require("PerpTokenMock") as PerpTokenMockContract
const ChainlinkL1Mock = artifacts.require("ChainlinkL1Mock") as ChainlinkL1MockContract
const ClearingHouseMock = artifacts.require("ClearingHouseMock") as ClearingHouseMockContract
const RewardPoolMock = artifacts.require("RewardPoolMock") as RewardPoolMockContract

export async function deployAmmMock(): Promise<AmmMockInstance> {
    return AmmMock.new()
}

export async function deployChainlinkAggregatorMock(): Promise<ChainlinkAggregatorMockInstance> {
    return ChainlinkAggregatorMock.new()
}

export async function deployChainlinkL1Mock(): Promise<ChainlinkL1MockInstance> {
    return ChainlinkL1Mock.new()
}

export async function deployPerpTokenMock(): Promise<PerpTokenMockInstance> {
    return PerpTokenMock.new()
}

export async function deployRootBridgeMock(): Promise<RootBridgeMockInstance> {
    return RootBridgeMock.new()
}

export async function deployRewardPoolMock(): Promise<RewardPoolMockInstance> {
    return RewardPoolMock.new()
}

export async function deployClearingHouseMock(): Promise<ClearingHouseMockInstance> {
    return ClearingHouseMock.new()
}
