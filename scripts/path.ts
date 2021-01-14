import path from "path"

export function getRootDir(): string {
    return path.join(__dirname, "..")
}

export function getOpenZeppelinDir() {
    return `${getRootDir()}/.openzeppelin`
}

export function getSettingsDir() {
    return `${getRootDir()}/publish/settings/`
}
