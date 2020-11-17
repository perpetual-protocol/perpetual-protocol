import { instance, mock, verify } from "ts-mockito"
import { ContractPublisher } from "../../publish/ContractPublisher"
import { OzScript } from "../../publish/OzScript"
import { SettingsDao } from "../../publish/SettingsDao"
import { SystemMetadataDao } from "../../publish/SystemMetadataDao"

describe.skip("ContractPublisher Spec", () => {
    const settingsDao: SettingsDao = mock(SettingsDao)
    const systemMetadataDao: SystemMetadataDao = mock(SystemMetadataDao)
    const ozScript: OzScript = mock(OzScript)
    let contractPublisher: ContractPublisher

    beforeEach(async () => {
        contractPublisher = new ContractPublisher(
            "layer1",
            instance(settingsDao),
            instance(systemMetadataDao),
            instance(ozScript),
        )
    })

    it("publishContracts", async () => {
        await contractPublisher.publishContracts(0)
        verify(settingsDao.getVersion("layer1")).called()
    })
})
