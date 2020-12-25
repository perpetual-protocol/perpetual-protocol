
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
    withdrawReward  |                  |       transfer        ---------------------
   <--------------- |  feeRewardPool   |  <------------------  |                   |                        keeper
 stakers            |                  |   notifyRewardAmount  |   TmpRewardPool   |  <------------------------
                    --------------------                       |                   |   transferToFeeRewardPool
                                                               ---------------------
                                                                         ▲
                                                                         |
                                        _________________________________|
                                        | 
    =================================== | ===========================================================
                                        | 
                                        | transferToTmpRewardPool()
                                ---------------                       -----------------
                                |             |        transfer       |               |
                                |  tollPool   |  <------------------  | clearingHouse |
                                |             |  notifyTokenAmount()  |               |
                                ---------------                       -----------------
```