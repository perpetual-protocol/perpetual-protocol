import { SettingsDao } from "../publish/SettingsDao"
import { SystemMetadataDao } from "../publish/SystemMetadataDao"
import { Stage } from "./common"

async function main(): Promise<void> {
    const stage = process.argv[2] as Stage
    if (!stage) {
        throw new Error("please type stage name (eg. production, staging)")
    }

    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)
    await systemMetadataDao.pullRemote()
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
