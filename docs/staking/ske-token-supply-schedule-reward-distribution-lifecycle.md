> :warning: These are only for learning purposes. Content may be out of sync with the HEAD. Check the git history to verify

## PerpToken & SupplySchedule & RewardDistribution Lifecycle

```mermaid
graph LR;
    startSchedule --> isMintable{next mint time passed?};
    isMintable -- yes --> mintReward;
    isMintable -- no --> isMintable;
    mintReward --> decayInflationRate;
    decayInflationRate --> isMintable;
```

## Key Operations

### mintReward()

```mermaid
graph LR;
    mintReward --> mintable{has more to mint?};
    mintable -- yes --> mintToDistributor;
    mintable -- no --> revert;
    mintToDistributor --> distributeRewards;

    classDef red fill:#EE561D;
    class revert red
```

### distributeRewards()

```mermaid
graph LR;
    distributeRewards --> hasMoreRecepient{has more recepient?};
    hasMoreRecepient -- yes --> transferSKEToRecepient;
    hasMoreRecepient -- no --> transferSKEToDefaultRecepient;
    transferSKEToRecepient --> notifyRecepient;
    notifyRecepient --> hasMoreRecepient;
    transferSKEToDefaultRecepient --> notifyDefaultRecepient;
```
