import fetch from "node-fetch"

interface Coin {
    id: string
    symbol: string
    name: string
}
export class CoinGeckoService {
    readonly BASE_URL = "https://api.coingecko.com/api/v3"

    async fetchUsdPrice(symbol: string): Promise<string> {
        const id = await this.getId(symbol)
        const results = await fetch(`${this.BASE_URL}/simple/price?ids=${id}&vs_currencies=usd`)
        const json = await results.json()
        return json[id]["usd"].toString()
    }

    async getId(symbol: string): Promise<string> {
        const results = await fetch(`${this.BASE_URL}/coins/list`)
        const coins: Coin[] = await results.json()
        const matched = coins.filter(it => it.symbol.toLowerCase() === symbol.toLowerCase())
        if (matched.length === 0) {
            throw new Error(`symbol=${symbol} not supported`)
        }
        const coin = matched[0]
        console.log(`get id from CoinGecko: id=${coin.id}, name=${coin.name}, symbol=${coin.symbol}`)
        return coin.id
    }
}
