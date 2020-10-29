/// <reference types="chai" />

declare namespace Chai {
    // For BDD API
    interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
        emit: Function
        withArgs: Function
    }
}
declare module "@openzeppelin/test-helpers"
