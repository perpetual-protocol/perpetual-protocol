import fetch from "node-fetch"

export class CoinGeckoService {
    async fetchUsdPrice(symbol: string): Promise<string> {
        const id = this.getId(symbol)
        const results = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
        const json =  await results.json()
        return  json[id]["usd"].toString()
    }

    private getId(symbol: string): string {
        switch(symbol) {
            case "ETH":
                return "ethereum";
                break;
            case "BTC":
                return "bitcoin"
                break
            default:
                throw new Error(`symbol=${symbol} not supported`)
        }
    }
}