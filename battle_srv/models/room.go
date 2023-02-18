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
	"net"
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

	DOWNSYNC_MSG_ACT_HB_REQ           = int32(1)
	DOWNSYNC_MSG_ACT_INPUT_BATCH      = int32(2)
	DOWNSYNC_MSG_ACT_BATTLE_STOPPED   = int32(3)
	DOWNSYNC_MSG_ACT_FORCED_RESYNC    = int32(4)
	DOWNSYNC_MSG_ACT_PEER_INPUT_BATCH = int32(5)
	DOWNSYNC_MSG_ACT_PEER_UDP_ADDR    = int32(6)

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
	DEFAULT_PLAYER_RADIUS = int32(float64(12) * battle.WORLD_TO_VIRTUAL_GRID_RATIO)
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
	Id                   int32
	Capacity             int
	BattleDurationFrames int32
	NstDelayFrames       int32
	Players              map[int32]*Player
	PlayersArr           []*Player                 // ordered by joinIndex
	SpeciesIdList        []int32                   // ordered by joinIndex
	CharacterConfigsArr  []*battle.CharacterConfig // ordered by joinIndex
	Space                *resolv.Space
	CollisionSysMap      map[int32]*resolv.Object
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
	PlayerDownsyncSessionDict map[int32]*websocket.Conn
	PlayerSignalToCloseDict   map[int32]SignalToCloseConnCbType
	PlayerDownsyncChanDict    map[int32](chan pb.InputsBufferSnapshot)

	PlayerSecondaryDownsyncSessionDict map[int32]*websocket.Conn
	PlayerSecondarySignalToCloseDict   map[int32]SignalToCloseConnCbType
	PlayerSecondaryDownsyncChanDict    map[int32](chan pb.InputsBufferSnapshot)

	PlayerActiveWatchdogDict               map[int32](*Watchdog)
	Score                                  float32
	State                                  int32
	Index                                  int
	RenderFrameId                          int32
	CurDynamicsRenderFrameId               int32 // [WARNING] The dynamics of backend is ALWAYS MOVING FORWARD BY ALL-CONFIRMED INPUTFRAMES (either by upsync or forced), i.e. no rollback; Moreover when "true == BackendDynamicsEnabled" we always have "Room.CurDynamicsRenderFrameId >= Room.RenderFrameId" because each "all-confirmed inputFrame" is applied on "all applicable renderFrames" in one-go hence often sees a future "renderFrame" earlier
	EffectivePlayerCount                   int32
	DismissalWaitGroup                     sync.WaitGroup
	InputsBuffer                           *resolv.RingBuffer // Indices are STRICTLY consecutive
	InputsBufferLock                       sync.Mutex         // Guards [InputsBuffer, LatestPlayerUpsyncedInputFrameId, LastAllConfirmedInputFrameId, LastAllConfirmedInputList, LastAllConfirmedInputFrameIdWithChange, LastIndividuallyConfirmedInputList, player.LastReceivedInputFrameId, player.LastUdpReceivedInputFrameId]
	RenderFrameBuffer                      *resolv.RingBuffer // Indices are STRICTLY consecutive
	LatestPlayerUpsyncedInputFrameId       int32
	LastAllConfirmedInputFrameId           int32
	LastAllConfirmedInputFrameIdWithChange int32
	LastAllConfirmedInputList              []uint64
	JoinIndexBooleanArr                    []bool

	BackendDynamicsEnabled              bool
	ForceAllResyncOnAnyActiveSlowTicker bool
	LastRenderFrameIdTriggeredAt        int64

	BulletBattleLocalIdCounter      int32
	dilutedRollbackEstimatedDtNanos int64

	pb.BattleColliderInfo // Compositing to send centralized magic numbers

	TmxPointsMap   StrToVec2DListMap
	TmxPolygonsMap StrToPolygon2DListMap

	rdfIdToActuallyUsedInput           map[int32]*pb.InputFrameDownsync
	LastIndividuallyConfirmedInputList []uint64

	BattleUdpTunnelLock sync.Mutex
	BattleUdpTunnelAddr *pb.PeerUdpAddr
	BattleUdpTunnel     *net.UDPConn

	collisionHolder           *resolv.Collision
	effPushbacks              []*battle.Vec2D
	hardPushbackNormsArr      [][]*battle.Vec2D
	jumpedOrNotList           []bool
	dynamicRectangleColliders []*resolv.Object
}

func (pR *Room) updateScore() {
	pR.Score = calRoomScore(pR.EffectivePlayerCount, pR.Capacity, pR.State)
}

func (pR *Room) AddPlayerIfPossible(pPlayerFromDbInit *Player, speciesId int, session *websocket.Conn, signalToCloseConnOfThisPlayer SignalToCloseConnCbType) bool {
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

	defer pR.onPlayerAdded(playerId, speciesId)

	pPlayerFromDbInit.UdpAddr = nil
	pPlayerFromDbInit.BattleUdpTunnelAddr = nil
	pPlayerFromDbInit.BattleUdpTunnelAuthKey = rand.Int31()
	pPlayerFromDbInit.AckingFrameId = -1
	pPlayerFromDbInit.AckingInputFrameId = -1
	pPlayerFromDbInit.LastSentInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_NORMAL_ADDED
	pPlayerFromDbInit.LastReceivedInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_NORMAL_ADDED
	pPlayerFromDbInit.LastUdpReceivedInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_NORMAL_ADDED
	pPlayerFromDbInit.BattleState = PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK

	pPlayerFromDbInit.ColliderRadius = DEFAULT_PLAYER_RADIUS // Hardcoded
	pPlayerFromDbInit.InAir = true                           // Hardcoded

	pR.Players[playerId] = pPlayerFromDbInit
	pR.PlayerDownsyncSessionDict[playerId] = session
	pR.PlayerSignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
	newWatchdog := NewWatchdog(ConstVals.Ws.WillKickIfInactiveFor, func() {
		Logger.Warn("Conn inactive watchdog triggered#1:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		pR.signalToCloseAllSessionsOfPlayer(playerId, Constants.RetCode.ActiveWatchdog)
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
	pEffectiveInRoomPlayerInstance.UdpAddr = nil
	pEffectiveInRoomPlayerInstance.BattleUdpTunnelAddr = nil
	pEffectiveInRoomPlayerInstance.BattleUdpTunnelAuthKey = rand.Int31()
	pEffectiveInRoomPlayerInstance.AckingFrameId = -1
	pEffectiveInRoomPlayerInstance.AckingInputFrameId = -1
	pEffectiveInRoomPlayerInstance.LastSentInputFrameId = MAGIC_LAST_SENT_INPUT_FRAME_ID_READDED
	// [WARNING] DON'T reset "player.LastReceivedInputFrameId" & "player.LastUdpReceivedInputFrameId" upon reconnection!
	pEffectiveInRoomPlayerInstance.BattleState = PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK

	pEffectiveInRoomPlayerInstance.ColliderRadius = DEFAULT_PLAYER_RADIUS // Hardcoded
	pEffectiveInRoomPlayerInstance.InAir = true                           // Hardcoded

	pR.PlayerDownsyncSessionDict[playerId] = session
	pR.PlayerSignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
	pR.PlayerActiveWatchdogDict[playerId] = NewWatchdog(ConstVals.Ws.WillKickIfInactiveFor, func() {
		Logger.Warn("Conn inactive watchdog triggered#2:", zap.Any("playerId", playerId), zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("roomEffectivePlayerCount", pR.EffectivePlayerCount))
		pR.signalToCloseAllSessionsOfPlayer(playerId, Constants.RetCode.ActiveWatchdog)
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

	pR.SpaceOffsetX = float64((stageDiscreteW * stageTileW) >> 1)
	pR.SpaceOffsetY = float64((stageDiscreteH * stageTileH) >> 1)
	pR.TmxPointsMap = strToVec2DListMap
	pR.TmxPolygonsMap = strToPolygon2DListMap

	return nil
}

func (pR *Room) RenderFrameBufferString() string {
	return fmt.Sprintf("{renderFrameId: %d, stRenderFrameId: %d, edRenderFrameId: %d, curDynamicsRenderFrameId: %d}", pR.RenderFrameId, pR.RenderFrameBuffer.StFrameId, pR.RenderFrameBuffer.EdFrameId, pR.CurDynamicsRenderFrameId)
}

func (pR *Room) InputsBufferString(allDetails bool) string {
	if allDetails {
		// Appending of the array of strings can be very SLOW due to on-demand heap allocation! Use this printing with caution.
		s := make([]string, 0)
		s = append(s, fmt.Sprintf("{renderFrameId: %v, stInputFrameId: %v, edInputFrameId: %v, lastAllConfirmedInputFrameIdWithChange: %v, lastAllConfirmedInputFrameId: %v}", pR.RenderFrameId, pR.InputsBuffer.StFrameId, pR.InputsBuffer.EdFrameId, pR.LastAllConfirmedInputFrameIdWithChange, pR.LastAllConfirmedInputFrameId))
		for _, player := range pR.PlayersArr {
			s = append(s, fmt.Sprintf("{playerId: %v, ackingFrameId: %v, ackingInputFrameId: %v, lastSentInputFrameId: %v}", player.Id, player.AckingFrameId, player.AckingInputFrameId, player.LastSentInputFrameId))
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
	onWallInt := 0
	if player.OnWall {
		onWallInt = 1
	}
	s := fmt.Sprintf("{%d,%d,%d,%d,%d,%d,%d,%d}", player.JoinIndex, player.VirtualGridX, player.VirtualGridY, player.VelX, player.VelY, player.FramesToRecover, inAirInt, onWallInt)

	return s
}

func (pR *Room) fireballDownsyncStr(fireball *battle.FireballBullet) string {
	if nil == fireball {
		return ""
	}
	s := fmt.Sprintf("{%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d}", fireball.BattleAttr.BulletLocalId, fireball.BattleAttr.OriginatedRenderFrameId, fireball.BattleAttr.OffenderJoinIndex, fireball.VirtualGridX, fireball.VirtualGridY, fireball.VelX, fireball.VelY, fireball.DirX, fireball.DirY, fireball.Bullet.HitboxSizeX, fireball.Bullet.HitboxSizeY)

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
		fireballsStrBldr := make([]string, 0, len(rdf.FireballBullets))
		for _, fireball := range rdf.FireballBullets {
			fireballsStrBldr = append(fireballsStrBldr, pR.fireballDownsyncStr(fireball))
		}
		s = append(s, fmt.Sprintf("rdfId:%d\nplayers:[%v]\nfireballs:[%v]\nactuallyUsedinputList:{%v}", rdfId, strings.Join(playersStrBldr, ","), strings.Join(fireballsStrBldr, ","), pR.inputFrameDownsyncStr(pR.rdfIdToActuallyUsedInput[rdfId])))
	}

	return strings.Join(s, "\n")
}

func (pR *Room) StartBattle() {
	if RoomBattleStateIns.WAITING != pR.State {
		Logger.Debug("[StartBattle] Battle not started due to not being WAITING!", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State))
		return
	}

	pR.RenderFrameId = 0

	Logger.Info("[StartBattle] ", zap.Any("roomId", pR.Id), zap.Any("roomState", pR.State), zap.Any("SpeciesIdList", pR.SpeciesIdList))

	// Initialize the "collisionSys" as well as "RenderFrameBuffer"
	pR.CurDynamicsRenderFrameId = 0
	kickoffFrameJs := &battle.RoomDownsyncFrame{
		Id:             pR.RenderFrameId,
		PlayersArr:     toJsPlayers(pR.Players),
		CountdownNanos: pR.BattleDurationNanos,
	}
	pR.RenderFrameBuffer.Put(kickoffFrameJs)

	// Refresh "Colliders"
	pR.refreshColliders()

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
			Logger.Info(fmt.Sprintf("The `battleMainLoop` for roomId=%v is stopped@renderFrameId=%v:\n%v", pR.Id, pR.RenderFrameId, pR.InputsBufferString(false))) // This takes sometime to print
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
						pbKickOffRenderFrame := toPbRoomDownsyncFrame(kickoffFrameJs)
						pbKickOffRenderFrame.SpeciesIdList = pR.SpeciesIdList
						pR.sendSafely(pbKickOffRenderFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_START, playerId, true, MAGIC_JOIN_INDEX_DEFAULT)
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

	downsyncLoop := func(playerId int32, player *Player, playerDownsyncChan chan pb.InputsBufferSnapshot, playerSecondaryDownsyncChan chan pb.InputsBufferSnapshot) {
		defer func() {
			if r := recover(); r != nil {
				Logger.Error("downsyncLoop, recovery spot#1, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("panic", r))
			}
			Logger.Info(fmt.Sprintf("The `downsyncLoop` for (roomId=%v, playerId=%v) is stopped@renderFrameId=%v", pR.Id, playerId, pR.RenderFrameId))
		}()

		//Logger.Info(fmt.Sprintf("Started downsyncLoop for (roomId: %d, playerId:%d, playerDownsyncChan:%p)", pR.Id, playerId, playerDownsyncChan))

		for {
			nowBattleState := atomic.LoadInt32(&pR.State)
			switch nowBattleState {
			case RoomBattleStateIns.IDLE, RoomBattleStateIns.STOPPING_BATTLE_FOR_SETTLEMENT, RoomBattleStateIns.IN_SETTLEMENT, RoomBattleStateIns.IN_DISMISSAL:
				Logger.Warn(fmt.Sprintf("Battle is not waiting/preparing/active for playerDownsyncChan for (roomId: %d, playerId:%d)", pR.Id, playerId))
				return
			}

			select {
			case inputsBufferSnapshot := <-playerDownsyncChan:
				pR.downsyncToSinglePlayer(playerId, player, inputsBufferSnapshot.RefRenderFrameId, inputsBufferSnapshot.UnconfirmedMask, inputsBufferSnapshot.ToSendInputFrameDownsyncs, inputsBufferSnapshot.ShouldForceResync)
				//Logger.Info(fmt.Sprintf("Sent inputsBufferSnapshot(refRenderFrameId:%d, unconfirmedMask:%v) to for (roomId: %d, playerId:%d)#2", inputsBufferSnapshot.RefRenderFrameId, inputsBufferSnapshot.UnconfirmedMask, pR.Id, playerId))
			case inputsBufferSnapshot2 := <-playerSecondaryDownsyncChan:
				pR.downsyncPeerInputFrameUpsyncToSinglePlayer(playerId, player, inputsBufferSnapshot2.ToSendInputFrameDownsyncs, inputsBufferSnapshot2.PeerJoinIndex)
				//Logger.Info(fmt.Sprintf("Sent secondary inputsBufferSnapshot to for (roomId: %d, playerId:%d)#2", pR.Id, playerId))
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
		pR.PlayerSecondaryDownsyncChanDict[playerId] = make(chan pb.InputsBufferSnapshot, pR.InputsBuffer.N)
		go downsyncLoop(playerId, player, pR.PlayerDownsyncChanDict[playerId], pR.PlayerSecondaryDownsyncChanDict[playerId])
	}

	pR.onBattlePrepare(func() {
		pR.onBattleStarted() // NOTE: Deliberately not using `defer`.
		go battleMainLoop()
	})
}

func (pR *Room) OnBattleCmdReceived(pReq *pb.WsReq, fromUDP bool) {
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

	inputsBufferSnapshot := pR.markConfirmationIfApplicable(inputFrameUpsyncBatch, playerId, player, fromUDP)
	if nil != inputsBufferSnapshot {
		pR.downsyncToAllPlayers(inputsBufferSnapshot)
	} /*else {
	        // FIXME: Enable this block after we can proactively detect whether there's any "secondary ws session player" in the battle to avoid waste of resource in creating the snapshot
			// no new all-confirmed
			toSendInputFrameDownsyncs := pR.cloneInputsBuffer(inputFrameUpsyncBatch[0].InputFrameId, inputFrameUpsyncBatch[len(inputFrameUpsyncBatch)-1].InputFrameId+1)

			inputsBufferSnapshot = &pb.InputsBufferSnapshot{
				ToSendInputFrameDownsyncs: toSendInputFrameDownsyncs,
				PeerJoinIndex:             player.JoinIndex,
			}
			//Logger.Info(fmt.Sprintf("OnBattleCmdReceived no new all-confirmed: roomId=%v, fromPlayerId=%v, forming peer broadcasting snapshot=%v", pR.Id, playerId, inputsBufferSnapshot))
			pR.broadcastPeerUpsyncForBetterPrediction(inputsBufferSnapshot)
		}*/
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
	pR.BattleUdpTunnelLock.Lock()
	pR.BattleUdpTunnel.Close()
	pR.BattleUdpTunnelLock.Unlock()

	pR.State = RoomBattleStateIns.STOPPING_BATTLE_FOR_SETTLEMENT
	Logger.Info("Stopping the `battleMainLoop` for:", zap.Any("roomId", pR.Id))
	pR.RenderFrameId++
	for playerId, _ := range pR.Players {
		assembledFrame := pb.RoomDownsyncFrame{
			Id:             pR.RenderFrameId,
			PlayersArr:     toPbPlayers(pR.Players, false),
			CountdownNanos: -1, // TODO: Replace this magic constant!
		}
		pR.sendSafely(&assembledFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_STOPPED, playerId, true, MAGIC_JOIN_INDEX_DEFAULT)
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
		pR.sendSafely(battleReadyToStartFrame, nil, DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START, player.Id, true, MAGIC_JOIN_INDEX_DEFAULT)
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
	pR.CollisionMinStep = 16 // the approx minimum distance a player can move per frame in world coordinate
	pR.Players = make(map[int32]*Player)
	pR.PlayersArr = make([]*Player, pR.Capacity)
	pR.SpeciesIdList = make([]int32, pR.Capacity)
	pR.CharacterConfigsArr = make([]*battle.CharacterConfig, pR.Capacity)
	pR.CollisionSysMap = make(map[int32]*resolv.Object)
	pR.PlayerDownsyncSessionDict = make(map[int32]*websocket.Conn)
	pR.PlayerSecondaryDownsyncSessionDict = make(map[int32]*websocket.Conn)
	for _, oldWatchdog := range pR.PlayerActiveWatchdogDict {
		oldWatchdog.Stop()
	}
	pR.PlayerActiveWatchdogDict = make(map[int32]*Watchdog)
	for _, oldChan := range pR.PlayerDownsyncChanDict {
		close(oldChan)
	}
	pR.PlayerDownsyncChanDict = make(map[int32](chan pb.InputsBufferSnapshot))
	for _, oldChan := range pR.PlayerSecondaryDownsyncChanDict {
		close(oldChan)
	}
	pR.PlayerSecondaryDownsyncChanDict = make(map[int32](chan pb.InputsBufferSnapshot))
	pR.PlayerSignalToCloseDict = make(map[int32]SignalToCloseConnCbType)
	pR.PlayerSecondarySignalToCloseDict = make(map[int32]SignalToCloseConnCbType)
	pR.JoinIndexBooleanArr = make([]bool, pR.Capacity)
	pR.RenderCacheSize = 256
	pR.RenderFrameBuffer = resolv.NewRingBuffer(pR.RenderCacheSize)
	pR.InputsBuffer = resolv.NewRingBuffer((pR.RenderCacheSize >> 1) + 1)
	pR.rdfIdToActuallyUsedInput = make(map[int32]*pb.InputFrameDownsync)
	pR.LastIndividuallyConfirmedInputList = make([]uint64, pR.Capacity)

	pR.LatestPlayerUpsyncedInputFrameId = -1
	pR.LastAllConfirmedInputFrameId = -1
	pR.LastAllConfirmedInputFrameIdWithChange = -1
	pR.LastAllConfirmedInputList = make([]uint64, pR.Capacity)

	pR.RenderFrameId = 0
	pR.CurDynamicsRenderFrameId = 0
	pR.NstDelayFrames = 24

	pR.collisionHolder = resolv.NewCollision()
	pR.effPushbacks = make([]*battle.Vec2D, pR.Capacity)
	for i := 0; i < len(pR.effPushbacks); i++ {
		pR.effPushbacks[i] = &battle.Vec2D{X: 0, Y: 0}
	}
	pR.hardPushbackNormsArr = make([][]*battle.Vec2D, pR.Capacity)
	for i := 0; i < pR.Capacity; i++ {
		pR.hardPushbackNormsArr[i] = make([]*battle.Vec2D, 5)
		for j := 0; j < len(pR.hardPushbackNormsArr[i]); j++ {
			pR.hardPushbackNormsArr[i][j] = &battle.Vec2D{X: 0, Y: 0}
		}
	}
	pR.jumpedOrNotList = make([]bool, pR.Capacity)
	pR.dynamicRectangleColliders = make([]*resolv.Object, 64)
	for i := 0; i < len(pR.dynamicRectangleColliders); i++ {
		pR.dynamicRectangleColliders[i] = battle.GenerateRectCollider(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, nil, "")
	}

	serverFps := 60
	pR.RollbackEstimatedDtMillis = 16.667  // Use fixed-and-low-precision to mitigate the inconsistent floating-point-number issue between Golang and JavaScript
	pR.RollbackEstimatedDtNanos = 16666666 // A little smaller than the actual per frame time, just for logging FAST FRAME
	dilutedServerFps := float64(58.0)      // Don't set this value too small, otherwise we might miss force confirmation needs for slow tickers!
	pR.dilutedRollbackEstimatedDtNanos = int64(float64(pR.RollbackEstimatedDtNanos) * float64(serverFps) / dilutedServerFps)
	pR.BattleDurationFrames = int32(60 * serverFps)
	//pR.BattleDurationFrames = int32(20 * serverFps)
	pR.BattleDurationNanos = int64(pR.BattleDurationFrames) * (pR.RollbackEstimatedDtNanos + 1)
	pR.InputFrameUpsyncDelayTolerance = battle.ConvertToNoDelayInputFrameId(pR.NstDelayFrames) - 1 // this value should be strictly smaller than (NstDelayFrames >> InputScaleFrames), otherwise "type#1 forceConfirmation" might become a lag avalanche
	pR.MaxChasingRenderFramesPerUpdate = 9                                                         // Don't set this value too high to avoid exhausting frontend CPU within a single frame, roughly as the "turn-around frames to recover" is empirically OK

	pR.BackendDynamicsEnabled = true              // [WARNING] When "false", recovery upon reconnection wouldn't work!
	pR.ForceAllResyncOnAnyActiveSlowTicker = true // See tradeoff discussion in "downsyncToAllPlayers"

	pR.FrameDataLoggingEnabled = false // [WARNING] DON'T ENABLE ON LONG BATTLE DURATION! It consumes A LOT OF MEMORY!
	pR.BattleUdpTunnelLock.Lock()
	pR.BattleUdpTunnel = nil
	pR.BattleUdpTunnelAddr = nil
	pR.BattleUdpTunnelLock.Unlock()

	pR.ChooseStage()
	pR.EffectivePlayerCount = 0

	// [WARNING] It's deliberately ordered such that "pR.State = RoomBattleStateIns.IDLE" is put AFTER all the refreshing operations above.
	pR.State = RoomBattleStateIns.IDLE
	go pR.startBattleUdpTunnel() // Would reassign "pR.BattleUdpTunnel"
	pR.updateScore()

	Logger.Info("The room is completely dismissed(all playerDownsyncChan closed):", zap.Any("roomId", pR.Id))
}

func (pR *Room) expelPlayerDuringGame(playerId int32) {
	pR.signalToCloseAllSessionsOfPlayer(playerId, Constants.RetCode.UnknownError)
	pR.onPlayerExpelledDuringGame(playerId)
}

func (pR *Room) expelPlayerForDismissal(playerId int32) {
	pR.signalToCloseAllSessionsOfPlayer(playerId, Constants.RetCode.UnknownError)
	pR.onPlayerExpelledForDismissal(playerId)
}

func (pR *Room) signalToCloseAllSessionsOfPlayer(playerId int32, retCode int) {
	if signalToCloseConnOfThisPlayer, existent := pR.PlayerSignalToCloseDict[playerId]; existent {
		signalToCloseConnOfThisPlayer(retCode, "") // TODO: Specify an error code
	}
	if signalToCloseConnOfThisPlayer2, existent2 := pR.PlayerSecondarySignalToCloseDict[playerId]; existent2 {
		signalToCloseConnOfThisPlayer2(retCode, "") // TODO: Specify an error code
	}
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

	if signalToCloseConnOfThisPlayer2, existent2 := pR.PlayerSecondarySignalToCloseDict[playerId]; existent2 {
		signalToCloseConnOfThisPlayer2(Constants.RetCode.UnknownError, "") // TODO: Specify an error code
	}

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
		delete(pR.PlayerSecondaryDownsyncSessionDict, playerId)
		delete(pR.PlayerSecondarySignalToCloseDict, playerId)
	}
}

func (pR *Room) onPlayerAdded(playerId int32, speciesId int) {
	pR.EffectivePlayerCount++

	if 1 == pR.EffectivePlayerCount {
		pR.State = RoomBattleStateIns.WAITING
	}

	for index, value := range pR.JoinIndexBooleanArr {
		if false == value {
			pR.Players[playerId].JoinIndex = int32(index) + 1
			pR.JoinIndexBooleanArr[index] = true

			pR.SpeciesIdList[index] = int32(speciesId)
			chosenCh := battle.Characters[speciesId]
			pR.CharacterConfigsArr[index] = chosenCh
			pR.Players[playerId].Speed = chosenCh.Speed

			// Lazily assign the initial position of "Player" for "RoomDownsyncFrame".
			playerPosList := *pR.TmxPointsMap["PlayerStartingPos"]
			if index > len(playerPosList) {
				panic(fmt.Sprintf("onPlayerAdded error, index >= len(playerPosList), roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
			}
			playerPos := playerPosList[index]

			if nil == playerPos {
				panic(fmt.Sprintf("onPlayerAdded error, nil == playerPos, roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
			}
			pR.Players[playerId].RevivalVirtualGridX, pR.Players[playerId].RevivalVirtualGridY = battle.WorldToVirtualGridPos(playerPos.X, playerPos.Y)
			pR.Players[playerId].VirtualGridX, pR.Players[playerId].VirtualGridY = pR.Players[playerId].RevivalVirtualGridX, pR.Players[playerId].RevivalVirtualGridY
			pR.Players[playerId].MaxHp = 100 // Hardcoded for now
			pR.Players[playerId].Hp = pR.Players[playerId].MaxHp
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
				pR.sendSafely(playerAckedFrame, nil, DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED, thatPlayer.Id, true, MAGIC_JOIN_INDEX_DEFAULT)
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

func (pR *Room) sendSafely(roomDownsyncFrame *pb.RoomDownsyncFrame, toSendInputFrameDownsyncs []*pb.InputFrameDownsync, act int32, playerId int32, needLockExplicitly bool, peerJoinIndex int32) {
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("sendSafely, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("playerId", playerId), zap.Any("panic", r))
		}
	}()

	pResp := &pb.WsResp{
		Ret:                     int32(Constants.RetCode.Ok),
		Act:                     act,
		Rdf:                     roomDownsyncFrame,
		InputFrameDownsyncBatch: toSendInputFrameDownsyncs,
		PeerJoinIndex:           peerJoinIndex,
	}

	theBytes, marshalErr := proto.Marshal(pResp)
	if nil != marshalErr {
		panic(fmt.Sprintf("Error marshaling downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
	}

	shouldUseSecondaryWsSession := (MAGIC_JOIN_INDEX_DEFAULT != peerJoinIndex && DOWNSYNC_MSG_ACT_INPUT_BATCH == act) // FIXME: Simplify the condition
	//Logger.Info(fmt.Sprintf("shouldUseSecondaryWsSession=%v: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v", shouldUseSecondaryWsSession, pR.Id, playerId, pR.State, pR.EffectivePlayerCount))
	if !shouldUseSecondaryWsSession {
		if playerDownsyncSession, existent := pR.PlayerDownsyncSessionDict[playerId]; existent {
			if err := playerDownsyncSession.WriteMessage(websocket.BinaryMessage, theBytes); nil != err {
				panic(fmt.Sprintf("Error sending primary downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v, err=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount, err))
			}
		}
	} else {
		/*
		   [FIXME]
		   This branch is preferred to use an additional session of each player for sending, and the session is preferrably UDP instead of any TCP-based protocol, but I'm being lazy here.

		   See `<proj-root>/ConcerningEdgeCases.md` for the advantage of using UDP as a supplement.
		*/
		if playerSecondaryDownsyncSession, existent := pR.PlayerSecondaryDownsyncSessionDict[playerId]; existent {
			if err := playerSecondaryDownsyncSession.WriteMessage(websocket.BinaryMessage, theBytes); nil != err {
				panic(fmt.Sprintf("Error sending secondary downsync message: roomId=%v, playerId=%v, roomState=%v, roomEffectivePlayerCount=%v, err=%v", pR.Id, playerId, pR.State, pR.EffectivePlayerCount, err))
			}
		}
	}
}

func (pR *Room) getOrPrefabInputFrameDownsync(inputFrameId int32) *battle.InputFrameDownsync {
	/*
	   [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked.
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

			/*
			   [WARNING] Don't reference "pR.InputsBuffer.GetByFrameId(j-1)" to prefab here!

			    Otherwise if an ActiveSlowTicker got a forced confirmation sequence like
			    ```
			    inputFrame#42    {dx: -2} upsynced;
			    inputFrame#43-50 {dx: +2} ignored by [type#1 forceConfirmation];
			    inputFrame#51    {dx: +2} upsynced;
			    inputFrame#52-60 {dx: +2} ignored by [type#1 forceConfirmation];
			    inputFrame#61    {dx: +2} upsynced;

			    ...there would be more [type#1 forceConfirmation]s for this ActiveSlowTicker if it doesn't catch up the upsync pace...
			    ```
			    , the backend might've been prefabbing TOO QUICKLY and thus still replicating "inputFrame#42" by now for this ActiveSlowTicker, making its graphics inconsistent upon "[type#1 forceConfirmation] at inputFrame#52-60", i.e. as if always dragged to the left while having been controlled to the right for a few frames -- what's worse, the same graphical inconsistence could even impact later "[type#1 forceConfirmation]s" if this ActiveSlowTicker doesn't catch up with the upsync pace!
			*/

			for i, _ := range currInputFrameDownsync.InputList {
				// [WARNING] The use of "InputsBufferLock" guarantees that by now "inputFrameId >= pR.InputsBuffer.EdFrameId >= pR.LatestPlayerUpsyncedInputFrameId", thus it's safe to use "pR.LastIndividuallyConfirmedInputList" for prediction.
				// Don't predict "btnA & btnB"!
				currInputFrameDownsync.InputList[i] = (pR.LastIndividuallyConfirmedInputList[i] & uint64(15))
			}

			pR.InputsBuffer.Put(currInputFrameDownsync)
		}
	} else {
		currInputFrameDownsync = tmp1.(*battle.InputFrameDownsync)
	}

	return currInputFrameDownsync
}

func (pR *Room) markConfirmationIfApplicable(inputFrameUpsyncBatch []*pb.InputFrameUpsync, playerId int32, player *Player, fromUDP bool) *pb.InputsBufferSnapshot {
	// [WARNING] This function MUST BE called while "pR.InputsBufferLock" is locked!
	// Step#1, put the received "inputFrameUpsyncBatch" into "pR.InputsBuffer"
	for _, inputFrameUpsync := range inputFrameUpsyncBatch {
		clientInputFrameId := inputFrameUpsync.InputFrameId
		if clientInputFrameId < pR.InputsBuffer.StFrameId {
			// The updates to "pR.InputsBuffer.StFrameId" is monotonically increasing, thus if "clientInputFrameId < pR.InputsBuffer.StFrameId" at any moment of time, it is obsolete in the future.
			Logger.Debug(fmt.Sprintf("Omitting obsolete inputFrameUpsync#1: roomId=%v, playerId=%v, clientInputFrameId=%v, InputsBuffer=%v", pR.Id, playerId, clientInputFrameId, pR.InputsBufferString(false)))
			continue
		}
		if clientInputFrameId < player.LastReceivedInputFrameId {
			// [WARNING] It's important for correctness that we use "player.LastReceivedInputFrameId" instead of "player.LastUdpReceivedInputFrameId" here!
			Logger.Debug(fmt.Sprintf("Omitting obsolete inputFrameUpsync#2: roomId=%v, playerId=%v, clientInputFrameId=%v, playerLastReceivedInputFrameId=%v, InputsBuffer=%v", pR.Id, playerId, clientInputFrameId, player.LastReceivedInputFrameId, pR.InputsBufferString(false)))
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

		if false == fromUDP {
			/*
							   [WARNING] We have to distinguish whether or not the incoming batch is from UDP here, otherwise "pR.LatestPlayerUpsyncedInputFrameId - pR.LastAllConfirmedInputFrameId" might become unexpectedly large in case of "UDP packet loss + slow ws session"!

							   Moreover, only ws session upsyncs should advance "player.LastReceivedInputFrameId" & "pR.LatestPlayerUpsyncedInputFrameId".

				               Kindly note that the updates of "player.LastReceivedInputFrameId" could be discrete before and after reconnection.
			*/
			player.LastReceivedInputFrameId = clientInputFrameId
			if clientInputFrameId > pR.LatestPlayerUpsyncedInputFrameId {
				pR.LatestPlayerUpsyncedInputFrameId = clientInputFrameId
			}
		}

		if clientInputFrameId > player.LastUdpReceivedInputFrameId {
			// No need to update "player.LastUdpReceivedInputFrameId" only when "true == fromUDP", we should keep "player.LastUdpReceivedInputFrameId >= player.LastReceivedInputFrameId" at any moment.
			player.LastUdpReceivedInputFrameId = clientInputFrameId
			// It's safe (in terms of getting an eventually correct "RenderFrameBuffer") to put the following update of "pR.LastIndividuallyConfirmedInputList" which is ONLY used for prediction in "InputsBuffer" out of "false == fromUDP" block.
			pR.LastIndividuallyConfirmedInputList[player.JoinIndex-1] = inputFrameUpsync.Encoded
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
		refSnapshotStFrameId := battle.ConvertToDelayedInputFrameId(refRenderFrameIdIfNeeded)
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
	// As "pR.LastAllConfirmedInputFrameId" can be advanced by UDP but "pR.LatestPlayerUpsyncedInputFrameId" could only be advanced by ws session, when the following condition is met we know that the slow ticker is really in trouble!
	if pR.LatestPlayerUpsyncedInputFrameId > (pR.LastAllConfirmedInputFrameId + pR.InputFrameUpsyncDelayTolerance + 1) {
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
			Logger.Info(fmt.Sprintf("[type#1 forceConfirmation] For roomId=%d@renderFrameId=%d, curDynamicsRenderFrameId=%d, LatestPlayerUpsyncedInputFrameId:%d, oldLastAllConfirmedInputFrameId:%d, newLastAllConfirmedInputFrameId:%d, InputFrameUpsyncDelayTolerance:%d, unconfirmedMask=%d; there's a slow ticker suspect, forcing all-confirmation", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LatestPlayerUpsyncedInputFrameId, oldLastAllConfirmedInputFrameId, pR.LastAllConfirmedInputFrameId, pR.InputFrameUpsyncDelayTolerance, unconfirmedMask))
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

func (pR *Room) applyInputFrameDownsyncDynamics(fromRenderFrameId int32, toRenderFrameId int32) {
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
		delayedInputFrameId := battle.ConvertToDelayedInputFrameId(collisionSysRenderFrameId)
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

		battle.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(pR.InputsBuffer, currRenderFrame.Id, pR.Space, pR.CollisionSysMap, pR.SpaceOffsetX, pR.SpaceOffsetY, pR.CharacterConfigsArr, pR.RenderFrameBuffer, pR.collisionHolder, pR.effPushbacks, pR.hardPushbackNormsArr, pR.jumpedOrNotList, pR.dynamicRectangleColliders)
		pR.CurDynamicsRenderFrameId++
	}
}

func (pR *Room) refreshColliders() {
	// Kindly note that by now, we've already got all the shapes in the tmx file into "pR.(Players | Barriers)" from "ParseTmxLayersAndGroups"

	pR.Space = resolv.NewSpace(int(pR.SpaceOffsetX*2), int(pR.SpaceOffsetY*2), int(pR.CollisionMinStep), int(pR.CollisionMinStep)) // allocate a new collision space everytime after a battle is settled

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
		barrierCollider := battle.GenerateConvexPolygonCollider(polygon2DUnaligned, pR.SpaceOffsetX, pR.SpaceOffsetY, nil, "Barrier")
		pR.Space.Add(barrierCollider)
	}
}

func (pR *Room) printBarrier(barrierCollider *resolv.Object) {
	Logger.Info(fmt.Sprintf("Barrier in roomId=%v: w=%v, h=%v, shape=%v", pR.Id, barrierCollider.W, barrierCollider.H, barrierCollider.Shape))
}

func (pR *Room) doBattleMainLoopPerTickBackendDynamicsWithProperLocking(prevRenderFrameId int32, pDynamicsDuration *int64) {
	//Logger.Debug(fmt.Sprintf("doBattleMainLoopPerTickBackendDynamicsWithProperLocking-InputsBufferLock to about lock: roomId=%v", pR.Id))
	pR.InputsBufferLock.Lock()
	//Logger.Debug(fmt.Sprintf("doBattleMainLoopPerTickBackendDynamicsWithProperLocking-InputsBufferLock locked: roomId=%v", pR.Id))

	defer func() {
		pR.InputsBufferLock.Unlock()
		//Logger.Debug(fmt.Sprintf("doBattleMainLoopPerTickBackendDynamicsWithProperLocking-InputsBufferLock unlocked: roomId=%v", pR.Id))
	}()

	if ok, thatRenderFrameId := battle.ShouldPrefabInputFrameDownsync(prevRenderFrameId, pR.RenderFrameId); ok {
		noDelayInputFrameId := battle.ConvertToNoDelayInputFrameId(thatRenderFrameId)
		pR.getOrPrefabInputFrameDownsync(noDelayInputFrameId)
	}

	// Force setting all-confirmed of buffered inputFrames periodically, kindly note that if "pR.BackendDynamicsEnabled", what we want to achieve is "recovery upon reconnection", which certainly requires "forceConfirmationIfApplicable" to move "pR.LastAllConfirmedInputFrameId" forward as much as possible
	oldLastAllConfirmedInputFrameId := pR.LastAllConfirmedInputFrameId
	unconfirmedMask := pR.forceConfirmationIfApplicable(prevRenderFrameId)

	if 0 <= pR.LastAllConfirmedInputFrameId {
		dynamicsStartedAt := utils.UnixtimeNano()
		// Apply "all-confirmed inputFrames" to move forward "pR.CurDynamicsRenderFrameId"
		nextDynamicsRenderFrameId := battle.ConvertToLastUsedRenderFrameId(pR.LastAllConfirmedInputFrameId) + 1
		Logger.Debug(fmt.Sprintf("roomId=%v, room.RenderFrameId=%v, room.CurDynamicsRenderFrameId=%v, LastAllConfirmedInputFrameId=%v, nextDynamicsRenderFrameId=%v", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LastAllConfirmedInputFrameId, nextDynamicsRenderFrameId))
		pR.applyInputFrameDownsyncDynamics(pR.CurDynamicsRenderFrameId, nextDynamicsRenderFrameId)
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
		refSnapshotStFrameId := battle.ConvertToDelayedInputFrameId(pR.CurDynamicsRenderFrameId - 1)
		if refSnapshotStFrameId < snapshotStFrameId {
			snapshotStFrameId = refSnapshotStFrameId
		}
		inputsBufferSnapshot := pR.produceInputsBufferSnapshotWithCurDynamicsRenderFrameAsRef(unconfirmedMask, snapshotStFrameId, pR.LastAllConfirmedInputFrameId+1)
		//Logger.Warn(fmt.Sprintf("[forceConfirmation] roomId=%v, room.RenderFrameId=%v, room.CurDynamicsRenderFrameId=%v, room.LastAllConfirmedInputFrameId=%v, unconfirmedMask=%v", pR.Id, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, pR.LastAllConfirmedInputFrameId, unconfirmedMask))
		pR.downsyncToAllPlayers(inputsBufferSnapshot)
	}
}

func (pR *Room) broadcastPeerUpsyncForBetterPrediction(inputsBufferSnapshot *pb.InputsBufferSnapshot) {
	// See `<proj-root>/ConcerningEdgeCases.md` for why this method exists.
	for _, player := range pR.PlayersArr {
		playerBattleState := atomic.LoadInt32(&(player.BattleState))
		switch playerBattleState {
		case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL, PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
			continue
		}
		if player.JoinIndex == inputsBufferSnapshot.PeerJoinIndex {
			continue
		}

		if playerSecondaryDownsyncChan, existent := pR.PlayerSecondaryDownsyncChanDict[player.Id]; existent {
			/*
			   [FIXME]
			   This function is preferred to use an additional go-channel of each player for sending, see "downsyncLoop" & "Room.sendSafely" for more information!
			*/
			playerSecondaryDownsyncChan <- (*inputsBufferSnapshot)
		} else {
			Logger.Warn(fmt.Sprintf("playerDownsyncChan for (roomId: %d, playerId:%d) is gone", pR.Id, player.Id))
		}
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

	playerJoinIndexInBooleanArr := player.JoinIndex - 1
	playerBattleState := atomic.LoadInt32(&(player.BattleState))
	switch playerBattleState {
	case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL, PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
		return
	}

	isSlowTicker := (0 < (unconfirmedMask & uint64(1<<uint32(playerJoinIndexInBooleanArr))))
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
		if shouldResync3 {
			refRenderFrame.ShouldForceResync = true
		}
		refRenderFrame.BackendUnconfirmedMask = unconfirmedMask
		pbRefRenderFrame := toPbRoomDownsyncFrame(refRenderFrame)
		pbRefRenderFrame.SpeciesIdList = pR.SpeciesIdList
		pR.sendSafely(pbRefRenderFrame, toSendInputFrameDownsyncsSnapshot, DOWNSYNC_MSG_ACT_FORCED_RESYNC, playerId, false, MAGIC_JOIN_INDEX_DEFAULT)
		//Logger.Warn(fmt.Sprintf("Sent refRenderFrameId=%v & inputFrameIds [%d, %d), for roomId=%v, playerId=%d, playerJoinIndex=%d, renderFrameId=%d, curDynamicsRenderFrameId=%d, playerLastSentInputFrameId=%d: InputsBuffer=%v", refRenderFrameId, toSendInputFrameIdSt, toSendInputFrameIdEd, pR.Id, playerId, player.JoinIndex, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, player.LastSentInputFrameId, pR.InputsBufferString(false)))
		if shouldResync1 || shouldResync3 {
			Logger.Debug(fmt.Sprintf("Sent refRenderFrameId=%v & inputFrameIds [%d, %d), for roomId=%v, playerId=%d, playerJoinIndex=%d, renderFrameId=%d, curDynamicsRenderFrameId=%d, playerLastSentInputFrameId=%d: shouldResync1=%v, shouldResync2=%v, shouldResync3=%v, playerBattleState=%d", refRenderFrameId, toSendInputFrameIdSt, toSendInputFrameIdEd, pR.Id, playerId, player.JoinIndex, pR.RenderFrameId, pR.CurDynamicsRenderFrameId, player.LastSentInputFrameId, shouldResync1, shouldResync2, shouldResync3, playerBattleState))
		}
	} else {
		pR.sendSafely(nil, toSendInputFrameDownsyncsSnapshot, DOWNSYNC_MSG_ACT_INPUT_BATCH, playerId, false, MAGIC_JOIN_INDEX_DEFAULT)
	}
	player.LastSentInputFrameId = toSendInputFrameIdEd - 1
	if shouldResync1 {
		atomic.StoreInt32(&(player.BattleState), PlayerBattleStateIns.ACTIVE)
	}
}

func (pR *Room) downsyncPeerInputFrameUpsyncToSinglePlayer(playerId int32, player *Player, toSendInputFrameDownsyncsSnapshot []*pb.InputFrameDownsync, peerJoinIndex int32) {
	playerBattleState := atomic.LoadInt32(&(player.BattleState))
	switch playerBattleState {
	case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL, PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK:
		return
	}

	pR.sendSafely(nil, toSendInputFrameDownsyncsSnapshot, DOWNSYNC_MSG_ACT_PEER_INPUT_BATCH, playerId, false, peerJoinIndex)
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

func (pR *Room) SetSecondarySession(playerId int32, session *websocket.Conn, signalToCloseConnOfThisPlayer SignalToCloseConnCbType) {
	// TODO: Use a dedicated lock
	if player, ok := pR.Players[playerId]; ok {
		playerBattleState := atomic.LoadInt32(&(player.BattleState))
		switch playerBattleState {
		case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL:
			// Kindly note that "PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK" are allowed
			return
		}
		if _, existent := pR.PlayerDownsyncSessionDict[playerId]; existent {
			if _, existent2 := pR.PlayerSecondaryDownsyncSessionDict[playerId]; !existent2 {
				Logger.Info(fmt.Sprintf("SetSecondarySession for roomId=%v, playerId=%d, pR.Players=%v", pR.Id, playerId, pR.Players))
				pR.PlayerSecondaryDownsyncSessionDict[playerId] = session
				pR.PlayerSecondarySignalToCloseDict[playerId] = signalToCloseConnOfThisPlayer
			}
		}
	}
}

func (pR *Room) UpdatePeerUdpAddrList(playerId int32, peerAddr *net.UDPAddr, pReq *pb.HolePunchUpsync) {
	// TODO: There's a chance that by now "player.JoinIndex" is not yet determined, use a lock to sync
	if player, ok := pR.Players[playerId]; ok && MAGIC_JOIN_INDEX_DEFAULT != player.JoinIndex {
		playerBattleState := atomic.LoadInt32(&(player.BattleState))
		switch playerBattleState {
		case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL:
			// Kindly note that "PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK, PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK" are allowed
			return
		}
		if _, existent := pR.PlayerDownsyncSessionDict[playerId]; existent {
			player.UdpAddr = &pb.PeerUdpAddr{
				Ip:      peerAddr.IP.String(),
				Port:    int32(peerAddr.Port),
				AuthKey: pReq.AuthKey,
			}
			Logger.Info(fmt.Sprintf("UpdatePeerUdpAddrList done for roomId=%v, playerId=%d, peerAddr=%s", pR.Id, playerId, peerAddr))

			peerJoinIndex := player.JoinIndex
			peerUdpAddrList := make([]*pb.PeerUdpAddr, pR.Capacity, pR.Capacity)

			for _, otherPlayer := range pR.Players {
				if MAGIC_JOIN_INDEX_DEFAULT == otherPlayer.JoinIndex {
					// TODO: Again this shouldn't happen, apply proper locking
					continue
				}
				// In case of highly concurrent update that might occur while later marshalling, use the ptr of a copy
				peerUdpAddrList[otherPlayer.JoinIndex-1] = &pb.PeerUdpAddr{
					Ip:      otherPlayer.UdpAddr.Ip,
					Port:    otherPlayer.UdpAddr.Port,
					AuthKey: otherPlayer.UdpAddr.AuthKey,
				}
			}

			// Broadcast this new UDP addr to all the existing players
			for otherPlayerId, otherPlayer := range pR.Players {
				otherPlayerBattleState := atomic.LoadInt32(&(otherPlayer.BattleState))
				switch otherPlayerBattleState {
				case PlayerBattleStateIns.DISCONNECTED, PlayerBattleStateIns.LOST, PlayerBattleStateIns.EXPELLED_DURING_GAME, PlayerBattleStateIns.EXPELLED_IN_DISMISSAL:
					continue
				}

				Logger.Info(fmt.Sprintf("Downsyncing peerUdpAddrList for roomId=%v, playerId=%d", pR.Id, otherPlayerId))
				pR.sendSafely(&pb.RoomDownsyncFrame{
					PeerUdpAddrList: peerUdpAddrList,
				}, nil, DOWNSYNC_MSG_ACT_PEER_UDP_ADDR, otherPlayerId, false, peerJoinIndex)
			}
		}
	}
}

func (pR *Room) startBattleUdpTunnel() {
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("`BattleUdpTunnel` recovery spot#1, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("panic", r))
		}
		Logger.Info(fmt.Sprintf("`BattleUdpTunnel` stopped for (roomId=%d)@renderFrameId=%v", pR.Id, pR.RenderFrameId))
	}()

	pR.BattleUdpTunnelLock.Lock()
	conn, err := net.ListenUDP("udp", &net.UDPAddr{
		Port: 0,
		IP:   net.ParseIP(Conf.Sio.UdpHost),
	})
	if nil != err {
		// No need to close the "conn" upon error here
		pR.BattleUdpTunnelLock.Unlock()
		panic(err)
	}
	pR.BattleUdpTunnel = conn
	switch v := conn.LocalAddr().(type) {
	case (*net.UDPAddr):
		pR.BattleUdpTunnelAddr = &pb.PeerUdpAddr{
			Ip:      Conf.Sio.UdpHost,
			Port:    int32(v.Port),
			AuthKey: 0, // To be determined for each specific player upon joining and sent to it by BattleColliderInfo
		}
	}

	pR.BattleUdpTunnelLock.Unlock()

	defer func() {
		if r := recover(); r != nil {
			Logger.Warn("`BattleUdpTunnel` recovery spot#2, recovered from: ", zap.Any("roomId", pR.Id), zap.Any("panic", r))
		}
		Logger.Info(fmt.Sprintf("`BattleUdpTunnel` closed for (roomId=%d)@renderFrameId=%v", pR.Id, pR.RenderFrameId))
	}()
	Logger.Info(fmt.Sprintf("`BattleUdpTunnel` started for roomId=%d at %s", pR.Id, conn.LocalAddr().String()))
	for {
		message := make([]byte, 128)
		rlen, remote, err := conn.ReadFromUDP(message[:]) // Would be unblocked when "conn.Close()" is called from another thread/goroutine, reference https://pkg.go.dev/net@go1.18.6#PacketConn
		if nil != err {
			// Should proceed to close the "conn" upon error here, if "conn" is already closed it'd just throw another error to be catched by "spot#2"
			conn.Close()
			panic(err)
		}
		pReq := new(pb.WsReq)
		bytes := message[0:rlen]
		if unmarshalErr := proto.Unmarshal(bytes, pReq); nil != unmarshalErr {
			Logger.Warn(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d failed to unmarshal %d bytes", pR.Id, rlen), zap.Error(unmarshalErr))
			continue
		}
		playerId := pReq.PlayerId
		//Logger.Info(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d received decoded WsReq:", pR.Id), zap.Any("pReq", pReq))
		if player, exists1 := pR.Players[playerId]; exists1 {
			authKey := pReq.AuthKey
			if authKey != player.BattleUdpTunnelAuthKey {
				Logger.Warn(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d received %d bytes for playerId=%d from %s, but (incomingAuthKey:%d != playerBattleUdpTunnelAuthKey:%d)\n", pR.Id, rlen, playerId, remote, authKey, player.BattleUdpTunnelAuthKey))
				continue
			}
			if _, existent := pR.PlayerDownsyncSessionDict[playerId]; existent {
				player.BattleUdpTunnelAddr = remote
				//Logger.Info(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d updated battleUdpAddr for playerId=%d to be %s\n", pR.Id, playerId, remote))

				nowBattleState := atomic.LoadInt32(&pR.State)
				if RoomBattleStateIns.IN_BATTLE == nowBattleState {
					batch := pReq.InputFrameUpsyncBatch
					if nil != batch && 0 < len(batch) {
						peerJoinIndex := pReq.JoinIndex
						// Broadcast to every other player in the same room/battle
						for _, otherPlayer := range pR.PlayersArr {
							if otherPlayer.JoinIndex == peerJoinIndex {
								continue
							}
							_, wrerr := conn.WriteTo(bytes, otherPlayer.BattleUdpTunnelAddr)
							if nil != wrerr {
								//Logger.Debug(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d failed to forward upsync from (playerId:%d, joinIndex:%d, addr:%s) to (otherPlayerId:%d, otherPlayerJoinIndex:%d, otherPlayerAddr:%s)\n", pR.Id, playerId, peerJoinIndex, remote, otherPlayer.Id, otherPlayer.JoinIndex, otherPlayer.BattleUdpTunnelAddr))
							}
						}
						pR.OnBattleCmdReceived(pReq, true) // To help advance "pR.LastAllConfirmedInputFrameId" asap, and even if "pR.LastAllConfirmedInputFrameId" is not advanced due to packet loss, these UDP packets would help prefill the "InputsBuffer" with correct player "future inputs (compared to ws session)" such that when "forceConfirmation" occurs we have as many correct predictions as possible
					}

				}
			} else {
				Logger.Warn(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d received validated %d bytes for playerId=%d from %s, but primary downsync session for it doesn't exist\n", pR.Id, rlen, playerId, remote))
			}
		} else {
			Logger.Warn(fmt.Sprintf("`BattleUdpTunnel` for roomId=%d received invalid %d bytes for playerId=%d from %s, but it doesn't belong to this room!\n", pR.Id, rlen, playerId, remote))
		}
	}
}
