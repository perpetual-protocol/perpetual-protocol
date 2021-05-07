/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Contract } from "ethers"
import { parseFullyQualifiedName } from "hardhat/utils/contract-names"
import { Layer } from "../../scripts/common"
import { AmmInstanceName, ContractFullyQualifiedName, ContractId, isContractId } from "../ContractName"
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
        fullyQualifiedContractName: ContractFullyQualifiedName,
        contractId?: ContractId,
    ): ContractWrapper<T> {
        let contractName: ContractId
        if (!contractId) {
            const parsed = parseFullyQualifiedName(fullyQualifiedContractName)
            const { contractName: parsedContractName } = parsed
            if (!isContractId(parsedContractName)) {
                throw new Error(`No ContractId correspond to "${fullyQualifiedContractName}"`)
            }
            contractName = parsedContractName
        } else {
            contractName = contractId
        }

        return new ContractWrapper<T>(
            this.layerType,
            this.systemMetadataDao,
            fullyQualifiedContractName,
            contractName,
            this.confirmations,
        )
    }

    createAmm(
        ammInstanceName: AmmInstanceName,
        ammFullyQualifiedContractName:
            | ContractFullyQualifiedName.Amm
            | ContractFullyQualifiedName.AmmV1
            | ContractFullyQualifiedName.FlattenAmm
            | ContractFullyQualifiedName.FlattenAmmUnderClearingHouse,
    ): AmmContractWrapper {
        return new AmmContractWrapper(
            this.layerType,
            this.systemMetadataDao,
            ammFullyQualifiedContractName,
            ammInstanceName,
            this.confirmations,
        )
    }
}
