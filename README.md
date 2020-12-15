# Perpetual Protocol

Perpetual Protocol is a decentralized perpetual contract protocol for every asset, made possible by a Virtual Automated Market Maker (henceforth referred to as a “vAMM” or “vAMMs”).
>*For those who aren’t familiar with perpetual contracts: A perpetual contract is a derivative similar to a futures contract but without an expiry date. For conventional futures contracts such as WTI, the contract’s price will gradually converge with the underlying asset’s spot market price as the expiry date approaches. Perpetual contracts are futures contracts that automatically roll every few hours. In order to keep the perpetual contract in line with the underlying index, one side pays the other the funding rate. The funding rate effectively implies a cost of capital and the steepness of the futures curve. You can learn more about how funding works by reading our documentation or this piece from FTX’s help center.*

##### Key features of the Perpetual Protocol include:
  - 10x Leverage On-Chain Perpetual Contact
Traders can trade with up to 10x leverage long or short, have transparent fees, and 24/7 guaranteed liquidity.
  - Go Long or Short on Any Asset
Every asset can be supported via a perpetual contract on Perpetual Protocol. Whether it's gold, fiat, BTC, BCH, ETH, ERC-20s, XRP, EOS, LTC, ZEC, XMR, and more - Perpetual Protocol can support it all. All that Perpetual Protocol requires is a price feed for the underlying asset from an oracle.
  - Lower Slippage than Other AMMs
Traders on constant product (x*y=k) market makers like Uniswap suffer higher slippage than traders on centralized exchanges (CEXs) because k is capped by the liquidity provided. Perpetual Protocol’s vAMM can set K algorithmically to provide lower slippage to traders.

Please refer to [Perpetual Protocol documentation](https://docs.perp.fi/) for more details. 

Welcome contributions to this project.  Please join our [Discord](https://discord.com/channels/687397941383659579/707845517610319893) to discuss.

## Local development and testing
### Requirements
You should have Node 12 installed. Use [nvm](https://github.com/nvm-sh/nvm) to install it.

### Get started
Clone this repository, install NodeJS dependencies, and build the source code:
```
git clone git@github.com:perpetual-protocol/perp-contract.git
npm i
npm run build
```


### Local development
Deploy in the local enviroment, deployed contract addresses listed in `build/system-local.json`.
```
npm run dev
```

To learn more use cases, please refer the [development guide](https://docs.perp.fi/sdk-documentation/smart-contract-javascript-dev-guide).

### Testing
Run all the test cases,
```
npm run test
```

If you only want to run partial test cases, add `.only` at title of test cases or test sections. For example, 
```
describe.only("Amm Unit Test", () => {
...
}
or 
it.only("admin open amm", async () => { ... }
```


## License 
GPL3.0 or later
