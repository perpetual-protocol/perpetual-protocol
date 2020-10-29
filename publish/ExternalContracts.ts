// TODO deprecated
// import { Network } from "../scripts/common"
//
// export class ExternalContracts {
//     // default is gnosis multisig (old version)
//     readonly foundationMultisig?: string
//
//     // default is gnosis multisig safe
//     readonly foundationTreasury?: string
//     readonly keeper?: string
//     readonly ambBridgeOnXDai?: string
//     readonly ambBridgeOnEth?: string
//     readonly multiTokenMediatorOnXDai?: string
//     readonly multiTokenMediatorOnEth?: string
//     readonly tether?: string
//
//     readonly usdc?: string
//     readonly perp?: string
//     readonly balancerCrpFactory?: string
//     readonly balancerPoolFactory?: string
//     readonly balancerPerpUsdcCrp?: string
//     readonly testnetFaucet?: string
//     readonly testnetArbitrager?: string
//
//     // TODO should define it somewhere else
//     readonly chainIdL1?: number
//
//     // buidler's network argument
//     constructor(private readonly network: Network) {
//         switch (network) {
//             case "homestead":
//                 this.foundationMultisig = "0x829e396fcA2b8c3c46c9C9ad997ddD85E910B30A"
//                 this.foundationTreasury = "0x5E4B407eB1253527628bAb875525AaeC0099fFC5"
//                 this.perp = "0xbc396689893d065f41bc2c6ecbee5e0085233447"
//                 this.usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
//                 this.balancerCrpFactory = "0xb3a3f6826281525dd57f7BA837235E4Fa71C6248"
//                 this.balancerPoolFactory = "0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd"
//                 this.balancerPerpUsdcCrp = "0x91ACcD0BC2aAbAB1d1b297EB64C4774bC4e7bcCE"
//                 break
//             case "kovan":
//                 this.testnetFaucet = "0xd31C31005E331BA54508A5c1caC50341a5121E9F"
//                 this.foundationMultisig = "0x99a79D6A1CDbB71e697F47EBB1a63E444f7C7c95"
//                 this.balancerCrpFactory = "0x17e8705E85aE8E3df7C5E4d3EEd94000FB30C483"
//                 this.balancerPoolFactory = "0x8f7F78080219d4066A8036ccD30D588B416a40DB"
//                 this.balancerPerpUsdcCrp = "0x58b7ed2058b9883211a979a4bdecaf36daced2ad"
//                 this.usdc = "0xa68895df8f959f5827a6b6427c0176044a4beba6"
//                 this.perp = "0x526002b6c617cc5c2c9d4391f53b18860214d989"
//                 // TODO change keeper address
//                 this.keeper = "0xd31C31005E331BA54508A5c1caC50341a5121E9F"
//                 this.ambBridgeOnEth = "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560"
//                 this.multiTokenMediatorOnEth = "0xA960d095470f7509955d5402e36d9DB984B5C8E2"
//                 break
//             case "rinkeby":
//                 this.foundationMultisig = "0xa5D2462Af09a1Ea1C0102e9F9A0f58ac15a4A6fA"
//                 this.foundationTreasury = "0xb649aDDe53f562bC5e083A8FaAD1b4b3A5CddD03"
//                 this.balancerCrpFactory = "0x62452b5f358a5e27798154b647f491dc9524059e"
//                 this.balancerPoolFactory = "0x9C84391B443ea3a48788079a5f98e2EaD55c9309"
//                 this.balancerPerpUsdcCrp = "0x381505ad1f9189Bf4bD9f07b38feaE8bF4329F31"
//                 this.usdc = "0x8fD7EEdBd635bA56AEA2EB11B692F1D33Df7c276"
//                 // TODO change keeper address
//                 this.keeper = "0xb649aDDe53f562bC5e083A8FaAD1b4b3A5CddD03"
//                 break
//             case "ropsten":
//                 break
//             case "xdai":
//                 // TODO fill in data once ready for production
//                 break
//             // TODO test
//             // case "xdaitest":
//             //     // use the deployer itself as the multisig & treasury
//             //     this.foundationMultisig = "0x9E9DFaCCABeEcDA6dD913b3685c9fe908F28F58c"
//             //     this.foundationTreasury = "0x9E9DFaCCABeEcDA6dD913b3685c9fe908F28F58c"
//             //     this.testnetArbitrager = "0x68dfc526037E9030c8F813D014919CC89E7d4d74"
//             //     this.chainIdL1 = 4 // rinkeby
//             //     break
//             case "sokol":
//                 this.foundationTreasury = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 // TODO change keeper address
//                 this.keeper = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 break
//             case "localhost":
//                 this.foundationTreasury = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 // TODO change keeper address
//                 this.keeper = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 this.ambBridgeOnXDai = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 this.ambBridgeOnEth = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 this.multiTokenMediatorOnXDai = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 this.multiTokenMediatorOnEth = "0x9602686bf53a17baeD60C48Ba34Ed4219A532381"
//                 this.chainIdL1 = 31337 // default buidler evm chain ID
//                 break
//             default:
//                 throw new Error(`ExternalContract not set: network=${network} not supported yet`)
//         }
//     }
// }
