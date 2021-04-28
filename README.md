#  Perpetual Protocol <img src="https://perp.fi/images/color.png" width="40">

Perpetual Protocol is a decentralized perpetual contract protocol for every asset, made possible by a Virtual Automated Market Maker (henceforth referred to as a “vAMM” or “vAMMs”).
>*For those who aren’t familiar with perpetual contracts: A perpetual contract is a derivative similar to a futures contract but without an expiry date. For conventional futures contracts such as WTI, the contract’s price will gradually converge with the underlying asset’s spot market price as the expiry date approaches. Perpetual contracts are futures contracts that automatically roll over on a given time period, e.g. 1 hour, 8 hours, etc. In order to keep the perpetual contract in line with the underlying index, one side of the market pays the other a funding rate. The funding rate effectively implies a cost of capital and the steepness of the futures curve. You can learn more about how funding works by reading our [documentation](https://docs.perp.fi/).*

##### Key features of the Perpetual Protocol include:
  - 10x Leverage On-Chain Perpetual Contacts
Traders can trade with up to 10x leverage long or short, with transparent fees and 24/7 guaranteed liquidity.
  - Go Long or Short on Any Asset
Every asset can be supported on Perpetual Protocol. Whether it's gold, fiat, BTC, BCH, ETH, ERC-20s, XRP, EOS, LTC, ZEC, XMR, and more - Perpetual Protocol can support it all. All that Perpetual Protocol requires is a price feed for the underlying asset from an oracle.
  - Lower Slippage than Other AMMs
Traders on constant product (x*y=k) market makers like Uniswap suffer higher slippage than traders on centralized exchanges (CEXs) because k is capped by the liquidity provided. Perpetual Protocol’s vAMM can set K algorithmically to provide lower slippage to traders.

Please refer to the [Perpetual Protocol documentation](https://docs.perp.fi/) for more details.

Welcome to contribute to this project.  Please join our [Discord](https://discord.gg/mYKKRTn) to discuss.

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

To learn more use cases, please refer to the [development guide](https://docs.perp.fi/sdk-documentation/smart-contract-javascript-dev-guide).

### Testing
To run all the test cases,
```
npm run test
```

If you only want to run partial test cases, add `.only` and pass the title of test cases or test sections. For example,
```
describe.only("Amm Unit Test", () => { ... }
```
or
```
it.only("admin open amm", async () => { ... }
```

Test cases can be found in the `./tests` folder.

### Mainnet fork testing
This is for testing the deployment or upgradability of contracts.

Two params are required: 
- `stage` can be `staging` or `production`
- `fileName` is the targeted testing file in the `publish/migrations` directory
```
npm run simulate <stage> <fileName>
```

## Deploy contracts on rinkeby without versioning

Deploy contracts on rinkeby without versioning requires two environment variables: WEB3_RINKEBY_ENDPOINT & RINKEBY_MNEMONIC.

Once these two variables are set, the deployment script is needed. For example, we want to deploy the "PerpRewardVesting" contract, and the deploy script should be similar to this code snippet:

```typescript
import { ethers, upgrades } from "hardhat"
import { ContractName } from "../publish/ContractName"

async function main() {
    const perpAddress = "0xaFfB148304D38947193785D194972a7d0d9b7F68"
    const options = {
        unsafeAllowCustomTypes: true,
    }
    const Vesting = await ethers.getContractFactory(ContractFullyQualifiedName.PerpRewardVesting)
    const instance = await upgrades.deployProxy(Vesting, [perpAddress], options)
    await instance.deployed()
}

main()

```

execute the below commands:

```shell
./node_modules/.bin/hardhat --network rinkeby run scripts/deploy-reward-vesting.ts
```

And the contract should be deployed on rinkeby, and the file ".openzeppelin/rinkeby.json" is modified with new contract addresses, but the changes can be ignored for testing purposes.

### Checking Chainlink aggregator

When we create a new AMM, we always need to execute `addAggregator()` to add a chainlink aggregator. Still, the arguments are all hex format numbers, and pretty easy to type the wrong parameters. There is a hardhat task "check:chainlink" to show all major information. We can use this information to check on gnosis multisign.

First step: go to https://docs.chain.link/docs/ethereum-addresses to find which price feed we need for the new AMM. e.g. if you want to check SNX/USD on homestead, please execute:

```shell
$ ./node_modules/.bin/hardhat check:chainlink  --network homestead --address 0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699
```

it will print basic information for SNX/USD:

```
When we create a new AMM, we always need to execute `addAggregator()` to add a chainlink aggregator. Still, the arguments are all hex format numbers, and pretty easy to type wrong parameters. There is a hardhat task "check:chainlink" to show all major information. We can use this information to check on gnosis multisign.
First step: go to https://docs.chain.link/docs/ethereum-addresses to find which price feed we need for the new AMM. e.g. if you want to check SNX/USD on homestead, please execute:
$ ./node_modules/.bin/hardhat check:chainlink  --network homestead --address 0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699
it will print basic information for SNX/USD:
pair: SNX / USD
base symbol: SNX
quote symbol: USD
latest price: 20.69401159
price feed key: 0x534e580000000000000000000000000000000000000000000000000000000000
functionData: 0x3f0e084f534e580000000000000000000000000000000000000000000000000000000000000000000000000000000000dc3ea94cd0ac27d9a86c180091e7f78c683d3699
```

When you send a transaction on gnosis app, we can use `functionData` to check if the transaction data is correct.

## License
GPL3.0 or later
