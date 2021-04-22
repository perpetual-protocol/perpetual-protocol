
## Fee(toll), staking and reward

```
                -------------------
                |                 |
   stakers  --> | stakedPerpToken |
                |                 |
                -------------------
                            |
                            |  notifyStake(staker, amount)
                            ▼ 
                    --------------------                                 
    withdrawReward  |                  |       transfer        ----------------------------
   <--------------- |  feeRewardPool   |  <------------------  |                          |           keeper
 stakers            |                  |   notifyRewardAmount  | FeeTokenPoolDispatcherL1 |  <------------------------
                    --------------------                       |                          |   transferToFeeRewardPool
                                                               ----------------------------
                                                                         ▲
                                                                         |
                                        _________________________________|
                                        | 
    =================================== | ===========================================================
                                        | 
                                        | transferToFeeTokenPoolDispatcher()
                                ---------------                       -----------------
                                |             |        transfer       |               |
                                |  tollPool   |  <------------------  | clearingHouse |
                                |             |  notifyTokenAmount()  |               |
                                ---------------                       -----------------
```