#!/bin/bash

# GOLANG part
# You have to download the OS binary "protoc" from `https://developers.google.com/protocol-buffers/docs/downloads` and set it to $PATH appropriately.
# You have to install `proto-gen-go` by `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest` as instructed in https://developers.google.com/protocol-buffers/docs/gotutorial#compiling-your-protocol-buffers too.

golang_basedir_1=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/dnmshared
protoc -I=$golang_basedir_1/../frontend/assets/resources/pbfiles/ --go_out=. geometry.proto 
echo "GOLANG part 1 done"

# [WARNING] The following "room_downsync_frame.proto" is generated in another Go package than "geometry.proto", but the generated Go codes are also required to work with imports correctly!
golang_basedir_2=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/jsexport
protoc -I=$golang_basedir_2/../frontend/assets/resources/pbfiles/ --go_out=. room_downsync_frame.proto 
echo "GOLANG part 2 done"

# JS part
js_basedir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/frontend
js_outdir=$js_basedir/assets/scripts/modules

# You have to install the commands according to https://www.npmjs.com/package/protobufjs. Use `npm -g ll` to see where the commands are installed and add them to PATH.
# npm install -g protobufjs 
# npm install -g protobufjs-cli 

# The specific filename is respected by "frontend/build-templates/wechatgame/game.js".
pbjs -t static-module -w commonjs --keep-case --force-message -o $js_outdir/room_downsync_frame_proto_bundle.forcemsg.js $js_basedir/assets/resources/pbfiles/geometry.proto $js_basedir/assets/resources/pbfiles/room_downsync_frame.proto

if [[ $OSTYPE == 'darwin'* ]]; then
	sed -i '' -e 's#require("protobufjs/minimal")#require("./protobuf-with-floating-num-decoding-endianess-toggle")#g' $js_outdir/room_downsync_frame_proto_bundle.forcemsg.js 
else 
	sed -i 's#require("protobufjs/minimal")#require("./protobuf-with-floating-num-decoding-endianess-toggle")#g' $js_outdir/room_downsync_frame_proto_bundle.forcemsg.js 
fi

echo "JavaScript part done"
