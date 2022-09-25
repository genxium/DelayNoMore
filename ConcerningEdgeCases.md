Under the current "input delay" algorithm, the lag of a single player would cause all the other players to receive outdated commands, e.g. when at a certain moment   
- player#1: renderFrameId = 100, significantly lagged due to local CPU overheated
- player#2: renderFrameId = 240
- player#3: renderFrameId = 239
- player#4: renderFrameId = 242

players #2, #3 #4 would receive "outdated(in their subjective feelings) but all-confirmed commands" from then on, thus forced to rollback and chase many frames - the lag due to "large range of frame-chasing" would then further deteriorate the situation - like an avalanche.   

In a "no-server & p2p" setup, I couldn't think of a proper way to cope with such edge case. Solely on the frontend we could only mitigate the impact to players #2, #3, #4, e.g. a potential lag due to "large range of frame-chasing" is proactively avoided in `<proj-root>/frontend/assets/scripts/Map.js, function update(dt)`.

However in a "server as authority" setup, the server could force confirming an inputFrame without player#1's upsync, and notify player#1 to apply a "roomDownsyncFrame" as well as drop all its outdated local inputFrames. 
