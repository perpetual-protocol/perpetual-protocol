> :warning: These are only for learning purposes. Content may be out of sync with the HEAD. Check the git history to verify

## Staking Lifecycle (staker workflow)

```mermaid
graph LR;
    deposit --> stake;
    stake --> claimFeesAndVestedReward;
    claimFeesAndVestedReward --> claimFeesAndVestedReward;
    claimFeesAndVestedReward --> unstake;
    unstake --> withdraw;
```

## Staking Lifecycle (reserve workflow)

```mermaid
graph LR;
    PerpToken.startSchedule -- "PerpToken.mint()" --> notifyRewardAmount;
    notifyRewardAmount -- "PerpToken.mint()" --> notifyRewardAmount;
```

## Staking Lifecycle (token state-machine)

```mermaid
graph LR;
    self-owned -- deposit --> deposited;
    deposited -- stake --> locked[pending/locked];
    locked[pending/locked] -- nextEpoch --> unlocked;
    unlocked -- unstake --> deposited;
    deposited -- withdraw --> self-owned;
```

## Key Operations

### deposit()

```mermaid
graph LR;
    deposit --> collectSKE[transfer SKE to StakingReserve];
```

### stake()

```mermaid
graph LR;
    stake --> getUnlockedBalance{enough unlocked SKE?};

    getUnlockedBalance -- yes --> supplyStarted{supply schedule started?};
    getUnlockedBalance -- no --> revert;

    supplyStarted -- yes --> isEpochActive{is current epoch still active?};
    supplyStarted -- no --> revert;

    isEpochActive -- yes --> increaseStake;

    isEpochActive -- no --> increaseStake;

    classDef red fill:#EE561D;
    class revert red
```

### claimFeesAndVestedReward()

```mermaid
graph LR;
    claimFeesAndVestedReward --> transferAllFees[transfer all remaining fees up to the last finished epoch];
    transferAllFees --> isVestingPeriodReached{vesting period reached?};
    isVestingPeriodReached -- yes --> transferReward[transfer remaining rewards until the last rewardable epoch];
    isVestingPeriodReached -- no --> no-op;
```

### unstake()

```mermaid
graph LR;
    withdraw --> getUnstakableBalance{enough unstakable SKE?};

    getUnstakableBalance -- yes --> decreaseStake;
    getUnstakableBalance -- no --> revert;

    classDef red fill:#EE561D;
    class revert red
```

### withdraw()

```mermaid
graph LR;
    withdraw --> getUnlockedBalance{enough unlocked SKE?};

    getUnlockedBalance -- yes --> transferSKE[transfer SKE to owner];
    getUnlockedBalance -- no --> revert;

    classDef red fill:#EE561D;
    class revert red
```

### notifyRewardAmount()

```mermaid
graph LR;
    notifyRewardAmount --> appendTokenReward;
    appendTokenReward --> collectFees[collect fee from AmmMgr for the closing epoch];
```
