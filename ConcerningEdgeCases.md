# What to be concerned for internet syncing
1. Server received too late (solution: force confirmation)
2. Client received too late (solution: prediction and frame chasing, big impact on user experience because the graphics will be inconsistent if mismatches occur too often)

# Potential avalanche from local lag
Under the current "input delay" algorithm, the lag of a single player would cause all the other players to receive outdated commands, e.g. when at a certain moment   
- player#1: renderFrameId = 100, significantly lagged due to local CPU overheated
- player#2: renderFrameId = 240
- player#3: renderFrameId = 239
- player#4: renderFrameId = 242

players #2, #3 #4 would receive "outdated(in their subjective feelings) but all-confirmed commands" from then on, thus forced to rollback and chase many frames - the lag due to "large range of frame-chasing" would then further deteriorate the situation - like an avalanche.   

In a "no-server & p2p" setup, I couldn't think of a proper way to cope with such edge case. Solely on the frontend we could only mitigate the impact to players #2, #3, #4, e.g. a potential lag due to "large range of frame-chasing" is proactively avoided in `<proj-root>/frontend/assets/scripts/Map.js, function update(dt)`. 

To be fair, **a "p2p" setup can reduce round-trip to single-trip**, but w/o a point of authority in such case player#1 needs a way to recognize the slowness (e.g. check the received peer inputs) and ticks faster for a while to catch up; in contrast in a "server as authority" setup, the server could force confirming an inputFrame without player#1's upsync, and notify player#1 to apply a "roomDownsyncFrame" as well as drop all its outdated local inputFrames. 

# Start up frames
renderFrameId      |   generatedInputFrameId    |  toApplyInputFrameId            
-------------------|----------------------------|----------------------
0, 1, 2, 3         |   0, _EMP_, _EMP_, _EMP_   |  0
4, 5, 6, 7         |   1, _EMP_, _EMP_, _EMP_   |  0
8, 9, 10, 11       |   2, _EMP_, _EMP_, _EMP_   |  1 
12, 13, 14, 15     |   3, _EMP_, _EMP_, _EMP_   |  2

It should be reasonable to assume that inputFrameId=0 is always of all-empty content, because human has no chance of clicking at the very first render frame.  

# Alignment of the current setup 
The following setup is chosen deliberately for some "%4" number coincidence.
- NstDelayFrames = 2 
- InputDelayFrames = 4
- InputScaleFrames = 2  

If "InputDelayFrames" is changed, the impact would be as follows, kindly note that "372%4 == 0".

### pR.InputDelayFrames = 4
renderFrameId             |   toApplyInputFrameId      
--------------------------|---------------------------------------------------- 
368, 369, 370, 371        |   91
372, 373, 374, 375        |   92       

### pR.InputDelayFrames = 5
renderFrameId             |   toApplyInputFrameId      
--------------------------|---------------------------------------------------- 
..., ..., ..., 368        |   90
369, 370, 371, 372        |   91
373, 374, 375, ...        |   92      
