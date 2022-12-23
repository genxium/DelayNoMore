package main

import (
    "github.com/gopherjs/gopherjs/js"
	"github.com/solarlune/resolv"
    . "jsexport/protos"
    "jsexport/models"
    . "dnmshared"
)

func NewRingBufferJs(n int32) *js.Object {
    return js.MakeWrapper(NewRingBuffer(n));
}

func NewCollisionSpaceJs(spaceW, spaceH, minStepW, minStepH int) *js.Object {
    return js.MakeWrapper(resolv.NewSpace(spaceW, spaceH, minStepW, minStepH))
}

func GenerateRectColliderJs(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64, tag string) *js.Object {
    /*
    [WARNING] It's important to note that we don't need "js.MakeFullWrapper" for a call sequence as follows. 
    ```
        var space = gopkgs.NewCollisionSpaceJs(2048, 2048, 8, 8);
        var a = gopkgs.GenerateRectColliderJs(189, 497, 48, 48, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, spaceOffsetX, spaceOffsetY, "Player");
        space.Add(a); 
    ```
    The "space" variable doesn't need access to the field of "a" in JavaScript level to run "space.Add(...)" method, which is good.
    */
    return js.MakeWrapper(GenerateRectCollider(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY, tag));

}

func CheckCollisionJs(obj *resolv.Object, dx, dy float64) *js.Object {
    // TODO: Support multiple tags in the future
    // Unfortunately I couldn't find a way to just call "var a = GenerateRectColliderJs(...); space.Add(a); a.Check(...)" to get the collision result, the unwrapped method will result in stack overflow. Need a better solution later.  
    return js.MakeFullWrapper(obj.Check(dx, dy));
}

func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(delayedInputFrame *InputFrameDownsync, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, gravityX, gravityY, jumpingInitVelY, inputDelayFrames, inputScaleFrames int32, inputsBuffer *RingBuffer, collisionSpaceOffsetX, collisionSpaceOffsetY, snapIntoPlatformOverlap, snapIntoPlatformThreshold, worldToVirtualGridRatio, virtualGridToWorldRatio float64) *js.Object {
    // We need access to all fields of RoomDownsyncFrame for displaying in frontend 
    return js.MakeFullWrapper(models.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, currRenderFrame, collisionSys, collisionSysMap, gravityX, gravityY, jumpingInitVelY, inputDelayFrames, inputScaleFrames, inputsBuffer, collisionSpaceOffsetX, collisionSpaceOffsetY, snapIntoPlatformOverlap, snapIntoPlatformThreshold, worldToVirtualGridRatio, virtualGridToWorldRatio))
}

func main() {
	js.Global.Set("gopkgs", map[string]interface{}{
        "NewRingBufferJs": NewRingBufferJs,
        "NewCollisionSpaceJs": NewCollisionSpaceJs,
        "GenerateRectColliderJs": GenerateRectColliderJs,
        "CheckCollisionJs": CheckCollisionJs,
	})
}
