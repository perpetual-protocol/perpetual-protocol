import BN from "bn.js"
import { MixedDecimal } from "./number"

export function assertionHelper(chai: Chai.ChaiStatic, utils: Chai.ChaiUtils): void {
    chai.Assertion.overwriteMethod("eq", function(_super) {
        return function assertDecimal(this: Chai.AssertionPrototype, expected: MixedDecimal): void {
            const obj = this._obj
            if (obj.d) {
                this.assert(
                    obj.d === expected.toString(),
                    `expected ${obj.d} to equal ${expected.toString()}`,
                    `expected ${obj.d} to equal ${expected.toString()}`,
                    expected,
                )
            } else if (BN.isBN(obj)) {
                this.assert(
                    obj.toString() === expected.toString(),
                    `expected ${obj.toString()} to equal ${expected.toString()}`,
                    `expected ${obj.toString()} to equal ${expected.toString()}`,
                    expected,
                )
            } else {
                _super.apply(this, [expected])
            }
        }
    })

    chai.Assertion.addMethod("emit", function(eventName: string) {
        const obj = this._obj as Truffle.TransactionResponse
        const log = obj.logs.find((_log: Truffle.TransactionLog) => _log.event === eventName)
        const msg = `Expected event "${eventName}" to be emitted, but it doesn't exist in the contract.`

        this.assert(log, msg, msg, eventName)
    })

    chai.Assertion.addMethod("withArgs", function(map: Record<string, any>) {
        const obj = this._obj as Truffle.TransactionResponse

        // map expected key/value pair from Record<string, any> to Record<string, string>
        // to make diff clear
        const expected: Record<string, string> = {}
        Object.entries(map).forEach(([key, value]) => {
            expected[key] = value.toString()
        })

        // same as expected to array of Record<string, string>
        const actual: Record<string, string>[] = obj.logs.map(log => {
            const filteredArgs: Record<string, any> = {}
            Object.keys(log.args).forEach(key => {
                if (Number.isNaN(Number.parseInt(key, 10)) && key !== "__length__") {
                    filteredArgs[key] = log.args[key].toString()
                }
            })
            return filteredArgs
        })

        const msg = "Expected event has certain args."
        const expectedList = Object.entries(expected)
        // expected one of item in actual to match every expected arguments
        const result = actual.some(args => expectedList.every(([key, value]) => args[key] === value))

        this.assert(result, msg, msg, [expected], actual)
    })
}
