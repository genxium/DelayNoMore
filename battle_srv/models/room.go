package models

import (
	. "dnmshared"
	"fmt"
	"github.com/golang/protobuf/proto"
	"github.com/gorilla/websocket"
	"github.com/kvartborg/vector"
	"github.com/solarlune/resolv"
	"go.uber.org/zap"
	"math/rand"
	. "server/common"
	"server/common/utils"
	pb "server/pb_output"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"encoding/xml"
	"io/ioutil"
	"os"
	"path/filepath"
)

const (
	UPSYNC_MSG_ACT_HB_PING             = int32(1)
	UPSYNC_MSG_ACT_PLAYER_CMD          = int32(2)
	UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK = int32(3)

	DOWNSYNC_MSG_ACT_HB_REQ         = int32(1)
	DOWNSYNC_MSG_ACT_INPUT_BATCH    = int32(2)
	DOWNSYNC_MSG_ACT_BATTLE_STOPPED = int32(3)
	DOWNSYNC_MSG_ACT_FORCED_RESYNC  = int32(4)

	DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START = int32(-1)
	DOWNSYNC_MSG_ACT_BATTLE_START          = int32(0)

	DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED   = int32(-98)
	DOWNSYNC_MSG_ACT_PLAYER_READDED_AND_ACKED = int32(-97)
)

const (
	MAGIC_JOIN_INDEX_DEFAULT = 0
	MAGIC_JOIN_INDEX_INVALID = -1
)

const (
	COLLISION_CATEGORY_CONTROLLED_PLAYER = (1 << 1)
	COLLISION_CATEGORY_BARRIER           = (1 << 2)

	COLLISION_MASK_FOR_CONTROLLED_PLAYER = (COLLISION_CATEGORY_BARRIER)
	COLLISION_MASK_FOR_BARRIER           = (COLLISION_CATEGORY_CONTROLLED_PLAYER)

	COLLISION_PLAYER_INDEX_PREFIX  = (1 << 17)
	COLLISION_BARRIER_INDEX_PREFIX = (1 << 16)
)

const (
	MAGIC_LAST_SENT_INPUT_FRAME_ID_NORMAL_ADDED = -1
	MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED      = -2
)

var DIRECTION_DECODER = [][]int32{
	{0, 0},
	{0, +1},
	{0, -1},
	{+2, 0},
	{-2, 0},
	{+2, +1},
	{-2, -1},
	{+2, -1},
	{-2, +1},
	{+2, 0},
	{-2, 0},
	{0, +1},
	{0, -1},
}

var DIRECTION_DECODER_INVERSE_LENGTH = []float64{
	0.0,
	1.0,
	1.0,
	0.5,
	0.5,
	0.4472,
	0.4472,
	0.4472,
	0.4472,
	0.5,
	0.5,
	1.0,
	1.0,
}

type RoomBattleState struct {
	IDLE                           int32
	WAITING                        int32
	PREPARE                        int32
	IN_BATTLE                      int32
	STOPPING_BATTLE_FOR_SETTLEMENT int32
	IN_SETTLEMENT                  int32
	IN_DISMISSAL                   int32
}

type BattleStartCbType func()
type SignalToCloseConnCbType func(customRetCode int, customRetMsg string)

// A single instance containing only "named constant integers" to be shared by all threads.
var RoomBattleStateIns RoomBattleState

func InitRoomBattleStateIns() {
	RoomBattleStateIns = RoomBattleState{
		IDLE:                           0,
		WAITING:                        -1,
		PREPARE:                        10000000,
		IN_BATTLE:                      10000001,
		STOPPING_BATTLE_FOR_SETTLEMENT: 10000002,
		IN_SETTLEMENT:                  10000003,
		IN_DISMISSAL:                   10000004,
	}
}

func calRoomScore(inRoomPlayerCount int32, roomPlayerCnt int, currentRoomBattleState int32) float32 {
	x := float32(inRoomPlayerCount) / float32(roomPlayerCnt)
	d := (x - 0.5)
	d2 := d * d
	return -7.8125*d2 + 5.0 - float32(currentRoomBattleState)
}

type Room struct {
	Id              int32
	Capacity        int
	Players         map[int32]*Player
	PlayersArr      []*Player // ordered by joinIndex
	CollisionSysMap map[int32]*resolv.Object
	/**
		 * The following `PlayerDownsyncSessionDict` is NOT individually put
		 * under `type Player struct` for a reason.
		 *
		 * Upon each connection establishment, a new instance `player Player` is created for the given `playerId`.

		 * To be specific, if
		 *   - that `playerId == 42` accidentally reconnects in just several milliseconds after a passive disconnection, e.g. due to bad wireless signal strength, and
		 *   - that `type Player struct` contains a `DownsyncSession` field
		 *
		 * , then we might have to
		 *   - clean up `previousPlayerInstance.DownsyncSession`
		 *   - initialize `currentPlayerInstance.DownsyncSession`
		 *
		 * to avoid chaotic flaws.
	     *
	     * Moreover, during the invocation of `PlayerSignalToCloseDict`, the `Player` instance is supposed to be deallocated (though not synchronously).
	*/
	PlayerDownsyncSessionDict              map[int32]*websocket.Conn
	PlayerSignalToCloseDict                map[int32]SignalToCloseConnCbType
	Score                                  float32
	State                                  int32
	Index                                  int
	RenderFrameId                          int32
	CurDynamicsRenderFrameId               int32 // [WARNING] The dynamics of backend is ALWAYS MOVING FORWARD BY ALL-CONFIRMED INPUTFRAMES (either by upsync or forced), i.e. no rollback
	ServerFps                              int32
	BattleDurationFrames                   int32
	BattleDurationNanos                    int64
	InputFrameUpsyncDelayTolerance         int32
	MaxChasingRenderFramesPerUpdate        int32
	EffectivePlayerCount                   int32
	DismissalWaitGroup                     sync.WaitGroup
	Barriers                               map[int32]*Barrier
	InputsBuffer                           *RingBuffer // Indices are STRICTLY consecutive
	DiscreteInputsBuffer                   sync.Map    // Indices are NOT NECESSARILY consecutive
	RenderFrameBuffer                      *RingBuffer
	LastAllConfirmedInputFrameId           int32
	LastAllConfirmedInputFrameIdWithChange int32
	LastAllConfirmedInputList              []uint64
	InputDelayFrames                       int32  // in the count of render frames
	NstDelayFrames                         int32  // network-single-trip delay in the count of render frames, proposed to be (InputDelayFrames >> 1) because we expect a round-trip delay to be exactly "InputDelayFrames"
	InputScaleFrames                       uint32 // inputDelayedAndScaledFrameId = ((originalFrameId - InputDelayFrames) >> InputScaleFrames)
	JoinIndexBooleanArr                    []bool
	RollbackEstimatedDt                    float64
	RollbackEstimatedDtMillis              float64
	RollbackEstimatedDtNanos               int64
	LastRenderFrameIdTriggeredAt           int64

	StageName                      string
	StageDiscreteW                 int32
	StageDiscreteH                 int32
	StageTileW                     int32
	StageTileH                     int32
	RawBattleStrToVec2DListMap     StrToVec2DListMap
	RawBattleStrToPolygon2DListMap StrToPolygon2DListMap
}

const (
	PLAYER_DEFAULT_SPEED = float64(200) // Hardcoded
	ADD_SPEED            = float64(100) // Hardcoded
)

func (pR *Room) updateScore() {
	pR.Score = calRoomScore(pR.EffectivePlayerCount, pR.Capacity, pR.State)
}

func (pR *Room) AddPlayerIfPossible(pPlayerFromDbInit *Player, session *websocket.Conn, signalToCloseConnOfThisPlayer SignalToCloseConnCbType) bool {
	playerId := pPlayerFromDbInit.Id
	// TODO: Any thread-safety concern for accessing "pR" here?
	if RoomBattleStateIns.IDLE != pR.State && RoomBattleStateIns.WAITING != pR.State {
		Logger.Warn("AddPlayerIfPossible error, roomState:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		return false
	}
	if _, existent := pR.Players[playerId]; existent {
		Logger.Warn("AddPlayerIfPossible error, existing in the room.PlayersDict:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		return false
	}

	defer pR.onPlayerAdded(playerId)
	pPlayerFromDbInit.AckingFrameId = -1
	pPlayerFromDbInit.AckingInputFrameId = -1
	pPlayerFromDbInit.LastSentInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_NORMAL_ADDED
	pPlayerFromDbInit.BattleState = PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK
	pPlayerFromDbInit.FrozenAtGmtMillis = -1       // Hardcoded temporarily.
	pPlayerFromDbInit.Speed = PLAYER_DEFAULT_SPEED // Hardcoded temporarily.
	pPlayerFromDbInit.AddSpeedAtGmtMillis = -1     // Hardcoded temporarily.

	pR.Players[playerId] = pPlayerFromDbInit
	pR.PlayerDownsyncSessionDict[playerId] = session
	pR.PlayerSignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
	return true
}

func (pR *Room) ReAddPlayerIfPossible(pTmpPlayerInstance *Player, session *websocket.Conn, signalToCloseConnOfThisPlayer SignalToCloseConnCbType) bool {
	playerId := pTmpPlayerInstance.Id
	// TODO: Any thread-safety concern for accessing "pR" and "pEffectiveInRoomPlayerInstance" here?
	if RoomBattleStateIns.PREPARE != pR.State && RoomBattleStateIns.WAITING != pR.State && RoomBattleStateIns.IN_BATTLE != pR.State && RoomBattleStateIns.IN_SETTLEMENT != pR.State && RoomBattleStateIns.IN_DISMISSAL != pR.State {
		Logger.Warn("ReAddPlayerIfPossible error due to roomState:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		return false
	}
	if _, existent := pR.Players[playerId]; !existent {
		Logger.Warn("ReAddPlayerIfPossible error due to player nonexistent for room:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		return false
	}
	/*
	 * WARNING: The "pTmpPlayerInstance *Player" used here is a temporarily constructed
	 * instance from "<proj-root>/battle_srv/ws/serve.go", which is NOT the same as "pR.Players[pTmpPlayerInstance.Id]".
	 * -- YFLu
	 */
	defer pR.onPlayerReAdded(playerId)
	pR.PlayerDownsyncSessionDict[playerId] = session
	pR.PlayerSignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
	pEffectiveInRoomPlayerInstance := pR.Players[playerId]
	pEffectiveInRoomPlayerInstance.AckingFrameId = -1
	pEffectiveInRoomPlayerInstance.AckingInputFrameId = -1
	pEffectiveInRoomPlayerInstance.LastSentInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED
	pEffectiveInRoomPlayerInstance.BattleState = PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK

	Logger.Warn("ReAddPlayerIfPossible finished.", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("joinIndex", pEffectiveInRoomPlayerInstance.JoinIndex), zap.Any("playerBattleState", pEffectiveInRoomPlayerInstance.BattleState), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount), zap.Any("AckingFrameId", pEffectiveInRoomPlayerInstance.AckingFrameId), zap.Any("AckingInputFrameId", pEffectiveInRoomPlayerInstance.AckingInputFrameId), zap.Any("LastSentInputFrameId", pEffectiveInRoomPlayerInstance.LastSentInputFrameId))
	return true
}

func (pR *Room) ChooseStage() error {
	/*
	 * We use the verb "refresh" here to imply that upon invocation of this function, all colliders will be recovered if they were destroyed in the previous battle.
	 *
	 * -- YFLu, 2019-09-04
	 */
	pwd, err := os.Getwd()
	if nil != err {
		panic(err)
	}

	rand.Seed(time.Now().Unix())
	stageNameList := []string{ /*"simple" ,*/ "richsoil"}
	chosenStageIndex := rand.Int() % len(stageNameList) // Hardcoded temporarily. -- YFLu

	pR.StageName = stageNameList[chosenStageIndex]

	relativePathForAllStages := "../frontend/assets/resources/map"
	relativePathForChosenStage := fmt.Sprintf("%s/%s", relativePathForAllStages, pR.StageName)

	pTmxMapIns := &TmxMap{}

	absDirPathContainingDirectlyTmxFile := filepath.Join(pwd, relativePathForChosenStage)
	absTmxFilePath := fmt.Sprintf("%s/map.tmx", absDirPathContainingDirectlyTmxFile)
	if !filepath.IsAbs(absTmxFilePath) {
		panic("Tmx filepath must be absolute!")
	}

	byteArr, err := ioutil.ReadFile(absTmxFilePath)
	if nil != err {
		panic(err)
	}
	err = xml.Unmarshal(byteArr, pTmxMapIns)
	if nil != err {
		panic(err)
	}

	// Obtain the content of `gidBoundariesMapInB2World`.
	gidBoundariesMapInB2World := make(map[int]StrToPolygon2DListMap, 0)
	for _, tileset := range pTmxMapIns.Tilesets {
		relativeTsxFilePath := fmt.Sprintf("%s/%s", filepath.Join(pwd, relativePathForChosenStage), tileset.Source) // Note that "TmxTileset.Source" can be a string of "relative path".
		absTsxFilePath, err := filepath.Abs(relativeTsxFilePath)
		if nil != err {
			panic(err)
		}
		if !filepath.IsAbs(absTsxFilePath) {
			panic("Filepath must be absolute!")
		}

		byteArrOfTsxFile, err := ioutil.ReadFile(absTsxFilePath)
		if nil != err {
			panic(err)
		}

		DeserializeTsxToColliderDict(pTmxMapIns, byteArrOfTsxFile, int(tileset.FirstGid), gidBoundariesMapInB2World)
	}

	stageDiscreteW, stageDiscreteH, stageTileW, stageTileH, toRetStrToVec2DListMap, toRetStrToPolygon2DListMap, err := ParseTmxLayersAndGroups(pTmxMapIns, gidBoundariesMapInB2World)
	if nil != err {
		panic(err)
	}

	pR.StageDiscreteW = stageDiscreteW
	pR.StageDiscreteH = stageDiscreteH
	pR.StageTileW = stageTileW
	pR.StageTileH = stageTileH
	pR.RawBattleStrToVec2DListMap = toRetStrToVec2DListMap
	pR.RawBattleStrToPolygon2DListMap = toRetStrToPolygon2DListMap

	barrierPolygon2DList := *(toRetStrToPolygon2DListMap["Barrier"])

	var barrierLocalIdInBattle int32 = 0
	for _, polygon2DUnaligned := range barrierPolygon2DList {
        polygon2D := AlignPolygon2DToBoundingBox(polygon2DUnaligned)  
		/*
		   // For debug-printing only.
		   Logger.Info("ChooseStage printing polygon2D for barrierPolygon2DList", zap.Any("barrierLocalIdInBattle", barrierLocalIdInBattle), zap.Any("polygon2D.Anchor", polygon2D.Anchor), zap.Any("polygon2D.Points", polygon2D.Points))
		*/
		pR.Barriers[barrierLocalIdInBattle] = &Barrier{
			Boundary: polygon2D,
		}

		barrierLocalIdInBattle++
	}

	return nil
}

func (pR *Room) ConvertToInputFrameId(renderFrameId int32, inputDelayFrames int32) int32 {
	// Specifically when "renderFrameId < inputDelayFrames", the result is 0.
	return ((renderFrameId - inputDelayFrames) >> pR.InputScaleFrames)
}

func (pR *Room) ConvertToGeneratingRenderFrameId(inputFrameId int32) int32 {
	return (inputFrameId << pR.InputScaleFrames)
}

func (pR *Room) ConvertToFirstUsedRenderFrameId(inputFrameId int32, inputDelayFrames int32) int32 {
	return ((inputFrameId << pR.InputScaleFrames) + inputDelayFrames)
}

func (pR *Room) ConvertToLastUsedRenderFrameId(inputFrameId int32, inputDelayFrames int32) int32 {
	return ((inputFrameId << pR.InputScaleFrames) + inputDelayFrames + (1 << pR.InputScaleFrames) - 1)
}

func (pR *Room) EncodeUpsyncCmd(upsyncCmd *pb.InputFrameUpsync) uint64 {
	var ret uint64 = 0
	// There're 13 possible directions, occupying the first 4 bits, no need to shift
	ret += uint64(upsyncCmd.EncodedDir)
	return ret
}

func (pR *Room) RenderFrameBufferString() string {
	return fmt.Sprintf("{renderFrameId: %d, stRenderFrameId: %d, edRenderFrameId: %d, lastAllConfirmedRenderFrameId: %d}", pR.RenderFrameId, pR.RenderFrameBuffer.StFrameId, pR.RenderFrameBuffer.EdFrameId, pR.CurDynamicsRenderFrameId)
}

func (pR *Room) InputsBufferString(allDetails bool) string {
	if allDetails {
		// Appending of the array of strings can be very SLOW due to on-demand heap allocation! Use this printing with caution.
		s := make([]string, 0)
		s = append(s, fmt.Sprintf("{renderFrameId: %v, stInputFrameId: %v, edInputFrameId: %v, lastAllConfirmedInputFrameIdWithChange: %v, lastAllConfirmedInputFrameId: %v}", pR.RenderFrameId, pR.InputsBuffer.StFrameId, pR.InputsBuffer.EdFrameId, pR.LastAllConfirmedInputFrameIdWithChange, pR.LastAllConfirmedInputFrameId))
		for playerId, player := range pR.Players {
			s = append(s, fmt.Sprintf("{playerId: %v, ackingFrameId: %v, ackingInputFrameId: %v, lastSentInputFrameId: %v}", playerId, player.AckingFrameId, player.AckingInputFrameId, player.LastSentInputFrameId))
		}
		for i := pR.InputsBuffer.StFrameId; i < pR.InputsBuffer.EdFrameId; i++ {
			tmp := pR.InputsBuffer.GetByFrameId(i)
			if nil == tmp {
				break
			}
			f := tmp.(*pb.InputFrameDownsync)
			s = append(s, fmt.Sprintf("{inputFrameId: %v, inputList: %v, confirmedList: %v}", f.InputFrameId, f.InputList, f.ConfirmedList))
		}

		return strings.Join(s, "; ")
	} else {
		return fmt.Sprintf("{renderFrameId: %d, stInputFrameId: %d, edInputFrameId: %d, lastAllConfirmedInputFrameIdWithChange: %d, lastAllConfirmedInputFrameId: %d}", pR.RenderFrameId, pR.InputsBuffer.StFrameId, pR.InputsBuffer.EdFrameId, pR.LastAllConfirmedInputFrameIdWithChange, pR.LastAllConfirmedInputFrameId)
	}
}

func (pR *Room) StartBattle() {
	if RoomBattleStateIns.WAITING != pR.State {
		Logger.Warn("[StartBattle] Battle not started due to not being WAITING!", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State))
		return
	}

	// Always instantiates a new channel and let the old one die out due to not being retained by any root reference.
	nanosPerFrame := 1000000000 / int64(pR.ServerFps)
	pR.RenderFrameId = 0

	// Initialize the "collisionSys" as well as "RenderFrameBuffer"
	pR.CurDynamicsRenderFrameId = 0
	kickoffFrame := &pb.RoomDownsyncFrame{
		Id:             pR.RenderFrameId,
		Players:        toPbPlayers(pR.Players),
		CountdownNanos: pR.BattleDurationNanos,
	}
	pR.RenderFrameBuffer.Put(kickoffFrame)

	// Refresh "Colliders"
	pR.refreshColliders()

	/**
	 * Will be triggered from a goroutine which executes the critical `Room.AddPlayerIfPossible`, thus the `battleMainLoop` should be detached.
	 * All of the consecutive stages, e.g. settlement, dismissal, should share the same goroutine with `battleMainLoop`.
	 */
	battleMainLoop := func() {
		defer func() {
			if r := recover(); r != nil {
				Logger.Error("battleMainLoop, recovery spot#1, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("panic", r))
				pR.StopBattleForSettlement()
			}
			Logger.Info("The `battleMainLoop` is stopped for:", zap.Any("roomId", pR.Id))
			pR.onBattleStoppedForSettlement()
		}()

		pR.LastRenderFrameIdTriggeredAt = utils.UnixtimeNano()

		Logger.Info("The `battleMainLoop` is started for:", zap.Any("roomId", pR.Id))
		for {
			stCalculation := utils.UnixtimeNano()

			elapsedNanosSinceLastFrameIdTriggered := stCalculation - pR.LastRenderFrameIdTriggeredAt
			if elapsedNanosSinceLastFrameIdTriggered < pR.RollbackEstimatedDtNanos {
				Logger.Debug(fmt.Sprintf("Avoiding too fast frame@roomId=%v, renderFrameId=%v: elapsedNanosSinceLastFrameIdTriggered=%v", pR.Id, pR.RenderFrameId, elapsedNanosSinceLastFrameIdTriggered))
				continue
			}

			if pR.RenderFrameId > pR.BattleDurationFrames {
				Logger.Info(fmt.Sprintf("The `battleMainLoop` for roomId=%v is stopped@renderFrameId=%v, with battleDurationFrames=%v:\n%v", pR.Id, pR.RenderFrameId, pR.BattleDurationFrames, pR.InputsBufferString(true)))
				pR.StopBattleForSettlement()
				return
			}

			if swapped := atomic.CompareAndSwapInt32(&pR.State, RoomBattleStateIns.IN_BATTLE, RoomBattleStateIns.IN_BATTLE); !swapped {
				return
			}

			// Prefab and buffer backend inputFrameDownsync
			if pR.shouldPrefabInputFrameDownsync(pR.RenderFrameId) {
				noDelayInputFrameId := pR.ConvertToInputFrameId(pR.RenderFrameId, 0)
				pR.prefabInputFrameDownsync(noDelayInputFrameId)
			}

			// Force setting all-confirmed of buffered inputFrames periodically
			unconfirmedMask := pR.forceConfirmationIfApplicable()

			dynamicsDuration := int64(0)
			if 0 <= pR.LastAllConfirmedInputFrameId {
				dynamicsStartedAt := utils.UnixtimeNano()
				// Apply "all-confirmed inputFrames" to move forward "pR.CurDynamicsRenderFrameId"
				nextDynamicsRenderFrameId := pR.ConvertToLastUsedRenderFrameId(pR.LastAllConfirmedInputFrameId, pR.InputDelayFrames)
				Logger.Debug(fmt.Sprintf("roomId=%v, room.RenderFrameId=%v, LastAllConfirmedInputFrameId=%v, InputDelayFrames=%v, nextDynamicsRenderFrameId=%v", pR.Id, pR.RenderFrameId, pR.LastAllConfirmedInputFrameId, pR.InputDelayFrames, nextDynamicsRenderFrameId))
				pR.applyInputFrameDownsyncDynamics(pR.CurDynamicsRenderFrameId, nextDynamicsRenderFrameId)
				dynamicsDuration = utils.UnixtimeNano() - dynamicsStartedAt
			}

			upperToSendInputFrameId := atomic.LoadInt32(&(pR.LastAllConfirmedInputFrameId))
			/*
			   [WARNING]
			   Upon resynced on frontend, "refRenderFrameId" MUST BE CAPPED somehow by "upperToSendInputFrameId", if frontend resyncs itself to a more advanced value than given below, upon the next renderFrame tick on the frontend it might generate non-consecutive "nextInputFrameId > frontend.recentInputCache.edFrameId+1".

			   If "NstDelayFrames" becomes larger, "pR.RenderFrameId - refRenderFrameId" possibly becomes larger because the force confirmation is delayed more.

			   Hence even upon resync, it's still possible that "refRenderFrameId < frontend.chaserRenderFrameId".
			*/
			refRenderFrameId := pR.ConvertToGeneratingRenderFrameId(upperToSendInputFrameId) + (1 << pR.InputScaleFrames) - 1
			// [WARNING] The following inequalities are seldom true, but just to avoid that in good network condition the frontend resyncs itself to a "too advanced frontend.renderFrameId", and then starts upsyncing "too advanced inputFrameId".
			if refRenderFrameId > pR.RenderFrameId {
				refRenderFrameId = pR.RenderFrameId
			}
			if refRenderFrameId > pR.CurDynamicsRenderFrameId {
				refRenderFrameId = pR.CurDynamicsRenderFrameId
			}
			for playerId, player := range pR.Players {
				if swapped := atomic.CompareAndSwapInt32(&player.BattleState, PlayerBattleStateIns.ACTIVE, PlayerBattleStateIns.ACTIVE); !swapped {
					// [WARNING] DON'T send anything if the player is disconnected, because it could jam the channel and cause significant delay upon "battle recovery for reconnected player".
					continue
				}
				if 0 == pR.RenderFrameId {
					kickoffFrame := pR.RenderFrameBuffer.GetByFrameId(0).(*pb.RoomDownsyncFrame)
					pR.sendSafely(kickoffFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_START, playerId)
				} else {
					// [WARNING] Websocket is TCP-based, thus no need to re-send a previously sent inputFrame to a same player!
					toSendInputFrames := make([]*pb.InputFrameDownsync, 0, pR.InputsBuffer.Cnt)
					candidateToSendInputFrameId := pR.Players[playerId].LastSentInputFrameId + 1
					if candidateToSendInputFrameId < pR.InputsBuffer.StFrameId {
						// [WARNING] As "player.LastSentInputFrameId <= lastAllConfirmedInputFrameIdWithChange" for each iteration, and "lastAllConfirmedInputFrameIdWithChange <= lastAllConfirmedInputFrameId" where the latter is used to "applyInputFrameDownsyncDynamics" and then evict "pR.InputsBuffer", thus there's a very high possibility that "player.LastSentInputFrameId" is already evicted.
						// Logger.Debug(fmt.Sprintf("LastSentInputFrameId already popped: roomId=%v, playerId=%v, lastSentInputFrameId=%v, playerAckingInputFrameId=%v, InputsBuffer=%v", pR.Id, playerId, candidateToSendInputFrameId-1, player.AckingInputFrameId, pR.InputsBufferString(false)))
						candidateToSendInputFrameId = pR.InputsBuffer.StFrameId
					}

					if MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED == player.LastSentInputFrameId {
						// A rejoined player, should guarantee that when it resyncs to "refRenderFrameId" a matching inputFrame to apply exists
						candidateToSendInputFrameId = pR.ConvertToInputFrameId(refRenderFrameId, pR.InputDelayFrames)
						Logger.Warn(fmt.Sprintf("Resetting refRenderFrame for rejoined player: roomId=%v, playerId=%v, refRenderFrameId=%v, candidateToSendInputFrameId=%v, upperToSendInputFrameId=%v, lastSentInputFrameId=%v, playerAckingInputFrameId=%v", pR.Id, playerId, refRenderFrameId, candidateToSendInputFrameId, upperToSendInputFrameId, player.LastSentInputFrameId, player.AckingInputFrameId))
					}

					// [WARNING] EDGE CASE HERE: Upon initialization, all of "lastAllConfirmedInputFrameId", "lastAllConfirmedInputFrameIdWithChange" and "anchorInputFrameId" are "-1", thus "candidateToSendInputFrameId" starts with "0", however "inputFrameId: 0" might not have been all confirmed!
					for candidateToSendInputFrameId <= upperToSendInputFrameId {
						tmp := pR.InputsBuffer.GetByFrameId(candidateToSendInputFrameId)
						if nil == tmp {
							panic(fmt.Sprintf("Required inputFrameId=%v for roomId=%v, playerId=%v doesn't exist! InputsBuffer=%v", candidateToSendInputFrameId, pR.Id, playerId, pR.InputsBufferString(false)))
						}
						f := tmp.(*pb.InputFrameDownsync)
						if pR.inputFrameIdDebuggable(candidateToSendInputFrameId) {
							Logger.Debug("inputFrame lifecycle#3[sending]:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("playerAckingInputFrameId", player.AckingInputFrameId), zap.Any("inputFrameId", candidateToSendInputFrameId), zap.Any("inputFrameId-doublecheck", f.InputFrameId), zap.Any("InputsBuffer", pR.InputsBufferString(false)), zap.Any("ConfirmedList", f.ConfirmedList))
						}
						toSendInputFrames = append(toSendInputFrames, f)
						candidateToSendInputFrameId++
					}

					if 0 >= len(toSendInputFrames) {
						// [WARNING] When sending DOWNSYNC_MSG_ACT_FORCED_RESYNC, there MUST BE accompanying "toSendInputFrames" for calculating "refRenderFrameId"!

						if MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED == player.LastSentInputFrameId {
							Logger.Warn(fmt.Sprintf("Not sending due to empty toSendInputFrames: roomId=%v, playerId=%v, refRenderFrameId=%v, candidateToSendInputFrameId=%v, upperToSendInputFrameId=%v, lastSentInputFrameId=%v, playerAckingInputFrameId=%v", pR.Id, playerId, refRenderFrameId, candidateToSendInputFrameId, upperToSendInputFrameId, player.LastSentInputFrameId, player.AckingInputFrameId))
						}
						continue
					}

					indiceInJoinIndexBooleanArr := uint32(player.JoinIndex - 1)
					var joinMask uint64 = (1 << indiceInJoinIndexBooleanArr)
					if MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED == player.LastSentInputFrameId || 0 < (unconfirmedMask&joinMask) {
						// [WARNING] Even upon "MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED", it could be true that "0 == (unconfirmedMask & joinMask)"!
						tmp := pR.RenderFrameBuffer.GetByFrameId(refRenderFrameId)
						if nil == tmp {
							panic(fmt.Sprintf("Required refRenderFrameId=%v for roomId=%v, playerId=%v, candidateToSendInputFrameId=%v doesn't exist! InputsBuffer=%v, RenderFrameBuffer=%v", refRenderFrameId, pR.Id, playerId, candidateToSendInputFrameId, pR.InputsBufferString(false), pR.RenderFrameBufferString()))
						}
						refRenderFrame := tmp.(*pb.RoomDownsyncFrame)
						pR.sendSafely(refRenderFrame, toSendInputFrames, DOWNSYNC_MSG_ACT_FORCED_RESYNC, playerId)
					} else {
						pR.sendSafely(nil, toSendInputFrames, DOWNSYNC_MSG_ACT_INPUT_BATCH, playerId)
					}
					pR.Players[playerId].LastSentInputFrameId = candidateToSendInputFrameId - 1
				}
			}

			// Evict no longer required "RenderFrameBuffer"
			for pR.RenderFrameBuffer.N < pR.RenderFrameBuffer.Cnt || (0 < pR.RenderFrameBuffer.Cnt && pR.RenderFrameBuffer.StFrameId < refRenderFrameId) {
				_ = pR.RenderFrameBuffer.Pop()
			}

			toApplyInputFrameId := pR.ConvertToInputFrameId(refRenderFrameId, pR.InputDelayFrames)
			for pR.InputsBuffer.N < pR.InputsBuffer.Cnt || (0 < pR.InputsBuffer.Cnt && pR.InputsBuffer.StFrameId < toApplyInputFrameId) {
				f := pR.InputsBuffer.Pop().(*pb.InputFrameDownsync)
				if pR.inputFrameIdDebuggable(f.InputFrameId) {
					// Popping of an "inputFrame" would be AFTER its being all being confirmed, because it requires the "inputFrame" to be all acked
					Logger.Debug("inputFrame lifecycle#4[popped]:", zap.Any("roomId", pR.Id), zap.Any("inputFrameId", f.InputFrameId), zap.Any("InputsBuffer", pR.InputsBufferString(false)))
				}
			}

			pR.RenderFrameId++
			elapsedInCalculation := (utils.UnixtimeNano() - stCalculation)
			if elapsedInCalculation > nanosPerFrame {
				Logger.Warn(fmt.Sprintf("SLOW FRAME! Elapsed time statistics: roomId=%v, room.RenderFrameId=%v, elapsedInCalculation=%v, dynamicsDuration=%v, nanosPerFrame=%v", pR.Id, pR.RenderFrameId, elapsedInCalculation, dynamicsDuration, nanosPerFrame))
			}
			time.Sleep(time.Duration(nanosPerFrame - elapsedInCalculation))
		}
	}

	pR.onBattlePrepare(func() {
		pR.onBattleStarted() // NOTE: Deliberately not using `defer`.
		go battleMainLoop()
	})
}

func (pR *Room) toDiscreteInputsBufferIndex(inputFrameId int32, joinIndex int32) int32 {
	return (inputFrameId << 2) + joinIndex // allowing joinIndex upto 15
}

func (pR *Room) OnBattleCmdReceived(pReq *pb.WsReq) {
	if swapped := atomic.CompareAndSwapInt32(&pR.State, RoomBattleStateIns.IN_BATTLE, RoomBattleStateIns.IN_BATTLE); !swapped {
		return
	}

	playerId := pReq.PlayerId
	inputFrameUpsyncBatch := pReq.InputFrameUpsyncBatch
	ackingFrameId := pReq.AckingFrameId
	ackingInputFrameId := pReq.AckingInputFrameId

	if _, existent := pR.Players[playerId]; !existent {
		Logger.Warn(fmt.Sprintf("upcmd player doesn't exist: roomId=%v, playerId=%v", pR.Id, playerId))
		return
	}

	if swapped := atomic.CompareAndSwapInt32(&(pR.Players[playerId].AckingFrameId), pR.Players[playerId].AckingFrameId, ackingFrameId); !swapped {
		panic(fmt.Sprintf("Failed to update AckingFrameId to %v for roomId=%v, playerId=%v", ackingFrameId, pR.Id, playerId))
	}

	if swapped := atomic.CompareAndSwapInt32(&(pR.Players[playerId].AckingInputFrameId), pR.Players[playerId].AckingInputFrameId, ackingInputFrameId); !swapped {
		panic(fmt.Sprintf("Failed to update AckingInputFrameId to %v for roomId=%v, playerId=%v", ackingInputFrameId, pR.Id, playerId))
	}

	for _, inputFrameUpsync := range inputFrameUpsyncBatch {
		clientInputFrameId := inputFrameUpsync.InputFrameId
		if clientInputFrameId < pR.InputsBuffer.StFrameId {
			// The updates to "pR.InputsBuffer.StFrameId" is monotonically increasing, thus if "clientInputFrameId < pR.InputsBuffer.StFrameId" at any moment of time, it is obsolete in the future.
			Logger.Debug(fmt.Sprintf("Omitting obsolete inputFrameUpsync: roomId=%v, playerId=%v, clientInputFrameId=%v, InputsBuffer=%v", pR.Id, playerId, clientInputFrameId, pR.InputsBufferString(false)))
			continue
		}

		bufIndex := pR.toDiscreteInputsBufferIndex(clientInputFrameId, pReq.JoinIndex)
		pR.DiscreteInputsBuffer.Store(bufIndex, inputFrameUpsync)

		// TODO: "pR.DiscreteInputsBuffer" might become too large with outdated "inputFrameUpsync" items, maintain another queue orderd by timestamp to evict them
	}
}

func (pR *Room) onInputFrameDownsyncAllConfirmed(inputFrameDownsync *pb.InputFrameDownsync, playerId int32) {
	inputFrameId := inputFrameDownsync.InputFrameId
	if -1 == pR.LastAllConfirmedInputFrameIdWithChange || false == pR.equalInputLists(inputFrameDownsync.InputList, pR.LastAllConfirmedInputList) {
		if -1 == playerId {
			Logger.Debug(fmt.Sprintf("Key inputFrame change: roomId=%v, newInputFrameId=%v, lastInputFrameId=%v, newInputList=%v, lastInputList=%v, InputsBuffer=%v", pR.Id, inputFrameId, pR.LastAllConfirmedInputFrameId, inputFrameDownsync.InputList, pR.LastAllConfirmedInputList, pR.InputsBufferString(false)))
		} else {
			Logger.Debug(fmt.Sprintf("Key inputFrame change: roomId=%v, playerId=%v, newInputFrameId=%v, lastInputFrameId=%v, newInputList=%v, lastInputList=%v, InputsBuffer=%v", pR.Id, playerId, inputFrameId, pR.LastAllConfirmedInputFrameId, inputFrameDownsync.InputList, pR.LastAllConfirmedInputList, pR.InputsBufferString(false)))
		}
		atomic.StoreInt32(&(pR.LastAllConfirmedInputFrameIdWithChange), inputFrameId)
	}
	atomic.StoreInt32(&(pR.LastAllConfirmedInputFrameId), inputFrameId) // [WARNING] It's IMPORTANT that "pR.LastAllConfirmedInputFrameId" is NOT NECESSARILY CONSECUTIVE, i.e. if one of the players disconnects and reconnects within a considerable amount of frame delays!
	for i, v := range inputFrameDownsync.InputList {
		// To avoid potential misuse of pointers
		pR.LastAllConfirmedInputList[i] = v
	}
	if -1 == playerId {
		Logger.Debug(fmt.Sprintf("inputFrame lifecycle#2[forced-allconfirmed]: roomId=%v, InputsBuffer=%v", pR.Id, pR.InputsBufferString(false)))
	} else {
		Logger.Debug(fmt.Sprintf("inputFrame lifecycle#2[allconfirmed]: roomId=%v, playerId=%v, InputsBuffer=%v", pR.Id, playerId, pR.InputsBufferString(false)))
	}
}

func (pR *Room) equalInputLists(lhs []uint64, rhs []uint64) bool {
	if len(lhs) != len(rhs) {
		return false
	}
	for i, _ := range lhs {
		if lhs[i] != rhs[i] {
			return false
		}
	}
	return true
}

func (pR *Room) StopBattleForSettlement() {
	if RoomBattleStateIns.IN_BATTLE != pR.State {
		return
	}
	pR.State = RoomBattleStateIns.STOPPING_BATTLE_FOR_SETTLEMENT
	Logger.Info("Stopping the `battleMainLoop` for:", zap.Any("roomId", pR.Id))
	pR.RenderFrameId++
	for playerId, _ := range pR.Players {
		assembledFrame := pb.RoomDownsyncFrame{
			Id:             pR.RenderFrameId,
			Players:        toPbPlayers(pR.Players),
			CountdownNanos: -1, // TODO: Replace this magic constant!
		}
		pR.sendSafely(&assembledFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_STOPPED, playerId)
	}
	// Note that `pR.onBattleStoppedForSettlement` will be called by `battleMainLoop`.
}

func (pR *Room) onBattleStarted() {
	if RoomBattleStateIns.PREPARE != pR.State {
		return
	}
	pR.State = RoomBattleStateIns.IN_BATTLE
	pR.updateScore()
}

func (pR *Room) onBattlePrepare(cb BattleStartCbType) {
	if RoomBattleStateIns.WAITING != pR.State {
		Logger.Warn("[onBattlePrepare] Battle not started after all players' battle state checked!", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State))
		return
	}
	pR.State = RoomBattleStateIns.PREPARE
	Logger.Info("Battle state transitted to RoomBattleStateIns.PREPARE for:", zap.Any("roomId", pR.Id))

	playerMetas := make(map[int32]*pb.PlayerMeta, 0)
	for _, player := range pR.Players {
		playerMetas[player.Id] = &pb.PlayerMeta{
			Id:          player.Id,
			Name:        player.Name,
			DisplayName: player.DisplayName,
			Avatar:      player.Avatar,
			JoinIndex:   player.JoinIndex,
		}
	}

	battleReadyToStartFrame := &pb.RoomDownsyncFrame{
		Id:             DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START,
		Players:        toPbPlayers(pR.Players),
		PlayerMetas:    playerMetas,
		CountdownNanos: pR.BattleDurationNanos,
	}

	Logger.Info("Sending out frame for RoomBattleState.PREPARE:", zap.Any("battleReadyToStartFrame", battleReadyToStartFrame))
	for _, player := range pR.Players {
		pR.sendSafely(battleReadyToStartFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START, player.Id)
	}

	battlePreparationNanos := int64(6000000000)
	preparationLoop := func() {
		defer func() {
			Logger.Info("The `preparationLoop` is stopped for:", zap.Any("roomId", pR.Id))
			cb()
		}()
		preparationLoopStartedNanos := utils.UnixtimeNano()
		totalElapsedNanos := int64(0)
		for {
			if totalElapsedNanos > battlePreparationNanos {
				break
			}
			now := utils.UnixtimeNano()
			totalElapsedNanos = (now - preparationLoopStartedNanos)
			time.Sleep(time.Duration(battlePreparationNanos - totalElapsedNanos))
		}
	}
	go preparationLoop()
}

func (pR *Room) onBattleStoppedForSettlement() {
	if RoomBattleStateIns.STOPPING_BATTLE_FOR_SETTLEMENT != pR.State {
		return
	}
	defer func() {
		pR.onSettlementCompleted()
	}()
	pR.State = RoomBattleStateIns.IN_SETTLEMENT
	Logger.Info("The room is in settlement:", zap.Any("roomId", pR.Id))
	// TODO: Some settlement labor.
}

func (pR *Room) onSettlementCompleted() {
	pR.Dismiss()
}

func (pR *Room) Dismiss() {
	if RoomBattleStateIns.IN_SETTLEMENT != pR.State {
		return
	}
	pR.State = RoomBattleStateIns.IN_DISMISSAL
	if 0 < len(pR.Players) {
		Logger.Info("The room is in dismissal:", zap.Any("roomId", pR.Id))
		for playerId, _ := range pR.Players {
			Logger.Info("Adding 1 to pR.DismissalWaitGroup:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId))
			pR.DismissalWaitGroup.Add(1)
			pR.expelPlayerForDismissal(playerId)
			pR.DismissalWaitGroup.Done()
			Logger.Info("Decremented 1 to pR.DismissalWaitGroup:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId))
		}
		pR.DismissalWaitGroup.Wait()
	}
	pR.OnDismissed()
}

func (pR *Room) OnDismissed() {

	// Always instantiates new HeapRAM blocks and let the old blocks die out due to not being retained by any root reference.
	pR.Players = make(map[int32]*Player)
	pR.PlayersArr = make([]*Player, pR.Capacity)
	pR.CollisionSysMap = make(map[int32]*resolv.Object)
	pR.PlayerDownsyncSessionDict = make(map[int32]*websocket.Conn)
	pR.PlayerSignalToCloseDict = make(map[int32]SignalToCloseConnCbType)
	pR.JoinIndexBooleanArr = make([]bool, pR.Capacity)
	pR.Barriers = make(map[int32]*Barrier)
	pR.InputsBuffer = NewRingBuffer(1024)
	pR.DiscreteInputsBuffer = sync.Map{}
	pR.RenderFrameBuffer = NewRingBuffer(1024)

	pR.LastAllConfirmedInputFrameId = -1
	pR.LastAllConfirmedInputFrameIdWithChange = -1
	pR.LastAllConfirmedInputList = make([]uint64, pR.Capacity)

	pR.RenderFrameId = 0
	pR.CurDynamicsRenderFrameId = 0
	pR.InputDelayFrames = 8
	pR.NstDelayFrames = 8
	pR.InputScaleFrames = uint32(2)
	pR.ServerFps = 60
	pR.RollbackEstimatedDt = 0.016667      // Use fixed-and-low-precision to mitigate the inconsistent floating-point-number issue between Golang and JavaScript
	pR.RollbackEstimatedDtMillis = 16.667  // Use fixed-and-low-precision to mitigate the inconsistent floating-point-number issue between Golang and JavaScript
	pR.RollbackEstimatedDtNanos = 16666666 // A little smaller than the actual per frame time, just for preventing FAST FRAME
	pR.BattleDurationFrames = 30 * pR.ServerFps
	pR.BattleDurationNanos = int64(pR.BattleDurationFrames) * (pR.RollbackEstimatedDtNanos + 1)
	pR.InputFrameUpsyncDelayTolerance = 2
	pR.MaxChasingRenderFramesPerUpdate = 10

	pR.ChooseStage()
	pR.EffectivePlayerCount = 0

	// [WARNING] It's deliberately ordered such that "pR.State = RoomBattleStateIns.IDLE" is put AFTER all the refreshing operations above.
	pR.State = RoomBattleStateIns.IDLE
	pR.updateScore()

	Logger.Info("The room is completely dismissed:", zap.Any("roomId", pR.Id))
}

func (pR *Room) expelPlayerDuringGame(playerId int32) {
	defer pR.onPlayerExpelledDuringGame(playerId)
}

func (pR *Room) expelPlayerForDismissal(playerId int32) {
	pR.onPlayerExpelledForDismissal(playerId)
}

func (pR *Room) onPlayerExpelledDuringGame(playerId int32) {
	pR.onPlayerLost(playerId)
}

func (pR *Room) onPlayerExpelledForDismissal(playerId int32) {
	pR.onPlayerLost(playerId)

	Logger.Info("onPlayerExpelledForDismissal:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
}

func (pR *Room) OnPlayerDisconnected(playerId int32) {
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("Room OnPlayerDisconnected, recovery spot#1, recovered from: ", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("panic", r))
		}
	}()

	if _, existent := pR.Players[playerId]; existent {
		switch pR.Players[playerId].BattleState {
		case PlayerBattleStateIns.DISCONNECTED:
		case PlayerBattleStateIns.LOST:
		case PlayerBattleStateIns.EXPELLED_DURING_GAME:
		case PlayerBattleStateIns.EXPELLED_IN_DISMISSAL:
			Logger.Info("Room OnPlayerDisconnected[early return #1]:", zap.Any("playerId", playerId), zap.Any("playerBattleState", pR.Players[playerId].BattleState), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
			return
		}
	} else {
		// Not even the "pR.Players[playerId]" exists.
		Logger.Info("Room OnPlayerDisconnected[early return #2]:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
		return
	}

	switch pR.State {
	case RoomBattleStateIns.WAITING:
		pR.onPlayerLost(playerId)
		delete(pR.Players, playerId) // Note that this statement MUST be put AFTER `pR.onPlayerLost(...)` to avoid nil pointer exception.
		if 0 == pR.EffectivePlayerCount {
			pR.State = RoomBattleStateIns.IDLE
		}
		pR.updateScore()
		Logger.Info("Player disconnected while room is at RoomBattleStateIns.WAITING:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
	default:
		pR.Players[playerId].BattleState = PlayerBattleStateIns.DISCONNECTED
		pR.clearPlayerNetworkSession(playerId) // Still need clear the network session pointers, because "OnPlayerDisconnected" is only triggered from "signalToCloseConnOfThisPlayer" in "ws/serve.go", when the same player reconnects the network session pointers will be re-assigned
		Logger.Info("Player disconnected from room:", zap.Any("playerId", playerId), zap.Any("playerBattleState", pR.Players[playerId].BattleState), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
	}
}

func (pR *Room) onPlayerLost(playerId int32) {
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("Room OnPlayerLost, recovery spot, recovered from: ", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("panic", r))
		}
	}()
	if player, existent := pR.Players[playerId]; existent {
		player.BattleState = PlayerBattleStateIns.LOST
		pR.clearPlayerNetworkSession(playerId)
		pR.EffectivePlayerCount--
		indiceInJoinIndexBooleanArr := int(player.JoinIndex - 1)
		if (0 <= indiceInJoinIndexBooleanArr) && (indiceInJoinIndexBooleanArr < len(pR.JoinIndexBooleanArr)) {
			pR.JoinIndexBooleanArr[indiceInJoinIndexBooleanArr] = false
		} else {
			Logger.Warn("Room OnPlayerLost, pR.JoinIndexBooleanArr is out of range: ", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("indiceInJoinIndexBooleanArr", indiceInJoinIndexBooleanArr), zap.Any("len(pR.JoinIndexBooleanArr)", len(pR.JoinIndexBooleanArr)))
		}
		player.JoinIndex = MAGIC_JOIN_INDEX_INVALID
		Logger.Info("Room OnPlayerLost: ", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("resulted pR.JoinIndexBooleanArr", pR.JoinIndexBooleanArr))
	}
}

func (pR *Room) clearPlayerNetworkSession(playerId int32) {
	if _, y := pR.PlayerDownsyncSessionDict[playerId]; y {
		Logger.Info("sending termination symbol for:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id))
		delete(pR.PlayerDownsyncSessionDict, playerId)
		delete(pR.PlayerSignalToCloseDict, playerId)
	}
}

func (pR *Room) onPlayerAdded(playerId int32) {
	pR.EffectivePlayerCount++

	if 1 == pR.EffectivePlayerCount {
		pR.State = RoomBattleStateIns.WAITING
	}

	for index, value := range pR.JoinIndexBooleanArr {
		if false == value {
			pR.Players[playerId].JoinIndex = int32(index) + 1
			pR.JoinIndexBooleanArr[index] = true

			// Lazily assign the initial position of "Player" for "RoomDownsyncFrame".
			playerPosList := *(pR.RawBattleStrToVec2DListMap["PlayerStartingPos"])
			if index > len(playerPosList) {
				panic(fmt.Sprintf("onPlayerAdded error, index >= len(playerPosList), roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
			}
			playerPos := playerPosList[index]

			if nil == playerPos {
				panic(fmt.Sprintf("onPlayerAdded error, nil == playerPos, roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
			}
			pR.Players[playerId].X = playerPos.X
			pR.Players[playerId].Y = playerPos.Y

			break
		}
	}

	pR.updateScore()
	Logger.Info("onPlayerAdded:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("joinIndex", pR.Players[playerId].JoinIndex), zap.Any("EffectivePlayerCount", pR.EffectivePlayerCount), zap.Any("resulted pR.JoinIndexBooleanArr", pR.JoinIndexBooleanArr), zap.Any("RoomBattleState", pR.State))
}

func (pR *Room) onPlayerReAdded(playerId int32) {
	/*
	 * [WARNING]
	 *
	 * If a player quits at "RoomBattleState.WAITING", then his/her re-joining will always invoke `AddPlayerIfPossible(...)`. Therefore, this
	 * function will only be invoked for players who quit the battle at ">RoomBattleState.WAITING" and re-join at "RoomBattleState.IN_BATTLE", during which the `pR.JoinIndexBooleanArr` doesn't change.
	 */
	Logger.Info("Room got `onPlayerReAdded` invoked,", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("resulted pR.JoinIndexBooleanArr", pR.JoinIndexBooleanArr))

	pR.updateScore()
}

func (pR *Room) OnPlayerBattleColliderAcked(playerId int32) bool {
	targetPlayer, existing := pR.Players[playerId]
	if false == existing {
		return false
	}

	playerMetas := make(map[int32]*pb.PlayerMeta, 0)
	for _, eachPlayer := range pR.Players {
		playerMetas[eachPlayer.Id] = &pb.PlayerMeta{
			Id:          eachPlayer.Id,
			Name:        eachPlayer.Name,
			DisplayName: eachPlayer.DisplayName,
			Avatar:      eachPlayer.Avatar,
			JoinIndex:   eachPlayer.JoinIndex,
		}
	}

	// Broadcast added or readded player info to all players in the same room
	for _, eachPlayer := range pR.Players {
		/*
					   [WARNING]
					   This `playerAckedFrame` is the first ever "RoomDownsyncFrame" for every "PersistentSessionClient on the frontend", and it goes right after each "BattleColliderInfo".

					   By making use of the sequential nature of each ws session, all later "RoomDownsyncFrame"s generated after `pRoom.StartBattle()` will be put behind this `playerAckedFrame`.

			           This function is triggered by an upsync message via WebSocket, thus downsync sending is also available by now.
		*/
		switch targetPlayer.BattleState {
		case PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK:
			playerAckedFrame := &pb.RoomDownsyncFrame{
				Id:          pR.RenderFrameId,
				Players:     toPbPlayers(pR.Players),
				PlayerMetas: playerMetas,
			}
			pR.sendSafely(playerAckedFrame, nil, DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED, eachPlayer.Id)
		case PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
			playerAckedFrame := &pb.RoomDownsyncFrame{
				Id:          pR.RenderFrameId,
				Players:     toPbPlayers(pR.Players),
				PlayerMetas: playerMetas,
			}
			pR.sendSafely(playerAckedFrame, nil, DOWNSYNC_MSG_ACT_PLAYER_READDED_AND_ACKED, eachPlayer.Id)
		default:
		}
	}

	targetPlayer.BattleState = PlayerBattleStateIns.ACTIVE
	Logger.Info(fmt.Sprintf("OnPlayerBattleColliderAcked: roomId=%v, roomState=%v, targetPlayerId=%v, targetPlayerBattleState=%v, capacity=%v, EffectivePlayerCount=%v", pR.Id, pR.State, targetPlayer.Id, targetPlayer.BattleState, pR.Capacity, pR.EffectivePlayerCount))

	if pR.Capacity == int(pR.EffectivePlayerCount) {
		allAcked := true
		for _, p := range pR.Players {
			if PlayerBattleStateIns.ACTIVE != p.BattleState {
				Logger.Info("unexpectedly got an inactive player", zap.Any("roomId", pR.Id), zap.Any("playerId", p.Id), zap.Any("battleState", p.BattleState))
				allAcked = false
				break
			}
		}
		if true == allAcked {
			pR.StartBattle() // WON'T run if the battle state is not in WAITING.
		}
	}

	pR.updateScore()
	return true
}

func (pR *Room) sendSafely(roomDownsyncFrame *pb.RoomDownsyncFrame, toSendFrames []*pb.InputFrameDownsync, act int32, playerId int32) {
	defer func() {
		if r := recover(); r != nil {
			pR.PlayerSignalToCloseDict[playerId](Constants.RetCode.UnknownError, fmt.Sprintf("%v", r))
		}
	}()

	pResp := &pb.WsResp{
		Ret:                     int32(Constants.RetCode.Ok),
		Act:                     act,
		Rdf:                     roomDownsyncFrame,
		InputFrameDownsyncBatch: toSendFrames,
	}

	theBytes, marshalErr := proto.Marshal(pResp)
	if nil != marshalErr {
		panic(fmt.Sprintf("Error marshaling downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
	}

	if err := pR.PlayerDownsyncSessionDict[playerId].WriteMessage(websocket.BinaryMessage, theBytes); nil != err {
		panic(fmt.Sprintf("Error sending downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v, err=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount, err))
	}
}

func (pR *Room) shouldPrefabInputFrameDownsync(renderFrameId int32) bool {
	return ((renderFrameId & ((1 << pR.InputScaleFrames) - 1)) == 0)
}

func (pR *Room) prefabInputFrameDownsync(inputFrameId int32) *pb.InputFrameDownsync {
	/*
	   Kindly note that on backend the prefab is much simpler than its frontend counterpart, because frontend will upsync its latest command immediately if there's any change w.r.t. its own prev cmd, thus if no upsync received from a frontend,
	   - EITHER it's due to local lag and bad network,
	   - OR there's no change w.r.t. to its prev cmd.
	*/
	var currInputFrameDownsync *pb.InputFrameDownsync = nil

	if 0 == inputFrameId && 0 == pR.InputsBuffer.Cnt {
		currInputFrameDownsync = &pb.InputFrameDownsync{
			InputFrameId:  0,
			InputList:     make([]uint64, pR.Capacity),
			ConfirmedList: uint64(0),
		}
	} else {
		tmp := pR.InputsBuffer.GetByFrameId(inputFrameId - 1)
		if nil == tmp {
			panic(fmt.Sprintf("Error prefabbing inputFrameDownsync: roomId=%v, InputsBuffer=%v", pR.Id, pR.InputsBufferString(false)))
		}
		prevInputFrameDownsync := tmp.(*pb.InputFrameDownsync)
		currInputList := prevInputFrameDownsync.InputList // Would be a clone of the values
		currInputFrameDownsync = &pb.InputFrameDownsync{
			InputFrameId:  inputFrameId,
			InputList:     currInputList,
			ConfirmedList: uint64(0),
		}
	}

	pR.InputsBuffer.Put(currInputFrameDownsync)
	return currInputFrameDownsync
}

func (pR *Room) forceConfirmationIfApplicable() uint64 {
	// Force confirmation of non-all-confirmed inputFrame EXACTLY ONE AT A TIME, returns the non-confirmed mask of players, e.g. in a 4-player-battle returning 1001 means that players with JoinIndex=1 and JoinIndex=4 are non-confirmed for inputFrameId2
	renderFrameId1 := (pR.RenderFrameId - pR.NstDelayFrames) // the renderFrameId which should've been rendered on frontend
	if 0 > renderFrameId1 || !pR.shouldPrefabInputFrameDownsync(renderFrameId1) {
		/*
		   The backend "shouldPrefabInputFrameDownsync" shares the same rule as frontend "shouldGenerateInputFrameUpsync".

		   It's also important that "forceConfirmationIfApplicable" is NOT EXECUTED for every renderFrame, such that when a player is forced to resync, it has some time, i.e. (1 << InputScaleFrames) renderFrames, to upsync again.
		*/
		return 0
	}

	inputFrameId2 := pR.ConvertToInputFrameId(renderFrameId1, 0) // The inputFrame to force confirmation (if necessary)
	if inputFrameId2 < pR.LastAllConfirmedInputFrameId {
		// No need to force confirmation, the inputFrames already arrived
		Logger.Debug(fmt.Sprintf("inputFrameId2=%v is already all-confirmed for roomId=%v[type#1], no need to force confirmation of it", inputFrameId2, pR.Id))
		return 0
	}
	tmp := pR.InputsBuffer.GetByFrameId(inputFrameId2)
	if nil == tmp {
		panic(fmt.Sprintf("inputFrameId2=%v doesn't exist for roomId=%v, this is abnormal because the server should prefab inputFrameDownsync in a most advanced pace, check the prefab logic! InputsBuffer=%v", inputFrameId2, pR.Id, pR.InputsBufferString(false)))
	}
	inputFrame2 := tmp.(*pb.InputFrameDownsync)
	for _, player := range pR.Players {
		// Enrich by already arrived player upsync commands
		bufIndex := pR.toDiscreteInputsBufferIndex(inputFrame2.InputFrameId, player.JoinIndex)
		tmp, loaded := pR.DiscreteInputsBuffer.LoadAndDelete(bufIndex)
		if !loaded {
			continue
		}
		inputFrameUpsync := tmp.(*pb.InputFrameUpsync)
		indiceInJoinIndexBooleanArr := uint32(player.JoinIndex - 1)
		inputFrame2.InputList[indiceInJoinIndexBooleanArr] = pR.EncodeUpsyncCmd(inputFrameUpsync)
		inputFrame2.ConfirmedList |= (1 << indiceInJoinIndexBooleanArr)
	}

	totPlayerCnt := uint32(pR.Capacity)
	allConfirmedMask := uint64((1 << totPlayerCnt) - 1)

	// Force confirmation of "inputFrame2"
	oldConfirmedList := inputFrame2.ConfirmedList
	unconfirmedMask := (oldConfirmedList ^ allConfirmedMask)
	inputFrame2.ConfirmedList = allConfirmedMask
	pR.onInputFrameDownsyncAllConfirmed(inputFrame2, -1)

	return unconfirmedMask
}

func (pR *Room) applyInputFrameDownsyncDynamics(fromRenderFrameId int32, toRenderFrameId int32) {
	if fromRenderFrameId >= toRenderFrameId {
		return
	}

	Logger.Debug(fmt.Sprintf("Applying inputFrame dynamics: roomId=%v, room.RenderFrameId=%v, fromRenderFrameId=%v, toRenderFrameId=%v", pR.Id, pR.RenderFrameId, fromRenderFrameId, toRenderFrameId))
	totPlayerCnt := uint32(pR.Capacity)
	allConfirmedMask := uint64((1 << totPlayerCnt) - 1)

	for collisionSysRenderFrameId := fromRenderFrameId; collisionSysRenderFrameId < toRenderFrameId; collisionSysRenderFrameId++ {
		delayedInputFrameId := pR.ConvertToInputFrameId(collisionSysRenderFrameId, pR.InputDelayFrames)
		if 0 <= delayedInputFrameId {
			if delayedInputFrameId > pR.LastAllConfirmedInputFrameId {
				panic(fmt.Sprintf("delayedInputFrameId=%v is not yet all-confirmed for roomId=%v, this is abnormal because it's to be used for applying dynamics to [fromRenderFrameId:%v, toRenderFrameId:%v) @ collisionSysRenderFrameId=%v! InputsBuffer=%v", delayedInputFrameId, pR.Id, fromRenderFrameId, toRenderFrameId, collisionSysRenderFrameId, pR.InputsBufferString(false)))
			}
			tmp := pR.InputsBuffer.GetByFrameId(delayedInputFrameId)
			if nil == tmp {
				panic(fmt.Sprintf("delayedInputFrameId=%v doesn't exist for roomId=%v, this is abnormal because it's to be used for applying dynamics to [fromRenderFrameId:%v, toRenderFrameId:%v) @ collisionSysRenderFrameId=%v! InputsBuffer=%v", delayedInputFrameId, pR.Id, fromRenderFrameId, toRenderFrameId, collisionSysRenderFrameId, pR.InputsBufferString(false)))
			}
			delayedInputFrame := tmp.(*pb.InputFrameDownsync)
			// [WARNING] It's possible that by now "allConfirmedMask != delayedInputFrame.ConfirmedList && delayedInputFrameId <= pR.LastAllConfirmedInputFrameId", we trust "pR.LastAllConfirmedInputFrameId" as the TOP AUTHORITY.
			atomic.StoreUint64(&(delayedInputFrame.ConfirmedList), allConfirmedMask)

			inputList := delayedInputFrame.InputList
			// Ordered by joinIndex to guarantee determinism
			for _, player := range pR.PlayersArr {
				joinIndex := player.JoinIndex
				encodedInput := inputList[joinIndex-1]
				decodedInput := DIRECTION_DECODER[encodedInput]
				decodedInputSpeedFactor := DIRECTION_DECODER_INVERSE_LENGTH[encodedInput]
				if 0.0 == decodedInputSpeedFactor {
					continue
				}
				baseChange := player.Speed * pR.RollbackEstimatedDt * decodedInputSpeedFactor
				oldDx, oldDy := baseChange * float64(decodedInput[0]), baseChange * float64(decodedInput[1])  
				dx, dy := oldDx, oldDy 

				collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
				playerCollider := pR.CollisionSysMap[collisionPlayerIndex]
				if collision := playerCollider.Check(oldDx, oldDy, "Barrier"); collision != nil {
					playerShape := playerCollider.Shape.(*resolv.ConvexPolygon)
					barrierShape := collision.Objects[0].Shape.(*resolv.ConvexPolygon)
					origX, origY := playerShape.Position() 
					playerShape.SetPosition(origX+oldDx, origY+oldDy) 
					if colliding := IsPolygonPairColliding(playerShape, barrierShape, nil); colliding {
						Logger.Info(fmt.Sprintf("Collided: playerShape=%v, oldDx=%v, oldDy=%v", playerShape, oldDx, oldDy))
						overlapResult := &SatResult{
							Overlap: 0,
							OverlapX: 0, 
							OverlapY: 0, 
							AContainedInB: true,
							BContainedInA: true,
							Axis: vector.Vector{0, 0},
						}
						e := vector.Vector{oldDx, oldDy}.Unit()
						if separatableAlongMovement := IsPolygonPairSeparatedByDir(playerShape, barrierShape, e, overlapResult); !separatableAlongMovement {
							pushbackX, pushbackY := overlapResult.Overlap*overlapResult.OverlapX, overlapResult.Overlap*overlapResult.OverlapY  
							Logger.Info(fmt.Sprintf("Collided: playerShape=%v, oldDx=%v, oldDy=%v, toCheckBarrier=%v, pushbackX=%v, pushbackY=%v", playerShape, oldDx, oldDy, barrierShape, pushbackX, pushbackY))
							dx, dy = oldDx-pushbackX, oldDy-pushbackY 
						} 
					}   

					playerShape.SetPosition(origX, origY)
				}
				playerCollider.X += dx
				playerCollider.Y += dy
				// Update in "collision space"
				playerCollider.Update()

				player.Dir.Dx = decodedInput[0]
				player.Dir.Dy = decodedInput[1]
				player.X += dx
				player.Y += dy
			}
		}

		newRenderFrame := pb.RoomDownsyncFrame{
			Id:             collisionSysRenderFrameId + 1,
			Players:        toPbPlayers(pR.Players),
			CountdownNanos: (pR.BattleDurationNanos - int64(collisionSysRenderFrameId)*pR.RollbackEstimatedDtNanos),
		}
		pR.RenderFrameBuffer.Put(&newRenderFrame)
		pR.CurDynamicsRenderFrameId++
	}
}

func (pR *Room) inputFrameIdDebuggable(inputFrameId int32) bool {
	return 0 == (inputFrameId % 10)
}

func (pR *Room) refreshColliders() {
	playerColliderRadius := float64(12) // hardcoded
	// Kindly note that by now, we've already got all the shapes in the tmx file into "pR.(Players | Barriers)" from "ParseTmxLayersAndGroups"
	spaceW := pR.StageDiscreteW * pR.StageTileW
	spaceH := pR.StageDiscreteH * pR.StageTileH

	spaceOffsetX := float64(spaceW) * 0.5
	spaceOffsetY := float64(spaceH) * 0.5

    minStep := int(3) // the approx minimum distance a player can move per frame
	space := resolv.NewSpace(int(spaceW), int(spaceH), minStep, minStep) // allocate a new collision space everytime after a battle is settled
	for _, player := range pR.Players {
		playerCollider := GenerateRectCollider(player.X, player.Y, playerColliderRadius*2, playerColliderRadius*2, spaceOffsetX, spaceOffsetY, "Player")
		space.Add(playerCollider)
		// Keep track of the collider in "pR.CollisionSysMap"
		joinIndex := player.JoinIndex
		pR.PlayersArr[joinIndex-1] = player
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		pR.CollisionSysMap[collisionPlayerIndex] = playerCollider
	}

	for _, barrier := range pR.Barriers {
		boundaryUnaligned := barrier.Boundary
		barrierCollider := GenerateConvexPolygonCollider(boundaryUnaligned, spaceOffsetX, spaceOffsetY, "Barrier")
		space.Add(barrierCollider)
	}
}

func (pR *Room) printBarrier(barrierCollider *resolv.Object) {
	Logger.Info(fmt.Sprintf("Barrier in roomId=%v: w=%v, h=%v, shape=%v", pR.Id, barrierCollider.W, barrierCollider.H, barrierCollider.Shape))
}
