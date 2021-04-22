import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { join } from "path"
import { extractMigrationMetadataFromPath, loadMigration, MigrationContext } from "../../publish/Migration"
import { Layer } from "../../scripts/common"
chai.use(chaiAsPromised)

describe("Migration", () => {
    describe("extractMigrationMetadataFromPath", () => {
        it("can extract batchIndex and layer", () => {
            const metadata = extractMigrationMetadataFromPath("0123-layer1-whatever")
            expect(metadata).has.property("batchIndex", 123)
            expect(metadata).has.property("layer", Layer.Layer1)
        })

        it("will throw error with invalid batchIndex", () => {
            expect(() => {
                extractMigrationMetadataFromPath("abc-layer1-whatever")
            }).throw(/Invalid batch/)
        })

        it("will throw error with invalid layer", () => {
            expect(() => {
                extractMigrationMetadataFromPath("0001-layer3-whatever")
            }).throw(/Invalid layer/)
        })
    })

    describe("loadMigration", () => {
        it("can load migration file", async () => {
            const migration = await loadMigration(join(__dirname, "fixtures", "0123-layer1-dummy.ts"))
            expect(migration).has.property("batchIndex", 123)
            expect(migration).has.property("layer", Layer.Layer1)

            expect(migration.getTasks({} as MigrationContext)).has.length(4)
        })

        it("will throw error if file not exist", async () => {
            expect(loadMigration(join(__dirname, "fixtures", "0123-layer1-not-exists.ts"))).rejected
        })
    })
})
