/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Contract } from "ethers"
import { Layer } from "../../scripts/common"
import { AmmInstanceName, ContractId, ContractName } from "../ContractName"
import { SystemMetadataDao } from "../SystemMetadataDao"
import { AmmContractWrapper } from "./AmmContractWrapper"
import { ContractWrapper } from "./ContractWrapper"

export class ContractWrapperFactory {
    constructor(
        protected readonly layerType: Layer,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly confirmations: number,
    ) {}

    create<T extends Contract>(
        contractFileName: ContractName,
        contractId: ContractId = contractFileName,
    ): ContractWrapper<T> {
        return new ContractWrapper<T>(
            this.layerType,
            this.systemMetadataDao,
            contractFileName,
            contractId,
            this.confirmations,
        )
    }

    createAmm(ammInstanceName: AmmInstanceName): AmmContractWrapper {
        return new AmmContractWrapper(
            this.layerType,
            this.systemMetadataDao,
            ContractName.Amm,
            ammInstanceName,
            this.confirmations,
        )
    }
}
