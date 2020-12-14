# Perpetual Protocol

Please refer Perpetual Protocol [documentation](https://docs.perp.fi/) for more details. 

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

### Testing
Run all the test cases,
```
npm run test
```

If you only want to run partial test cases, add `.only` at test cases or test sections. For example, 
```
describe.only("Amm Unit Test", () => {
...
}

or 

it.only("admin open amm", async () => { ... }
```


## License 
GPL3.0 or later
