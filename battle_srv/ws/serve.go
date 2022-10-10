package ws

import (
	"container/heap"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/golang/protobuf/proto"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"net/http"
	. "server/common"
	"server/models"
	pb "server/pb_output"
	"strconv"
	"sync/atomic"
	"time"
)

const (
	READ_BUF_SIZE  = 8 * 1024
	WRITE_BUF_SIZE = 8 * 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  READ_BUF_SIZE,
	WriteBufferSize: WRITE_BUF_SIZE,
	CheckOrigin: func(r *http.Request) bool {
		Logger.Debug("origin", zap.Any("origin", r.Header.Get("Origin")))
		return true
	},
}

func startOrFeedHeartbeatWatchdog(conn *websocket.Conn) bool {
	if nil == conn {
		return false
	}
	conn.SetReadDeadline(time.Now().Add(time.Millisecond * (ConstVals.Ws.WillKickIfInactiveFor)))
	return true
}

func Serve(c *gin.Context) {
	token, ok := c.GetQuery("intAuthToken")
	if !ok {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	Logger.Info("Finding PlayerLogin record for ws authentication:", zap.Any("intAuthToken", token))
	boundRoomId := 0
	expectRoomId := 0
	var err error
	if boundRoomIdStr, hasBoundRoomId := c.GetQuery("boundRoomId"); hasBoundRoomId {
		boundRoomId, err = strconv.Atoi(boundRoomIdStr)
		if err != nil {
			// TODO: Abort with specific message.
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		Logger.Info("Finding PlayerLogin record for ws authentication:", zap.Any("intAuthToken", token), zap.Any("boundRoomId", boundRoomId))
	}
	if expectRoomIdStr, hasExpectRoomId := c.GetQuery("expectedRoomId"); hasExpectRoomId {
		expectRoomId, err = strconv.Atoi(expectRoomIdStr)
		if err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		Logger.Info("Finding PlayerLogin record for ws authentication:", zap.Any("intAuthToken", token), zap.Any("expectedRoomId", expectRoomId))
	}

	// TODO: Wrap the following 2 stmts by sql transaction!
	playerId, err := models.GetPlayerIdByToken(token)
	if err != nil || playerId == 0 {
		// TODO: Abort with specific message.
		Logger.Info("PlayerLogin record not found for ws authentication:", zap.Any("intAuthToken", token))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	Logger.Info("PlayerLogin record has been found for ws authentication:", zap.Any("playerId", playerId))

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		Logger.Error("upgrade:", zap.Error(err), zap.Any("playerId", playerId))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	Logger.Debug("ConstVals.Ws.WillKickIfInactiveFor", zap.Duration("v", ConstVals.Ws.WillKickIfInactiveFor))
	/**
	 * WARNING: After successfully upgraded to use the "persistent connection" of http1.1/websocket protocol, you CANNOT overwrite the http1.0 resp status by `c.AbortWithStatus(...)` any more!
	 */

	connHasBeenSignaledToClose := int32(0)
	pConnHasBeenSignaledToClose := &connHasBeenSignaledToClose

	var pRoom *models.Room = nil
	signalToCloseConnOfThisPlayer := func(customRetCode int, customRetMsg string) {
		if swapped := atomic.CompareAndSwapInt32(pConnHasBeenSignaledToClose, 0, 1); !swapped {
			return
		}
		Logger.Warn("signalToCloseConnOfThisPlayer:", zap.Any("playerId", playerId), zap.Any("customRetCode", customRetCode), zap.Any("customRetMsg", customRetMsg))
		if nil != pRoom {
			pRoom.OnPlayerDisconnected(int32(playerId))
		}
		defer func() {
			if r := recover(); r != nil {
				Logger.Warn("Recovered from: ", zap.Any("panic", r))
			}
		}()
		/**
		 * References
		 * - https://tools.ietf.org/html/rfc6455
		 * - https://godoc.org/github.com/gorilla/websocket#hdr-Control_Messages
		 * - https://godoc.org/github.com/gorilla/websocket#FormatCloseMessage
		 * - https://godoc.org/github.com/gorilla/websocket#Conn.WriteControl
		 * - https://godoc.org/github.com/gorilla/websocket#hdr-Concurrency
		 *   - "The Close and WriteControl methods can be called concurrently with all other methods."
		 */

		/**
		 * References for the "WebsocketStdCloseCode"s. Note that we're using some "CustomCloseCode"s here as well.
		 *
		 * - https://tools.ietf.org/html/rfc6455#section-7.4
		 * - https://godoc.org/github.com/gorilla/websocket#pkg-constants.
		 */
		closeMessage := websocket.FormatCloseMessage(customRetCode, customRetMsg)
		err := conn.WriteControl(websocket.CloseMessage, closeMessage, time.Now().Add(time.Millisecond*(ConstVals.Ws.WillKickIfInactiveFor)))
		if err != nil {
			Logger.Error("Unable to send the CloseFrame control message to player(client-side):", zap.Any("playerId", playerId), zap.Error(err))
		}

		time.AfterFunc(3*time.Second, func() {
			// To actually terminates the underlying TCP connection which might be in `CLOSE_WAIT` state if inspected by `netstat`.
			conn.Close()
		})
	}

	onReceivedCloseMessageFromClient := func(code int, text string) error {
		Logger.Warn("Triggered `onReceivedCloseMessageFromClient`:", zap.Any("code", code), zap.Any("playerId", playerId), zap.Any("message", text))
		signalToCloseConnOfThisPlayer(code, text)
		return nil
	}

	/**
	 * - "SetCloseHandler sets the handler for close messages received from the peer."
	 *
	 * - "The default close handler sends a close message back to the peer."
	 *
	 * - "The connection read methods return a CloseError when a close message is received. Most applications should handle close messages as part of their normal error handling. Applications should only set a close handler when the application must perform some action before sending a close message back to the peer."
	 *
	 * from reference https://godoc.org/github.com/gorilla/websocket#Conn.SetCloseHandler.
	 */
	conn.SetCloseHandler(onReceivedCloseMessageFromClient)

	pPlayer, err := models.GetPlayerById(playerId)

	if nil != err || nil == pPlayer {
		// TODO: Abort with specific message.
		signalToCloseConnOfThisPlayer(Constants.RetCode.PlayerNotFound, "")
	}

	Logger.Info("Player has logged in and its profile is found from persistent storage:", zap.Any("playerId", playerId), zap.Any("play", pPlayer))

	// Find a room to join.
	Logger.Info("About to acquire RoomHeapMux for player:", zap.Any("playerId", playerId))
	(*(models.RoomHeapMux)).Lock()
	defer func() {
		(*(models.RoomHeapMux)).Unlock()
		Logger.Info("Released RoomHeapMux for player:", zap.Any("playerId", playerId))
	}()
	defer func() {
		if r := recover(); r != nil {
			Logger.Error("Recovered from: ", zap.Any("panic", r))
			signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "")
		}
	}()
	Logger.Info("Acquired RoomHeapMux for player:", zap.Any("playerId", playerId))
	// Logger.Info("The RoomHeapManagerIns has:", zap.Any("addr", fmt.Sprintf("%p", models.RoomHeapManagerIns)), zap.Any("size", len(*(models.RoomHeapManagerIns))))
	playerSuccessfullyAddedToRoom := false
	if 0 < boundRoomId {
		if tmpPRoom, existent := (*models.RoomMapManagerIns)[int32(boundRoomId)]; existent {
			pRoom = tmpPRoom
			Logger.Info("Successfully got:\n", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Any("forBoundRoomId", boundRoomId))
			res := pRoom.ReAddPlayerIfPossible(pPlayer, conn, signalToCloseConnOfThisPlayer)
			if !res {
				Logger.Warn("Failed to get:\n", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Any("forBoundRoomId", boundRoomId))
			} else {
				playerSuccessfullyAddedToRoom = true
			}
		}
	}

	if 0 < expectRoomId {
		if tmpRoom, existent := (*models.RoomMapManagerIns)[int32(expectRoomId)]; existent {
			pRoom = tmpRoom
			Logger.Info("Successfully got:\n", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Any("forExpectedRoomId", expectRoomId))

			if pRoom.ReAddPlayerIfPossible(pPlayer, conn, signalToCloseConnOfThisPlayer) {
				playerSuccessfullyAddedToRoom = true
			} else if pRoom.AddPlayerIfPossible(pPlayer, conn, signalToCloseConnOfThisPlayer) {
				playerSuccessfullyAddedToRoom = true
			} else {
				Logger.Warn("Failed to get:\n", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Any("forExpectedRoomId", expectRoomId))
				playerSuccessfullyAddedToRoom = false
			}

		}
	}

	if false == playerSuccessfullyAddedToRoom {
		defer func() {
			if pRoom != nil {
				heap.Push(models.RoomHeapManagerIns, pRoom)
				(models.RoomHeapManagerIns).Update(pRoom, pRoom.Score)
			}
			(models.RoomHeapManagerIns).PrintInOrder()
		}()
		tmpRoom, ok := heap.Pop(models.RoomHeapManagerIns).(*models.Room)
		if !ok {
			signalToCloseConnOfThisPlayer(Constants.RetCode.LocallyNoAvailableRoom, fmt.Sprintf("Cannot pop a (*Room) for playerId == %v!", playerId))
		} else {
			pRoom = tmpRoom
			Logger.Info("Successfully popped:\n", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId))
			res := pRoom.AddPlayerIfPossible(pPlayer, conn, signalToCloseConnOfThisPlayer)
			if !res {
				signalToCloseConnOfThisPlayer(Constants.RetCode.PlayerNotAddableToRoom, fmt.Sprintf("AddPlayerIfPossible returns false for roomId == %v, playerId == %v!", pRoom.Id, playerId))
			}
		}
	}

	if swapped := atomic.CompareAndSwapInt32(pConnHasBeenSignaledToClose, 1, 1); swapped {
		return
	}

	if pThePlayer, ok := pRoom.Players[int32(playerId)]; ok && (models.PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK == pThePlayer.BattleState || models.PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK == pThePlayer.BattleState) {
		defer func() {
			timeoutSeconds := time.Duration(5) * time.Second
			time.AfterFunc(timeoutSeconds, func() {
				if models.PlayerBattleStateIns.ADDED_PENDING_BATTLE_COLLIDER_ACK == pThePlayer.BattleState || models.PlayerBattleStateIns.READDED_PENDING_BATTLE_COLLIDER_ACK == pThePlayer.BattleState {
					signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, fmt.Sprintf("The expected Ack for BattleColliderInfo is not received in %s, for playerId == %v!", timeoutSeconds, playerId))
				}
			})
		}()

		// Construct "battleColliderInfo" to downsync
		bciFrame := &pb.BattleColliderInfo{
			BoundRoomId:           pRoom.Id,
			StageName:             pRoom.StageName,
			StrToVec2DListMap:     models.ToPbVec2DListMap(pRoom.RawBattleStrToVec2DListMap),
			StrToPolygon2DListMap: models.ToPbPolygon2DListMap(pRoom.RawBattleStrToPolygon2DListMap),
			StageDiscreteW:        pRoom.StageDiscreteW,
			StageDiscreteH:        pRoom.StageDiscreteH,
			StageTileW:            pRoom.StageTileW,
			StageTileH:            pRoom.StageTileH,

			IntervalToPing:                  int32(Constants.Ws.IntervalToPing),
			WillKickIfInactiveFor:           int32(Constants.Ws.WillKickIfInactiveFor),
			BattleDurationNanos:             pRoom.BattleDurationNanos,
			ServerFps:                       pRoom.ServerFps,
			InputDelayFrames:                pRoom.InputDelayFrames,
			InputScaleFrames:                pRoom.InputScaleFrames,
			NstDelayFrames:                  pRoom.NstDelayFrames,
			InputFrameUpsyncDelayTolerance:  pRoom.InputFrameUpsyncDelayTolerance,
			MaxChasingRenderFramesPerUpdate: pRoom.MaxChasingRenderFramesPerUpdate,
			PlayerBattleState:               pThePlayer.BattleState, // For frontend to know whether it's rejoining
			RollbackEstimatedDt:             pRoom.RollbackEstimatedDt,
			RollbackEstimatedDtMillis:       pRoom.RollbackEstimatedDtMillis,
			RollbackEstimatedDtNanos:        pRoom.RollbackEstimatedDtNanos,
		}

		resp := &pb.WsResp{
			Ret:         int32(Constants.RetCode.Ok),
			EchoedMsgId: int32(0),
			Act:         models.DOWNSYNC_MSG_ACT_HB_REQ,
			BciFrame:    bciFrame,
		}

		Logger.Debug("Sending downsync HeartbeatRequirements:", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Any("resp", resp))

		theBytes, marshalErr := proto.Marshal(resp)
		if nil != marshalErr {
			Logger.Error("Error marshalling HeartbeatRequirements:", zap.Any("the error", marshalErr), zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId))
			signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, fmt.Sprintf("Error marshalling HeartbeatRequirements, playerId == %v and roomId == %v!", playerId, pRoom.Id))
		}

		if err := conn.WriteMessage(websocket.BinaryMessage, theBytes); nil != err {
			Logger.Error("HeartbeatRequirements resp not written:", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Error(err))
			signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, fmt.Sprintf("HeartbeatRequirements resp not written to roomId=%v, playerId == %v!", pRoom.Id, playerId))
		}
	}

	/*
		  TODO

		  Is there a way to EXPLICITLY make this "receivingLoopAgainstPlayer/conn.ReadXXX(...)" edge-triggered or yield/park otherwise? For example a C-style equivalent would be as follows.

		  ```
			receivingLoopAgainstPlayer := func() error {
				defer func() {
					if r := recover(); r != nil {
						Logger.Warn("Goroutine `receivingLoopAgainstPlayer`, recovery spot#1, recovered from: ", zap.Any("panic", r))
					}
					Logger.Info("Goroutine `receivingLoopAgainstPlayer` is stopped for:", zap.Any("playerId", playerId), zap.Any("roomId", pRoom.Id))
				}()

		    // Set O_NONBLOCK on "fdOfThisConn".
		    int flags = fcntl(fdOfThisConn, F_GETFL, 0);
		    fcntl(fdOfThisConn, F_SETFL, flags | O_NONBLOCK);

		    int ep_fd = epoll_create1(0);
		    epoll_event ev;
		    ev.data.fd = fdOfThisConn;
		    ev.events = (EPOLLIN | EPOLLET | CUSTOM_SIGNAL_TO_CLOSE); // Is this possible?
		    epoll_ctl(ep_fd, EPOLL_CTL_ADD, fdOfThisConn, &ev);
		    epoll_event *evs = (epoll_event*)calloc(MAXEVENTS, sizeof(epoll_event));

		    bool localAwarenessOfSignaledToClose = false;

		    while(true) {
		      if (true == localAwarenessOfSignaledToClose) {
		        return;
		      }

		      // Would yield the current KernelThread and park it to a "queue" for later being unparked from the same "queue", thus resumed running. See http://web.stanford.edu/~hhli/CS110Notes/CS110NotesCollection/Topic%204%20Networking%20(5).html for more information. However, multiple "goroutine"s might share a same KernelThread and could be an issue for yielding.
		      int n = epoll_wait(ep_fd, evs, MAXEVENTS, -1);

		      for (int i = 0; i < n; ++i) {
		        if (evs[i].data.fd == fdOfThisConn) {
		          if (
		              (evs[i].events & EPOLLERR) ||
		              (evs[i].events & EPOLLHUP) ||
		              (evs[i].events & CUSTOM_SIGNAL_TO_CLOSE)
		            ) {
		            signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "")
		            localAwarenessOfSignaledToClose = true;
		            break;
		          }
		          int nbytes = 0;
		          while(nbytes = recv(fdOfThisConn, buff, sizeof(buff)) && 0 < nbytes) {
		            ...
		          }
		          // Now that "0 == nbytes" or "EWOULDBLOCK == nbytes" or other errors came up.
		          continue;
		        }
		      }
		    }
		  }

		  ```
		  -- YFLu, 2020-07-03
	*/

	// Starts the receiving loop against the client-side
	receivingLoopAgainstPlayer := func() error {
		defer func() {
			if r := recover(); r != nil {
				Logger.Warn("Goroutine `receivingLoopAgainstPlayer`, recovery spot#1, recovered from: ", zap.Any("panic", r))
			}
			Logger.Info("Goroutine `receivingLoopAgainstPlayer` is stopped for:", zap.Any("playerId", playerId), zap.Any("roomId", pRoom.Id))
		}()
		for {
			if swapped := atomic.CompareAndSwapInt32(pConnHasBeenSignaledToClose, 1, 1); swapped {
				return nil
			}

			// Tries to receive from client-side in a non-blocking manner.
			_, bytes, err := conn.ReadMessage()
			if nil != err {
				Logger.Error("About to `signalToCloseConnOfThisPlayer`", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Error(err))
				signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "")
				return nil
			}

			pReq := new(pb.WsReq)
			unmarshalErr := proto.Unmarshal(bytes, pReq)
			if nil != unmarshalErr {
				Logger.Error("About to `signalToCloseConnOfThisPlayer`", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Error(unmarshalErr))
				signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "")
			}

			// Logger.Info("Received request message from client", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Any("pReq", pReq))

			switch pReq.Act {
			case models.UPSYNC_MSG_ACT_HB_PING:
				startOrFeedHeartbeatWatchdog(conn)
			case models.UPSYNC_MSG_ACT_PLAYER_CMD:
				startOrFeedHeartbeatWatchdog(conn)
				pRoom.OnBattleCmdReceived(pReq)
			case models.UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK:
				res := pRoom.OnPlayerBattleColliderAcked(int32(playerId))
				if false == res {
					Logger.Error("About to `signalToCloseConnOfThisPlayer`", zap.Any("roomId", pRoom.Id), zap.Any("playerId", playerId), zap.Error(err))
					signalToCloseConnOfThisPlayer(Constants.RetCode.UnknownError, "")
					return nil
				}
			default:
			}
		}
		return nil
	}

	startOrFeedHeartbeatWatchdog(conn)
	go receivingLoopAgainstPlayer()
}
