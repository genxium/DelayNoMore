#!/bin/bash

# GOLANG part
# You have to download the OS binary "protoc" from `https://developers.google.com/protocol-buffers/docs/downloads` and set it to $PATH appropriately.
# You have to install `proto-gen-go` by `go get -u github.com/golang/protobuf/protoc-gen-go` as instructed in https://developers.google.com/protocol-buffers/docs/gotutorial too.

golang_basedir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/battle_srv
mkdir -p $golang_basedir/pb_output
protoc -I=$golang_basedir/../frontend/assets/resources/pbfiles/ --go_out=$golang_basedir/pb_output room_downsync_frame.proto 

# JS part
js_basedir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/frontend
js_outdir=$js_basedir/assets/scripts/modules

# You have to install the commands according to https://www.npmjs.com/package/protobufjs. Use `npm -g ll` to see where the commands are installed and add them to PATH.
# npm install -g protobufjs 
# npm install -g protobufjs-cli 

# The specific filename is respected by "frontend/build-templates/wechatgame/game.js".
pbjs -t static-module -w commonjs --keep-case --force-message -o $js_outdir/room_downsync_frame_proto_bundle.forcemsg.js $js_basedir/assets/resources/pbfiles/room_downsync_frame.proto

sed -i 's#require("protobufjs/minimal")#require("./protobuf-with-floating-num-decoding-endianess-toggle")#g' $js_outdir/room_downsync_frame_proto_bundle.forcemsg.js
