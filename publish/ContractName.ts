export enum AmmInstanceName {
    BTCUSDC = "BTCUSDC",
    ETHUSDC = "ETHUSDC",
}

export enum ContractName {
    MetaTxGateway = "MetaTxGateway",
    PerpToken = "PerpToken",
    Minter = "Minter",
    SupplySchedule = "SupplySchedule",
    TetherToken = "TetherToken",
    ExchangeWrapper = "ExchangeWrapper",
    StakingReserve = "StakingReserve",
    InsuranceFund = "InsuranceFund",
    ChainlinkL1 = "ChainlinkL1",
    ChainlinkPriceFeed = "ChainlinkPriceFeed",
    L2PriceFeed = "L2PriceFeed",
    ClearingHouse = "ClearingHouse",
    ClearingHouseViewer = "ClearingHouseViewer",
    Amm = "Amm",
    AmmReader = "AmmReader",
    RewardsDistribution = "RewardsDistribution",
    InflationMonitor = "InflationMonitor",
    ClientBridge = "ClientBridge",
    RootBridge = "RootBridge",
    MultiTokenMediatorMock = "MultiTokenMediatorMock",
}

export type ContractInstanceName = ContractName | AmmInstanceName
