import { web3 } from "@nomiclabs/buidler"
import { expectRevert } from "@openzeppelin/test-helpers"
import { suite, test } from "@testdeck/mocha"
import { default as BigNumber } from "bn.js"
import { expect, use } from "chai"
import { MetaTxGatewayInstance } from "types/truffle"
import MetaTxRecipientMockArtifact from "../../build/contracts/MetaTxRecipientMock.json"
import { MetaTxRecipientMock } from "../../types/web3/MetaTxRecipientMock"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployMetaTxGateway } from "../helper/contract"
import { EIP712Domain, signEIP712MetaTx } from "../helper/web3"

use(assertionHelper)

@suite
class MetaTxGatewaySpec {
    domain!: EIP712Domain

    admin!: string
    alice!: string
    relayer!: string

    l1ChainId!: number

    metaTxGateway!: MetaTxGatewayInstance
    metaTxRecipientMock!: MetaTxRecipientMock

    async before(): Promise<void> {
        const accounts = await web3.eth.getAccounts()
        this.admin = accounts[0]
        this.alice = accounts[1]
        this.relayer = accounts[2]

        this.l1ChainId = 1234

        this.metaTxGateway = await deployMetaTxGateway("Test", "1", this.l1ChainId)
        this.metaTxRecipientMock = ((await new web3.eth.Contract(MetaTxRecipientMockArtifact.abi)
            .deploy({
                data: MetaTxRecipientMockArtifact.bytecode,
                arguments: [this.metaTxGateway.address],
            })
            .send({
                from: this.admin,
            })) as unknown) as MetaTxRecipientMock

        await this.metaTxGateway.addToWhitelists(this.metaTxRecipientMock.options.address)

        this.domain = {
            name: "Test",
            version: "1",
            chainId: this.l1ChainId,
            verifyingContract: this.metaTxGateway.address,
        }
    }

    @test
    async processMetaTxSignedL1(): Promise<void> {
        expect(await this.metaTxRecipientMock.methods.pokedBy().call()).to.eq(
            "0x0000000000000000000000000000000000000000",
        )

        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(this.alice, this.domain, metaTx)

        await this.metaTxGateway.executeMetaTransaction(
            metaTx.from,
            metaTx.to,
            metaTx.functionSignature,
            signedResponse.r,
            signedResponse.s,
            signedResponse.v,
            {
                from: this.relayer,
            },
        )

        expect(await this.metaTxRecipientMock.methods.pokedBy().call()).to.eq(this.alice)
    }

    @test
    async processMetaTxSignedL2(): Promise<void> {
        expect(await this.metaTxRecipientMock.methods.pokedBy().call()).to.eq(
            "0x0000000000000000000000000000000000000000",
        )

        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(
            this.alice,
            {
                ...this.domain,
                chainId: 31337, // default buidler evm chain ID
            },
            metaTx,
        )

        await this.metaTxGateway.executeMetaTransaction(
            metaTx.from,
            metaTx.to,
            metaTx.functionSignature,
            signedResponse.r,
            signedResponse.s,
            signedResponse.v,
            {
                from: this.relayer,
            },
        )

        expect(await this.metaTxRecipientMock.methods.pokedBy().call()).to.eq(this.alice)
    }

    @test
    async rejectMetaTxNotWhitelisted(): Promise<void> {
        const metaTx = {
            from: this.alice,
            to: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", // arbitrary address not in whitelist
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(this.alice, this.domain, metaTx)

        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: this.relayer,
                },
            ),
            "!whitelisted",
        )
    }

    @test
    async rejectNonOwnerWhitelisting(): Promise<void> {
        await expectRevert(
            this.metaTxGateway.addToWhitelists("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", { from: this.alice }),
            "PerpFiOwnableUpgrade: caller is not the owner",
        )
    }

    @test
    async rejectMetaTxWrongDomain(): Promise<void> {
        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(
            this.alice,
            {
                ...this.domain,
                version: "2", // wrong domain version
            },
            metaTx,
        )

        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: this.relayer,
                },
            ),
            "Signer and signature do not match",
        )
    }

    @test
    async rejectMetaTxNonceTooHigh(): Promise<void> {
        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: 1, // nonce should be 0 instead of 1
        }
        const signedResponse = await signEIP712MetaTx(this.alice, this.domain, metaTx)

        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: this.relayer,
                },
            ),
            "Signer and signature do not match",
        )
    }

    @test
    async rejectMetaTxNonceTooLow(): Promise<void> {
        // make a successful meta tx first
        const metaTx1 = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse1 = await signEIP712MetaTx(this.alice, this.domain, metaTx1)
        await this.metaTxGateway.executeMetaTransaction(
            metaTx1.from,
            metaTx1.to,
            metaTx1.functionSignature,
            signedResponse1.r,
            signedResponse1.s,
            signedResponse1.v,
            {
                from: this.relayer,
            },
        )
        expect(await this.metaTxGateway.getNonce(this.alice)).to.eq(new BigNumber(1))

        // make the second meta tx
        const metaTx2 = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: 0, // nonce should be 1 instead of 0
        }
        const signedResponse2 = await signEIP712MetaTx(this.alice, this.domain, metaTx2)
        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx2.from,
                metaTx2.to,
                metaTx2.functionSignature,
                signedResponse2.r,
                signedResponse2.s,
                signedResponse2.v,
                {
                    from: this.relayer,
                },
            ),
            "Signer and signature do not match",
        )
    }

    @test
    async rejectMetaTxSignedByOthers(): Promise<void> {
        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(
            this.relayer, // sign the meta tx with other account
            {
                name: "Test",
                version: "1",
                chainId: this.l1ChainId,
                verifyingContract: this.metaTxGateway.address,
            },
            metaTx,
        )

        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: this.relayer,
                },
            ),
            "Signer and signature do not match",
        )
    }

    @test
    async rejectMetaTxZeroAddressAttack(): Promise<void> {
        const metaTx = {
            from: "0x0000000000000000000000000000000000000000",
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: 0,
        }
        const invalidSignature =
            "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefde"
        const signedResponse = {
            invalidSignature,
            r: "0x" + invalidSignature.substring(0, 64),
            s: "0x" + invalidSignature.substring(64, 128),
            v: parseInt(invalidSignature.substring(128, 130), 16),
        }

        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: this.relayer,
                },
            ),
            "invalid signature",
        )
    }

    @test
    async rejectMetaTxWithSpecificErrorMessage(): Promise<void> {
        await expectRevert(this.metaTxRecipientMock.methods.error().call(), "MetaTxRecipientMock: Error")

        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.error().encodeABI(),
            nonce: +(await this.metaTxGateway.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(
            this.alice,
            {
                ...this.domain,
                chainId: 31337, // default buidler evm chain ID
            },
            metaTx,
        )

        await expectRevert(
            this.metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: this.relayer,
                },
            ),
            "MetaTxRecipientMock: Error",
        )
    }

    @test
    async fallbackMsgSenderIfNonTrustedForwarder(): Promise<void> {
        expect(await this.metaTxRecipientMock.methods.pokedBy().call()).to.eq(
            "0x0000000000000000000000000000000000000000",
        )

        // create another forwarder which is not trusted by metaTxRecipient
        const nonTrustedForwarder = await deployMetaTxGateway("Test", "1", this.l1ChainId)
        expect(await this.metaTxRecipientMock.methods.isTrustedForwarder(nonTrustedForwarder.address).call()).to.be
            .false
        await nonTrustedForwarder.addToWhitelists(this.metaTxRecipientMock.options.address)

        const metaTx = {
            from: this.alice,
            to: this.metaTxRecipientMock.options.address,
            functionSignature: this.metaTxRecipientMock.methods.poke().encodeABI(),
            nonce: +(await nonTrustedForwarder.getNonce(this.alice)),
        }
        const signedResponse = await signEIP712MetaTx(
            this.alice,
            {
                ...this.domain,
                verifyingContract: nonTrustedForwarder.address, // use the non-trusted forwarder
            },
            metaTx,
        )

        // send meta tx through the non-trusted forwarder
        await nonTrustedForwarder.executeMetaTransaction(
            metaTx.from,
            metaTx.to,
            metaTx.functionSignature,
            signedResponse.r,
            signedResponse.s,
            signedResponse.v,
            {
                from: this.relayer,
            },
        )

        // _msgSender() should fallback to msg.sender, which is the non-trusted forwarder
        expect(await this.metaTxRecipientMock.methods.pokedBy().call()).to.eq(nonTrustedForwarder.address)
    }
}
