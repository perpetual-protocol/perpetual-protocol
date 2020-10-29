import { web3 } from "@nomiclabs/buidler"

export interface EIP712Domain {
    name: string
    version: string
    chainId: number
    verifyingContract: string
}

export interface MetaTx {
    from: string
    to: string
    functionSignature: string
    nonce: number
}

export interface SignedResponse {
    signature: string
    r: string
    s: string
    v: number
}

const EIP712DomainTypes = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
]

const MetaTxTypes = [
    { name: "nonce", type: "uint256" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "functionSignature", type: "bytes" },
]

export function changeBlockTime(time: number): Promise<void> {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [time],
                id: 0,
            },
            (err: Error, res: any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(res)
                }
            },
        )
    })
}

export function signEIP712MetaTx(signer: string, domain: EIP712Domain, metaTx: MetaTx): Promise<SignedResponse> {
    const dataToSign = {
        types: {
            EIP712Domain: EIP712DomainTypes,
            MetaTransaction: MetaTxTypes,
        },
        domain,
        primaryType: "MetaTransaction",
        message: metaTx,
    }

    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                id: 999999999999,
                method: "eth_signTypedData",
                params: [signer, dataToSign],
            },
            async function(err: any, result: any) {
                if (err) {
                    reject(err)
                }

                const signature = result.result.substring(2)
                resolve({
                    signature,
                    r: "0x" + signature.substring(0, 64),
                    s: "0x" + signature.substring(64, 128),
                    v: parseInt(signature.substring(128, 130), 16),
                })
            },
        )
    })
}
