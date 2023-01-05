Major goals
- Create several skills that can be chained by pressing "btnA" 3 times, while the 2nd skill cancels the last hit of 1st skill before the latters' FramesToRecover is over, same goes with 2nd->3rd transition. 
- Note that each skill can contain "multihit".

Minor goals
- Split jumping anim into "once" part and "keep" part, depending on "character.framesElapsedInChState" we should play the corresponding part
- Add new "chState = STUNNED", which is applicable to both on ground and in air, while "inAir && STUNNED", "character.FramesToRecover" is regarded as infinite. If implemented, make the last hit of the aforementioned 3rd skill "pushback opponent to air". 
