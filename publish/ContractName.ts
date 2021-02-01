export enum AmmInstanceName {
    BTCUSDC = "BTCUSDC",
    ETHUSDC = "ETHUSDC",
    YFIUSDC = "YFIUSDC",
    DOTUSDC = "DOTUSDC",
    SNXUSDC = "SNXUSDC",
    LINKUSDC = "LINKUSDC",
    SDEFIUSDC = "SDEFIUSDC",
}

export enum ContractName {
    MetaTxGateway = "MetaTxGateway",
    TetherToken = "TetherToken",
    InsuranceFund = "InsuranceFund",
    ChainlinkL1 = "ChainlinkL1",
    L2PriceFeed = "L2PriceFeed",
    ClearingHouse = "ClearingHouse",
    ClearingHouseViewer = "ClearingHouseViewer",
    Amm = "Amm",
    AmmReader = "AmmReader",
    ClientBridge = "ClientBridge",
    RootBridge = "RootBridge",
    KeeperRewardL1 = "KeeperRewardL1",
    KeeperRewardL2 = "KeeperRewardL2",
    PerpRewardVesting = "PerpRewardVesting",
    StakedPerpToken = "StakedPerpToken",
    TollPool = "TollPool",
    FeeTokenPoolDispatcherL1 = "FeeTokenPoolDispatcherL1",
}

export type ContractInstanceName = ContractName | AmmInstanceName
