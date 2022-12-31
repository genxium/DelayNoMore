package models

import (
	. "battle_srv/common"
	"battle_srv/common/utils"
	pb "battle_srv/protos"
	. "dnmshared"
	"encoding/xml"
	"fmt"
	"github.com/golang/protobuf/proto"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"io/ioutil"
	"jsexport/battle"
	"math/rand"
	"os"
	"path/filepath"
	"resolv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
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

	DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED = int32(-98)
)

const (
	MAGIC_JOIN_INDEX_DEFAULT = 0
	MAGIC_JOIN_INDEX_INVALID = -1
)

const (
	MAGIC_LAST_SENT_INPUT_FRAME_ID_NORMAL_ADDED = -1
	MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED      = -2
)

const (
	DEFAULT_PLAYER_RADIUS = float64(12)
)

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
	Id                       int32
	Capacity                 int
	collisionSpaceOffsetX    float64
	collisionSpaceOffsetY    float64
	playerOpPatternToSkillId map[int]int
	Players                  map[int32]*Player
	PlayersArr               []*Player // ordered by joinIndex
	Space                    *resolv.Space
	CollisionSysMap          map[int32]*resolv.Object
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
	PlayerDownsyncChanDict                 map[int32](chan pb.InputsBufferSnapshot)
	PlayerActiveWatchdogDict               map[int32](*Watchdog)
	PlayerSignalToCloseDict                map[int32]SignalToCloseConnCbType
	Score                                  float32
	State                                  int32
	Index                                  int
	RenderFrameId                          int32
	CurDynamicsRenderFrameId               int32 // [WARNING] The dynamics of backend is ALWAYS MOVING FORWARD BY ALL-CONFIRMED INPUTFRAMES (either by upsync or forced), i.e. no rollback; Moreover when "true == BackendDynamicsEnabled" we always have "Room.CurDynamicsRenderFrameId >= Room.RenderFrameId" because each "all-confirmed inputFrame" is applied on "all applicable renderFrames" in one-go hence often sees a future "renderFrame" earlier
	EffectivePlayerCount                   int32
	DismissalWaitGroup                     sync.WaitGroup
	InputsBuffer                           *battle.RingBuffer // Indices are STRICTLY consecutive
	InputsBufferLock                       sync.Mutex         // Guards [InputsBuffer, LatestPlayerUpsyncedInputFrameId, LastAllConfirmedInputFrameId, LastAllConfirmedInputList, LastAllConfirmedInputFrameIdWithChange]
	RenderFrameBuffer                      *battle.RingBuffer // Indices are STRICTLY consecutive
	LatestPlayerUpsyncedInputFrameId       int32
	LastAllConfirmedInputFrameId           int32
	LastAllConfirmedInputFrameIdWithChange int32
	LastAllConfirmedInputList              []uint64
	JoinIndexBooleanArr                    []bool

	BackendDynamicsEnabled              bool
	ForceAllResyncOnAnyActiveSlowTicker bool
	LastRenderFrameIdTriggeredAt        int64
	PlayerDefaultSpeed                  int32

	BulletBattleLocalIdCounter      int32
	dilutedRollbackEstimatedDtNanos int64

	pb.BattleColliderInfo // Compositing to send centralized magic numbers

	TmxPointsMap   StrToVec2DListMap
	TmxPolygonsMap StrToPolygon2DListMap

	rdfIdToActuallyUsedInput map[int32]*pb.InputFrameDownsync
}

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
	pPlayerFromDbInit.Speed = pR.PlayerDefaultSpeed          // Hardcoded
	pPlayerFromDbInit.ColliderRadius = DEFAULT_PLAYER_RADIUS // Hardcoded
	pPlayerFromDbInit.InAir = true                           // Hardcoded

	pR.Players[playerId] = pPlayerFromDbInit
	pR.PlayerDownsyncSessionDict[playerId] = session
	pR.PlayerSignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
	newWatchdog := NewWatchdog(ConstVals.Ws.WillKickIfInactiveFor, func() {
		Logger.Warn("Conn inactive watchdog triggered#1:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		signalToCloseConnOfThisPlayer(Constants.RetCode.ActiveWatchdog, "")
	})
	newWatchdog.Stop()
	pR.PlayerActiveWatchdogDict[playerId] = newWatchdog
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
	pEffectiveInRoomPlayerInstance := pR.Players[playerId]
	pEffectiveInRoomPlayerInstance.AckingFrameId = -1
	pEffectiveInRoomPlayerInstance.AckingInputFrameId = -1
	pEffectiveInRoomPlayerInstance.LastSentInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED
	pEffectiveInRoomPlayerInstance.BattleState = PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK
	pEffectiveInRoomPlayerInstance.Speed = pR.PlayerDefaultSpeed          // Hardcoded
	pEffectiveInRoomPlayerInstance.ColliderRadius = DEFAULT_PLAYER_RADIUS // Hardcoded
	pEffectiveInRoomPlayerInstance.InAir = true                           // Hardcoded

	pR.PlayerDownsyncSessionDict[playerId] = session
	pR.PlayerSignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
	pR.PlayerActiveWatchdogDict[playerId] = NewWatchdog(ConstVals.Ws.WillKickIfInactiveFor, func() {
		Logger.Warn("Conn inactive watchdog triggered#2:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		signalToCloseConnOfThisPlayer(Constants.RetCode.ActiveWatchdog, "")
	}) // For ReAdded player the new watchdog starts immediately

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
	stageNameList := []string{"dungeon" /*"dungeon", "simple", "richsoil" */}
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

	// Obtain the content of `gidBoundariesMap`.
	gidBoundariesMap := make(map[int]StrToPolygon2DListMap, 0)
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

		DeserializeTsxToColliderDict(pTmxMapIns, byteArrOfTsxFile, int(tileset.FirstGid), gidBoundariesMap)
	}

	stageDiscreteW, stageDiscreteH, stageTileW, stageTileH, strToVec2DListMap, strToPolygon2DListMap, err := ParseTmxLayersAndGroups(pTmxMapIns, gidBoundariesMap)
	if nil != err {
		panic(err)
	}

	//Logger.Info("parsed tmx:", zap.Any("stageDiscreteW", stageDiscreteW), zap.Any("strToVec2DListMap", strToVec2DListMap), zap.Any("strToPolygon2DListMap", strToPolygon2DListMap))

	pR.StageDiscreteW = stageDiscreteW
	pR.StageDiscreteH = stageDiscreteH
	pR.StageTileW = stageTileW
	pR.StageTileH = stageTileH
	pR.TmxPointsMap = strToVec2DListMap
	pR.TmxPolygonsMap = strToPolygon2DListMap

	return nil
}

func (pR *Room) ConvertToInputFrameId(renderFrameId int32, inputDelayFrames int32) int32 {
	if renderFrameId < inputDelayFrames {
		return 0
	}
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

func (pR *Room) RenderFrameBufferString() string {
	return fmt.Sprintf("{renderFrameId: %d, stRenderFrameId: %d, edRenderFrameId: %d, curDynamicsRenderFrameId: %d}", pR.RenderFrameId, pR.RenderFrameBuffer.StFrameId, pR.RenderFrameBuffer.EdFrameId, pR.CurDynamicsRenderFrameId)
}

func (pR *Room) InputsBufferString(allDetails bool) string {
	if allDetails {
		// Appending of the array of strings can be very SLOW due to on-demand heap allocation! Use this printing with caution.
		s := make([]string, 0)
		s = append(s, fmt.Sprintf("{renderFrameId: %v, stInputFrameId: %v, edInputFrameId: %v, lastAllConfirmedInputFrameIdWithChange: %v, lastAllConfirmedInputFrameId: %v}", pR.RenderFrameId, pR.InputsBuffer.StFrameId, pR.InputsBuffer.EdFrameId, pR.LastAllConfirmedInputFrameIdWithChange, pR.LastAllConfirmedInputFrameId))
		for playerId, player := range pR.PlayersArr {
			s = append(s, fmt.Sprintf("{playerId: %v, ackingFrameId: %v, ackingInputFrameId: %v, lastSentInputFrameId: %v}", playerId, player.AckingFrameId, player.AckingInputFrameId, player.LastSentInputFrameId))
		}
		for i := pR.InputsBuffer.StFrameId; i < pR.InputsBuffer.EdFrameId; i++ {
			tmp := pR.InputsBuffer.GetByFrameId(i)
			if nil == tmp {
				break
			}
			f := tmp.(*pb.InputFrameDownsync)
			s = append(s, fmt.Sprintf("{\"inputFrameId\":%d,\"inputList\":%v,\"confirmedList\":\"%d\"}", f.InputFrameId, f.InputList, f.ConfirmedList))
		}

		return strings.Join(s, "\n")
	} else {
		return fmt.Sprintf("{renderFrameId: %d, stInputFrameId: %d, edInputFrameId: %d, lastAllConfirmedInputFrameIdWithChange: %d, lastAllConfirmedInputFrameId: %d}", pR.RenderFrameId, pR.InputsBuffer.StFrameId, pR.InputsBuffer.EdFrameId, pR.LastAllConfirmedInputFrameIdWithChange, pR.LastAllConfirmedInputFrameId)
	}
}

func (pR *Room) playerDownsyncStr(player *battle.PlayerDownsync) string {
	if nil == player {
		return ""
	}
	inAirInt := 0
	if player.InAir {
		inAirInt = 1
	}
	s := fmt.Sprintf("{%d,%d,%d,%d,%d,%d,%d}", player.JoinIndex, player.VirtualGridX, player.VirtualGridY, player.VelX, player.VelY, player.FramesToRecover, inAirInt)

	return s
}

func (pR *Room) inputFrameDownsyncStr(inputFrameDownsync *pb.InputFrameDownsync) string {
	if nil == inputFrameDownsync {
		return ""
	}
	s := make([]string, 0)
	s = append(s, fmt.Sprintf("InputFrameId:%d", inputFrameDownsync.InputFrameId))
	ss := make([]string, 0)
	for _, v := range inputFrameDownsync.InputList {
		ss = append(ss, fmt.Sprintf("\"%d\"", v))
	}
	s = append(s, fmt.Sprintf("InputList:[%v]", strings.Join(ss, ",")))
	//s = append(s, fmt.Sprintf("ConfirmedList:%d", inputFrameDownsync.ConfirmedList))

	return strings.Join(s, ",")
}

func (pR *Room) rdfIdToActuallyUsedInputString() string {
	// Appending of the array of strings can be very SLOW due to on-demand heap allocation! Use this printing with caution.
	s := make([]string, 0)
	for rdfId := pR.RenderFrameBuffer.StFrameId; rdfId < pR.RenderFrameBuffer.EdFrameId; rdfId++ {
		rdf := pR.RenderFrameBuffer.GetByFrameId(rdfId).(*battle.RoomDownsyncFrame)
		playersStrBldr := make([]string, 0, len(rdf.PlayersArr))
		for _, player := range rdf.PlayersArr {
			playersStrBldr = append(playersStrBldr, pR.playerDownsyncStr(player))
		}
		s = append(s, fmt.Sprintf("rdfId:%d\nplayers:[%v]\nactuallyUsedinputList:{%v}", rdfId, strings.Join(playersStrBldr, ","), pR.inputFrameDownsyncStr(pR.rdfIdToActuallyUsedInput[rdfId])))
	}

	return strings.Join(s, "\n")
}

func (pR *Room) StartBattle() {
	if RoomBattleStateIns.WAITING != pR.State {
		Logger.Debug("[StartBattle] Battle not started due to not being WAITING!", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State))
		return
	}

	pR.RenderFrameId = 0

	// [WARNING] Only since battle starts do we have all players bound to certain joinIndexes.
	for _, player := range pR.Players {
		opJoinIndexPrefix := (int(player.JoinIndex) << uint(8))
		pR.playerOpPatternToSkillId[opJoinIndexPrefix+0] = 1 // Hardcoded for now
	}

	// Initialize the "collisionSys" as well as "RenderFrameBuffer"
	pR.CurDynamicsRenderFrameId = 0
	kickoffFrameJs := &battle.RoomDownsyncFrame{
		Id:                       pR.RenderFrameId,
		PlayersArr:               toJsPlayers(pR.Players),
		PlayerOpPatternToSkillId: pR.playerOpPatternToSkillId,
		CountdownNanos:           pR.BattleDurationNanos,
	}
	pR.RenderFrameBuffer.Put(kickoffFrameJs)

	// Refresh "Colliders"
	spaceW := pR.StageDiscreteW * pR.StageTileW
	spaceH := pR.StageDiscreteH * pR.StageTileH

	pR.collisionSpaceOffsetX, pR.collisionSpaceOffsetY = float64(spaceW)*0.5, float64(spaceH)*0.5
	pR.refreshColliders(spaceW, spaceH)

	/*
			  Will be triggered from a goroutine which executes the critical `Room.AddPlayerIfPossible`, thus the `battleMainLoop` should be detached.
			  All of the consecutive stages, e.g. settlement, dismissal, should share the same goroutine with `battleMainLoop`.

		      As "defer" is only applicable to function scope, the use of "pR.InputsBufferLock" within "battleMainLoop" is embedded into each subroutine call.
	*/
	battleMainLoop := func() {
		defer func() {
			if r := recover(); r != nil {
				Logger.Error("battleMainLoop, recovery spot#1, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("panic", r))
			}
			pR.StopBattleForSettlement()
			Logger.Info(fmt.Sprintf("The `battleMainLoop` for roomId=%v is stopped@renderFrameId=%v, with battleDurationFrames=%v:\n%v", pR.Id, pR.RenderFrameId, pR.BattleDurationFrames, pR.InputsBufferString(false))) // This takes sometime to print
			if pR.FrameDataLoggingEnabled {
				rdfIdToActuallyUsedInputDump := pR.rdfIdToActuallyUsedInputString()
				os.WriteFile(fmt.Sprintf("room_%d.txt", pR.Id), []byte(rdfIdToActuallyUsedInputDump), 0644) // DEBUG ONLY
			}
			pR.onBattleStoppedForSettlement()
		}()

		pR.LastRenderFrameIdTriggeredAt = utils.UnixtimeNano()
		battleStartedAt := utils.UnixtimeNano()
		Logger.Info("The `battleMainLoop` is started for:", zap.Any("roomId", pR.Id))
		for _, watchdog := range pR.PlayerActiveWatchdogDict {
			watchdog.Kick()
		}
		for {
			stCalculation := utils.UnixtimeNano()
			elapsedNanosSinceLastFrameIdTriggered := stCalculation - pR.LastRenderFrameIdTriggeredAt
			if elapsedNanosSinceLastFrameIdTriggered < pR.RollbackEstimatedDtNanos {
				Logger.Debug(fmt.Sprintf("renderFrameId=%v@roomId=%v: Is backend running too fast? elapsedNanosSinceLastFrameIdTriggered=%v", pR.RenderFrameId, pR.Id, elapsedNanosSinceLastFrameIdTriggered))
			}

			if pR.RenderFrameId > pR.BattleDurationFrames {
				return
			}

			if swapped := atomic.CompareAndSwapInt32(&pR.State, RoomBattleStateIns.IN_BATTLE, RoomBattleStateIns.IN_BATTLE); !swapped {
				return
			}

			/*
			   [WARNING]
			   Golang "time.Sleep" is known to be taking longer than specified time to wake up at millisecond granularity, as discussed in https://github.com/golang/go/issues/44343
			   However, we assume that while "time.Sleep(16.67 ms)" might wake up after ~30ms, it still only covers at most 1 inputFrame generation.
			*/
			totalElapsedNanos := utils.UnixtimeNano() - battleStartedAt
			nextRenderFrameId := int32((totalElapsedNanos + pR.dilutedRollbackEstimatedDtNanos - 1) / pR.dilutedRollbackEstimatedDtNanos) // fast ceiling
			toSleepNanos := int64(0)
			if nextRenderFrameId > pR.RenderFrameId {
				if 0 == pR.RenderFrameId {
					// It's important to send kickoff frame iff  "0 == pR.RenderFrameId && nextRenderFrameId > pR.RenderFrameId", otherwise it might send duplicate kickoff frames
					for _, player := range pR.PlayersArr {
						playerId := player.Id
						thatPlayerBattleState := atomic.LoadInt32(&(player.BattleState)) // Might be changed in "OnPlayerDisconnected/OnPlayerLost" from other threads
						// [WARNING] DON'T try to send any message to an inactive player!
						switch thatPlayerBattleState {
						case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL:
							continue
						}
						kickoffFrameJs := pR.RenderFrameBuffer.GetByFrameId(0).(*battle.RoomDownsyncFrame)
						pR.sendSafely(toPbRoomDownsyncFrame(kickoffFrameJs), nil, DOWNSYNC_MSG_ACT_BATTLE_START, playerId, true)
					}
					Logger.Info(fmt.Sprintf("In `battleMainLoop` for roomId=%v sent out kickoffFrame", pR.Id))
				}
				prevRenderFrameId := pR.RenderFrameId
				pR.RenderFrameId = nextRenderFrameId

				dynamicsDuration := int64(0)

				// Prefab and buffer backend inputFrameDownsync
				if pR.BackendDynamicsEnabled {
					pR.doBattleMainLoopPerTickBackendDynamicsWithProperLocking(prevRenderFrameId, &dynamicsDuration)
				}

				pR.LastRenderFrameIdTriggeredAt = utils.UnixtimeNano()

				elapsedInCalculation := (utils.UnixtimeNano() - stCalculation)
				toSleepNanos = pR.dilutedRollbackEstimatedDtNanos - elapsedInCalculation // don't sleep if "nextRenderFrame == pR.RenderFrameId"
				if elapsedInCalculation > pR.RollbackEstimatedDtNanos {
					Logger.Warn(fmt.Sprintf("SLOW FRAME! Elapsed time statistics: roomId=%v, room.RenderFrameId=%v, elapsedInCalculation=%v ns, dynamicsDuration=%v ns, RollbackEstimatedDtNanos=%v, dilutedRollbackEstimatedDtNanos=%v", pR.Id, pR.RenderFrameId, elapsedInCalculation, dynamicsDuration, pR.RollbackEstimatedDtNanos, pR.dilutedRollbackEstimatedDtNanos))
				}
			}

			time.Sleep(time.Duration(toSleepNanos))
		}
	}

	downsyncLoop := func(playerId int32, player *Player, playerDownsyncChan chan pb.InputsBufferSnapshot) {
		defer func() {
			if r := recover(); r != nil {
				Logger.Error("downsyncLoop, recovery spot#1, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("panic", r))
			}
			Logger.Info(fmt.Sprintf("The `downsyncLoop` for (roomId=%v, playerId=%v) is stopped@renderFrameId=%v", pR.Id, playerId, pR.RenderFrameId))
		}()

		Logger.Debug(fmt.Sprintf("Started downsyncLoop for (roomId: %d, playerId:%d, playerDownsyncChan:%p)", pR.Id, playerId, playerDownsyncChan))

		for {
			select {
			case inputsBufferSnapshot := <-playerDownsyncChan:
				nowBattleState := atomic.LoadInt32(&pR.State)
				switch nowBattleState {
				case RoomBattleStateIns.IDLE, RoomBattleStateIns.STOPPING_BATTLE_FOR_SETTLEMENT, RoomBattleStateIns.IN_SETTLEMENT, RoomBattleStateIns.IN_DISMISSAL:
					Logger.Warn(fmt.Sprintf("Battle is not waiting/preparing/active for playerDownsyncChan for (roomId: %d, playerId:%d)", pR.Id, playerId))
					return
				}
				pR.downsyncToSinglePlayer(playerId, player, inputsBufferSnapshot.RefRenderFrameId, inputsBufferSnapshot.UnconfirmedMask, inputsBufferSnapshot.ToSendInputFrameDownsyncs, inputsBufferSnapshot.ShouldForceResync)
				//Logger.Info(fmt.Sprintf("Sent inputsBufferSnapshot(refRenderFrameId:%d, unconfirmedMask:%v) to for (roomId: %d, playerId:%d)#2", inputsBufferSnapshot.RefRenderFrameId, inputsBufferSnapshot.UnconfirmedMask, pR.Id, playerId))
			default:
			}
		}
	}

	for playerId, player := range pR.Players {
		/*
		   Always instantiates a new channel and let the old one die out due to not being retained by any root reference.

		   Each "playerDownsyncChan" stays alive through out the lifecycle of room instead of each "playerDownsyncSession", i.e. not closed or dereferenced upon disconnection.
		*/
		pR.PlayerDownsyncChanDict[playerId] = make(chan pb.InputsBufferSnapshot, pR.InputsBuffer.N)
		go downsyncLoop(playerId, player, pR.PlayerDownsyncChanDict[playerId])
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
	/*
	   [WARNING] This function "OnBattleCmdReceived" could be called by different ws sessions and thus from different threads!

	   That said, "markConfirmationIfApplicable" will still work as expected. Here's an example of weird call orders.
	   ---------------------------------------------------
	   now lastAllConfirmedInputFrameId: 42; each "()" below indicates a "Lock/Unlock cycle of InputsBufferLock", and "x" indicates no new all-confirmed snapshot is created
	   A: ([44,50],x)                                            ([49,54],snapshot=[51,53])
	   B:           ([54,58],x)
	   C:                               ([42,53],snapshot=[43,50])
	   D:                     ([51,55],x)
	   ---------------------------------------------------
	*/
	// TODO: Put a rate limiter on this function!
	if swapped := atomic.CompareAndSwapInt32(&pR.State, RoomBattleStateIns.IN_BATTLE, RoomBattleStateIns.IN_BATTLE); !swapped {
		return
	}

	playerId := pReq.PlayerId
	var player *Player = nil
	var existent bool = false
	inputFrameUpsyncBatch := pReq.InputFrameUpsyncBatch
	ackingFrameId := pReq.AckingFrameId
	ackingInputFrameId := pReq.AckingInputFrameId

	if player, existent = pR.Players[playerId]; !existent {
		Logger.Warn(fmt.Sprintf("upcmd player doesn't exist: roomId=%v, playerId=%v", pR.Id, playerId))
		return
	}

	if watchdog, existent := pR.PlayerActiveWatchdogDict[playerId]; existent {
		watchdog.Kick()
	}

	atomic.StoreInt32(&(player.AckingFrameId), ackingFrameId)
	atomic.StoreInt32(&(player.AckingInputFrameId), ackingInputFrameId)

	//Logger.Debug(fmt.Sprintf("OnBattleCmdReceived-InputsBufferLock about to lock: roomId=%v, fromPlayerId=%v", pR.Id, playerId))
	pR.InputsBufferLock.Lock()
	//Logger.Debug(fmt.Sprintf("OnBattleCmdReceived-InputsBufferLock locked: roomId=%v, fromPlayerId=%v", pR.Id, playerId))
	defer func() {
		pR.InputsBufferLock.Unlock()
		//Logger.Debug(fmt.Sprintf("OnBattleCmdReceived-InputsBufferLock unlocked: roomId=%v, fromPlayerId=%v", pR.Id, playerId))
	}()

	inputsBufferSnapshot := pR.markConfirmationIfApplicable(inputFrameUpsyncBatch, playerId, player)
	if nil != inputsBufferSnapshot {
		pR.downsyncToAllPlayers(inputsBufferSnapshot)
	}
}

func (pR *Room) onInputFrameDownsyncAllConfirmed(inputFrameDownsync *battle.InputFrameDownsync, playerId int32) {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	inputFrameId := inputFrameDownsync.InputFrameId
	if -1 == pR.LastAllConfirmedInputFrameIdWithChange || false == pR.equalInputLists(inputFrameDownsync.InputList, pR.LastAllConfirmedInputList) {
		if -1 == playerId {
			Logger.Debug(fmt.Sprintf("Key inputFrame change: roomId=%v, newInputFrameId=%v, lastInputFrameId=%v, newInputList=%v, lastInputList=%v, InputsBuffer=%v", pR.Id, inputFrameId, pR.LastAllConfirmedInputFrameId, inputFrameDownsync.InputList, pR.LastAllConfirmedInputList, pR.InputsBufferString(false)))
		} else {
			Logger.Debug(fmt.Sprintf("Key inputFrame change: roomId=%v, playerId=%v, newInputFrameId=%v, lastInputFrameId=%v, newInputList=%v, lastInputList=%v, InputsBuffer=%v", pR.Id, playerId, inputFrameId, pR.LastAllConfirmedInputFrameId, inputFrameDownsync.InputList, pR.LastAllConfirmedInputList, pR.InputsBufferString(false)))
		}
		pR.LastAllConfirmedInputFrameIdWithChange = inputFrameId
	}
	pR.LastAllConfirmedInputFrameId = inputFrameId
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
			PlayersArr:     toPbPlayers(pR.Players, false),
			CountdownNanos: -1, // TODO: Replace this magic constant!
		}
		pR.sendSafely(&assembledFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_STOPPED, playerId, true)
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

	battleReadyToStartFrame := &pb.RoomDownsyncFrame{
		Id:             DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START,
		PlayersArr:     toPbPlayers(pR.Players, true),
		CountdownNanos: pR.BattleDurationNanos,
	}

	Logger.Info("Sending out frame for RoomBattleState.PREPARE:", zap.Any("battleReadyToStartFrame", battleReadyToStartFrame))
	for _, player := range pR.Players {
		pR.sendSafely(battleReadyToStartFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START, player.Id, true)
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
	pR.BulletBattleLocalIdCounter = 0
	pR.WorldToVirtualGridRatio = battle.WORLD_TO_VIRTUAL_GRID_RATIO
	pR.VirtualGridToWorldRatio = float64(1.0) / pR.WorldToVirtualGridRatio // this is a one-off computation, should avoid division in iterations
	pR.SpAtkLookupFrames = 5
	pR.PlayerDefaultSpeed = int32(float64(1) * pR.WorldToVirtualGridRatio)                        // in virtual grids per frame
	pR.CollisionMinStep = (int32(float64(pR.PlayerDefaultSpeed)*pR.VirtualGridToWorldRatio) << 3) // the approx minimum distance a player can move per frame in world coordinate
	pR.playerOpPatternToSkillId = make(map[int]int)
	pR.Players = make(map[int32]*Player)
	pR.PlayersArr = make([]*Player, pR.Capacity)
	pR.CollisionSysMap = make(map[int32]*resolv.Object)
	pR.PlayerDownsyncSessionDict = make(map[int32]*websocket.Conn)
	for _, oldWatchdog := range pR.PlayerActiveWatchdogDict {
		oldWatchdog.Stop()
	}
	pR.PlayerActiveWatchdogDict = make(map[int32]*Watchdog)
	for _, oldChan := range pR.PlayerDownsyncChanDict {
		close(oldChan)
	}
	pR.PlayerDownsyncChanDict = make(map[int32](chan pb.InputsBufferSnapshot))
	pR.PlayerSignalToCloseDict = make(map[int32]SignalToCloseConnCbType)
	pR.JoinIndexBooleanArr = make([]bool, pR.Capacity)
	pR.RenderCacheSize = 1024
	pR.RenderFrameBuffer = battle.NewRingBuffer(pR.RenderCacheSize)
	pR.InputsBuffer = battle.NewRingBuffer((pR.RenderCacheSize >> 1) + 1)
	pR.rdfIdToActuallyUsedInput = make(map[int32]*pb.InputFrameDownsync)

	pR.LatestPlayerUpsyncedInputFrameId = -1
	pR.LastAllConfirmedInputFrameId = -1
	pR.LastAllConfirmedInputFrameIdWithChange = -1
	pR.LastAllConfirmedInputList = make([]uint64, pR.Capacity)

	pR.RenderFrameId = 0
	pR.CurDynamicsRenderFrameId = 0
	pR.InputDelayFrames = 8
	pR.NstDelayFrames = 16
	pR.InputScaleFrames = uint32(2)
	pR.ServerFps = 60
	pR.RollbackEstimatedDtMillis = 16.667  // Use fixed-and-low-precision to mitigate the inconsistent floating-point-number issue between Golang and JavaScript
	pR.RollbackEstimatedDtNanos = 16666666 // A little smaller than the actual per frame time, just for logging FAST FRAME
	dilutedServerFps := float64(58.0)      // Don't set this value too small, otherwise we might miss force confirmation needs for slow tickers!
	pR.dilutedRollbackEstimatedDtNanos = int64(float64(pR.RollbackEstimatedDtNanos) * float64(pR.ServerFps) / dilutedServerFps)
	pR.BattleDurationFrames = 60 * pR.ServerFps
	pR.BattleDurationNanos = int64(pR.BattleDurationFrames) * (pR.RollbackEstimatedDtNanos + 1)
	pR.InputFrameUpsyncDelayTolerance = (pR.NstDelayFrames >> pR.InputScaleFrames) - 1 // this value should be strictly smaller than (NstDelayFrames >> InputScaleFrames), otherwise "type#1 forceConfirmation" might become a lag avalanche
	pR.MaxChasingRenderFramesPerUpdate = 12                                            // Don't set this value too high to avoid exhausting frontend CPU within a single frame

	pR.BackendDynamicsEnabled = true              // [WARNING] When "false", recovery upon reconnection wouldn't work!
	pR.ForceAllResyncOnAnyActiveSlowTicker = true // See tradeoff discussion in "downsyncToAllPlayers"

	pR.FrameDataLoggingEnabled = false // [WARNING] DON'T ENABLE ON LONG BATTLE DURATION! It consumes A LOT OF MEMORY!

	pR.ChooseStage()
	pR.EffectivePlayerCount = 0

	// [WARNING] It's deliberately ordered such that "pR.State = RoomBattleStateIns.IDLE" is put AFTER all the refreshing operations above.
	pR.State = RoomBattleStateIns.IDLE
	pR.updateScore()

	Logger.Info("The room is completely dismissed(all playerDownsyncChan closed):", zap.Any("roomId", pR.Id))
}

func (pR *Room) expelPlayerDuringGame(playerId int32) {
	if signalToCloseConnOfThisPlayer, existent := pR.PlayerSignalToCloseDict[playerId]; existent {
		signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "") // TODO: Specify an error code
	}
	pR.onPlayerExpelledDuringGame(playerId)
}

func (pR *Room) expelPlayerForDismissal(playerId int32) {
	if signalToCloseConnOfThisPlayer, existent := pR.PlayerSignalToCloseDict[playerId]; existent {
		signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "") // TODO: Specify an error code
	}
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

	if player, existent := pR.Players[playerId]; existent {
		thatPlayerBattleState := atomic.LoadInt32(&(player.BattleState))
		switch thatPlayerBattleState {
		case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL:
			Logger.Info("Room OnPlayerDisconnected[early return #1]:", zap.Any("playerId", playerId), zap.Any("playerBattleState", pR.Players[playerId].BattleState), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
			return
		}
	} else {
		// Not even the "pR.Players[playerId]" exists.
		Logger.Info("Room OnPlayerDisconnected[early return #2]:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
		return
	}

	currRoomBattleState := atomic.LoadInt32(&(pR.State))
	switch currRoomBattleState {
	case RoomBattleStateIns.WAITING:
		pR.onPlayerLost(playerId)
		delete(pR.Players, playerId) // Note that this statement MUST be put AFTER `pR.onPlayerLost(...)` to avoid nil pointer exception.
		if 0 == pR.EffectivePlayerCount {
			atomic.StoreInt32(&(pR.State), RoomBattleStateIns.IDLE)
		}
		pR.updateScore()
		Logger.Info("Player disconnected while room is at RoomBattleStateIns.WAITING:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
	default:
		atomic.StoreInt32(&(pR.Players[playerId].BattleState), PlayerBattleStateIns.DISCONNECTED)
		pR.clearPlayerNetworkSession(playerId) // Still need clear the network session pointers, because "OnPlayerDisconnected" is only triggered from "signalToCloseConnOfThisPlayer" in "ws/serve.go", when the same player reconnects the network session pointers will be re-assigned
		Logger.Warn("OnPlayerDisconnected finished:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("playerBattleState", pR.Players[playerId].BattleState), zap.Any("nowRoomBattleState", pR.State), zap.Any("nowRoomEffectivePlayerCount", pR.EffectivePlayerCount))
	}
}

func (pR *Room) onPlayerLost(playerId int32) {
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("Room OnPlayerLost, recovery spot, recovered from: ", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("panic", r))
		}
	}()
	if player, existent := pR.Players[playerId]; existent {
		atomic.StoreInt32(&(player.BattleState), PlayerBattleStateIns.LOST)
		pR.clearPlayerNetworkSession(playerId)
		pR.EffectivePlayerCount--
		indiceInJoinIndexBooleanArr := int(player.JoinIndex - 1)
		if (0 <= indiceInJoinIndexBooleanArr) && (indiceInJoinIndexBooleanArr < len(pR.JoinIndexBooleanArr)) {
			pR.JoinIndexBooleanArr[indiceInJoinIndexBooleanArr] = false
		} else {
			Logger.Warn("Room OnPlayerLost, pR.JoinIndexBooleanArr is out of range: ", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("indiceInJoinIndexBooleanArr", indiceInJoinIndexBooleanArr), zap.Any("len(pR.JoinIndexBooleanArr)", len(pR.JoinIndexBooleanArr)))
		}
		player.JoinIndex = MAGIC_JOIN_INDEX_INVALID
		Logger.Warn("OnPlayerLost: ", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("resulted pR.JoinIndexBooleanArr", pR.JoinIndexBooleanArr))
	}
}

func (pR *Room) clearPlayerNetworkSession(playerId int32) {
	if _, y := pR.PlayerDownsyncSessionDict[playerId]; y {
		Logger.Debug("clearPlayerNetworkSession:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId))
		// [WARNING] No need to close "pR.PlayerDownsyncChanDict[playerId]" immediately!
		pR.PlayerActiveWatchdogDict[playerId].Stop()
		delete(pR.PlayerActiveWatchdogDict, playerId)
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
			playerPosList := *pR.TmxPointsMap["PlayerStartingPos"]
			if index > len(playerPosList) {
				panic(fmt.Sprintf("onPlayerAdded error, index >= len(playerPosList), roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
			}
			playerPos := playerPosList[index]

			if nil == playerPos {
				panic(fmt.Sprintf("onPlayerAdded error, nil == playerPos, roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
			}
			pR.Players[playerId].VirtualGridX, pR.Players[playerId].VirtualGridY = battle.WorldToVirtualGridPos(playerPos.X, playerPos.Y, pR.WorldToVirtualGridRatio)
			// Hardcoded initial character orientation/facing
			if 0 == (pR.Players[playerId].JoinIndex % 2) {
				pR.Players[playerId].DirX = -2
				pR.Players[playerId].DirY = 0
			} else {
				pR.Players[playerId].DirX = +2
				pR.Players[playerId].DirY = 0
			}

			break
		}
	}

	pR.updateScore()
	Logger.Info("onPlayerAdded:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("playerBattleState", pR.Players[playerId].BattleState), zap.Any("joinIndex", pR.Players[playerId].JoinIndex), zap.Any("EffectivePlayerCount", pR.EffectivePlayerCount), zap.Any("resulted pR.JoinIndexBooleanArr", pR.JoinIndexBooleanArr), zap.Any("RoomBattleState", pR.State))
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
	shouldTryToStartBattle := true
	Logger.Debug(fmt.Sprintf("OnPlayerBattleColliderAcked-before: roomId=%v, roomState=%v, targetPlayerId=%v, targetPlayerBattleState=%v, capacity=%v, EffectivePlayerCount=%v", pR.Id, pR.State, targetPlayer.Id, targetPlayer.BattleState, pR.Capacity, pR.EffectivePlayerCount))
	targetPlayerBattleState := atomic.LoadInt32(&(targetPlayer.BattleState))
	switch targetPlayerBattleState {
	case PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK:
		playerAckedFrame := &pb.RoomDownsyncFrame{
			Id:         pR.RenderFrameId,
			PlayersArr: toPbPlayers(pR.Players, true),
		}

		// Broadcast normally added player info to all players in the same room
		for _, thatPlayer := range pR.Players {
			/*
			   [WARNING]
			   This `playerAckedFrame` is the first ever "RoomDownsyncFrame" for every "PersistentSessionClient on the frontend", and it goes right after each "BattleColliderInfo".

			   By making use of the sequential nature of each ws session, all later "RoomDownsyncFrame"s generated after `pRoom.StartBattle()` will be put behind this `playerAckedFrame`.

			   This function is triggered by an upsync message via WebSocket, thus downsync sending is also available by now.
			*/
			thatPlayerId := thatPlayer.Id
			thatPlayerBattleState := atomic.LoadInt32(&(thatPlayer.BattleState))
			Logger.Debug(fmt.Sprintf("OnPlayerBattleColliderAcked-middle: roomId=%v, roomState=%v, targetPlayerId=%v, targetPlayerBattleState=%v, thatPlayerId=%v, thatPlayerBattleState=%v", pR.Id, pR.State, targetPlayer.Id, targetPlayer.BattleState, thatPlayer.Id, thatPlayerBattleState))
			if thatPlayerId == targetPlayer.Id || (PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK == thatPlayerBattleState || PlayerBattleStateIns.ACTIVE == thatPlayerBattleState) {
				Logger.Debug(fmt.Sprintf("OnPlayerBattleColliderAcked-sending DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED: roomId=%v, roomState=%v, targetPlayerId=%v, targetPlayerBattleState=%v, capacity=%v, EffectivePlayerCount=%v", pR.Id, pR.State, targetPlayer.Id, targetPlayer.BattleState, pR.Capacity, pR.EffectivePlayerCount))
				pR.sendSafely(playerAckedFrame, nil, DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED, thatPlayer.Id, true)
			}
		}
		atomic.StoreInt32(&(targetPlayer.BattleState), PlayerBattleStateIns.ACTIVE)
	case PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
		shouldTryToStartBattle = false
		atomic.StoreInt32(&(targetPlayer.BattleState), PlayerBattleStateIns.READDED_BATTLE_COLLIDER_ACKED)
		Logger.Warn(fmt.Sprintf("OnPlayerBattleColliderAcked-reAdded: roomId=%v, roomState=%v, targetPlayerId=%v, targetPlayerBattleState=%v, capacity=%v, EffectivePlayerCount=%v", pR.Id, pR.State, targetPlayer.Id, targetPlayer.BattleState, pR.Capacity, pR.EffectivePlayerCount))
	default:
	}

	Logger.Debug(fmt.Sprintf("OnPlayerBattleColliderAcked-post-downsync: roomId=%v, roomState=%v, targetPlayerId=%v, targetPlayerBattleState=%v, capacity=%v, EffectivePlayerCount=%v", pR.Id, pR.State, targetPlayer.Id, targetPlayer.BattleState, pR.Capacity, pR.EffectivePlayerCount))

	if shouldTryToStartBattle {
		if pR.Capacity == int(pR.EffectivePlayerCount) {
			allAcked := true
			for _, p := range pR.Players {
				if PlayerBattleStateIns.ACTIVE != p.BattleState {
					Logger.Warn("Unexpectedly got an inactive player", zap.Any("roomId", pR.Id), zap.Any("playerId", p.Id), zap.Any("battleState", p.BattleState))
					allAcked = false
					break
				}
			}
			if true == allAcked {
				pR.StartBattle() // WON'T run if the battle state is not in WAITING.
			}
		}

		pR.updateScore()
	}
	return true
}

func (pR *Room) sendSafely(roomDownsyncFrame *pb.RoomDownsyncFrame, toSendInputFrameDownsyncs []*pb.InputFrameDownsync, act int32, playerId int32, needLockExplicitly bool) {
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("sendSafely, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("panic", r))
		}
	}()

	if playerDownsyncSession, existent := pR.PlayerDownsyncSessionDict[playerId]; existent {
		pResp := &pb.WsResp{
			Ret:                     int32(Constants.RetCode.Ok),
			Act:                     act,
			Rdf:                     roomDownsyncFrame,
			InputFrameDownsyncBatch: toSendInputFrameDownsyncs,
		}

		theBytes, marshalErr := proto.Marshal(pResp)
		if nil != marshalErr {
			panic(fmt.Sprintf("Error marshaling downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
		}

		if err := playerDownsyncSession.WriteMessage(websocket.BinaryMessage, theBytes); nil != err {
			panic(fmt.Sprintf("Error sending downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v, err=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount, err))
		}
	}
}

func (pR *Room) shouldPrefabInputFrameDownsync(prevRenderFrameId int32, renderFrameId int32) (bool, int32) {
	for i := prevRenderFrameId + 1; i <= renderFrameId; i++ {
		if (0 <= i) && (0 == (i & ((1 << pR.InputScaleFrames) - 1))) {
			return true, i
		}
	}
	return false, -1
}

func (pR *Room) getOrPrefabInputFrameDownsync(inputFrameId int32) *battle.InputFrameDownsync {
	/*
	   [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked.

	   Kindly note that on backend the prefab is much simpler than its frontend counterpart, because frontend will upsync its latest command immediately if there's any change w.r.t. its own prev cmd, thus if no upsync received from a frontend,
	   - EITHER it's due to local lag and bad network,
	   - OR there's no change w.r.t. to its prev cmd.
	*/

	var currInputFrameDownsync *battle.InputFrameDownsync = nil
	tmp1 := pR.InputsBuffer.GetByFrameId(inputFrameId) // Would be nil if "pR.InputsBuffer.EdFrameId <= inputFrameId", else if "pR.InputsBuffer.EdFrameId > inputFrameId" is already met, then by now we can just return "tmp1.(*InputFrameDownsync)"
	if nil == tmp1 {
		for pR.InputsBuffer.EdFrameId <= inputFrameId {
			j := pR.InputsBuffer.EdFrameId
			currInputFrameDownsync = &battle.InputFrameDownsync{
				InputFrameId:  j,
				InputList:     make([]uint64, pR.Capacity),
				ConfirmedList: uint64(0),
			}

			j2 := j - 1
			tmp2 := pR.InputsBuffer.GetByFrameId(j2)
			if nil != tmp2 {
				prevInputFrameDownsync := tmp2.(*battle.InputFrameDownsync)
				for i, _ := range currInputFrameDownsync.InputList {
					currInputFrameDownsync.InputList[i] = prevInputFrameDownsync.InputList[i]
				}
			}

			for i, _ := range currInputFrameDownsync.InputList {
				// Don't predict "btnA & btnB"!
				currInputFrameDownsync.InputList[i] = (currInputFrameDownsync.InputList[i] & uint64(15))
			}

			pR.InputsBuffer.Put(currInputFrameDownsync)
		}
	} else {
		currInputFrameDownsync = tmp1.(*battle.InputFrameDownsync)
	}

	return currInputFrameDownsync
}

func (pR *Room) markConfirmationIfApplicable(inputFrameUpsyncBatch []*pb.InputFrameUpsync, playerId int32, player *Player) *pb.InputsBufferSnapshot {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	// Step#1, put the received "inputFrameUpsyncBatch" into "pR.InputsBuffer"
	for _, inputFrameUpsync := range inputFrameUpsyncBatch {
		clientInputFrameId := inputFrameUpsync.InputFrameId
		if clientInputFrameId < pR.InputsBuffer.StFrameId {
			// The updates to "pR.InputsBuffer.StFrameId" is monotonically increasing, thus if "clientInputFrameId < pR.InputsBuffer.StFrameId" at any moment of time, it is obsolete in the future.
			Logger.Debug(fmt.Sprintf("Omitting obsolete inputFrameUpsync#1: roomId=%v, playerId=%v, clientInputFrameId=%v, InputsBuffer=%v", pR.Id, playerId, clientInputFrameId, pR.InputsBufferString(false)))
			continue
		}
		if clientInputFrameId < pR.LastAllConfirmedInputFrameId {
			Logger.Debug(fmt.Sprintf("Omitting obsolete inputFrameUpsync#2: roomId=%v, playerId=%v, clientInputFrameId=%v, InputsBuffer=%v", pR.Id, playerId, clientInputFrameId, pR.InputsBufferString(false)))
			continue
		}
		if clientInputFrameId > pR.InputsBuffer.EdFrameId {
			Logger.Warn(fmt.Sprintf("Dropping too advanced inputFrameUpsync: roomId=%v, playerId=%v, clientInputFrameId=%v, InputsBuffer=%v; is this player cheating?", pR.Id, playerId, clientInputFrameId, pR.InputsBufferString(false)))
			continue
		}
		// by now "clientInputFrameId <= pR.InputsBuffer.EdFrameId"
		targetInputFrameDownsync := pR.getOrPrefabInputFrameDownsync(clientInputFrameId)
		targetInputFrameDownsync.InputList[player.JoinIndex-1] = inputFrameUpsync.Encoded
		targetInputFrameDownsync.ConfirmedList |= uint64(1 << uint32(player.JoinIndex-1))

		if clientInputFrameId > pR.LatestPlayerUpsyncedInputFrameId {
			pR.LatestPlayerUpsyncedInputFrameId = clientInputFrameId
		}
	}

	// Step#2, mark confirmation without forcing
	newAllConfirmedCount := int32(0)
	inputFrameId1 := pR.LastAllConfirmedInputFrameId + 1
	totPlayerCnt := uint32(pR.Capacity)
	allConfirmedMask := uint64((1 << totPlayerCnt) - 1)

	for inputFrameId := inputFrameId1; inputFrameId < pR.InputsBuffer.EdFrameId; inputFrameId++ {
		tmp := pR.InputsBuffer.GetByFrameId(inputFrameId)
		if nil == tmp {
			panic(fmt.Sprintf("inputFrameId=%v doesn't exist for roomId=%v! InputsBuffer=%v", inputFrameId, pR.Id, pR.InputsBufferString(false)))
		}
		shouldBreakConfirmation := false
		inputFrameDownsync := tmp.(*battle.InputFrameDownsync)

		if allConfirmedMask != inputFrameDownsync.ConfirmedList {
			for _, player := range pR.PlayersArr {
				thatPlayerBattleState := atomic.LoadInt32(&(player.BattleState))
				thatPlayerJoinMask := uint64(1 << uint32(player.JoinIndex-1))
				isSlowTicker := (0 == (inputFrameDownsync.ConfirmedList & thatPlayerJoinMask))
				isActiveSlowTicker := (isSlowTicker && thatPlayerBattleState == PlayerBattleStateIns.ACTIVE)
				if isActiveSlowTicker {
					shouldBreakConfirmation = true // Could be an `ACTIVE SLOW TICKER` here, but no action needed for now
					break
				}
				Logger.Debug(fmt.Sprintf("markConfirmationIfApplicable for roomId=%v, skipping UNCONFIRMED BUT INACTIVE player(id:%v, joinIndex:%v) while checking inputFrameId=[%v, %v): InputsBuffer=%v", pR.Id, player.Id, player.JoinIndex, inputFrameId1, pR.InputsBuffer.EdFrameId, pR.InputsBufferString(false)))
			}
		}

		if shouldBreakConfirmation {
			break
		}
		newAllConfirmedCount += 1
		pR.onInputFrameDownsyncAllConfirmed(inputFrameDownsync, -1)
	}

	if 0 < newAllConfirmedCount {
		/*
					   [WARNING]

					   If "pR.InputsBufferLock" was previously held by "doBattleMainLoopPerTickBackendDynamicsWithProperLocking", then "snapshotStFrameId" would be just (LastAllConfirmedInputFrameId - newAllConfirmedCount).

					   However if "pR.InputsBufferLock" was previously held by another "OnBattleCmdReceived", the proper value for "snapshotStFrameId" might be smaller than (pR.LastAllConfirmedInputFrameId - newAllConfirmedCount) -- but why? Especially when we've already wrapped this whole function in "InputsBufferLock", the order of "markConfirmationIfApplicable" generated snapshots is preserved for sending, isn't (LastAllConfirmedInputFrameId - newAllConfirmedCount) good enough here?

			           Unfortunately no, for a reconnected player to get recovered asap (of course with BackendDynamicsEnabled), we put a check of READDED_BATTLE_COLLIDER_ACKED in "downsyncToSinglePlayer" -- which could be called right after "markConfirmationIfApplicable" yet without going through "forceConfirmationIfApplicable" -- and if a READDED_BATTLE_COLLIDER_ACKED player is found there we need a proper "(refRenderFrameId, snapshotStFrameId)" pair for that player!
		*/
		snapshotStFrameId := (pR.LastAllConfirmedInputFrameId - newAllConfirmedCount)
		refRenderFrameIdIfNeeded := pR.CurDynamicsRenderFrameId - 1
		refSnapshotStFrameId := pR.ConvertToInputFrameId(refRenderFrameIdIfNeeded, pR.InputDelayFrames)
		if refSnapshotStFrameId < snapshotStFrameId {
			snapshotStFrameId = refSnapshotStFrameId
		}
		Logger.Debug(fmt.Sprintf("markConfirmationIfApplicable for roomId=%v returning newAllConfirmedCount=%d: InputsBuffer=%v", pR.Id, newAllConfirmedCount, pR.InputsBufferString(false)))
		return pR.produceInputsBufferSnapshotWithCurDynamicsRenderFrameAsRef(uint64(0), snapshotStFrameId, pR.LastAllConfirmedInputFrameId+1)
	} else {
		return nil
	}
}

func (pR *Room) forceConfirmationIfApplicable(prevRenderFrameId int32) uint64 {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	totPlayerCnt := uint32(pR.Capacity)
	allConfirmedMask := uint64((1 << totPlayerCnt) - 1)
	unconfirmedMask := uint64(0)
	if pR.LatestPlayerUpsyncedInputFrameId > (pR.LastAllConfirmedInputFrameId + (pR.NstDelayFrames >> pR.InputScaleFrames)) {
		// Type#1 check whether there's a significantly slow ticker among players
		oldLastAllConfirmedInputFrameId := pR.LastAllConfirmedInputFrameId
		for j := pR.LastAllConfirmedInputFrameId + 1; j <= pR.LatestPlayerUpsyncedInputFrameId; j++ {
			tmp := pR.InputsBuffer.GetByFrameId(j)
			if nil == tmp {
				panic(fmt.Sprintf("inputFrameId=%v doesn't exist for roomId=%v! InputsBuffer=%v", j, pR.Id, pR.InputsBufferString(false)))
			}
			inputFrameDownsync := tmp.(*battle.InputFrameDownsync)
			unconfirmedMask |= (allConfirmedMask ^ inputFrameDownsync.ConfirmedList)
			inputFrameDownsync.ConfirmedList = allConfirmedMask
			pR.onInputFrameDownsyncAllConfirmed(inputFrameDownsync, -1)
		}
		if 0 < unconfirmedMask {
			Logger.Info(fmt.Sprintf("[type#1 forceConfirmation] For roomId=%d@renderFrameId=%d, curDynamicsRenderFrameId=%d, LatestPlayerUpsyncedInputFrameId:%d, oldLastAllConfirmedInputFrameId:%d, newLastAllConfirmedInputFrameId:%d, (pR.NstDelayFrames >> pR.InputScaleFrames):%d, InputFrameUpsyncDelayTolerance:%d, unconfirmedMask=%d; there's a slow ticker suspect, forcing all-confirmation", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LatestPlayerUpsyncedInputFrameId, oldLastAllConfirmedInputFrameId, pR.LastAllConfirmedInputFrameId, (pR.NstDelayFrames >> pR.InputScaleFrames), pR.InputFrameUpsyncDelayTolerance, unconfirmedMask))
		}
	} else {
		// Type#2 helps resolve the edge case when all players are disconnected temporarily
		shouldForceResync := false
		for _, player := range pR.PlayersArr {
			playerBattleState := atomic.LoadInt32(&(player.BattleState))
			if PlayerBattleStateIns.READDED_BATTLE_COLLIDER_ACKED == playerBattleState {
				shouldForceResync = true
				break
			}
		}
		if shouldForceResync {
			Logger.Warn(fmt.Sprintf("[type#2 forceConfirmation] For roomId=%d@renderFrameId=%d, curDynamicsRenderFrameId=%d, LatestPlayerUpsyncedInputFrameId:%d, LastAllConfirmedInputFrameId:%d; there's at least one reconnected player, forcing all-confirmation", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LatestPlayerUpsyncedInputFrameId, pR.LastAllConfirmedInputFrameId))
			unconfirmedMask = allConfirmedMask
		}
	}

	return unconfirmedMask
}

func (pR *Room) produceInputsBufferSnapshotWithCurDynamicsRenderFrameAsRef(unconfirmedMask uint64, snapshotStFrameId, snapshotEdFrameId int32) *pb.InputsBufferSnapshot {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	refRenderFrameIdIfNeeded := pR.CurDynamicsRenderFrameId - 1
	if 0 > refRenderFrameIdIfNeeded {
		return nil
	}
	// Duplicate downsynced inputFrameIds will be filtered out by frontend.
	toSendInputFrameDownsyncs := pR.cloneInputsBuffer(snapshotStFrameId, snapshotEdFrameId)

	return &pb.InputsBufferSnapshot{
		RefRenderFrameId:          refRenderFrameIdIfNeeded,
		UnconfirmedMask:           unconfirmedMask,
		ToSendInputFrameDownsyncs: toSendInputFrameDownsyncs,
	}
}

func (pR *Room) applyInputFrameDownsyncDynamics(fromRenderFrameId int32, toRenderFrameId int32, spaceOffsetX, spaceOffsetY float64) {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	if fromRenderFrameId >= toRenderFrameId {
		return
	}

	Logger.Debug(fmt.Sprintf("Applying inputFrame dynamics: roomId=%v, room.RenderFrameId=%v, fromRenderFrameId=%v, toRenderFrameId=%v", pR.Id, pR.RenderFrameId, fromRenderFrameId, toRenderFrameId))

	for collisionSysRenderFrameId := fromRenderFrameId; collisionSysRenderFrameId < toRenderFrameId; collisionSysRenderFrameId++ {
		currRenderFrameTmp := pR.RenderFrameBuffer.GetByFrameId(collisionSysRenderFrameId)
		if nil == currRenderFrameTmp {
			panic(fmt.Sprintf("collisionSysRenderFrameId=%v doesn't exist for roomId=%v, this is abnormal because it's to be used for applying dynamics to [fromRenderFrameId:%v, toRenderFrameId:%v)! RenderFrameBuffer=%v", collisionSysRenderFrameId, pR.Id, fromRenderFrameId, toRenderFrameId, pR.RenderFrameBufferString()))
		}
		currRenderFrame := currRenderFrameTmp.(*battle.RoomDownsyncFrame)
		delayedInputFrameId := pR.ConvertToInputFrameId(collisionSysRenderFrameId, pR.InputDelayFrames)
		if 0 <= delayedInputFrameId {
			if delayedInputFrameId > pR.LastAllConfirmedInputFrameId {
				panic(fmt.Sprintf("delayedInputFrameId=%v is not yet all-confirmed for roomId=%v, this is abnormal because it's to be used for applying dynamics to [fromRenderFrameId:%v, toRenderFrameId:%v) @ collisionSysRenderFrameId=%v! InputsBuffer=%v", delayedInputFrameId, pR.Id, fromRenderFrameId, toRenderFrameId, collisionSysRenderFrameId, pR.InputsBufferString(false)))
			}
			tmp := pR.InputsBuffer.GetByFrameId(delayedInputFrameId)
			if nil == tmp {
				panic(fmt.Sprintf("delayedInputFrameId=%v doesn't exist for roomId=%v, this is abnormal because it's to be used for applying dynamics to [fromRenderFrameId:%v, toRenderFrameId:%v) @ collisionSysRenderFrameId=%v! InputsBuffer=%v", delayedInputFrameId, pR.Id, fromRenderFrameId, toRenderFrameId, collisionSysRenderFrameId, pR.InputsBufferString(false)))
			}

			if pR.FrameDataLoggingEnabled {
				delayedInputFrame := tmp.(*battle.InputFrameDownsync)
				actuallyUsedInputClone := make([]uint64, len(delayedInputFrame.InputList), len(delayedInputFrame.InputList))
				for i, v := range delayedInputFrame.InputList {
					actuallyUsedInputClone[i] = v
				}
				pR.rdfIdToActuallyUsedInput[currRenderFrame.Id] = &pb.InputFrameDownsync{
					InputFrameId:  delayedInputFrame.InputFrameId,
					InputList:     actuallyUsedInputClone,
					ConfirmedList: delayedInputFrame.ConfirmedList,
				}
			}
		}

		nextRenderFrame := battle.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(pR.InputsBuffer, currRenderFrame, pR.Space, pR.CollisionSysMap, pR.InputDelayFrames, pR.InputScaleFrames, pR.collisionSpaceOffsetX, pR.collisionSpaceOffsetY, pR.SnapIntoPlatformOverlap, pR.SnapIntoPlatformThreshold, pR.WorldToVirtualGridRatio, pR.VirtualGridToWorldRatio, pR.playerOpPatternToSkillId)
		pR.RenderFrameBuffer.Put(nextRenderFrame)
		pR.CurDynamicsRenderFrameId++
	}
}

func (pR *Room) refreshColliders(spaceW, spaceH int32) {
	// Kindly note that by now, we've already got all the shapes in the tmx file into "pR.(Players | Barriers)" from "ParseTmxLayersAndGroups"

	topPadding, bottomPadding, leftPadding, rightPadding := pR.SnapIntoPlatformOverlap, pR.SnapIntoPlatformOverlap, pR.SnapIntoPlatformOverlap, pR.SnapIntoPlatformOverlap

	pR.Space = resolv.NewSpace(int(spaceW), int(spaceH), int(pR.CollisionMinStep), int(pR.CollisionMinStep)) // allocate a new collision space everytime after a battle is settled
	jsPlayers := toJsPlayers(pR.Players)
	for _, player := range jsPlayers {
		wx, wy := battle.VirtualGridToWorldPos(player.VirtualGridX, player.VirtualGridY, pR.VirtualGridToWorldRatio)
		colliderWidth, colliderHeight := player.ColliderRadius*2, player.ColliderRadius*4
		playerCollider := battle.GenerateRectCollider(wx, wy, colliderWidth, colliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, pR.collisionSpaceOffsetX, pR.collisionSpaceOffsetY, player, "Player") // the coords of all barrier boundaries are multiples of tileWidth(i.e. 16), by adding snapping y-padding when "landedOnGravityPushback" all "playerCollider.Y" would be a multiple of 1.0
		pR.Space.Add(playerCollider)
		// Keep track of the collider in "pR.CollisionSysMap"
		joinIndex := player.JoinIndex
		collisionPlayerIndex := battle.COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		pR.CollisionSysMap[collisionPlayerIndex] = playerCollider
	}

	for _, player := range pR.Players {
		joinIndex := player.JoinIndex
		pR.PlayersArr[joinIndex-1] = player
	}

	barrierPolygon2DList := *pR.TmxPolygonsMap["Barrier"]
	for _, polygon2DUnaligned := range barrierPolygon2DList {
		/*
		   // For debug-printing only.
		   Logger.Info("ChooseStage printing polygon2D for barrierPolygon2DList", zap.Any("barrierLocalIdInBattle", barrierLocalIdInBattle), zap.Any("polygon2D.Anchor", polygon2D.Anchor), zap.Any("polygon2D.Points", polygon2D.Points))
		*/
		barrierCollider := battle.GenerateConvexPolygonCollider(polygon2DUnaligned, pR.collisionSpaceOffsetX, pR.collisionSpaceOffsetY, nil, "Barrier")
		pR.Space.Add(barrierCollider)
	}
}

func (pR *Room) printBarrier(barrierCollider *resolv.Object) {
	Logger.Info(fmt.Sprintf("Barrier in roomId=%v: w=%v, h=%v, shape=%v", pR.Id, barrierCollider.W, barrierCollider.H, barrierCollider.Shape))
}

func (pR *Room) doBattleMainLoopPerTickBackendDynamicsWithProperLocking(prevRenderFrameId int32, pDynamicsDuration *int64) {
	Logger.Debug(fmt.Sprintf("doBattleMainLoopPerTickBackendDynamicsWithProperLocking-InputsBufferLock to about lock: roomId=%v", pR.Id))
	pR.InputsBufferLock.Lock()
	Logger.Debug(fmt.Sprintf("doBattleMainLoopPerTickBackendDynamicsWithProperLocking-InputsBufferLock locked: roomId=%v", pR.Id))

	defer func() {
		pR.InputsBufferLock.Unlock()
		Logger.Debug(fmt.Sprintf("doBattleMainLoopPerTickBackendDynamicsWithProperLocking-InputsBufferLock unlocked: roomId=%v", pR.Id))
	}()

	if ok, thatRenderFrameId := pR.shouldPrefabInputFrameDownsync(prevRenderFrameId, pR.RenderFrameId); ok {
		noDelayInputFrameId := pR.ConvertToInputFrameId(thatRenderFrameId, 0)
		pR.getOrPrefabInputFrameDownsync(noDelayInputFrameId)
	}

	// Force setting all-confirmed of buffered inputFrames periodically, kindly note that if "pR.BackendDynamicsEnabled", what we want to achieve is "recovery upon reconnection", which certainly requires "forceConfirmationIfApplicable" to move "pR.LastAllConfirmedInputFrameId" forward as much as possible
	oldLastAllConfirmedInputFrameId := pR.LastAllConfirmedInputFrameId
	unconfirmedMask := pR.forceConfirmationIfApplicable(prevRenderFrameId)

	if 0 <= pR.LastAllConfirmedInputFrameId {
		dynamicsStartedAt := utils.UnixtimeNano()
		// Apply "all-confirmed inputFrames" to move forward "pR.CurDynamicsRenderFrameId"
		nextDynamicsRenderFrameId := pR.ConvertToLastUsedRenderFrameId(pR.LastAllConfirmedInputFrameId, pR.InputDelayFrames) + 1
		Logger.Debug(fmt.Sprintf("roomId=%v, room.RenderFrameId=%v, room.CurDynamicsRenderFrameId=%v, LastAllConfirmedInputFrameId=%v, InputDelayFrames=%v, nextDynamicsRenderFrameId=%v", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LastAllConfirmedInputFrameId, pR.InputDelayFrames, nextDynamicsRenderFrameId))
		pR.applyInputFrameDownsyncDynamics(pR.CurDynamicsRenderFrameId, nextDynamicsRenderFrameId, pR.collisionSpaceOffsetX, pR.collisionSpaceOffsetY)
		*pDynamicsDuration = utils.UnixtimeNano() - dynamicsStartedAt
	}

	/*
	   [WARNING]

	   It's critical to create the snapshot AFTER "applyInputFrameDownsyncDynamics" for `ACTIVE SLOW TICKER` to avoid lag avalanche (see `<proj-root>/ConcerningEdgeCases.md` for introduction).

	   Consider that in a 4-player battle, player#1 is once disconnected but soon reconnected in 2 seconds, during its absence, "markConfirmationIfApplicable" would skip it and increment "LastAllConfirmedInputFrameId" and when backend is sending "DOWNSYNC_MSG_ACT_FORCED_RESYNC" it'd be always based on "LatestPlayerUpsyncedInputFrameId == LastAllConfirmedInputFrameId" thus NOT triggering "[type#1 forceConfirmation]".

	   However, if player#1 remains connected but ticks very slowly (i.e. an "ACTIVE SLOW TICKER"), "markConfirmationIfApplicable" couldn't increment "LastAllConfirmedInputFrameId", thus "[type#1 forceConfirmation]" will be triggered, but what's worse is that after "[type#1 forceConfirmation]" if the "refRenderFrameId" is not advanced enough, player#1 could never catch up even if it resumed from slow ticking!
	*/

	if 0 < unconfirmedMask {
		// [WARNING] As "pR.CurDynamicsRenderFrameId" was just incremented above, "refSnapshotStFrameId" is most possibly larger than "oldLastAllConfirmedInputFrameId + 1", therefore this initial assignment is critical for `ACTIVE NORMAL TICKER`s to receive consecutive ids of inputFrameDownsync.
		snapshotStFrameId := oldLastAllConfirmedInputFrameId + 1
		refSnapshotStFrameId := pR.ConvertToInputFrameId(pR.CurDynamicsRenderFrameId-1, pR.InputDelayFrames)
		if refSnapshotStFrameId < snapshotStFrameId {
			snapshotStFrameId = refSnapshotStFrameId
		}
		inputsBufferSnapshot := pR.produceInputsBufferSnapshotWithCurDynamicsRenderFrameAsRef(unconfirmedMask, snapshotStFrameId, pR.LastAllConfirmedInputFrameId+1)
		Logger.Debug(fmt.Sprintf("[forceConfirmation] roomId=%v, room.RenderFrameId=%v, room.CurDynamicsRenderFrameId=%v, room.LastAllConfirmedInputFrameId=%v, unconfirmedMask=%v", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LastAllConfirmedInputFrameId, unconfirmedMask))
		pR.downsyncToAllPlayers(inputsBufferSnapshot)
	}
}

func (pR *Room) downsyncToAllPlayers(inputsBufferSnapshot *pb.InputsBufferSnapshot) {
	/*
		       [WARNING] This function MUST BE called while "pR.InputsBufferLock" is LOCKED to **preserve the order of generation of "inputsBufferSnapshot" for sending** -- see comments in "OnBattleCmdReceived" and [this issue](https://github.com/genxium/DelayNoMore/issues/12).

		       Actually if each player session were both intrinsically thread-safe & non-blocking for writing (like Java NIO), I could've just called "playerSession.WriteMessage" while holding "pR.InputsBufferLock" -- but the ws session provided by Gorilla library is neither thread-safe nor non-blocking for writing, which is fine because it creates a chance for the users to solve an interesting problem :)

			   Moreover, we're downsyncing a same "inputsBufferSnapshot" for all players in the same battle and this is by design, i.e. not respecting "player.LastSentInputFrameId" because "new all-confirmed inputFrameDownsyncs" are the same for all players and ws is TCP-based (no loss of consecutive packets except for reconnection -- which is already handled by READDED_BATTLE_COLLIDER_ACKED)

		       Lastly noting just for fun, if in "OnBattleCmdReceived" we need downsync to a single specific player (keeping **the order of generation of "inputsBufferSnapshot" preserved for sending** of course), in theory it's better to do it by the following order.
		       1. lock "InputsBuffer";
		       2. generate downsync msg;
		       3. lock "pR.PlayerDownsyncChanDict[playerId]";
		       4. put downsync msg to "pR.PlayerDownsyncChanDict[playerId]";
		       5. unlock "InputsBuffer";
		       6. now other threads are allowed to lock "inputsBuffer", and we can do "other things" on "pR.PlayerDownsyncChanDict[playerId]";
		       7. unlock "pR.PlayerDownsyncChanDict[playerId]".

		       The difference from our current approach is that the "pR.PlayerDownsyncChanDict[playerId]" in use is a Golang channel, i.e. when executing #4 it automatically executes #3 (before) & #7 (after) as well, thus we couldn't do #5 & #6 in between.
	*/
	if true == pR.BackendDynamicsEnabled {
		for _, player := range pR.PlayersArr {
			/*
			   [WARNING] Since v0.9.1, the inconsistence between frontend & backend collision handling results became too difficult to track, therefore before we can let frontend use a Golang compiled library for "applyInputFrameDownsyncDynamicsOnSingleRenderFrame", it's a compromise here to force resync for all players in a same room if any player recovered from a reconnection (when it's most likely for anyone to notice an inconsistence).

			   That said, we ensured that if "false == BackendDynamicsEnabled" and noone ever disconnects & reconnects, the frontend collision handling results are always consistent.
			*/
			playerBattleState := atomic.LoadInt32(&(player.BattleState))
			if PlayerBattleStateIns.READDED_BATTLE_COLLIDER_ACKED == playerBattleState {
				inputsBufferSnapshot.ShouldForceResync = true
				break
			}
			/*
			   [WARNING] There's a tradeoff for setting/unsetting "ForceAllResyncOnAnyActiveSlowTicker" here, if the `ACTIVE SLOW TICKER` doesn't resume for a long period of time, the current approach is to kick it out by "connWatchdog" instead of forcing resync of all players in the same battle all the way along.

			   [FIXME]
			   In practice, I tested in internet environment by toggling player#1 "CPU throttling: 1x -> 4x -> 1x -> 6x -> 1x" and checked the logs of all players which showed that "all received inputFrameIds are consecutive for all players", yet not forcing resync of all players here still result in occasional inconsistent graphics for the `ACTIVE NORMAL TICKER`s.

			   More investigation into this issue is needed, it's possible that the inconsistent graphics is just a result of difference of backend/frontend collision calculations, yet before it's totally resolved we'd keep forcing resync here.
			*/
			thatPlayerJoinMask := uint64(1 << uint32(player.JoinIndex-1))
			isActiveSlowTicker := (0 < (thatPlayerJoinMask & inputsBufferSnapshot.UnconfirmedMask)) && (PlayerBattleStateIns.ACTIVE == playerBattleState)
			if pR.ForceAllResyncOnAnyActiveSlowTicker && isActiveSlowTicker {
				inputsBufferSnapshot.ShouldForceResync = true
				break
			}
		}
	}

	for _, player := range pR.PlayersArr {
		/*
		   [WARNING] While the order of generation of "inputsBufferSnapshot" is preserved for sending, the underlying network I/O blocking action is dispatched to "downsyncLoop of each player" such that "markConfirmationIfApplicable & forceConfirmationIfApplicable" can re-hold "pR.InputsBufferLock" asap and proceed with more inputFrameUpsyncs.

		   The use of "downsyncLoop of each player" also waives the need of guarding each "pR.PlayerDownsyncSessionDict[playerId]" from multithread-access (e.g. by a "pR.PlayerDownsyncSessionMutexDict[playerId]"), i.e. Gorilla v1.2.0 "conn.WriteMessage" isn't thread-safe https://github.com/gorilla/websocket/blob/v1.2.0/conn.go#L585.
		*/
		playerBattleState := atomic.LoadInt32(&(player.BattleState))
		switch playerBattleState {
		case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL, PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
			continue
		}

		if playerDownsyncChan, existent := pR.PlayerDownsyncChanDict[player.Id]; existent {
			playerDownsyncChan <- (*inputsBufferSnapshot)
			//Logger.Info(fmt.Sprintf("Sent inputsBufferSnapshot(refRenderFrameId:%d, unconfirmedMask:%v) to for (roomId: %d, playerId:%d, playerDownsyncChan:%p)#1", inputsBufferSnapshot.RefRenderFrameId, inputsBufferSnapshot.UnconfirmedMask, pR.Id, player.Id, playerDownsyncChan))
		} else {
			Logger.Warn(fmt.Sprintf("playerDownsyncChan for (roomId: %d, playerId:%d) is gone", pR.Id, player.Id))
		}
	}
}

func (pR *Room) downsyncToSinglePlayer(playerId int32, player *Player, refRenderFrameId int32, unconfirmedMask uint64, toSendInputFrameDownsyncsSnapshot []*pb.InputFrameDownsync, shouldForceResync bool) {
	/*
	   [WARNING] This function MUST BE called while "pR.InputsBufferLock" is unlocked -- otherwise the network I/O blocking of "sendSafely" might cause significant lag for "markConfirmationIfApplicable & forceConfirmationIfApplicable"!

	   We hereby assume that Golang runtime allocates & frees small amount of RAM quickly enough compared to either network I/O blocking in worst cases or the high frequency "per inputFrameDownsync*player" locking (though "OnBattleCmdReceived" locks at the same frequency but it's inevitable).
	*/

	playerJoinIndex := player.JoinIndex - 1
	playerBattleState := atomic.LoadInt32(&(player.BattleState))
	switch playerBattleState {
	case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL, PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
		return
	}

	isSlowTicker := (0 < (unconfirmedMask & uint64(1<<uint32(playerJoinIndex))))
	shouldResync1 := (PlayerBattleStateIns.READDED_BATTLE_COLLIDER_ACKED == playerBattleState) // i.e. implies that "MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED == player.LastSentInputFrameId"
	shouldResync2 := isSlowTicker                                                              // This condition is critical, if we don't send resync upon this condition, the "reconnected or slowly-clocking player" might never get its input synced
	shouldResync3 := shouldForceResync
	shouldResyncOverall := (shouldResync1 || shouldResync2 || shouldResync3)

	/*
	   Resync helps
	   1. when player with a slower frontend clock lags significantly behind and thus wouldn't get its inputUpsync recognized due to faster "forceConfirmation"
	   2. reconnection
	*/
	toSendInputFrameIdSt, toSendInputFrameIdEd := toSendInputFrameDownsyncsSnapshot[0].InputFrameId, toSendInputFrameDownsyncsSnapshot[len(toSendInputFrameDownsyncsSnapshot)-1].InputFrameId+1
	if pR.BackendDynamicsEnabled && shouldResyncOverall {
		tmp := pR.RenderFrameBuffer.GetByFrameId(refRenderFrameId)
		if nil == tmp {
			panic(fmt.Sprintf("Required refRenderFrameId=%v for (roomId=%v, renderFrameId=%v, playerId=%v, playerLastSentInputFrameId=%v) doesn't exist! InputsBuffer=%v, RenderFrameBuffer=%v", refRenderFrameId, pR.Id, pR.RenderFrameId, playerId, player.LastSentInputFrameId, pR.InputsBufferString(false), pR.RenderFrameBufferString()))
		}

		refRenderFrame := tmp.(*battle.RoomDownsyncFrame)
		refRenderFrame.PlayerOpPatternToSkillId = pR.playerOpPatternToSkillId
		for i, player := range pR.PlayersArr {
			refRenderFrame.PlayersArr[i].ColliderRadius = player.ColliderRadius // hardcoded for now
		}
		if shouldResync3 {
			refRenderFrame.ShouldForceResync = true
		}
		refRenderFrame.BackendUnconfirmedMask = unconfirmedMask
		pR.sendSafely(toPbRoomDownsyncFrame(refRenderFrame), toSendInputFrameDownsyncsSnapshot, DOWNSYNC_MSG_ACT_FORCED_RESYNC, playerId, false)
		//Logger.Warn(fmt.Sprintf("Sent refRenderFrameId=%v & inputFrameIds [%d, %d), for roomId=%v, playerId=%d, playerJoinIndex=%d, renderFrameId=%d, curDynamicsRenderFrameId=%d, playerLastSentInputFrameId=%d: InputsBuffer=%v", refRenderFrameId, toSendInputFrameIdSt, toSendInputFrameIdEd, pR.Id, playerId, player.JoinIndex, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, player.LastSentInputFrameId, pR.InputsBufferString(false)))
		if shouldResync1 {
			Logger.Warn(fmt.Sprintf("Sent refRenderFrameId=%v & inputFrameIds [%d, %d), for roomId=%v, playerId=%d, playerJoinIndex=%d, renderFrameId=%d, curDynamicsRenderFrameId=%d, playerLastSentInputFrameId=%d: shouldResync1=%v, shouldResync2=%v, shouldResync3=%v, playerBattleState=%d", refRenderFrameId, toSendInputFrameIdSt, toSendInputFrameIdEd, pR.Id, playerId, player.JoinIndex, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, player.LastSentInputFrameId, shouldResync1, shouldResync2, shouldResync3, playerBattleState))
		}
	} else {
		pR.sendSafely(nil, toSendInputFrameDownsyncsSnapshot, DOWNSYNC_MSG_ACT_INPUT_BATCH, playerId, false)
	}
	player.LastSentInputFrameId = toSendInputFrameIdEd - 1
	if shouldResync1 {
		atomic.StoreInt32(&(player.BattleState), PlayerBattleStateIns.ACTIVE)
	}
}

func (pR *Room) cloneInputsBuffer(stFrameId, edFrameId int32) []*pb.InputFrameDownsync {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	cloned := make([]*pb.InputFrameDownsync, 0, edFrameId-stFrameId)
	prevFrameFound := false
	j := stFrameId
	for j < edFrameId {
		tmp := pR.InputsBuffer.GetByFrameId(j)
		if nil == tmp {
			if false == prevFrameFound {
				j++
				continue // allowed to keep not finding the requested inputFrames at the beginning
			} else {
				break // The "id"s are always consecutive
			}
		}
		prevFrameFound = true
		foo := tmp.(*battle.InputFrameDownsync)

		bar := &pb.InputFrameDownsync{
			InputFrameId:  foo.InputFrameId,
			InputList:     make([]uint64, len(foo.InputList)),
			ConfirmedList: foo.ConfirmedList,
		}
		for i, input := range foo.InputList {
			bar.InputList[i] = input
		}
		cloned = append(cloned, bar)
		j++
	}

	return cloned
}
