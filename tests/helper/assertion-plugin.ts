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
}
