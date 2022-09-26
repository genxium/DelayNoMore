package models

import (
	"encoding/xml"
	"fmt"
	"github.com/ByteArena/box2d"
	"github.com/golang/protobuf/proto"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	. "server/common"
	"server/common/utils"
	pb "server/pb_output"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	UPSYNC_MSG_ACT_HB_PING             = int32(1)
	UPSYNC_MSG_ACT_PLAYER_CMD          = int32(2)
	UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK = int32(3)

	DOWNSYNC_MSG_ACT_HB_REQ      = int32(1)
	DOWNSYNC_MSG_ACT_INPUT_BATCH = int32(2)
	DOWNSYNC_MSG_ACT_ROOM_FRAME  = int32(3)
)

const (
	MAGIC_ROOM_DOWNSYNC_FRAME_ID_BATTLE_READY_TO_START    = -1
	MAGIC_ROOM_DOWNSYNC_FRAME_ID_BATTLE_START             = 0
	MAGIC_ROOM_DOWNSYNC_FRAME_ID_PLAYER_ADDED_AND_ACKED   = -98
	MAGIC_ROOM_DOWNSYNC_FRAME_ID_PLAYER_READDED_AND_ACKED = -97

	MAGIC_JOIN_INDEX_DEFAULT = 0
	MAGIC_JOIN_INDEX_INVALID = -1
)

const (
	// You can equivalently use the `GroupIndex` approach, but the more complicated and general purpose approach is used deliberately here. Reference http://www.aurelienribon.com/post/2011-07-box2d-tutorial-collision-filtering.
	COLLISION_CATEGORY_CONTROLLED_PLAYER = (1 << 1)
	COLLISION_CATEGORY_BARRIER           = (1 << 2)

	COLLISION_MASK_FOR_CONTROLLED_PLAYER = (COLLISION_CATEGORY_BARRIER)
	COLLISION_MASK_FOR_BARRIER           = (COLLISION_CATEGORY_CONTROLLED_PLAYER)
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

var DIRECTION_DECODER_INVERSE_LENGTH = []float32{
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
	Id       int32
	Capacity int
	Players  map[int32]*Player
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
	Tick                                   int32
	ServerFPS                              int32
	BattleDurationNanos                    int64
	EffectivePlayerCount                   int32
	DismissalWaitGroup                     sync.WaitGroup
	Barriers                               map[int32]*Barrier
	AccumulatedLocalIdForBullets           int32
	CollidableWorld                        *box2d.B2World
	AllPlayerInputsBuffer                  *RingBuffer
	RenderFrameBuffer                      *RingBuffer
	LastAllConfirmedInputFrameId           int32
	LastAllConfirmedInputFrameIdWithChange int32
	LastAllConfirmedInputList              []uint64
	InputDelayFrames                       int32
	InputScaleFrames                       uint32 // inputDelayedAndScaledFrameId = ((originalFrameId - InputDelayFrames) >> InputScaleFrames)
	JoinIndexBooleanArr                    []bool

	StageName                      string
	StageDiscreteW                 int32
	StageDiscreteH                 int32
	StageTileW                     int32
	StageTileH                     int32
	RawBattleStrToVec2DListMap     StrToVec2DListMap
	RawBattleStrToPolygon2DListMap StrToPolygon2DListMap
}

const (
	PLAYER_DEFAULT_SPEED = 200 // Hardcoded
	ADD_SPEED            = 100 // Hardcoded
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
	pPlayerFromDbInit.AckingFrameId = 0
	pPlayerFromDbInit.AckingInputFrameId = -1
	pPlayerFromDbInit.LastSentInputFrameId = -1
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
	pEffectiveInRoomPlayerInstance.AckingFrameId = 0
	pEffectiveInRoomPlayerInstance.AckingInputFrameId = -1
	pEffectiveInRoomPlayerInstance.LastSentInputFrameId = -1
	pEffectiveInRoomPlayerInstance.BattleState = PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK

	Logger.Warn("ReAddPlayerIfPossible finished.", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount), zap.Any("player AckingFrameId", pEffectiveInRoomPlayerInstance.AckingFrameId), zap.Any("player AckingInputFrameId", pEffectiveInRoomPlayerInstance.AckingInputFrameId))
	return true
}

func (pR *Room) ChooseStage() error {
	/*
	 * We use the verb "refresh" here to imply that upon invocation of this function, all colliders will be recovered if they were destroyed in the previous battle.
	 *
	 * -- YFLu, 2019-09-04
	 */
	pwd, err := os.Getwd()
	ErrFatal(err)

	rand.Seed(time.Now().Unix())
	stageNameList := []string{ /*"pacman" ,*/ "richsoil"}
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
	for _, polygon2D := range barrierPolygon2DList {
		/*
		   // For debug-printing only.
		   Logger.Info("ChooseStage printing polygon2D for barrierPolygon2DList", zap.Any("barrierLocalIdInBattle", barrierLocalIdInBattle), zap.Any("polygon2D.Anchor", polygon2D.Anchor), zap.Any("polygon2D.Points", polygon2D.Points))
		*/
		pR.Barriers[barrierLocalIdInBattle] = &Barrier{
			X:               polygon2D.Anchor.X,
			Y:               polygon2D.Anchor.Y,
			Boundary:        polygon2D,
		}

		barrierLocalIdInBattle++
	}

	return nil
}

func (pR *Room) ConvertToInputFrameId(originalFrameId int32, inputDelayFrames int32) int32 {
	if originalFrameId < inputDelayFrames {
		return 0
	}
	return ((originalFrameId - inputDelayFrames) >> pR.InputScaleFrames)
}

func (pR *Room) EncodeUpsyncCmd(upsyncCmd *pb.InputFrameUpsync) uint64 {
	var ret uint64 = 0
	// There're 13 possible directions, occupying the first 4 bits, no need to shift
	ret += uint64(upsyncCmd.EncodedDir)
	return ret
}

func (pR *Room) CanPopSt(refLowerInputFrameId int32) bool {
	rb := pR.AllPlayerInputsBuffer
	if rb.Cnt <= 0 {
		return false
	}
	if rb.StFrameId <= refLowerInputFrameId {
		// already delayed too much
		return true
	}

	return false
}

func (pR *Room) AllPlayerInputsBufferString() string {
	s := make([]string, 0)
	s = append(s, fmt.Sprintf("{lastAllConfirmedInputFrameId: %v, lastAllConfirmedInputFrameIdWithChange: %v}", pR.LastAllConfirmedInputFrameId, pR.LastAllConfirmedInputFrameIdWithChange))
	for playerId, player := range pR.Players {
		s = append(s, fmt.Sprintf("{playerId: %v, ackingFrameId: %v, ackingInputFrameId: %v, lastSentInputFrameId: %v}", playerId, player.AckingFrameId, player.AckingInputFrameId, player.LastSentInputFrameId))
	}
	for i := pR.AllPlayerInputsBuffer.StFrameId; i < pR.AllPlayerInputsBuffer.EdFrameId; i++ {
		tmp := pR.AllPlayerInputsBuffer.GetByFrameId(i)
		if nil == tmp {
			break
		}
		f := tmp.(*pb.InputFrameDownsync)
		s = append(s, fmt.Sprintf("{inputFrameId: %v, inputList: %v, confirmedList: %v}", f.InputFrameId, f.InputList, f.ConfirmedList))
	}

	return strings.Join(s, "\n")
}

func (pR *Room) StartBattle() {
	if RoomBattleStateIns.WAITING != pR.State {
		Logger.Warn("[StartBattle] Battle not started after all players' battle state checked!", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State))
		return
	}

	// Always instantiates a new channel and let the old one die out due to not being retained by any root reference.
	nanosPerFrame := 1000000000 / int64(pR.ServerFPS)
	pR.Tick = 0

	// Refresh "Colliders" for server-side contact listening of B2World.
	pR.refreshColliders()

	/**
	 * Will be triggered from a goroutine which executes the critical `Room.AddPlayerIfPossible`, thus the `battleMainLoop` should be detached.
	 * All of the consecutive stages, e.g. settlement, dismissal, should share the same goroutine with `battleMainLoop`.
	 */
	battleMainLoop := func() {
		defer func() {
			if r := recover(); r != nil {
				Logger.Error("battleMainLoop, recovery spot#1, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("panic", r))
			}
			Logger.Info("The `battleMainLoop` is stopped for:", zap.Any("roomId", pR.Id))
			pR.onBattleStoppedForSettlement()
		}()

		battleMainLoopStartedNanos := utils.UnixtimeNano()
		totalElapsedNanos := int64(0)

		Logger.Info("The `battleMainLoop` is started for:", zap.Any("roomId", pR.Id))
		for {
			if 0 == pR.Tick {
				// The legacy frontend code needs this "kickoffFrame" to remove the "ready to start 3-2-1" panel
				kickoffFrame := pb.RoomDownsyncFrame{
					Id:             pR.Tick,
					RefFrameId:     MAGIC_ROOM_DOWNSYNC_FRAME_ID_BATTLE_START,
					Players:        toPbPlayers(pR.Players),
					SentAt:         utils.UnixtimeMilli(),
					CountdownNanos: (pR.BattleDurationNanos - totalElapsedNanos),
				}
				for playerId, player := range pR.Players {
					if swapped := atomic.CompareAndSwapInt32(&player.BattleState, PlayerBattleStateIns.ACTIVE, PlayerBattleStateIns.ACTIVE); !swapped {
						/*
						   [WARNING] DON'T send anything into "DedicatedForwardingChanForPlayer" if the player is disconnected, because it could jam the channel and cause significant delay upon "battle recovery for reconnected player".
						*/
						continue
					}
					pR.sendSafely(kickoffFrame, playerId)
				}
			}

			if totalElapsedNanos > pR.BattleDurationNanos {
				Logger.Info(fmt.Sprintf("The `battleMainLoop` is stopped:\n%v", pR.AllPlayerInputsBufferString()))
				pR.StopBattleForSettlement()
			}

			if swapped := atomic.CompareAndSwapInt32(&pR.State, RoomBattleStateIns.IN_BATTLE, RoomBattleStateIns.IN_BATTLE); !swapped {
				return
			}
			stCalculation := utils.UnixtimeNano()

            // TODO: Force confirm some non-all-confirmed but outdated input frames, derive server-sider RenderFrameBuffer elements from them, and send to respective players with "RoomDownsyncFrame.refFrameId=MAGIC_ROOM_DOWNSYNC_FRAME_ID_PLAYER_READDED_AND_ACKED"  

			refInputFrameId := int32(999999999) // Hardcoded as a max reference.
			for playerId, _ := range pR.Players {
				thatId := atomic.LoadInt32(&(pR.Players[playerId].AckingInputFrameId))
				if thatId > refInputFrameId {
					continue
				}
				refInputFrameId = thatId
			}

			for pR.CanPopSt(refInputFrameId) {
				// _ = pR.AllPlayerInputsBuffer.Pop()
				f := pR.AllPlayerInputsBuffer.Pop().(*pb.InputFrameDownsync)
				if pR.inputFrameIdDebuggable(f.InputFrameId) {
					// Popping of an "inputFrame" would be AFTER its being all being confirmed, because it requires the "inputFrame" to be all acked
					Logger.Info("inputFrame lifecycle#5[popped]:", zap.Any("roomId", pR.Id), zap.Any("refInputFrameId", refInputFrameId), zap.Any("inputFrameId", f.InputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
				}
			}

			lastAllConfirmedInputFrameIdWithChange := atomic.LoadInt32(&(pR.LastAllConfirmedInputFrameIdWithChange))
			for playerId, player := range pR.Players {
				if swapped := atomic.CompareAndSwapInt32(&player.BattleState, PlayerBattleStateIns.ACTIVE, PlayerBattleStateIns.ACTIVE); !swapped {
					/*
					   [WARNING] DON'T send anything into "DedicatedForwardingChanForPlayer" if the player is disconnected, because it could jam the channel and cause significant delay upon "battle recovery for reconnected player".
					*/
					continue
				}

				toSendInputFrames := make([]*pb.InputFrameDownsync, 0, pR.AllPlayerInputsBuffer.Cnt)
				// [WARNING] Websocket is TCP-based, thus no need to re-send a previously sent inputFrame to a same player!
				anchorInputFrameId := atomic.LoadInt32(&(pR.Players[playerId].LastSentInputFrameId))
				candidateToSendInputFrameId := anchorInputFrameId + 1

				// [WARNING] EDGE CASE HERE: Upon initialization, all of "lastAllConfirmedInputFrameId", "lastAllConfirmedInputFrameIdWithChange" and "anchorInputFrameId" are "-1", thus "candidateToSendInputFrameId" starts with "0", however "inputFrameId: 0" might not have been all confirmed!
				debugSendingInputFrameId := int32(-1)

				for candidateToSendInputFrameId <= lastAllConfirmedInputFrameIdWithChange {
					tmp := pR.AllPlayerInputsBuffer.GetByFrameId(candidateToSendInputFrameId)
					if nil == tmp {
						break
					}
					f := tmp.(*pb.InputFrameDownsync)
					if pR.inputFrameIdDebuggable(candidateToSendInputFrameId) {
						debugSendingInputFrameId = candidateToSendInputFrameId
						Logger.Info("inputFrame lifecycle#3[sending]:", zap.Any("roomId", pR.Id), zap.Any("refInputFrameId", refInputFrameId), zap.Any("playerId", playerId), zap.Any("playerAnchorInputFrameId", anchorInputFrameId), zap.Any("playerAckingInputFrameId", player.AckingInputFrameId), zap.Any("inputFrameId", candidateToSendInputFrameId), zap.Any("inputFrameId-doublecheck", f.InputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId), zap.Any("ConfirmedList", f.ConfirmedList))
					}
					toSendInputFrames = append(toSendInputFrames, f)
					candidateToSendInputFrameId++
				}

				if 0 >= len(toSendInputFrames) {
					continue
				}

				pR.sendSafely(toSendInputFrames, playerId)
				atomic.StoreInt32(&(pR.Players[playerId].LastSentInputFrameId), candidateToSendInputFrameId-1)
				if -1 != debugSendingInputFrameId {
					Logger.Info("inputFrame lifecycle#4[sent]:", zap.Any("roomId", pR.Id), zap.Any("refInputFrameId", refInputFrameId), zap.Any("playerId", playerId), zap.Any("playerAckingInputFrameId", player.AckingInputFrameId), zap.Any("inputFrameId", debugSendingInputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
				}
			}

			pR.Tick++
			now := utils.UnixtimeNano()
			elapsedInCalculation := now - stCalculation
			totalElapsedNanos = (now - battleMainLoopStartedNanos)
			// Logger.Info("Elapsed time statistics:", zap.Any("roomId", pR.Id), zap.Any("elapsedInCalculation", elapsedInCalculation), zap.Any("totalElapsedNanos", totalElapsedNanos))
			time.Sleep(time.Duration(nanosPerFrame - elapsedInCalculation))
		}
	}

	pR.onBattlePrepare(func() {
		pR.onBattleStarted() // NOTE: Deliberately not using `defer`.
		go battleMainLoop()
	})
}

func (pR *Room) OnBattleCmdReceived(pReq *pb.WsReq) {
	if swapped := atomic.CompareAndSwapInt32(&pR.State, RoomBattleStateIns.IN_BATTLE, RoomBattleStateIns.IN_BATTLE); !swapped {
		return
	}

	playerId := pReq.PlayerId
	indiceInJoinIndexBooleanArr := uint32(pReq.JoinIndex - 1)
	inputFrameUpsyncBatch := pReq.InputFrameUpsyncBatch
	ackingFrameId := pReq.AckingFrameId
	ackingInputFrameId := pReq.AckingInputFrameId

	for _, inputFrameUpsync := range inputFrameUpsyncBatch {
		if _, existent := pR.Players[playerId]; !existent {
			Logger.Warn("upcmd player doesn't exist:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId))
			return
		}

		if swapped := atomic.CompareAndSwapInt32(&(pR.Players[playerId].AckingFrameId), pR.Players[playerId].AckingFrameId, ackingFrameId); !swapped {
			panic(fmt.Sprintf("Failed to update AckingFrameId to %v for roomId=%v, playerId=%v", ackingFrameId, pR.Id, playerId))
		}

		if swapped := atomic.CompareAndSwapInt32(&(pR.Players[playerId].AckingInputFrameId), pR.Players[playerId].AckingInputFrameId, ackingInputFrameId); !swapped {
			panic(fmt.Sprintf("Failed to update AckingInputFrameId to %v for roomId=%v, playerId=%v", ackingInputFrameId, pR.Id, playerId))
		}
		clientInputFrameId := inputFrameUpsync.InputFrameId
		if clientInputFrameId < pR.AllPlayerInputsBuffer.StFrameId {
			Logger.Warn("Obsolete inputFrameUpsync:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("clientInputFrameId", clientInputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
			return
		}

		var joinMask uint64 = (1 << indiceInJoinIndexBooleanArr)
		encodedInput := pR.EncodeUpsyncCmd(inputFrameUpsync)

		if clientInputFrameId >= pR.AllPlayerInputsBuffer.EdFrameId {
			// The outer-if branching is for reducing an extra get-and-set operation, which is now placed in the else-branch.
			for clientInputFrameId >= pR.AllPlayerInputsBuffer.EdFrameId {
				newInputList := make([]uint64, len(pR.Players))
				newInputList[indiceInJoinIndexBooleanArr] = encodedInput
				pR.AllPlayerInputsBuffer.Put(&pb.InputFrameDownsync{
					InputFrameId:  pR.AllPlayerInputsBuffer.EdFrameId,
					InputList:     newInputList,
					ConfirmedList: joinMask, // by now only the current player has confirmed this input frame
				})
				if pR.inputFrameIdDebuggable(clientInputFrameId) {
					Logger.Info("inputFrame lifecycle#1[inserted]", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("inputFrameId", clientInputFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
				}
			}
		} else {
			tmp2 := pR.AllPlayerInputsBuffer.GetByFrameId(clientInputFrameId)
			if nil == tmp2 {
				// This shouldn't happen due to the previous 2 checks
				Logger.Warn("Mysterious error getting an input frame:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("clientInputFrameId", clientInputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
				return
			}
			inputFrameDownsync := tmp2.(*pb.InputFrameDownsync)
			oldConfirmedList := inputFrameDownsync.ConfirmedList
			if (oldConfirmedList & joinMask) > 0 {
				Logger.Warn("Cmd already confirmed but getting set attempt:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("clientInputFrameId", clientInputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
				return
			}

			// In Golang 1.12, there's no "compare-and-swap primitive" on a custom struct (or it's pointer, unless it's an unsafe pointer https://pkg.go.dev/sync/atomic@go1.12#CompareAndSwapPointer). Although CAS on custom struct is possible in Golang 1.19 https://pkg.go.dev/sync/atomic@go1.19.1#Value.CompareAndSwap, using a single word is still faster whenever possible.
			if swapped := atomic.CompareAndSwapUint64(&inputFrameDownsync.InputList[indiceInJoinIndexBooleanArr], uint64(0), encodedInput); !swapped {
				if encodedInput > 0 {
					Logger.Warn("Failed input CAS:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("clientInputFrameId", clientInputFrameId))
				}
				return
			}

			newConfirmedList := (oldConfirmedList | joinMask)
			if swapped := atomic.CompareAndSwapUint64(&(inputFrameDownsync.ConfirmedList), oldConfirmedList, newConfirmedList); !swapped {
				if encodedInput > 0 {
					Logger.Warn("Failed confirm CAS:", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("clientInputFrameId", clientInputFrameId))
				}
				return
			}

			totPlayerCnt := uint32(len(pR.Players))
			allConfirmedMask := uint64((1 << totPlayerCnt) - 1) // TODO: What if a player is disconnected backthen?
			if allConfirmedMask == newConfirmedList {
				if false == pR.equalInputLists(inputFrameDownsync.InputList, pR.LastAllConfirmedInputList) {
					atomic.StoreInt32(&(pR.LastAllConfirmedInputFrameIdWithChange), clientInputFrameId) // [WARNING] Different from the CAS in "battleMainLoop", it's safe to just update "pR.LastAllConfirmedInputFrameIdWithChange" here, because only monotonic increment is possible here!
					Logger.Info("Key inputFrame change", zap.Any("roomId", pR.Id), zap.Any("inputFrameId", clientInputFrameId), zap.Any("lastInputFrameId", pR.LastAllConfirmedInputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId), zap.Any("newInputList", inputFrameDownsync.InputList), zap.Any("lastInputList", pR.LastAllConfirmedInputList))
				}
				atomic.StoreInt32(&(pR.LastAllConfirmedInputFrameId), clientInputFrameId) // [WARNING] It's IMPORTANT that "pR.LastAllConfirmedInputFrameId" is NOT NECESSARILY CONSECUTIVE, i.e. if one of the players disconnects and reconnects within a considerable amount of frame delays!
				for i, v := range inputFrameDownsync.InputList {
					// To avoid potential misuse of pointers
					pR.LastAllConfirmedInputList[i] = v
				}
				if pR.inputFrameIdDebuggable(clientInputFrameId) {
					Logger.Info("inputFrame lifecycle#2[allconfirmed]", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("inputFrameId", clientInputFrameId), zap.Any("StFrameId", pR.AllPlayerInputsBuffer.StFrameId), zap.Any("EdFrameId", pR.AllPlayerInputsBuffer.EdFrameId))
				}
			}
		}
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
	pR.Tick++
	for playerId, _ := range pR.Players {
		assembledFrame := pb.RoomDownsyncFrame{
			Id:             pR.Tick,
			RefFrameId:     pR.Tick, // Hardcoded for now.
			Players:        toPbPlayers(pR.Players),
			SentAt:         utils.UnixtimeMilli(),
			CountdownNanos: -1, // TODO: Replace this magic constant!
		}
		pR.sendSafely(assembledFrame, playerId)
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

	battleReadyToStartFrame := pb.RoomDownsyncFrame{
		Id:             pR.Tick,
		Players:        toPbPlayers(pR.Players),
		SentAt:         utils.UnixtimeMilli(),
		RefFrameId:     MAGIC_ROOM_DOWNSYNC_FRAME_ID_BATTLE_READY_TO_START,
		PlayerMetas:    playerMetas,
		CountdownNanos: pR.BattleDurationNanos,
	}

	Logger.Info("Sending out frame for RoomBattleState.PREPARE ", zap.Any("battleReadyToStartFrame", battleReadyToStartFrame))
	for _, player := range pR.Players {
		pR.sendSafely(battleReadyToStartFrame, player.Id)
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
	pR.onDismissed()
}

func (pR *Room) onDismissed() {

	// Always instantiates new HeapRAM blocks and let the old blocks die out due to not being retained by any root reference.
	pR.Players = make(map[int32]*Player)
	pR.PlayerDownsyncSessionDict = make(map[int32]*websocket.Conn)
	pR.PlayerSignalToCloseDict = make(map[int32]SignalToCloseConnCbType)

	pR.LastAllConfirmedInputFrameId = -1
	pR.LastAllConfirmedInputFrameIdWithChange = -1
	pR.LastAllConfirmedInputList = make([]uint64, pR.Capacity)

	for indice, _ := range pR.JoinIndexBooleanArr {
		pR.JoinIndexBooleanArr[indice] = false
	}
	pR.AllPlayerInputsBuffer = NewRingBuffer(1024)
	pR.RenderFrameBuffer = NewRingBuffer(1024)

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
	pPlayer, ok := pR.Players[playerId]
	if false == ok {
		return false
	}

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

	var playerAckedFrame pb.RoomDownsyncFrame

	switch pPlayer.BattleState {
	case PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK:
		playerAckedFrame = pb.RoomDownsyncFrame{
			Id:          pR.Tick,
			Players:     toPbPlayers(pR.Players),
			SentAt:      utils.UnixtimeMilli(),
			RefFrameId:  MAGIC_ROOM_DOWNSYNC_FRAME_ID_PLAYER_ADDED_AND_ACKED,
			PlayerMetas: playerMetas,
		}
	case PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
		playerAckedFrame = pb.RoomDownsyncFrame{
			Id:          pR.Tick,
			Players:     toPbPlayers(pR.Players),
			SentAt:      utils.UnixtimeMilli(),
			RefFrameId:  MAGIC_ROOM_DOWNSYNC_FRAME_ID_PLAYER_READDED_AND_ACKED,
			PlayerMetas: playerMetas,
		}
	default:
	}

	for _, player := range pR.Players {
		/*
		   [WARNING]
		   This `playerAckedFrame` is the first ever "RoomDownsyncFrame" for every "PersistentSessionClient on the frontend", and it goes right after each "BattleColliderInfo".

		   By making use of the sequential nature of each ws session, all later "RoomDownsyncFrame"s generated after `pRoom.StartBattle()` will be put behind this `playerAckedFrame`.
		*/
		pR.sendSafely(playerAckedFrame, player.Id)
	}

	pPlayer.BattleState = PlayerBattleStateIns.ACTIVE
	Logger.Info("OnPlayerBattleColliderAcked", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("playerId", playerId), zap.Any("capacity", pR.Capacity), zap.Any("len(players)", len(pR.Players)))

	if pR.Capacity == len(pR.Players) {
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

func (pR *Room) sendSafely(s interface{}, playerId int32) {
	defer func() {
		if r := recover(); r != nil {
			pR.PlayerSignalToCloseDict[playerId](Constants.RetCode.UnknownError, fmt.Sprintf("%v", r))
		}
	}()

	var resp *pb.WsResp = nil

	switch v := s.(type) {
	case pb.RoomDownsyncFrame:
		roomDownsyncFrame := s.(pb.RoomDownsyncFrame)
		resp = &pb.WsResp{
			Ret:         int32(Constants.RetCode.Ok),
			EchoedMsgId: int32(0),
			Act:         DOWNSYNC_MSG_ACT_ROOM_FRAME,
			Rdf:         &roomDownsyncFrame,
		}
	case []*pb.InputFrameDownsync:
		toSendFrames := s.([]*pb.InputFrameDownsync)
		resp = &pb.WsResp{
			Ret:                     int32(Constants.RetCode.Ok),
			EchoedMsgId:             int32(0),
			Act:                     DOWNSYNC_MSG_ACT_INPUT_BATCH,
			InputFrameDownsyncBatch: toSendFrames,
		}
	default:
		panic(fmt.Sprintf("Unknown downsync message type, roomId=%v, playerId=%v, roomState=%v, v=%v", pR.Id, playerId, v))
	}

	theBytes, marshalErr := proto.Marshal(resp)
	if nil != marshalErr {
		panic(fmt.Sprintf("Error marshaling downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
	}

	if err := pR.PlayerDownsyncSessionDict[playerId].WriteMessage(websocket.BinaryMessage, theBytes); nil != err {
		panic(fmt.Sprintf("Error sending downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
	}
}

func (pR *Room) inputFrameIdDebuggable(inputFrameId int32) bool {
	return 0 == (inputFrameId % 10)
}

func (pR *Room) refreshColliders() {
	gravity := box2d.MakeB2Vec2(0.0, 0.0)
	world := box2d.MakeB2World(gravity)
	world.SetContactFilter(&box2d.B2ContactFilter{})
	pR.CollidableWorld = &world

	Logger.Info("Begins players collider processing:", zap.Any("roomId", pR.Id))
	for _, player := range pR.Players {
		var bdDef box2d.B2BodyDef
		colliderOffset := box2d.MakeB2Vec2(0, 0) // Matching that of client-side setting.
		bdDef = box2d.MakeB2BodyDef()
		bdDef.Type = box2d.B2BodyType.B2_dynamicBody
		bdDef.Position.Set(player.X+colliderOffset.X, player.Y+colliderOffset.Y)

		b2Body := pR.CollidableWorld.CreateBody(&bdDef)

		b2CircleShape := box2d.MakeB2CircleShape()
		b2CircleShape.M_radius = 32 // Matching that of client-side setting.

		fd := box2d.MakeB2FixtureDef()
		fd.Shape = &b2CircleShape
		fd.Filter.CategoryBits = COLLISION_CATEGORY_CONTROLLED_PLAYER
		fd.Filter.MaskBits = COLLISION_MASK_FOR_CONTROLLED_PLAYER
		fd.Density = 0.0
		b2Body.CreateFixtureFromDef(&fd)

		player.CollidableBody = b2Body
		b2Body.SetUserData(player)
	}
	Logger.Info("Ends players collider processing:", zap.Any("roomId", pR.Id))

	Logger.Info("Begins barriers collider processing:", zap.Any("roomId", pR.Id))
	for _, barrier := range pR.Barriers {
		var bdDef box2d.B2BodyDef
		bdDef.Type = box2d.B2BodyType.B2_dynamicBody
		bdDef = box2d.MakeB2BodyDef()
		bdDef.Position.Set(barrier.Boundary.Anchor.X, barrier.Boundary.Anchor.Y)

		b2Body := pR.CollidableWorld.CreateBody(&bdDef)

		pointsCount := len(barrier.Boundary.Points)

		b2Vertices := make([]box2d.B2Vec2, pointsCount)
		for vIndex, v2 := range barrier.Boundary.Points {
			b2Vertices[vIndex] = v2.ToB2Vec2()
		}

		b2PolygonShape := box2d.MakeB2PolygonShape()
		b2PolygonShape.Set(b2Vertices, pointsCount)

		fd := box2d.MakeB2FixtureDef()
		fd.Shape = &b2PolygonShape
		fd.Filter.CategoryBits = COLLISION_CATEGORY_BARRIER
		fd.Filter.MaskBits = COLLISION_MASK_FOR_BARRIER
		fd.Density = 0.0
		b2Body.CreateFixtureFromDef(&fd)

		barrier.CollidableBody = b2Body
		b2Body.SetUserData(barrier)
	}
	Logger.Info("Ends barriers collider processing:", zap.Any("roomId", pR.Id))

	listener := RoomBattleContactListener{
		name: "DelayNoMore",
		room: pR,
	}
	/*
	 * Setting a "ContactListener" for "pR.CollidableWorld"
	 * will only trigger corresponding callbacks in the
	 * SAME GOROUTINE of "pR.CollidableWorld.Step(...)" according
	 * to "https://github.com/ByteArena/box2d/blob/master/DynamicsB2World.go" and
	 * "https://github.com/ByteArena/box2d/blob/master/DynamicsB2Contact.go".
	 *
	 * The invocation-chain involves "Step -> SolveTOI -> B2ContactUpdate -> [BeginContact, EndContact, PreSolve]".
	 */
	pR.CollidableWorld.SetContactListener(listener)
}

type RoomBattleContactListener struct {
	name string
	room *Room
}

// Implementing the GolangBox2d contact listeners [begins].
/**
 * Note that the execution of these listeners is within the SAME GOROUTINE as that of "`battleMainLoop` in the same room".
 * See the comments in `Room.refreshColliders()` for details.
 */
func (l RoomBattleContactListener) BeginContact(contact box2d.B2ContactInterface) {
	var pBarrier *Barrier
	var pPlayer *Player

	switch v := contact.GetNodeA().Other.GetUserData().(type) {
	case *Barrier:
		pBarrier = v
	case *Player:
		pPlayer = v
	default:
		//
	}

	switch v := contact.GetNodeB().Other.GetUserData().(type) {
	case *Barrier:
		pBarrier = v
	case *Player:
		pPlayer = v
	default:
	}

	if pBarrier != nil && pPlayer != nil {
   	    Logger.Info("player begins collision with barrier:", zap.Any("barrier", pBarrier), zap.Any("player", pPlayer))
        // TODO: Push back player
	}
}

func (l RoomBattleContactListener) EndContact(contact box2d.B2ContactInterface) {
	var pBarrier *Barrier
	var pPlayer *Player

	switch v := contact.GetNodeA().Other.GetUserData().(type) {
	case *Barrier:
		pBarrier = v
	case *Player:
		pPlayer = v
	default:
	}

	switch v := contact.GetNodeB().Other.GetUserData().(type) {
	case *Barrier:
		pBarrier = v
	case *Player:
		pPlayer = v
	default:
	}

	if pBarrier != nil && pPlayer != nil {
   	    Logger.Info("player ends collision with barrier:", zap.Any("barrier", pBarrier), zap.Any("player", pPlayer))
	}
}

func (l RoomBattleContactListener) PreSolve(contact box2d.B2ContactInterface, oldManifold box2d.B2Manifold) {
	//fmt.Printf("I am PreSolve %s\n", l.name);
}

func (l RoomBattleContactListener) PostSolve(contact box2d.B2ContactInterface, impulse *box2d.B2ContactImpulse) {
	//fmt.Printf("PostSolve %s\n", l.name);
}

// Implementing the GolangBox2d contact listeners [ends].
