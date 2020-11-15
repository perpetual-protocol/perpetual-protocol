/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Contract } from "ethers"
import { Layer } from "../../scripts/common"
import { Amm } from "../../types/ethers"
import { ContractAlias, ContractName } from "../ContractName"
import { SystemMetadataDao } from "../SystemMetadataDao"
import { AmmContractWrapper } from "./AmmContractWrapper"
import { ContractWrapper } from "./ContractWrapper"

export class ContractWrapperFactory {
    constructor(protected readonly layerType: Layer, protected readonly systemMetadataDao: SystemMetadataDao) {}

    create<T extends Contract>(contractFileName: ContractName): ContractWrapper<T> {
        return new ContractWrapper<T>(this.layerType, this.systemMetadataDao, contractFileName, contractFileName)
    }

    createAmm(contractAlias: ContractAlias): ContractWrapper<Amm> {
        return new AmmContractWrapper(this.layerType, this.systemMetadataDao, ContractName.Amm, contractAlias)
    }
}
