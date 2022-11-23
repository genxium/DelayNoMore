/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("./protobuf-with-floating-num-decoding-endianess-toggle");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.sharedprotos = (function() {

    /**
     * Namespace sharedprotos.
     * @exports sharedprotos
     * @namespace
     */
    var sharedprotos = {};

    sharedprotos.Direction = (function() {

        /**
         * Properties of a Direction.
         * @memberof sharedprotos
         * @interface IDirection
         * @property {number|null} [dx] Direction dx
         * @property {number|null} [dy] Direction dy
         */

        /**
         * Constructs a new Direction.
         * @memberof sharedprotos
         * @classdesc Represents a Direction.
         * @implements IDirection
         * @constructor
         * @param {sharedprotos.IDirection=} [properties] Properties to set
         */
        function Direction(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Direction dx.
         * @member {number} dx
         * @memberof sharedprotos.Direction
         * @instance
         */
        Direction.prototype.dx = 0;

        /**
         * Direction dy.
         * @member {number} dy
         * @memberof sharedprotos.Direction
         * @instance
         */
        Direction.prototype.dy = 0;

        /**
         * Creates a new Direction instance using the specified properties.
         * @function create
         * @memberof sharedprotos.Direction
         * @static
         * @param {sharedprotos.IDirection=} [properties] Properties to set
         * @returns {sharedprotos.Direction} Direction instance
         */
        Direction.create = function create(properties) {
            return new Direction(properties);
        };

        /**
         * Encodes the specified Direction message. Does not implicitly {@link sharedprotos.Direction.verify|verify} messages.
         * @function encode
         * @memberof sharedprotos.Direction
         * @static
         * @param {sharedprotos.Direction} message Direction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Direction.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.dx != null && Object.hasOwnProperty.call(message, "dx"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.dx);
            if (message.dy != null && Object.hasOwnProperty.call(message, "dy"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.dy);
            return writer;
        };

        /**
         * Encodes the specified Direction message, length delimited. Does not implicitly {@link sharedprotos.Direction.verify|verify} messages.
         * @function encodeDelimited
         * @memberof sharedprotos.Direction
         * @static
         * @param {sharedprotos.Direction} message Direction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Direction.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Direction message from the specified reader or buffer.
         * @function decode
         * @memberof sharedprotos.Direction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {sharedprotos.Direction} Direction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Direction.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.sharedprotos.Direction();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.dx = reader.int32();
                        break;
                    }
                case 2: {
                        message.dy = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Direction message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof sharedprotos.Direction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {sharedprotos.Direction} Direction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Direction.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Direction message.
         * @function verify
         * @memberof sharedprotos.Direction
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Direction.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.dx != null && message.hasOwnProperty("dx"))
                if (!$util.isInteger(message.dx))
                    return "dx: integer expected";
            if (message.dy != null && message.hasOwnProperty("dy"))
                if (!$util.isInteger(message.dy))
                    return "dy: integer expected";
            return null;
        };

        /**
         * Creates a Direction message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof sharedprotos.Direction
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {sharedprotos.Direction} Direction
         */
        Direction.fromObject = function fromObject(object) {
            if (object instanceof $root.sharedprotos.Direction)
                return object;
            var message = new $root.sharedprotos.Direction();
            if (object.dx != null)
                message.dx = object.dx | 0;
            if (object.dy != null)
                message.dy = object.dy | 0;
            return message;
        };

        /**
         * Creates a plain object from a Direction message. Also converts values to other types if specified.
         * @function toObject
         * @memberof sharedprotos.Direction
         * @static
         * @param {sharedprotos.Direction} message Direction
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Direction.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.dx = 0;
                object.dy = 0;
            }
            if (message.dx != null && message.hasOwnProperty("dx"))
                object.dx = message.dx;
            if (message.dy != null && message.hasOwnProperty("dy"))
                object.dy = message.dy;
            return object;
        };

        /**
         * Converts this Direction to JSON.
         * @function toJSON
         * @memberof sharedprotos.Direction
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Direction.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Direction
         * @function getTypeUrl
         * @memberof sharedprotos.Direction
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Direction.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/sharedprotos.Direction";
        };

        return Direction;
    })();

    sharedprotos.Vec2D = (function() {

        /**
         * Properties of a Vec2D.
         * @memberof sharedprotos
         * @interface IVec2D
         * @property {number|null} [x] Vec2D x
         * @property {number|null} [y] Vec2D y
         */

        /**
         * Constructs a new Vec2D.
         * @memberof sharedprotos
         * @classdesc Represents a Vec2D.
         * @implements IVec2D
         * @constructor
         * @param {sharedprotos.IVec2D=} [properties] Properties to set
         */
        function Vec2D(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Vec2D x.
         * @member {number} x
         * @memberof sharedprotos.Vec2D
         * @instance
         */
        Vec2D.prototype.x = 0;

        /**
         * Vec2D y.
         * @member {number} y
         * @memberof sharedprotos.Vec2D
         * @instance
         */
        Vec2D.prototype.y = 0;

        /**
         * Creates a new Vec2D instance using the specified properties.
         * @function create
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {sharedprotos.IVec2D=} [properties] Properties to set
         * @returns {sharedprotos.Vec2D} Vec2D instance
         */
        Vec2D.create = function create(properties) {
            return new Vec2D(properties);
        };

        /**
         * Encodes the specified Vec2D message. Does not implicitly {@link sharedprotos.Vec2D.verify|verify} messages.
         * @function encode
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {sharedprotos.Vec2D} message Vec2D message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Vec2D.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 1, wireType 1 =*/9).double(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 2, wireType 1 =*/17).double(message.y);
            return writer;
        };

        /**
         * Encodes the specified Vec2D message, length delimited. Does not implicitly {@link sharedprotos.Vec2D.verify|verify} messages.
         * @function encodeDelimited
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {sharedprotos.Vec2D} message Vec2D message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Vec2D.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Vec2D message from the specified reader or buffer.
         * @function decode
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {sharedprotos.Vec2D} Vec2D
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Vec2D.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.sharedprotos.Vec2D();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.x = reader.double();
                        break;
                    }
                case 2: {
                        message.y = reader.double();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Vec2D message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {sharedprotos.Vec2D} Vec2D
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Vec2D.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Vec2D message.
         * @function verify
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Vec2D.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.x != null && message.hasOwnProperty("x"))
                if (typeof message.x !== "number")
                    return "x: number expected";
            if (message.y != null && message.hasOwnProperty("y"))
                if (typeof message.y !== "number")
                    return "y: number expected";
            return null;
        };

        /**
         * Creates a Vec2D message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {sharedprotos.Vec2D} Vec2D
         */
        Vec2D.fromObject = function fromObject(object) {
            if (object instanceof $root.sharedprotos.Vec2D)
                return object;
            var message = new $root.sharedprotos.Vec2D();
            if (object.x != null)
                message.x = Number(object.x);
            if (object.y != null)
                message.y = Number(object.y);
            return message;
        };

        /**
         * Creates a plain object from a Vec2D message. Also converts values to other types if specified.
         * @function toObject
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {sharedprotos.Vec2D} message Vec2D
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Vec2D.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.x = 0;
                object.y = 0;
            }
            if (message.x != null && message.hasOwnProperty("x"))
                object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
            if (message.y != null && message.hasOwnProperty("y"))
                object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
            return object;
        };

        /**
         * Converts this Vec2D to JSON.
         * @function toJSON
         * @memberof sharedprotos.Vec2D
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Vec2D.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Vec2D
         * @function getTypeUrl
         * @memberof sharedprotos.Vec2D
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Vec2D.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/sharedprotos.Vec2D";
        };

        return Vec2D;
    })();

    sharedprotos.Polygon2D = (function() {

        /**
         * Properties of a Polygon2D.
         * @memberof sharedprotos
         * @interface IPolygon2D
         * @property {sharedprotos.Vec2D|null} [anchor] Polygon2D anchor
         * @property {Array.<sharedprotos.Vec2D>|null} [points] Polygon2D points
         */

        /**
         * Constructs a new Polygon2D.
         * @memberof sharedprotos
         * @classdesc Represents a Polygon2D.
         * @implements IPolygon2D
         * @constructor
         * @param {sharedprotos.IPolygon2D=} [properties] Properties to set
         */
        function Polygon2D(properties) {
            this.points = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Polygon2D anchor.
         * @member {sharedprotos.Vec2D|null|undefined} anchor
         * @memberof sharedprotos.Polygon2D
         * @instance
         */
        Polygon2D.prototype.anchor = null;

        /**
         * Polygon2D points.
         * @member {Array.<sharedprotos.Vec2D>} points
         * @memberof sharedprotos.Polygon2D
         * @instance
         */
        Polygon2D.prototype.points = $util.emptyArray;

        /**
         * Creates a new Polygon2D instance using the specified properties.
         * @function create
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {sharedprotos.IPolygon2D=} [properties] Properties to set
         * @returns {sharedprotos.Polygon2D} Polygon2D instance
         */
        Polygon2D.create = function create(properties) {
            return new Polygon2D(properties);
        };

        /**
         * Encodes the specified Polygon2D message. Does not implicitly {@link sharedprotos.Polygon2D.verify|verify} messages.
         * @function encode
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {sharedprotos.Polygon2D} message Polygon2D message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Polygon2D.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.anchor != null && Object.hasOwnProperty.call(message, "anchor"))
                $root.sharedprotos.Vec2D.encode(message.anchor, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.points != null && message.points.length)
                for (var i = 0; i < message.points.length; ++i)
                    $root.sharedprotos.Vec2D.encode(message.points[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Polygon2D message, length delimited. Does not implicitly {@link sharedprotos.Polygon2D.verify|verify} messages.
         * @function encodeDelimited
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {sharedprotos.Polygon2D} message Polygon2D message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Polygon2D.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Polygon2D message from the specified reader or buffer.
         * @function decode
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {sharedprotos.Polygon2D} Polygon2D
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Polygon2D.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.sharedprotos.Polygon2D();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.anchor = $root.sharedprotos.Vec2D.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        if (!(message.points && message.points.length))
                            message.points = [];
                        message.points.push($root.sharedprotos.Vec2D.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Polygon2D message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {sharedprotos.Polygon2D} Polygon2D
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Polygon2D.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Polygon2D message.
         * @function verify
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Polygon2D.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.anchor != null && message.hasOwnProperty("anchor")) {
                var error = $root.sharedprotos.Vec2D.verify(message.anchor);
                if (error)
                    return "anchor." + error;
            }
            if (message.points != null && message.hasOwnProperty("points")) {
                if (!Array.isArray(message.points))
                    return "points: array expected";
                for (var i = 0; i < message.points.length; ++i) {
                    var error = $root.sharedprotos.Vec2D.verify(message.points[i]);
                    if (error)
                        return "points." + error;
                }
            }
            return null;
        };

        /**
         * Creates a Polygon2D message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {sharedprotos.Polygon2D} Polygon2D
         */
        Polygon2D.fromObject = function fromObject(object) {
            if (object instanceof $root.sharedprotos.Polygon2D)
                return object;
            var message = new $root.sharedprotos.Polygon2D();
            if (object.anchor != null) {
                if (typeof object.anchor !== "object")
                    throw TypeError(".sharedprotos.Polygon2D.anchor: object expected");
                message.anchor = $root.sharedprotos.Vec2D.fromObject(object.anchor);
            }
            if (object.points) {
                if (!Array.isArray(object.points))
                    throw TypeError(".sharedprotos.Polygon2D.points: array expected");
                message.points = [];
                for (var i = 0; i < object.points.length; ++i) {
                    if (typeof object.points[i] !== "object")
                        throw TypeError(".sharedprotos.Polygon2D.points: object expected");
                    message.points[i] = $root.sharedprotos.Vec2D.fromObject(object.points[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a Polygon2D message. Also converts values to other types if specified.
         * @function toObject
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {sharedprotos.Polygon2D} message Polygon2D
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Polygon2D.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.points = [];
            if (options.defaults)
                object.anchor = null;
            if (message.anchor != null && message.hasOwnProperty("anchor"))
                object.anchor = $root.sharedprotos.Vec2D.toObject(message.anchor, options);
            if (message.points && message.points.length) {
                object.points = [];
                for (var j = 0; j < message.points.length; ++j)
                    object.points[j] = $root.sharedprotos.Vec2D.toObject(message.points[j], options);
            }
            return object;
        };

        /**
         * Converts this Polygon2D to JSON.
         * @function toJSON
         * @memberof sharedprotos.Polygon2D
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Polygon2D.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Polygon2D
         * @function getTypeUrl
         * @memberof sharedprotos.Polygon2D
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Polygon2D.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/sharedprotos.Polygon2D";
        };

        return Polygon2D;
    })();

    sharedprotos.Vec2DList = (function() {

        /**
         * Properties of a Vec2DList.
         * @memberof sharedprotos
         * @interface IVec2DList
         * @property {Array.<sharedprotos.Vec2D>|null} [eles] Vec2DList eles
         */

        /**
         * Constructs a new Vec2DList.
         * @memberof sharedprotos
         * @classdesc Represents a Vec2DList.
         * @implements IVec2DList
         * @constructor
         * @param {sharedprotos.IVec2DList=} [properties] Properties to set
         */
        function Vec2DList(properties) {
            this.eles = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Vec2DList eles.
         * @member {Array.<sharedprotos.Vec2D>} eles
         * @memberof sharedprotos.Vec2DList
         * @instance
         */
        Vec2DList.prototype.eles = $util.emptyArray;

        /**
         * Creates a new Vec2DList instance using the specified properties.
         * @function create
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {sharedprotos.IVec2DList=} [properties] Properties to set
         * @returns {sharedprotos.Vec2DList} Vec2DList instance
         */
        Vec2DList.create = function create(properties) {
            return new Vec2DList(properties);
        };

        /**
         * Encodes the specified Vec2DList message. Does not implicitly {@link sharedprotos.Vec2DList.verify|verify} messages.
         * @function encode
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {sharedprotos.Vec2DList} message Vec2DList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Vec2DList.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.eles != null && message.eles.length)
                for (var i = 0; i < message.eles.length; ++i)
                    $root.sharedprotos.Vec2D.encode(message.eles[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Vec2DList message, length delimited. Does not implicitly {@link sharedprotos.Vec2DList.verify|verify} messages.
         * @function encodeDelimited
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {sharedprotos.Vec2DList} message Vec2DList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Vec2DList.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Vec2DList message from the specified reader or buffer.
         * @function decode
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {sharedprotos.Vec2DList} Vec2DList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Vec2DList.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.sharedprotos.Vec2DList();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.eles && message.eles.length))
                            message.eles = [];
                        message.eles.push($root.sharedprotos.Vec2D.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Vec2DList message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {sharedprotos.Vec2DList} Vec2DList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Vec2DList.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Vec2DList message.
         * @function verify
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Vec2DList.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.eles != null && message.hasOwnProperty("eles")) {
                if (!Array.isArray(message.eles))
                    return "eles: array expected";
                for (var i = 0; i < message.eles.length; ++i) {
                    var error = $root.sharedprotos.Vec2D.verify(message.eles[i]);
                    if (error)
                        return "eles." + error;
                }
            }
            return null;
        };

        /**
         * Creates a Vec2DList message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {sharedprotos.Vec2DList} Vec2DList
         */
        Vec2DList.fromObject = function fromObject(object) {
            if (object instanceof $root.sharedprotos.Vec2DList)
                return object;
            var message = new $root.sharedprotos.Vec2DList();
            if (object.eles) {
                if (!Array.isArray(object.eles))
                    throw TypeError(".sharedprotos.Vec2DList.eles: array expected");
                message.eles = [];
                for (var i = 0; i < object.eles.length; ++i) {
                    if (typeof object.eles[i] !== "object")
                        throw TypeError(".sharedprotos.Vec2DList.eles: object expected");
                    message.eles[i] = $root.sharedprotos.Vec2D.fromObject(object.eles[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a Vec2DList message. Also converts values to other types if specified.
         * @function toObject
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {sharedprotos.Vec2DList} message Vec2DList
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Vec2DList.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.eles = [];
            if (message.eles && message.eles.length) {
                object.eles = [];
                for (var j = 0; j < message.eles.length; ++j)
                    object.eles[j] = $root.sharedprotos.Vec2D.toObject(message.eles[j], options);
            }
            return object;
        };

        /**
         * Converts this Vec2DList to JSON.
         * @function toJSON
         * @memberof sharedprotos.Vec2DList
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Vec2DList.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Vec2DList
         * @function getTypeUrl
         * @memberof sharedprotos.Vec2DList
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Vec2DList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/sharedprotos.Vec2DList";
        };

        return Vec2DList;
    })();

    sharedprotos.Polygon2DList = (function() {

        /**
         * Properties of a Polygon2DList.
         * @memberof sharedprotos
         * @interface IPolygon2DList
         * @property {Array.<sharedprotos.Polygon2D>|null} [eles] Polygon2DList eles
         */

        /**
         * Constructs a new Polygon2DList.
         * @memberof sharedprotos
         * @classdesc Represents a Polygon2DList.
         * @implements IPolygon2DList
         * @constructor
         * @param {sharedprotos.IPolygon2DList=} [properties] Properties to set
         */
        function Polygon2DList(properties) {
            this.eles = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Polygon2DList eles.
         * @member {Array.<sharedprotos.Polygon2D>} eles
         * @memberof sharedprotos.Polygon2DList
         * @instance
         */
        Polygon2DList.prototype.eles = $util.emptyArray;

        /**
         * Creates a new Polygon2DList instance using the specified properties.
         * @function create
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {sharedprotos.IPolygon2DList=} [properties] Properties to set
         * @returns {sharedprotos.Polygon2DList} Polygon2DList instance
         */
        Polygon2DList.create = function create(properties) {
            return new Polygon2DList(properties);
        };

        /**
         * Encodes the specified Polygon2DList message. Does not implicitly {@link sharedprotos.Polygon2DList.verify|verify} messages.
         * @function encode
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {sharedprotos.Polygon2DList} message Polygon2DList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Polygon2DList.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.eles != null && message.eles.length)
                for (var i = 0; i < message.eles.length; ++i)
                    $root.sharedprotos.Polygon2D.encode(message.eles[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Polygon2DList message, length delimited. Does not implicitly {@link sharedprotos.Polygon2DList.verify|verify} messages.
         * @function encodeDelimited
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {sharedprotos.Polygon2DList} message Polygon2DList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Polygon2DList.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Polygon2DList message from the specified reader or buffer.
         * @function decode
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {sharedprotos.Polygon2DList} Polygon2DList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Polygon2DList.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.sharedprotos.Polygon2DList();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.eles && message.eles.length))
                            message.eles = [];
                        message.eles.push($root.sharedprotos.Polygon2D.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Polygon2DList message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {sharedprotos.Polygon2DList} Polygon2DList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Polygon2DList.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Polygon2DList message.
         * @function verify
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Polygon2DList.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.eles != null && message.hasOwnProperty("eles")) {
                if (!Array.isArray(message.eles))
                    return "eles: array expected";
                for (var i = 0; i < message.eles.length; ++i) {
                    var error = $root.sharedprotos.Polygon2D.verify(message.eles[i]);
                    if (error)
                        return "eles." + error;
                }
            }
            return null;
        };

        /**
         * Creates a Polygon2DList message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {sharedprotos.Polygon2DList} Polygon2DList
         */
        Polygon2DList.fromObject = function fromObject(object) {
            if (object instanceof $root.sharedprotos.Polygon2DList)
                return object;
            var message = new $root.sharedprotos.Polygon2DList();
            if (object.eles) {
                if (!Array.isArray(object.eles))
                    throw TypeError(".sharedprotos.Polygon2DList.eles: array expected");
                message.eles = [];
                for (var i = 0; i < object.eles.length; ++i) {
                    if (typeof object.eles[i] !== "object")
                        throw TypeError(".sharedprotos.Polygon2DList.eles: object expected");
                    message.eles[i] = $root.sharedprotos.Polygon2D.fromObject(object.eles[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a Polygon2DList message. Also converts values to other types if specified.
         * @function toObject
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {sharedprotos.Polygon2DList} message Polygon2DList
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Polygon2DList.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.eles = [];
            if (message.eles && message.eles.length) {
                object.eles = [];
                for (var j = 0; j < message.eles.length; ++j)
                    object.eles[j] = $root.sharedprotos.Polygon2D.toObject(message.eles[j], options);
            }
            return object;
        };

        /**
         * Converts this Polygon2DList to JSON.
         * @function toJSON
         * @memberof sharedprotos.Polygon2DList
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Polygon2DList.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Polygon2DList
         * @function getTypeUrl
         * @memberof sharedprotos.Polygon2DList
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Polygon2DList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/sharedprotos.Polygon2DList";
        };

        return Polygon2DList;
    })();

    return sharedprotos;
})();

$root.protos = (function() {

    /**
     * Namespace protos.
     * @exports protos
     * @namespace
     */
    var protos = {};

    protos.BattleColliderInfo = (function() {

        /**
         * Properties of a BattleColliderInfo.
         * @memberof protos
         * @interface IBattleColliderInfo
         * @property {string|null} [stageName] BattleColliderInfo stageName
         * @property {Object.<string,sharedprotos.Vec2DList>|null} [strToVec2DListMap] BattleColliderInfo strToVec2DListMap
         * @property {Object.<string,sharedprotos.Polygon2DList>|null} [strToPolygon2DListMap] BattleColliderInfo strToPolygon2DListMap
         * @property {number|null} [stageDiscreteW] BattleColliderInfo stageDiscreteW
         * @property {number|null} [stageDiscreteH] BattleColliderInfo stageDiscreteH
         * @property {number|null} [stageTileW] BattleColliderInfo stageTileW
         * @property {number|null} [stageTileH] BattleColliderInfo stageTileH
         * @property {number|null} [intervalToPing] BattleColliderInfo intervalToPing
         * @property {number|null} [willKickIfInactiveFor] BattleColliderInfo willKickIfInactiveFor
         * @property {number|null} [boundRoomId] BattleColliderInfo boundRoomId
         * @property {number|Long|null} [battleDurationNanos] BattleColliderInfo battleDurationNanos
         * @property {number|null} [serverFps] BattleColliderInfo serverFps
         * @property {number|null} [inputDelayFrames] BattleColliderInfo inputDelayFrames
         * @property {number|null} [inputScaleFrames] BattleColliderInfo inputScaleFrames
         * @property {number|null} [nstDelayFrames] BattleColliderInfo nstDelayFrames
         * @property {number|null} [inputFrameUpsyncDelayTolerance] BattleColliderInfo inputFrameUpsyncDelayTolerance
         * @property {number|null} [maxChasingRenderFramesPerUpdate] BattleColliderInfo maxChasingRenderFramesPerUpdate
         * @property {number|null} [playerBattleState] BattleColliderInfo playerBattleState
         * @property {number|null} [rollbackEstimatedDtMillis] BattleColliderInfo rollbackEstimatedDtMillis
         * @property {number|Long|null} [rollbackEstimatedDtNanos] BattleColliderInfo rollbackEstimatedDtNanos
         * @property {number|null} [worldToVirtualGridRatio] BattleColliderInfo worldToVirtualGridRatio
         * @property {number|null} [virtualGridToWorldRatio] BattleColliderInfo virtualGridToWorldRatio
         * @property {number|null} [spAtkLookupFrames] BattleColliderInfo spAtkLookupFrames
         * @property {number|null} [renderCacheSize] BattleColliderInfo renderCacheSize
         */

        /**
         * Constructs a new BattleColliderInfo.
         * @memberof protos
         * @classdesc Represents a BattleColliderInfo.
         * @implements IBattleColliderInfo
         * @constructor
         * @param {protos.IBattleColliderInfo=} [properties] Properties to set
         */
        function BattleColliderInfo(properties) {
            this.strToVec2DListMap = {};
            this.strToPolygon2DListMap = {};
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * BattleColliderInfo stageName.
         * @member {string} stageName
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.stageName = "";

        /**
         * BattleColliderInfo strToVec2DListMap.
         * @member {Object.<string,sharedprotos.Vec2DList>} strToVec2DListMap
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.strToVec2DListMap = $util.emptyObject;

        /**
         * BattleColliderInfo strToPolygon2DListMap.
         * @member {Object.<string,sharedprotos.Polygon2DList>} strToPolygon2DListMap
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.strToPolygon2DListMap = $util.emptyObject;

        /**
         * BattleColliderInfo stageDiscreteW.
         * @member {number} stageDiscreteW
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.stageDiscreteW = 0;

        /**
         * BattleColliderInfo stageDiscreteH.
         * @member {number} stageDiscreteH
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.stageDiscreteH = 0;

        /**
         * BattleColliderInfo stageTileW.
         * @member {number} stageTileW
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.stageTileW = 0;

        /**
         * BattleColliderInfo stageTileH.
         * @member {number} stageTileH
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.stageTileH = 0;

        /**
         * BattleColliderInfo intervalToPing.
         * @member {number} intervalToPing
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.intervalToPing = 0;

        /**
         * BattleColliderInfo willKickIfInactiveFor.
         * @member {number} willKickIfInactiveFor
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.willKickIfInactiveFor = 0;

        /**
         * BattleColliderInfo boundRoomId.
         * @member {number} boundRoomId
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.boundRoomId = 0;

        /**
         * BattleColliderInfo battleDurationNanos.
         * @member {number|Long} battleDurationNanos
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.battleDurationNanos = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * BattleColliderInfo serverFps.
         * @member {number} serverFps
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.serverFps = 0;

        /**
         * BattleColliderInfo inputDelayFrames.
         * @member {number} inputDelayFrames
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.inputDelayFrames = 0;

        /**
         * BattleColliderInfo inputScaleFrames.
         * @member {number} inputScaleFrames
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.inputScaleFrames = 0;

        /**
         * BattleColliderInfo nstDelayFrames.
         * @member {number} nstDelayFrames
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.nstDelayFrames = 0;

        /**
         * BattleColliderInfo inputFrameUpsyncDelayTolerance.
         * @member {number} inputFrameUpsyncDelayTolerance
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.inputFrameUpsyncDelayTolerance = 0;

        /**
         * BattleColliderInfo maxChasingRenderFramesPerUpdate.
         * @member {number} maxChasingRenderFramesPerUpdate
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.maxChasingRenderFramesPerUpdate = 0;

        /**
         * BattleColliderInfo playerBattleState.
         * @member {number} playerBattleState
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.playerBattleState = 0;

        /**
         * BattleColliderInfo rollbackEstimatedDtMillis.
         * @member {number} rollbackEstimatedDtMillis
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.rollbackEstimatedDtMillis = 0;

        /**
         * BattleColliderInfo rollbackEstimatedDtNanos.
         * @member {number|Long} rollbackEstimatedDtNanos
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.rollbackEstimatedDtNanos = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * BattleColliderInfo worldToVirtualGridRatio.
         * @member {number} worldToVirtualGridRatio
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.worldToVirtualGridRatio = 0;

        /**
         * BattleColliderInfo virtualGridToWorldRatio.
         * @member {number} virtualGridToWorldRatio
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.virtualGridToWorldRatio = 0;

        /**
         * BattleColliderInfo spAtkLookupFrames.
         * @member {number} spAtkLookupFrames
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.spAtkLookupFrames = 0;

        /**
         * BattleColliderInfo renderCacheSize.
         * @member {number} renderCacheSize
         * @memberof protos.BattleColliderInfo
         * @instance
         */
        BattleColliderInfo.prototype.renderCacheSize = 0;

        /**
         * Creates a new BattleColliderInfo instance using the specified properties.
         * @function create
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {protos.IBattleColliderInfo=} [properties] Properties to set
         * @returns {protos.BattleColliderInfo} BattleColliderInfo instance
         */
        BattleColliderInfo.create = function create(properties) {
            return new BattleColliderInfo(properties);
        };

        /**
         * Encodes the specified BattleColliderInfo message. Does not implicitly {@link protos.BattleColliderInfo.verify|verify} messages.
         * @function encode
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {protos.BattleColliderInfo} message BattleColliderInfo message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BattleColliderInfo.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.stageName != null && Object.hasOwnProperty.call(message, "stageName"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.stageName);
            if (message.strToVec2DListMap != null && Object.hasOwnProperty.call(message, "strToVec2DListMap"))
                for (var keys = Object.keys(message.strToVec2DListMap), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 2, wireType 2 =*/18).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                    $root.sharedprotos.Vec2DList.encode(message.strToVec2DListMap[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                }
            if (message.strToPolygon2DListMap != null && Object.hasOwnProperty.call(message, "strToPolygon2DListMap"))
                for (var keys = Object.keys(message.strToPolygon2DListMap), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 3, wireType 2 =*/26).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                    $root.sharedprotos.Polygon2DList.encode(message.strToPolygon2DListMap[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                }
            if (message.stageDiscreteW != null && Object.hasOwnProperty.call(message, "stageDiscreteW"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.stageDiscreteW);
            if (message.stageDiscreteH != null && Object.hasOwnProperty.call(message, "stageDiscreteH"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.stageDiscreteH);
            if (message.stageTileW != null && Object.hasOwnProperty.call(message, "stageTileW"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.stageTileW);
            if (message.stageTileH != null && Object.hasOwnProperty.call(message, "stageTileH"))
                writer.uint32(/* id 7, wireType 0 =*/56).int32(message.stageTileH);
            if (message.intervalToPing != null && Object.hasOwnProperty.call(message, "intervalToPing"))
                writer.uint32(/* id 8, wireType 0 =*/64).int32(message.intervalToPing);
            if (message.willKickIfInactiveFor != null && Object.hasOwnProperty.call(message, "willKickIfInactiveFor"))
                writer.uint32(/* id 9, wireType 0 =*/72).int32(message.willKickIfInactiveFor);
            if (message.boundRoomId != null && Object.hasOwnProperty.call(message, "boundRoomId"))
                writer.uint32(/* id 10, wireType 0 =*/80).int32(message.boundRoomId);
            if (message.battleDurationNanos != null && Object.hasOwnProperty.call(message, "battleDurationNanos"))
                writer.uint32(/* id 11, wireType 0 =*/88).int64(message.battleDurationNanos);
            if (message.serverFps != null && Object.hasOwnProperty.call(message, "serverFps"))
                writer.uint32(/* id 12, wireType 0 =*/96).int32(message.serverFps);
            if (message.inputDelayFrames != null && Object.hasOwnProperty.call(message, "inputDelayFrames"))
                writer.uint32(/* id 13, wireType 0 =*/104).int32(message.inputDelayFrames);
            if (message.inputScaleFrames != null && Object.hasOwnProperty.call(message, "inputScaleFrames"))
                writer.uint32(/* id 14, wireType 0 =*/112).uint32(message.inputScaleFrames);
            if (message.nstDelayFrames != null && Object.hasOwnProperty.call(message, "nstDelayFrames"))
                writer.uint32(/* id 15, wireType 0 =*/120).int32(message.nstDelayFrames);
            if (message.inputFrameUpsyncDelayTolerance != null && Object.hasOwnProperty.call(message, "inputFrameUpsyncDelayTolerance"))
                writer.uint32(/* id 16, wireType 0 =*/128).int32(message.inputFrameUpsyncDelayTolerance);
            if (message.maxChasingRenderFramesPerUpdate != null && Object.hasOwnProperty.call(message, "maxChasingRenderFramesPerUpdate"))
                writer.uint32(/* id 17, wireType 0 =*/136).int32(message.maxChasingRenderFramesPerUpdate);
            if (message.playerBattleState != null && Object.hasOwnProperty.call(message, "playerBattleState"))
                writer.uint32(/* id 18, wireType 0 =*/144).int32(message.playerBattleState);
            if (message.rollbackEstimatedDtMillis != null && Object.hasOwnProperty.call(message, "rollbackEstimatedDtMillis"))
                writer.uint32(/* id 19, wireType 1 =*/153).double(message.rollbackEstimatedDtMillis);
            if (message.rollbackEstimatedDtNanos != null && Object.hasOwnProperty.call(message, "rollbackEstimatedDtNanos"))
                writer.uint32(/* id 20, wireType 0 =*/160).int64(message.rollbackEstimatedDtNanos);
            if (message.worldToVirtualGridRatio != null && Object.hasOwnProperty.call(message, "worldToVirtualGridRatio"))
                writer.uint32(/* id 21, wireType 1 =*/169).double(message.worldToVirtualGridRatio);
            if (message.virtualGridToWorldRatio != null && Object.hasOwnProperty.call(message, "virtualGridToWorldRatio"))
                writer.uint32(/* id 22, wireType 1 =*/177).double(message.virtualGridToWorldRatio);
            if (message.spAtkLookupFrames != null && Object.hasOwnProperty.call(message, "spAtkLookupFrames"))
                writer.uint32(/* id 23, wireType 0 =*/184).int32(message.spAtkLookupFrames);
            if (message.renderCacheSize != null && Object.hasOwnProperty.call(message, "renderCacheSize"))
                writer.uint32(/* id 24, wireType 0 =*/192).int32(message.renderCacheSize);
            return writer;
        };

        /**
         * Encodes the specified BattleColliderInfo message, length delimited. Does not implicitly {@link protos.BattleColliderInfo.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {protos.BattleColliderInfo} message BattleColliderInfo message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BattleColliderInfo.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a BattleColliderInfo message from the specified reader or buffer.
         * @function decode
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.BattleColliderInfo} BattleColliderInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BattleColliderInfo.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.BattleColliderInfo(), key, value;
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.stageName = reader.string();
                        break;
                    }
                case 2: {
                        if (message.strToVec2DListMap === $util.emptyObject)
                            message.strToVec2DListMap = {};
                        var end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = null;
                        while (reader.pos < end2) {
                            var tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = $root.sharedprotos.Vec2DList.decode(reader, reader.uint32());
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.strToVec2DListMap[key] = value;
                        break;
                    }
                case 3: {
                        if (message.strToPolygon2DListMap === $util.emptyObject)
                            message.strToPolygon2DListMap = {};
                        var end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = null;
                        while (reader.pos < end2) {
                            var tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = $root.sharedprotos.Polygon2DList.decode(reader, reader.uint32());
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.strToPolygon2DListMap[key] = value;
                        break;
                    }
                case 4: {
                        message.stageDiscreteW = reader.int32();
                        break;
                    }
                case 5: {
                        message.stageDiscreteH = reader.int32();
                        break;
                    }
                case 6: {
                        message.stageTileW = reader.int32();
                        break;
                    }
                case 7: {
                        message.stageTileH = reader.int32();
                        break;
                    }
                case 8: {
                        message.intervalToPing = reader.int32();
                        break;
                    }
                case 9: {
                        message.willKickIfInactiveFor = reader.int32();
                        break;
                    }
                case 10: {
                        message.boundRoomId = reader.int32();
                        break;
                    }
                case 11: {
                        message.battleDurationNanos = reader.int64();
                        break;
                    }
                case 12: {
                        message.serverFps = reader.int32();
                        break;
                    }
                case 13: {
                        message.inputDelayFrames = reader.int32();
                        break;
                    }
                case 14: {
                        message.inputScaleFrames = reader.uint32();
                        break;
                    }
                case 15: {
                        message.nstDelayFrames = reader.int32();
                        break;
                    }
                case 16: {
                        message.inputFrameUpsyncDelayTolerance = reader.int32();
                        break;
                    }
                case 17: {
                        message.maxChasingRenderFramesPerUpdate = reader.int32();
                        break;
                    }
                case 18: {
                        message.playerBattleState = reader.int32();
                        break;
                    }
                case 19: {
                        message.rollbackEstimatedDtMillis = reader.double();
                        break;
                    }
                case 20: {
                        message.rollbackEstimatedDtNanos = reader.int64();
                        break;
                    }
                case 21: {
                        message.worldToVirtualGridRatio = reader.double();
                        break;
                    }
                case 22: {
                        message.virtualGridToWorldRatio = reader.double();
                        break;
                    }
                case 23: {
                        message.spAtkLookupFrames = reader.int32();
                        break;
                    }
                case 24: {
                        message.renderCacheSize = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a BattleColliderInfo message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.BattleColliderInfo} BattleColliderInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BattleColliderInfo.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a BattleColliderInfo message.
         * @function verify
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        BattleColliderInfo.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.stageName != null && message.hasOwnProperty("stageName"))
                if (!$util.isString(message.stageName))
                    return "stageName: string expected";
            if (message.strToVec2DListMap != null && message.hasOwnProperty("strToVec2DListMap")) {
                if (!$util.isObject(message.strToVec2DListMap))
                    return "strToVec2DListMap: object expected";
                var key = Object.keys(message.strToVec2DListMap);
                for (var i = 0; i < key.length; ++i) {
                    var error = $root.sharedprotos.Vec2DList.verify(message.strToVec2DListMap[key[i]]);
                    if (error)
                        return "strToVec2DListMap." + error;
                }
            }
            if (message.strToPolygon2DListMap != null && message.hasOwnProperty("strToPolygon2DListMap")) {
                if (!$util.isObject(message.strToPolygon2DListMap))
                    return "strToPolygon2DListMap: object expected";
                var key = Object.keys(message.strToPolygon2DListMap);
                for (var i = 0; i < key.length; ++i) {
                    var error = $root.sharedprotos.Polygon2DList.verify(message.strToPolygon2DListMap[key[i]]);
                    if (error)
                        return "strToPolygon2DListMap." + error;
                }
            }
            if (message.stageDiscreteW != null && message.hasOwnProperty("stageDiscreteW"))
                if (!$util.isInteger(message.stageDiscreteW))
                    return "stageDiscreteW: integer expected";
            if (message.stageDiscreteH != null && message.hasOwnProperty("stageDiscreteH"))
                if (!$util.isInteger(message.stageDiscreteH))
                    return "stageDiscreteH: integer expected";
            if (message.stageTileW != null && message.hasOwnProperty("stageTileW"))
                if (!$util.isInteger(message.stageTileW))
                    return "stageTileW: integer expected";
            if (message.stageTileH != null && message.hasOwnProperty("stageTileH"))
                if (!$util.isInteger(message.stageTileH))
                    return "stageTileH: integer expected";
            if (message.intervalToPing != null && message.hasOwnProperty("intervalToPing"))
                if (!$util.isInteger(message.intervalToPing))
                    return "intervalToPing: integer expected";
            if (message.willKickIfInactiveFor != null && message.hasOwnProperty("willKickIfInactiveFor"))
                if (!$util.isInteger(message.willKickIfInactiveFor))
                    return "willKickIfInactiveFor: integer expected";
            if (message.boundRoomId != null && message.hasOwnProperty("boundRoomId"))
                if (!$util.isInteger(message.boundRoomId))
                    return "boundRoomId: integer expected";
            if (message.battleDurationNanos != null && message.hasOwnProperty("battleDurationNanos"))
                if (!$util.isInteger(message.battleDurationNanos) && !(message.battleDurationNanos && $util.isInteger(message.battleDurationNanos.low) && $util.isInteger(message.battleDurationNanos.high)))
                    return "battleDurationNanos: integer|Long expected";
            if (message.serverFps != null && message.hasOwnProperty("serverFps"))
                if (!$util.isInteger(message.serverFps))
                    return "serverFps: integer expected";
            if (message.inputDelayFrames != null && message.hasOwnProperty("inputDelayFrames"))
                if (!$util.isInteger(message.inputDelayFrames))
                    return "inputDelayFrames: integer expected";
            if (message.inputScaleFrames != null && message.hasOwnProperty("inputScaleFrames"))
                if (!$util.isInteger(message.inputScaleFrames))
                    return "inputScaleFrames: integer expected";
            if (message.nstDelayFrames != null && message.hasOwnProperty("nstDelayFrames"))
                if (!$util.isInteger(message.nstDelayFrames))
                    return "nstDelayFrames: integer expected";
            if (message.inputFrameUpsyncDelayTolerance != null && message.hasOwnProperty("inputFrameUpsyncDelayTolerance"))
                if (!$util.isInteger(message.inputFrameUpsyncDelayTolerance))
                    return "inputFrameUpsyncDelayTolerance: integer expected";
            if (message.maxChasingRenderFramesPerUpdate != null && message.hasOwnProperty("maxChasingRenderFramesPerUpdate"))
                if (!$util.isInteger(message.maxChasingRenderFramesPerUpdate))
                    return "maxChasingRenderFramesPerUpdate: integer expected";
            if (message.playerBattleState != null && message.hasOwnProperty("playerBattleState"))
                if (!$util.isInteger(message.playerBattleState))
                    return "playerBattleState: integer expected";
            if (message.rollbackEstimatedDtMillis != null && message.hasOwnProperty("rollbackEstimatedDtMillis"))
                if (typeof message.rollbackEstimatedDtMillis !== "number")
                    return "rollbackEstimatedDtMillis: number expected";
            if (message.rollbackEstimatedDtNanos != null && message.hasOwnProperty("rollbackEstimatedDtNanos"))
                if (!$util.isInteger(message.rollbackEstimatedDtNanos) && !(message.rollbackEstimatedDtNanos && $util.isInteger(message.rollbackEstimatedDtNanos.low) && $util.isInteger(message.rollbackEstimatedDtNanos.high)))
                    return "rollbackEstimatedDtNanos: integer|Long expected";
            if (message.worldToVirtualGridRatio != null && message.hasOwnProperty("worldToVirtualGridRatio"))
                if (typeof message.worldToVirtualGridRatio !== "number")
                    return "worldToVirtualGridRatio: number expected";
            if (message.virtualGridToWorldRatio != null && message.hasOwnProperty("virtualGridToWorldRatio"))
                if (typeof message.virtualGridToWorldRatio !== "number")
                    return "virtualGridToWorldRatio: number expected";
            if (message.spAtkLookupFrames != null && message.hasOwnProperty("spAtkLookupFrames"))
                if (!$util.isInteger(message.spAtkLookupFrames))
                    return "spAtkLookupFrames: integer expected";
            if (message.renderCacheSize != null && message.hasOwnProperty("renderCacheSize"))
                if (!$util.isInteger(message.renderCacheSize))
                    return "renderCacheSize: integer expected";
            return null;
        };

        /**
         * Creates a BattleColliderInfo message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.BattleColliderInfo} BattleColliderInfo
         */
        BattleColliderInfo.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.BattleColliderInfo)
                return object;
            var message = new $root.protos.BattleColliderInfo();
            if (object.stageName != null)
                message.stageName = String(object.stageName);
            if (object.strToVec2DListMap) {
                if (typeof object.strToVec2DListMap !== "object")
                    throw TypeError(".protos.BattleColliderInfo.strToVec2DListMap: object expected");
                message.strToVec2DListMap = {};
                for (var keys = Object.keys(object.strToVec2DListMap), i = 0; i < keys.length; ++i) {
                    if (typeof object.strToVec2DListMap[keys[i]] !== "object")
                        throw TypeError(".protos.BattleColliderInfo.strToVec2DListMap: object expected");
                    message.strToVec2DListMap[keys[i]] = $root.sharedprotos.Vec2DList.fromObject(object.strToVec2DListMap[keys[i]]);
                }
            }
            if (object.strToPolygon2DListMap) {
                if (typeof object.strToPolygon2DListMap !== "object")
                    throw TypeError(".protos.BattleColliderInfo.strToPolygon2DListMap: object expected");
                message.strToPolygon2DListMap = {};
                for (var keys = Object.keys(object.strToPolygon2DListMap), i = 0; i < keys.length; ++i) {
                    if (typeof object.strToPolygon2DListMap[keys[i]] !== "object")
                        throw TypeError(".protos.BattleColliderInfo.strToPolygon2DListMap: object expected");
                    message.strToPolygon2DListMap[keys[i]] = $root.sharedprotos.Polygon2DList.fromObject(object.strToPolygon2DListMap[keys[i]]);
                }
            }
            if (object.stageDiscreteW != null)
                message.stageDiscreteW = object.stageDiscreteW | 0;
            if (object.stageDiscreteH != null)
                message.stageDiscreteH = object.stageDiscreteH | 0;
            if (object.stageTileW != null)
                message.stageTileW = object.stageTileW | 0;
            if (object.stageTileH != null)
                message.stageTileH = object.stageTileH | 0;
            if (object.intervalToPing != null)
                message.intervalToPing = object.intervalToPing | 0;
            if (object.willKickIfInactiveFor != null)
                message.willKickIfInactiveFor = object.willKickIfInactiveFor | 0;
            if (object.boundRoomId != null)
                message.boundRoomId = object.boundRoomId | 0;
            if (object.battleDurationNanos != null)
                if ($util.Long)
                    (message.battleDurationNanos = $util.Long.fromValue(object.battleDurationNanos)).unsigned = false;
                else if (typeof object.battleDurationNanos === "string")
                    message.battleDurationNanos = parseInt(object.battleDurationNanos, 10);
                else if (typeof object.battleDurationNanos === "number")
                    message.battleDurationNanos = object.battleDurationNanos;
                else if (typeof object.battleDurationNanos === "object")
                    message.battleDurationNanos = new $util.LongBits(object.battleDurationNanos.low >>> 0, object.battleDurationNanos.high >>> 0).toNumber();
            if (object.serverFps != null)
                message.serverFps = object.serverFps | 0;
            if (object.inputDelayFrames != null)
                message.inputDelayFrames = object.inputDelayFrames | 0;
            if (object.inputScaleFrames != null)
                message.inputScaleFrames = object.inputScaleFrames >>> 0;
            if (object.nstDelayFrames != null)
                message.nstDelayFrames = object.nstDelayFrames | 0;
            if (object.inputFrameUpsyncDelayTolerance != null)
                message.inputFrameUpsyncDelayTolerance = object.inputFrameUpsyncDelayTolerance | 0;
            if (object.maxChasingRenderFramesPerUpdate != null)
                message.maxChasingRenderFramesPerUpdate = object.maxChasingRenderFramesPerUpdate | 0;
            if (object.playerBattleState != null)
                message.playerBattleState = object.playerBattleState | 0;
            if (object.rollbackEstimatedDtMillis != null)
                message.rollbackEstimatedDtMillis = Number(object.rollbackEstimatedDtMillis);
            if (object.rollbackEstimatedDtNanos != null)
                if ($util.Long)
                    (message.rollbackEstimatedDtNanos = $util.Long.fromValue(object.rollbackEstimatedDtNanos)).unsigned = false;
                else if (typeof object.rollbackEstimatedDtNanos === "string")
                    message.rollbackEstimatedDtNanos = parseInt(object.rollbackEstimatedDtNanos, 10);
                else if (typeof object.rollbackEstimatedDtNanos === "number")
                    message.rollbackEstimatedDtNanos = object.rollbackEstimatedDtNanos;
                else if (typeof object.rollbackEstimatedDtNanos === "object")
                    message.rollbackEstimatedDtNanos = new $util.LongBits(object.rollbackEstimatedDtNanos.low >>> 0, object.rollbackEstimatedDtNanos.high >>> 0).toNumber();
            if (object.worldToVirtualGridRatio != null)
                message.worldToVirtualGridRatio = Number(object.worldToVirtualGridRatio);
            if (object.virtualGridToWorldRatio != null)
                message.virtualGridToWorldRatio = Number(object.virtualGridToWorldRatio);
            if (object.spAtkLookupFrames != null)
                message.spAtkLookupFrames = object.spAtkLookupFrames | 0;
            if (object.renderCacheSize != null)
                message.renderCacheSize = object.renderCacheSize | 0;
            return message;
        };

        /**
         * Creates a plain object from a BattleColliderInfo message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {protos.BattleColliderInfo} message BattleColliderInfo
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        BattleColliderInfo.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.objects || options.defaults) {
                object.strToVec2DListMap = {};
                object.strToPolygon2DListMap = {};
            }
            if (options.defaults) {
                object.stageName = "";
                object.stageDiscreteW = 0;
                object.stageDiscreteH = 0;
                object.stageTileW = 0;
                object.stageTileH = 0;
                object.intervalToPing = 0;
                object.willKickIfInactiveFor = 0;
                object.boundRoomId = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.battleDurationNanos = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.battleDurationNanos = options.longs === String ? "0" : 0;
                object.serverFps = 0;
                object.inputDelayFrames = 0;
                object.inputScaleFrames = 0;
                object.nstDelayFrames = 0;
                object.inputFrameUpsyncDelayTolerance = 0;
                object.maxChasingRenderFramesPerUpdate = 0;
                object.playerBattleState = 0;
                object.rollbackEstimatedDtMillis = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.rollbackEstimatedDtNanos = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.rollbackEstimatedDtNanos = options.longs === String ? "0" : 0;
                object.worldToVirtualGridRatio = 0;
                object.virtualGridToWorldRatio = 0;
                object.spAtkLookupFrames = 0;
                object.renderCacheSize = 0;
            }
            if (message.stageName != null && message.hasOwnProperty("stageName"))
                object.stageName = message.stageName;
            var keys2;
            if (message.strToVec2DListMap && (keys2 = Object.keys(message.strToVec2DListMap)).length) {
                object.strToVec2DListMap = {};
                for (var j = 0; j < keys2.length; ++j)
                    object.strToVec2DListMap[keys2[j]] = $root.sharedprotos.Vec2DList.toObject(message.strToVec2DListMap[keys2[j]], options);
            }
            if (message.strToPolygon2DListMap && (keys2 = Object.keys(message.strToPolygon2DListMap)).length) {
                object.strToPolygon2DListMap = {};
                for (var j = 0; j < keys2.length; ++j)
                    object.strToPolygon2DListMap[keys2[j]] = $root.sharedprotos.Polygon2DList.toObject(message.strToPolygon2DListMap[keys2[j]], options);
            }
            if (message.stageDiscreteW != null && message.hasOwnProperty("stageDiscreteW"))
                object.stageDiscreteW = message.stageDiscreteW;
            if (message.stageDiscreteH != null && message.hasOwnProperty("stageDiscreteH"))
                object.stageDiscreteH = message.stageDiscreteH;
            if (message.stageTileW != null && message.hasOwnProperty("stageTileW"))
                object.stageTileW = message.stageTileW;
            if (message.stageTileH != null && message.hasOwnProperty("stageTileH"))
                object.stageTileH = message.stageTileH;
            if (message.intervalToPing != null && message.hasOwnProperty("intervalToPing"))
                object.intervalToPing = message.intervalToPing;
            if (message.willKickIfInactiveFor != null && message.hasOwnProperty("willKickIfInactiveFor"))
                object.willKickIfInactiveFor = message.willKickIfInactiveFor;
            if (message.boundRoomId != null && message.hasOwnProperty("boundRoomId"))
                object.boundRoomId = message.boundRoomId;
            if (message.battleDurationNanos != null && message.hasOwnProperty("battleDurationNanos"))
                if (typeof message.battleDurationNanos === "number")
                    object.battleDurationNanos = options.longs === String ? String(message.battleDurationNanos) : message.battleDurationNanos;
                else
                    object.battleDurationNanos = options.longs === String ? $util.Long.prototype.toString.call(message.battleDurationNanos) : options.longs === Number ? new $util.LongBits(message.battleDurationNanos.low >>> 0, message.battleDurationNanos.high >>> 0).toNumber() : message.battleDurationNanos;
            if (message.serverFps != null && message.hasOwnProperty("serverFps"))
                object.serverFps = message.serverFps;
            if (message.inputDelayFrames != null && message.hasOwnProperty("inputDelayFrames"))
                object.inputDelayFrames = message.inputDelayFrames;
            if (message.inputScaleFrames != null && message.hasOwnProperty("inputScaleFrames"))
                object.inputScaleFrames = message.inputScaleFrames;
            if (message.nstDelayFrames != null && message.hasOwnProperty("nstDelayFrames"))
                object.nstDelayFrames = message.nstDelayFrames;
            if (message.inputFrameUpsyncDelayTolerance != null && message.hasOwnProperty("inputFrameUpsyncDelayTolerance"))
                object.inputFrameUpsyncDelayTolerance = message.inputFrameUpsyncDelayTolerance;
            if (message.maxChasingRenderFramesPerUpdate != null && message.hasOwnProperty("maxChasingRenderFramesPerUpdate"))
                object.maxChasingRenderFramesPerUpdate = message.maxChasingRenderFramesPerUpdate;
            if (message.playerBattleState != null && message.hasOwnProperty("playerBattleState"))
                object.playerBattleState = message.playerBattleState;
            if (message.rollbackEstimatedDtMillis != null && message.hasOwnProperty("rollbackEstimatedDtMillis"))
                object.rollbackEstimatedDtMillis = options.json && !isFinite(message.rollbackEstimatedDtMillis) ? String(message.rollbackEstimatedDtMillis) : message.rollbackEstimatedDtMillis;
            if (message.rollbackEstimatedDtNanos != null && message.hasOwnProperty("rollbackEstimatedDtNanos"))
                if (typeof message.rollbackEstimatedDtNanos === "number")
                    object.rollbackEstimatedDtNanos = options.longs === String ? String(message.rollbackEstimatedDtNanos) : message.rollbackEstimatedDtNanos;
                else
                    object.rollbackEstimatedDtNanos = options.longs === String ? $util.Long.prototype.toString.call(message.rollbackEstimatedDtNanos) : options.longs === Number ? new $util.LongBits(message.rollbackEstimatedDtNanos.low >>> 0, message.rollbackEstimatedDtNanos.high >>> 0).toNumber() : message.rollbackEstimatedDtNanos;
            if (message.worldToVirtualGridRatio != null && message.hasOwnProperty("worldToVirtualGridRatio"))
                object.worldToVirtualGridRatio = options.json && !isFinite(message.worldToVirtualGridRatio) ? String(message.worldToVirtualGridRatio) : message.worldToVirtualGridRatio;
            if (message.virtualGridToWorldRatio != null && message.hasOwnProperty("virtualGridToWorldRatio"))
                object.virtualGridToWorldRatio = options.json && !isFinite(message.virtualGridToWorldRatio) ? String(message.virtualGridToWorldRatio) : message.virtualGridToWorldRatio;
            if (message.spAtkLookupFrames != null && message.hasOwnProperty("spAtkLookupFrames"))
                object.spAtkLookupFrames = message.spAtkLookupFrames;
            if (message.renderCacheSize != null && message.hasOwnProperty("renderCacheSize"))
                object.renderCacheSize = message.renderCacheSize;
            return object;
        };

        /**
         * Converts this BattleColliderInfo to JSON.
         * @function toJSON
         * @memberof protos.BattleColliderInfo
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        BattleColliderInfo.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for BattleColliderInfo
         * @function getTypeUrl
         * @memberof protos.BattleColliderInfo
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        BattleColliderInfo.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.BattleColliderInfo";
        };

        return BattleColliderInfo;
    })();

    protos.PlayerDownsync = (function() {

        /**
         * Properties of a PlayerDownsync.
         * @memberof protos
         * @interface IPlayerDownsync
         * @property {number|null} [id] PlayerDownsync id
         * @property {number|null} [virtualGridX] PlayerDownsync virtualGridX
         * @property {number|null} [virtualGridY] PlayerDownsync virtualGridY
         * @property {number|null} [dirX] PlayerDownsync dirX
         * @property {number|null} [dirY] PlayerDownsync dirY
         * @property {number|null} [speed] PlayerDownsync speed
         * @property {number|null} [battleState] PlayerDownsync battleState
         * @property {number|null} [joinIndex] PlayerDownsync joinIndex
         * @property {number|null} [colliderRadius] PlayerDownsync colliderRadius
         * @property {boolean|null} [removed] PlayerDownsync removed
         * @property {number|null} [score] PlayerDownsync score
         * @property {number|null} [lastMoveGmtMillis] PlayerDownsync lastMoveGmtMillis
         * @property {number|null} [framesToRecover] PlayerDownsync framesToRecover
         * @property {number|null} [hp] PlayerDownsync hp
         * @property {number|null} [maxHp] PlayerDownsync maxHp
         * @property {number|null} [characterState] PlayerDownsync characterState
         * @property {string|null} [name] PlayerDownsync name
         * @property {string|null} [displayName] PlayerDownsync displayName
         * @property {string|null} [avatar] PlayerDownsync avatar
         */

        /**
         * Constructs a new PlayerDownsync.
         * @memberof protos
         * @classdesc Represents a PlayerDownsync.
         * @implements IPlayerDownsync
         * @constructor
         * @param {protos.IPlayerDownsync=} [properties] Properties to set
         */
        function PlayerDownsync(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PlayerDownsync id.
         * @member {number} id
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.id = 0;

        /**
         * PlayerDownsync virtualGridX.
         * @member {number} virtualGridX
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.virtualGridX = 0;

        /**
         * PlayerDownsync virtualGridY.
         * @member {number} virtualGridY
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.virtualGridY = 0;

        /**
         * PlayerDownsync dirX.
         * @member {number} dirX
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.dirX = 0;

        /**
         * PlayerDownsync dirY.
         * @member {number} dirY
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.dirY = 0;

        /**
         * PlayerDownsync speed.
         * @member {number} speed
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.speed = 0;

        /**
         * PlayerDownsync battleState.
         * @member {number} battleState
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.battleState = 0;

        /**
         * PlayerDownsync joinIndex.
         * @member {number} joinIndex
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.joinIndex = 0;

        /**
         * PlayerDownsync colliderRadius.
         * @member {number} colliderRadius
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.colliderRadius = 0;

        /**
         * PlayerDownsync removed.
         * @member {boolean} removed
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.removed = false;

        /**
         * PlayerDownsync score.
         * @member {number} score
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.score = 0;

        /**
         * PlayerDownsync lastMoveGmtMillis.
         * @member {number} lastMoveGmtMillis
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.lastMoveGmtMillis = 0;

        /**
         * PlayerDownsync framesToRecover.
         * @member {number} framesToRecover
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.framesToRecover = 0;

        /**
         * PlayerDownsync hp.
         * @member {number} hp
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.hp = 0;

        /**
         * PlayerDownsync maxHp.
         * @member {number} maxHp
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.maxHp = 0;

        /**
         * PlayerDownsync characterState.
         * @member {number} characterState
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.characterState = 0;

        /**
         * PlayerDownsync name.
         * @member {string} name
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.name = "";

        /**
         * PlayerDownsync displayName.
         * @member {string} displayName
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.displayName = "";

        /**
         * PlayerDownsync avatar.
         * @member {string} avatar
         * @memberof protos.PlayerDownsync
         * @instance
         */
        PlayerDownsync.prototype.avatar = "";

        /**
         * Creates a new PlayerDownsync instance using the specified properties.
         * @function create
         * @memberof protos.PlayerDownsync
         * @static
         * @param {protos.IPlayerDownsync=} [properties] Properties to set
         * @returns {protos.PlayerDownsync} PlayerDownsync instance
         */
        PlayerDownsync.create = function create(properties) {
            return new PlayerDownsync(properties);
        };

        /**
         * Encodes the specified PlayerDownsync message. Does not implicitly {@link protos.PlayerDownsync.verify|verify} messages.
         * @function encode
         * @memberof protos.PlayerDownsync
         * @static
         * @param {protos.PlayerDownsync} message PlayerDownsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PlayerDownsync.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.virtualGridX != null && Object.hasOwnProperty.call(message, "virtualGridX"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.virtualGridX);
            if (message.virtualGridY != null && Object.hasOwnProperty.call(message, "virtualGridY"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.virtualGridY);
            if (message.dirX != null && Object.hasOwnProperty.call(message, "dirX"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.dirX);
            if (message.dirY != null && Object.hasOwnProperty.call(message, "dirY"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.dirY);
            if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.speed);
            if (message.battleState != null && Object.hasOwnProperty.call(message, "battleState"))
                writer.uint32(/* id 7, wireType 0 =*/56).int32(message.battleState);
            if (message.joinIndex != null && Object.hasOwnProperty.call(message, "joinIndex"))
                writer.uint32(/* id 8, wireType 0 =*/64).int32(message.joinIndex);
            if (message.colliderRadius != null && Object.hasOwnProperty.call(message, "colliderRadius"))
                writer.uint32(/* id 9, wireType 1 =*/73).double(message.colliderRadius);
            if (message.removed != null && Object.hasOwnProperty.call(message, "removed"))
                writer.uint32(/* id 10, wireType 0 =*/80).bool(message.removed);
            if (message.score != null && Object.hasOwnProperty.call(message, "score"))
                writer.uint32(/* id 11, wireType 0 =*/88).int32(message.score);
            if (message.lastMoveGmtMillis != null && Object.hasOwnProperty.call(message, "lastMoveGmtMillis"))
                writer.uint32(/* id 12, wireType 0 =*/96).int32(message.lastMoveGmtMillis);
            if (message.framesToRecover != null && Object.hasOwnProperty.call(message, "framesToRecover"))
                writer.uint32(/* id 13, wireType 0 =*/104).int32(message.framesToRecover);
            if (message.hp != null && Object.hasOwnProperty.call(message, "hp"))
                writer.uint32(/* id 14, wireType 0 =*/112).int32(message.hp);
            if (message.maxHp != null && Object.hasOwnProperty.call(message, "maxHp"))
                writer.uint32(/* id 15, wireType 0 =*/120).int32(message.maxHp);
            if (message.characterState != null && Object.hasOwnProperty.call(message, "characterState"))
                writer.uint32(/* id 16, wireType 0 =*/128).int32(message.characterState);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 17, wireType 2 =*/138).string(message.name);
            if (message.displayName != null && Object.hasOwnProperty.call(message, "displayName"))
                writer.uint32(/* id 18, wireType 2 =*/146).string(message.displayName);
            if (message.avatar != null && Object.hasOwnProperty.call(message, "avatar"))
                writer.uint32(/* id 19, wireType 2 =*/154).string(message.avatar);
            return writer;
        };

        /**
         * Encodes the specified PlayerDownsync message, length delimited. Does not implicitly {@link protos.PlayerDownsync.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.PlayerDownsync
         * @static
         * @param {protos.PlayerDownsync} message PlayerDownsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PlayerDownsync.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PlayerDownsync message from the specified reader or buffer.
         * @function decode
         * @memberof protos.PlayerDownsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.PlayerDownsync} PlayerDownsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PlayerDownsync.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.PlayerDownsync();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.int32();
                        break;
                    }
                case 2: {
                        message.virtualGridX = reader.int32();
                        break;
                    }
                case 3: {
                        message.virtualGridY = reader.int32();
                        break;
                    }
                case 4: {
                        message.dirX = reader.int32();
                        break;
                    }
                case 5: {
                        message.dirY = reader.int32();
                        break;
                    }
                case 6: {
                        message.speed = reader.int32();
                        break;
                    }
                case 7: {
                        message.battleState = reader.int32();
                        break;
                    }
                case 8: {
                        message.joinIndex = reader.int32();
                        break;
                    }
                case 9: {
                        message.colliderRadius = reader.double();
                        break;
                    }
                case 10: {
                        message.removed = reader.bool();
                        break;
                    }
                case 11: {
                        message.score = reader.int32();
                        break;
                    }
                case 12: {
                        message.lastMoveGmtMillis = reader.int32();
                        break;
                    }
                case 13: {
                        message.framesToRecover = reader.int32();
                        break;
                    }
                case 14: {
                        message.hp = reader.int32();
                        break;
                    }
                case 15: {
                        message.maxHp = reader.int32();
                        break;
                    }
                case 16: {
                        message.characterState = reader.int32();
                        break;
                    }
                case 17: {
                        message.name = reader.string();
                        break;
                    }
                case 18: {
                        message.displayName = reader.string();
                        break;
                    }
                case 19: {
                        message.avatar = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a PlayerDownsync message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.PlayerDownsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.PlayerDownsync} PlayerDownsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PlayerDownsync.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PlayerDownsync message.
         * @function verify
         * @memberof protos.PlayerDownsync
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PlayerDownsync.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.virtualGridX != null && message.hasOwnProperty("virtualGridX"))
                if (!$util.isInteger(message.virtualGridX))
                    return "virtualGridX: integer expected";
            if (message.virtualGridY != null && message.hasOwnProperty("virtualGridY"))
                if (!$util.isInteger(message.virtualGridY))
                    return "virtualGridY: integer expected";
            if (message.dirX != null && message.hasOwnProperty("dirX"))
                if (!$util.isInteger(message.dirX))
                    return "dirX: integer expected";
            if (message.dirY != null && message.hasOwnProperty("dirY"))
                if (!$util.isInteger(message.dirY))
                    return "dirY: integer expected";
            if (message.speed != null && message.hasOwnProperty("speed"))
                if (!$util.isInteger(message.speed))
                    return "speed: integer expected";
            if (message.battleState != null && message.hasOwnProperty("battleState"))
                if (!$util.isInteger(message.battleState))
                    return "battleState: integer expected";
            if (message.joinIndex != null && message.hasOwnProperty("joinIndex"))
                if (!$util.isInteger(message.joinIndex))
                    return "joinIndex: integer expected";
            if (message.colliderRadius != null && message.hasOwnProperty("colliderRadius"))
                if (typeof message.colliderRadius !== "number")
                    return "colliderRadius: number expected";
            if (message.removed != null && message.hasOwnProperty("removed"))
                if (typeof message.removed !== "boolean")
                    return "removed: boolean expected";
            if (message.score != null && message.hasOwnProperty("score"))
                if (!$util.isInteger(message.score))
                    return "score: integer expected";
            if (message.lastMoveGmtMillis != null && message.hasOwnProperty("lastMoveGmtMillis"))
                if (!$util.isInteger(message.lastMoveGmtMillis))
                    return "lastMoveGmtMillis: integer expected";
            if (message.framesToRecover != null && message.hasOwnProperty("framesToRecover"))
                if (!$util.isInteger(message.framesToRecover))
                    return "framesToRecover: integer expected";
            if (message.hp != null && message.hasOwnProperty("hp"))
                if (!$util.isInteger(message.hp))
                    return "hp: integer expected";
            if (message.maxHp != null && message.hasOwnProperty("maxHp"))
                if (!$util.isInteger(message.maxHp))
                    return "maxHp: integer expected";
            if (message.characterState != null && message.hasOwnProperty("characterState"))
                if (!$util.isInteger(message.characterState))
                    return "characterState: integer expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.displayName != null && message.hasOwnProperty("displayName"))
                if (!$util.isString(message.displayName))
                    return "displayName: string expected";
            if (message.avatar != null && message.hasOwnProperty("avatar"))
                if (!$util.isString(message.avatar))
                    return "avatar: string expected";
            return null;
        };

        /**
         * Creates a PlayerDownsync message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.PlayerDownsync
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.PlayerDownsync} PlayerDownsync
         */
        PlayerDownsync.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.PlayerDownsync)
                return object;
            var message = new $root.protos.PlayerDownsync();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.virtualGridX != null)
                message.virtualGridX = object.virtualGridX | 0;
            if (object.virtualGridY != null)
                message.virtualGridY = object.virtualGridY | 0;
            if (object.dirX != null)
                message.dirX = object.dirX | 0;
            if (object.dirY != null)
                message.dirY = object.dirY | 0;
            if (object.speed != null)
                message.speed = object.speed | 0;
            if (object.battleState != null)
                message.battleState = object.battleState | 0;
            if (object.joinIndex != null)
                message.joinIndex = object.joinIndex | 0;
            if (object.colliderRadius != null)
                message.colliderRadius = Number(object.colliderRadius);
            if (object.removed != null)
                message.removed = Boolean(object.removed);
            if (object.score != null)
                message.score = object.score | 0;
            if (object.lastMoveGmtMillis != null)
                message.lastMoveGmtMillis = object.lastMoveGmtMillis | 0;
            if (object.framesToRecover != null)
                message.framesToRecover = object.framesToRecover | 0;
            if (object.hp != null)
                message.hp = object.hp | 0;
            if (object.maxHp != null)
                message.maxHp = object.maxHp | 0;
            if (object.characterState != null)
                message.characterState = object.characterState | 0;
            if (object.name != null)
                message.name = String(object.name);
            if (object.displayName != null)
                message.displayName = String(object.displayName);
            if (object.avatar != null)
                message.avatar = String(object.avatar);
            return message;
        };

        /**
         * Creates a plain object from a PlayerDownsync message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.PlayerDownsync
         * @static
         * @param {protos.PlayerDownsync} message PlayerDownsync
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PlayerDownsync.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = 0;
                object.virtualGridX = 0;
                object.virtualGridY = 0;
                object.dirX = 0;
                object.dirY = 0;
                object.speed = 0;
                object.battleState = 0;
                object.joinIndex = 0;
                object.colliderRadius = 0;
                object.removed = false;
                object.score = 0;
                object.lastMoveGmtMillis = 0;
                object.framesToRecover = 0;
                object.hp = 0;
                object.maxHp = 0;
                object.characterState = 0;
                object.name = "";
                object.displayName = "";
                object.avatar = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.virtualGridX != null && message.hasOwnProperty("virtualGridX"))
                object.virtualGridX = message.virtualGridX;
            if (message.virtualGridY != null && message.hasOwnProperty("virtualGridY"))
                object.virtualGridY = message.virtualGridY;
            if (message.dirX != null && message.hasOwnProperty("dirX"))
                object.dirX = message.dirX;
            if (message.dirY != null && message.hasOwnProperty("dirY"))
                object.dirY = message.dirY;
            if (message.speed != null && message.hasOwnProperty("speed"))
                object.speed = message.speed;
            if (message.battleState != null && message.hasOwnProperty("battleState"))
                object.battleState = message.battleState;
            if (message.joinIndex != null && message.hasOwnProperty("joinIndex"))
                object.joinIndex = message.joinIndex;
            if (message.colliderRadius != null && message.hasOwnProperty("colliderRadius"))
                object.colliderRadius = options.json && !isFinite(message.colliderRadius) ? String(message.colliderRadius) : message.colliderRadius;
            if (message.removed != null && message.hasOwnProperty("removed"))
                object.removed = message.removed;
            if (message.score != null && message.hasOwnProperty("score"))
                object.score = message.score;
            if (message.lastMoveGmtMillis != null && message.hasOwnProperty("lastMoveGmtMillis"))
                object.lastMoveGmtMillis = message.lastMoveGmtMillis;
            if (message.framesToRecover != null && message.hasOwnProperty("framesToRecover"))
                object.framesToRecover = message.framesToRecover;
            if (message.hp != null && message.hasOwnProperty("hp"))
                object.hp = message.hp;
            if (message.maxHp != null && message.hasOwnProperty("maxHp"))
                object.maxHp = message.maxHp;
            if (message.characterState != null && message.hasOwnProperty("characterState"))
                object.characterState = message.characterState;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.displayName != null && message.hasOwnProperty("displayName"))
                object.displayName = message.displayName;
            if (message.avatar != null && message.hasOwnProperty("avatar"))
                object.avatar = message.avatar;
            return object;
        };

        /**
         * Converts this PlayerDownsync to JSON.
         * @function toJSON
         * @memberof protos.PlayerDownsync
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PlayerDownsync.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PlayerDownsync
         * @function getTypeUrl
         * @memberof protos.PlayerDownsync
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PlayerDownsync.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.PlayerDownsync";
        };

        return PlayerDownsync;
    })();

    protos.InputFrameDecoded = (function() {

        /**
         * Properties of an InputFrameDecoded.
         * @memberof protos
         * @interface IInputFrameDecoded
         * @property {number|null} [dx] InputFrameDecoded dx
         * @property {number|null} [dy] InputFrameDecoded dy
         * @property {number|null} [btnALevel] InputFrameDecoded btnALevel
         */

        /**
         * Constructs a new InputFrameDecoded.
         * @memberof protos
         * @classdesc Represents an InputFrameDecoded.
         * @implements IInputFrameDecoded
         * @constructor
         * @param {protos.IInputFrameDecoded=} [properties] Properties to set
         */
        function InputFrameDecoded(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * InputFrameDecoded dx.
         * @member {number} dx
         * @memberof protos.InputFrameDecoded
         * @instance
         */
        InputFrameDecoded.prototype.dx = 0;

        /**
         * InputFrameDecoded dy.
         * @member {number} dy
         * @memberof protos.InputFrameDecoded
         * @instance
         */
        InputFrameDecoded.prototype.dy = 0;

        /**
         * InputFrameDecoded btnALevel.
         * @member {number} btnALevel
         * @memberof protos.InputFrameDecoded
         * @instance
         */
        InputFrameDecoded.prototype.btnALevel = 0;

        /**
         * Creates a new InputFrameDecoded instance using the specified properties.
         * @function create
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {protos.IInputFrameDecoded=} [properties] Properties to set
         * @returns {protos.InputFrameDecoded} InputFrameDecoded instance
         */
        InputFrameDecoded.create = function create(properties) {
            return new InputFrameDecoded(properties);
        };

        /**
         * Encodes the specified InputFrameDecoded message. Does not implicitly {@link protos.InputFrameDecoded.verify|verify} messages.
         * @function encode
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {protos.InputFrameDecoded} message InputFrameDecoded message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputFrameDecoded.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.dx != null && Object.hasOwnProperty.call(message, "dx"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.dx);
            if (message.dy != null && Object.hasOwnProperty.call(message, "dy"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.dy);
            if (message.btnALevel != null && Object.hasOwnProperty.call(message, "btnALevel"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.btnALevel);
            return writer;
        };

        /**
         * Encodes the specified InputFrameDecoded message, length delimited. Does not implicitly {@link protos.InputFrameDecoded.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {protos.InputFrameDecoded} message InputFrameDecoded message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputFrameDecoded.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an InputFrameDecoded message from the specified reader or buffer.
         * @function decode
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.InputFrameDecoded} InputFrameDecoded
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputFrameDecoded.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.InputFrameDecoded();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.dx = reader.int32();
                        break;
                    }
                case 2: {
                        message.dy = reader.int32();
                        break;
                    }
                case 3: {
                        message.btnALevel = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an InputFrameDecoded message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.InputFrameDecoded} InputFrameDecoded
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputFrameDecoded.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an InputFrameDecoded message.
         * @function verify
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        InputFrameDecoded.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.dx != null && message.hasOwnProperty("dx"))
                if (!$util.isInteger(message.dx))
                    return "dx: integer expected";
            if (message.dy != null && message.hasOwnProperty("dy"))
                if (!$util.isInteger(message.dy))
                    return "dy: integer expected";
            if (message.btnALevel != null && message.hasOwnProperty("btnALevel"))
                if (!$util.isInteger(message.btnALevel))
                    return "btnALevel: integer expected";
            return null;
        };

        /**
         * Creates an InputFrameDecoded message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.InputFrameDecoded} InputFrameDecoded
         */
        InputFrameDecoded.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.InputFrameDecoded)
                return object;
            var message = new $root.protos.InputFrameDecoded();
            if (object.dx != null)
                message.dx = object.dx | 0;
            if (object.dy != null)
                message.dy = object.dy | 0;
            if (object.btnALevel != null)
                message.btnALevel = object.btnALevel | 0;
            return message;
        };

        /**
         * Creates a plain object from an InputFrameDecoded message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {protos.InputFrameDecoded} message InputFrameDecoded
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InputFrameDecoded.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.dx = 0;
                object.dy = 0;
                object.btnALevel = 0;
            }
            if (message.dx != null && message.hasOwnProperty("dx"))
                object.dx = message.dx;
            if (message.dy != null && message.hasOwnProperty("dy"))
                object.dy = message.dy;
            if (message.btnALevel != null && message.hasOwnProperty("btnALevel"))
                object.btnALevel = message.btnALevel;
            return object;
        };

        /**
         * Converts this InputFrameDecoded to JSON.
         * @function toJSON
         * @memberof protos.InputFrameDecoded
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InputFrameDecoded.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for InputFrameDecoded
         * @function getTypeUrl
         * @memberof protos.InputFrameDecoded
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        InputFrameDecoded.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.InputFrameDecoded";
        };

        return InputFrameDecoded;
    })();

    protos.InputFrameUpsync = (function() {

        /**
         * Properties of an InputFrameUpsync.
         * @memberof protos
         * @interface IInputFrameUpsync
         * @property {number|null} [inputFrameId] InputFrameUpsync inputFrameId
         * @property {number|Long|null} [encoded] InputFrameUpsync encoded
         */

        /**
         * Constructs a new InputFrameUpsync.
         * @memberof protos
         * @classdesc Represents an InputFrameUpsync.
         * @implements IInputFrameUpsync
         * @constructor
         * @param {protos.IInputFrameUpsync=} [properties] Properties to set
         */
        function InputFrameUpsync(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * InputFrameUpsync inputFrameId.
         * @member {number} inputFrameId
         * @memberof protos.InputFrameUpsync
         * @instance
         */
        InputFrameUpsync.prototype.inputFrameId = 0;

        /**
         * InputFrameUpsync encoded.
         * @member {number|Long} encoded
         * @memberof protos.InputFrameUpsync
         * @instance
         */
        InputFrameUpsync.prototype.encoded = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new InputFrameUpsync instance using the specified properties.
         * @function create
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {protos.IInputFrameUpsync=} [properties] Properties to set
         * @returns {protos.InputFrameUpsync} InputFrameUpsync instance
         */
        InputFrameUpsync.create = function create(properties) {
            return new InputFrameUpsync(properties);
        };

        /**
         * Encodes the specified InputFrameUpsync message. Does not implicitly {@link protos.InputFrameUpsync.verify|verify} messages.
         * @function encode
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {protos.InputFrameUpsync} message InputFrameUpsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputFrameUpsync.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.inputFrameId != null && Object.hasOwnProperty.call(message, "inputFrameId"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.inputFrameId);
            if (message.encoded != null && Object.hasOwnProperty.call(message, "encoded"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.encoded);
            return writer;
        };

        /**
         * Encodes the specified InputFrameUpsync message, length delimited. Does not implicitly {@link protos.InputFrameUpsync.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {protos.InputFrameUpsync} message InputFrameUpsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputFrameUpsync.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an InputFrameUpsync message from the specified reader or buffer.
         * @function decode
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.InputFrameUpsync} InputFrameUpsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputFrameUpsync.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.InputFrameUpsync();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.inputFrameId = reader.int32();
                        break;
                    }
                case 2: {
                        message.encoded = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an InputFrameUpsync message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.InputFrameUpsync} InputFrameUpsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputFrameUpsync.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an InputFrameUpsync message.
         * @function verify
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        InputFrameUpsync.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.inputFrameId != null && message.hasOwnProperty("inputFrameId"))
                if (!$util.isInteger(message.inputFrameId))
                    return "inputFrameId: integer expected";
            if (message.encoded != null && message.hasOwnProperty("encoded"))
                if (!$util.isInteger(message.encoded) && !(message.encoded && $util.isInteger(message.encoded.low) && $util.isInteger(message.encoded.high)))
                    return "encoded: integer|Long expected";
            return null;
        };

        /**
         * Creates an InputFrameUpsync message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.InputFrameUpsync} InputFrameUpsync
         */
        InputFrameUpsync.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.InputFrameUpsync)
                return object;
            var message = new $root.protos.InputFrameUpsync();
            if (object.inputFrameId != null)
                message.inputFrameId = object.inputFrameId | 0;
            if (object.encoded != null)
                if ($util.Long)
                    (message.encoded = $util.Long.fromValue(object.encoded)).unsigned = true;
                else if (typeof object.encoded === "string")
                    message.encoded = parseInt(object.encoded, 10);
                else if (typeof object.encoded === "number")
                    message.encoded = object.encoded;
                else if (typeof object.encoded === "object")
                    message.encoded = new $util.LongBits(object.encoded.low >>> 0, object.encoded.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from an InputFrameUpsync message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {protos.InputFrameUpsync} message InputFrameUpsync
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InputFrameUpsync.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.inputFrameId = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.encoded = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.encoded = options.longs === String ? "0" : 0;
            }
            if (message.inputFrameId != null && message.hasOwnProperty("inputFrameId"))
                object.inputFrameId = message.inputFrameId;
            if (message.encoded != null && message.hasOwnProperty("encoded"))
                if (typeof message.encoded === "number")
                    object.encoded = options.longs === String ? String(message.encoded) : message.encoded;
                else
                    object.encoded = options.longs === String ? $util.Long.prototype.toString.call(message.encoded) : options.longs === Number ? new $util.LongBits(message.encoded.low >>> 0, message.encoded.high >>> 0).toNumber(true) : message.encoded;
            return object;
        };

        /**
         * Converts this InputFrameUpsync to JSON.
         * @function toJSON
         * @memberof protos.InputFrameUpsync
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InputFrameUpsync.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for InputFrameUpsync
         * @function getTypeUrl
         * @memberof protos.InputFrameUpsync
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        InputFrameUpsync.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.InputFrameUpsync";
        };

        return InputFrameUpsync;
    })();

    protos.InputFrameDownsync = (function() {

        /**
         * Properties of an InputFrameDownsync.
         * @memberof protos
         * @interface IInputFrameDownsync
         * @property {number|null} [inputFrameId] InputFrameDownsync inputFrameId
         * @property {Array.<number|Long>|null} [inputList] InputFrameDownsync inputList
         * @property {number|Long|null} [confirmedList] InputFrameDownsync confirmedList
         */

        /**
         * Constructs a new InputFrameDownsync.
         * @memberof protos
         * @classdesc Represents an InputFrameDownsync.
         * @implements IInputFrameDownsync
         * @constructor
         * @param {protos.IInputFrameDownsync=} [properties] Properties to set
         */
        function InputFrameDownsync(properties) {
            this.inputList = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * InputFrameDownsync inputFrameId.
         * @member {number} inputFrameId
         * @memberof protos.InputFrameDownsync
         * @instance
         */
        InputFrameDownsync.prototype.inputFrameId = 0;

        /**
         * InputFrameDownsync inputList.
         * @member {Array.<number|Long>} inputList
         * @memberof protos.InputFrameDownsync
         * @instance
         */
        InputFrameDownsync.prototype.inputList = $util.emptyArray;

        /**
         * InputFrameDownsync confirmedList.
         * @member {number|Long} confirmedList
         * @memberof protos.InputFrameDownsync
         * @instance
         */
        InputFrameDownsync.prototype.confirmedList = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new InputFrameDownsync instance using the specified properties.
         * @function create
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {protos.IInputFrameDownsync=} [properties] Properties to set
         * @returns {protos.InputFrameDownsync} InputFrameDownsync instance
         */
        InputFrameDownsync.create = function create(properties) {
            return new InputFrameDownsync(properties);
        };

        /**
         * Encodes the specified InputFrameDownsync message. Does not implicitly {@link protos.InputFrameDownsync.verify|verify} messages.
         * @function encode
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {protos.InputFrameDownsync} message InputFrameDownsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputFrameDownsync.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.inputFrameId != null && Object.hasOwnProperty.call(message, "inputFrameId"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.inputFrameId);
            if (message.inputList != null && message.inputList.length) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork();
                for (var i = 0; i < message.inputList.length; ++i)
                    writer.uint64(message.inputList[i]);
                writer.ldelim();
            }
            if (message.confirmedList != null && Object.hasOwnProperty.call(message, "confirmedList"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.confirmedList);
            return writer;
        };

        /**
         * Encodes the specified InputFrameDownsync message, length delimited. Does not implicitly {@link protos.InputFrameDownsync.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {protos.InputFrameDownsync} message InputFrameDownsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputFrameDownsync.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an InputFrameDownsync message from the specified reader or buffer.
         * @function decode
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.InputFrameDownsync} InputFrameDownsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputFrameDownsync.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.InputFrameDownsync();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.inputFrameId = reader.int32();
                        break;
                    }
                case 2: {
                        if (!(message.inputList && message.inputList.length))
                            message.inputList = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.inputList.push(reader.uint64());
                        } else
                            message.inputList.push(reader.uint64());
                        break;
                    }
                case 3: {
                        message.confirmedList = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an InputFrameDownsync message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.InputFrameDownsync} InputFrameDownsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputFrameDownsync.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an InputFrameDownsync message.
         * @function verify
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        InputFrameDownsync.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.inputFrameId != null && message.hasOwnProperty("inputFrameId"))
                if (!$util.isInteger(message.inputFrameId))
                    return "inputFrameId: integer expected";
            if (message.inputList != null && message.hasOwnProperty("inputList")) {
                if (!Array.isArray(message.inputList))
                    return "inputList: array expected";
                for (var i = 0; i < message.inputList.length; ++i)
                    if (!$util.isInteger(message.inputList[i]) && !(message.inputList[i] && $util.isInteger(message.inputList[i].low) && $util.isInteger(message.inputList[i].high)))
                        return "inputList: integer|Long[] expected";
            }
            if (message.confirmedList != null && message.hasOwnProperty("confirmedList"))
                if (!$util.isInteger(message.confirmedList) && !(message.confirmedList && $util.isInteger(message.confirmedList.low) && $util.isInteger(message.confirmedList.high)))
                    return "confirmedList: integer|Long expected";
            return null;
        };

        /**
         * Creates an InputFrameDownsync message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.InputFrameDownsync} InputFrameDownsync
         */
        InputFrameDownsync.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.InputFrameDownsync)
                return object;
            var message = new $root.protos.InputFrameDownsync();
            if (object.inputFrameId != null)
                message.inputFrameId = object.inputFrameId | 0;
            if (object.inputList) {
                if (!Array.isArray(object.inputList))
                    throw TypeError(".protos.InputFrameDownsync.inputList: array expected");
                message.inputList = [];
                for (var i = 0; i < object.inputList.length; ++i)
                    if ($util.Long)
                        (message.inputList[i] = $util.Long.fromValue(object.inputList[i])).unsigned = true;
                    else if (typeof object.inputList[i] === "string")
                        message.inputList[i] = parseInt(object.inputList[i], 10);
                    else if (typeof object.inputList[i] === "number")
                        message.inputList[i] = object.inputList[i];
                    else if (typeof object.inputList[i] === "object")
                        message.inputList[i] = new $util.LongBits(object.inputList[i].low >>> 0, object.inputList[i].high >>> 0).toNumber(true);
            }
            if (object.confirmedList != null)
                if ($util.Long)
                    (message.confirmedList = $util.Long.fromValue(object.confirmedList)).unsigned = true;
                else if (typeof object.confirmedList === "string")
                    message.confirmedList = parseInt(object.confirmedList, 10);
                else if (typeof object.confirmedList === "number")
                    message.confirmedList = object.confirmedList;
                else if (typeof object.confirmedList === "object")
                    message.confirmedList = new $util.LongBits(object.confirmedList.low >>> 0, object.confirmedList.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from an InputFrameDownsync message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {protos.InputFrameDownsync} message InputFrameDownsync
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InputFrameDownsync.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.inputList = [];
            if (options.defaults) {
                object.inputFrameId = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.confirmedList = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.confirmedList = options.longs === String ? "0" : 0;
            }
            if (message.inputFrameId != null && message.hasOwnProperty("inputFrameId"))
                object.inputFrameId = message.inputFrameId;
            if (message.inputList && message.inputList.length) {
                object.inputList = [];
                for (var j = 0; j < message.inputList.length; ++j)
                    if (typeof message.inputList[j] === "number")
                        object.inputList[j] = options.longs === String ? String(message.inputList[j]) : message.inputList[j];
                    else
                        object.inputList[j] = options.longs === String ? $util.Long.prototype.toString.call(message.inputList[j]) : options.longs === Number ? new $util.LongBits(message.inputList[j].low >>> 0, message.inputList[j].high >>> 0).toNumber(true) : message.inputList[j];
            }
            if (message.confirmedList != null && message.hasOwnProperty("confirmedList"))
                if (typeof message.confirmedList === "number")
                    object.confirmedList = options.longs === String ? String(message.confirmedList) : message.confirmedList;
                else
                    object.confirmedList = options.longs === String ? $util.Long.prototype.toString.call(message.confirmedList) : options.longs === Number ? new $util.LongBits(message.confirmedList.low >>> 0, message.confirmedList.high >>> 0).toNumber(true) : message.confirmedList;
            return object;
        };

        /**
         * Converts this InputFrameDownsync to JSON.
         * @function toJSON
         * @memberof protos.InputFrameDownsync
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InputFrameDownsync.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for InputFrameDownsync
         * @function getTypeUrl
         * @memberof protos.InputFrameDownsync
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        InputFrameDownsync.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.InputFrameDownsync";
        };

        return InputFrameDownsync;
    })();

    protos.HeartbeatUpsync = (function() {

        /**
         * Properties of a HeartbeatUpsync.
         * @memberof protos
         * @interface IHeartbeatUpsync
         * @property {number|Long|null} [clientTimestamp] HeartbeatUpsync clientTimestamp
         */

        /**
         * Constructs a new HeartbeatUpsync.
         * @memberof protos
         * @classdesc Represents a HeartbeatUpsync.
         * @implements IHeartbeatUpsync
         * @constructor
         * @param {protos.IHeartbeatUpsync=} [properties] Properties to set
         */
        function HeartbeatUpsync(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * HeartbeatUpsync clientTimestamp.
         * @member {number|Long} clientTimestamp
         * @memberof protos.HeartbeatUpsync
         * @instance
         */
        HeartbeatUpsync.prototype.clientTimestamp = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Creates a new HeartbeatUpsync instance using the specified properties.
         * @function create
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {protos.IHeartbeatUpsync=} [properties] Properties to set
         * @returns {protos.HeartbeatUpsync} HeartbeatUpsync instance
         */
        HeartbeatUpsync.create = function create(properties) {
            return new HeartbeatUpsync(properties);
        };

        /**
         * Encodes the specified HeartbeatUpsync message. Does not implicitly {@link protos.HeartbeatUpsync.verify|verify} messages.
         * @function encode
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {protos.HeartbeatUpsync} message HeartbeatUpsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        HeartbeatUpsync.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.clientTimestamp != null && Object.hasOwnProperty.call(message, "clientTimestamp"))
                writer.uint32(/* id 1, wireType 0 =*/8).int64(message.clientTimestamp);
            return writer;
        };

        /**
         * Encodes the specified HeartbeatUpsync message, length delimited. Does not implicitly {@link protos.HeartbeatUpsync.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {protos.HeartbeatUpsync} message HeartbeatUpsync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        HeartbeatUpsync.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a HeartbeatUpsync message from the specified reader or buffer.
         * @function decode
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.HeartbeatUpsync} HeartbeatUpsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        HeartbeatUpsync.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.HeartbeatUpsync();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.clientTimestamp = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a HeartbeatUpsync message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.HeartbeatUpsync} HeartbeatUpsync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        HeartbeatUpsync.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a HeartbeatUpsync message.
         * @function verify
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        HeartbeatUpsync.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.clientTimestamp != null && message.hasOwnProperty("clientTimestamp"))
                if (!$util.isInteger(message.clientTimestamp) && !(message.clientTimestamp && $util.isInteger(message.clientTimestamp.low) && $util.isInteger(message.clientTimestamp.high)))
                    return "clientTimestamp: integer|Long expected";
            return null;
        };

        /**
         * Creates a HeartbeatUpsync message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.HeartbeatUpsync} HeartbeatUpsync
         */
        HeartbeatUpsync.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.HeartbeatUpsync)
                return object;
            var message = new $root.protos.HeartbeatUpsync();
            if (object.clientTimestamp != null)
                if ($util.Long)
                    (message.clientTimestamp = $util.Long.fromValue(object.clientTimestamp)).unsigned = false;
                else if (typeof object.clientTimestamp === "string")
                    message.clientTimestamp = parseInt(object.clientTimestamp, 10);
                else if (typeof object.clientTimestamp === "number")
                    message.clientTimestamp = object.clientTimestamp;
                else if (typeof object.clientTimestamp === "object")
                    message.clientTimestamp = new $util.LongBits(object.clientTimestamp.low >>> 0, object.clientTimestamp.high >>> 0).toNumber();
            return message;
        };

        /**
         * Creates a plain object from a HeartbeatUpsync message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {protos.HeartbeatUpsync} message HeartbeatUpsync
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        HeartbeatUpsync.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.clientTimestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.clientTimestamp = options.longs === String ? "0" : 0;
            if (message.clientTimestamp != null && message.hasOwnProperty("clientTimestamp"))
                if (typeof message.clientTimestamp === "number")
                    object.clientTimestamp = options.longs === String ? String(message.clientTimestamp) : message.clientTimestamp;
                else
                    object.clientTimestamp = options.longs === String ? $util.Long.prototype.toString.call(message.clientTimestamp) : options.longs === Number ? new $util.LongBits(message.clientTimestamp.low >>> 0, message.clientTimestamp.high >>> 0).toNumber() : message.clientTimestamp;
            return object;
        };

        /**
         * Converts this HeartbeatUpsync to JSON.
         * @function toJSON
         * @memberof protos.HeartbeatUpsync
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        HeartbeatUpsync.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for HeartbeatUpsync
         * @function getTypeUrl
         * @memberof protos.HeartbeatUpsync
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        HeartbeatUpsync.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.HeartbeatUpsync";
        };

        return HeartbeatUpsync;
    })();

    protos.WsReq = (function() {

        /**
         * Properties of a WsReq.
         * @memberof protos
         * @interface IWsReq
         * @property {number|null} [msgId] WsReq msgId
         * @property {number|null} [playerId] WsReq playerId
         * @property {number|null} [act] WsReq act
         * @property {number|null} [joinIndex] WsReq joinIndex
         * @property {number|null} [ackingFrameId] WsReq ackingFrameId
         * @property {number|null} [ackingInputFrameId] WsReq ackingInputFrameId
         * @property {Array.<protos.InputFrameUpsync>|null} [inputFrameUpsyncBatch] WsReq inputFrameUpsyncBatch
         * @property {protos.HeartbeatUpsync|null} [hb] WsReq hb
         */

        /**
         * Constructs a new WsReq.
         * @memberof protos
         * @classdesc Represents a WsReq.
         * @implements IWsReq
         * @constructor
         * @param {protos.IWsReq=} [properties] Properties to set
         */
        function WsReq(properties) {
            this.inputFrameUpsyncBatch = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * WsReq msgId.
         * @member {number} msgId
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.msgId = 0;

        /**
         * WsReq playerId.
         * @member {number} playerId
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.playerId = 0;

        /**
         * WsReq act.
         * @member {number} act
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.act = 0;

        /**
         * WsReq joinIndex.
         * @member {number} joinIndex
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.joinIndex = 0;

        /**
         * WsReq ackingFrameId.
         * @member {number} ackingFrameId
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.ackingFrameId = 0;

        /**
         * WsReq ackingInputFrameId.
         * @member {number} ackingInputFrameId
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.ackingInputFrameId = 0;

        /**
         * WsReq inputFrameUpsyncBatch.
         * @member {Array.<protos.InputFrameUpsync>} inputFrameUpsyncBatch
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.inputFrameUpsyncBatch = $util.emptyArray;

        /**
         * WsReq hb.
         * @member {protos.HeartbeatUpsync|null|undefined} hb
         * @memberof protos.WsReq
         * @instance
         */
        WsReq.prototype.hb = null;

        /**
         * Creates a new WsReq instance using the specified properties.
         * @function create
         * @memberof protos.WsReq
         * @static
         * @param {protos.IWsReq=} [properties] Properties to set
         * @returns {protos.WsReq} WsReq instance
         */
        WsReq.create = function create(properties) {
            return new WsReq(properties);
        };

        /**
         * Encodes the specified WsReq message. Does not implicitly {@link protos.WsReq.verify|verify} messages.
         * @function encode
         * @memberof protos.WsReq
         * @static
         * @param {protos.WsReq} message WsReq message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        WsReq.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.msgId != null && Object.hasOwnProperty.call(message, "msgId"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.msgId);
            if (message.playerId != null && Object.hasOwnProperty.call(message, "playerId"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.playerId);
            if (message.act != null && Object.hasOwnProperty.call(message, "act"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.act);
            if (message.joinIndex != null && Object.hasOwnProperty.call(message, "joinIndex"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.joinIndex);
            if (message.ackingFrameId != null && Object.hasOwnProperty.call(message, "ackingFrameId"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.ackingFrameId);
            if (message.ackingInputFrameId != null && Object.hasOwnProperty.call(message, "ackingInputFrameId"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.ackingInputFrameId);
            if (message.inputFrameUpsyncBatch != null && message.inputFrameUpsyncBatch.length)
                for (var i = 0; i < message.inputFrameUpsyncBatch.length; ++i)
                    $root.protos.InputFrameUpsync.encode(message.inputFrameUpsyncBatch[i], writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
            if (message.hb != null && Object.hasOwnProperty.call(message, "hb"))
                $root.protos.HeartbeatUpsync.encode(message.hb, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified WsReq message, length delimited. Does not implicitly {@link protos.WsReq.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.WsReq
         * @static
         * @param {protos.WsReq} message WsReq message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        WsReq.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a WsReq message from the specified reader or buffer.
         * @function decode
         * @memberof protos.WsReq
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.WsReq} WsReq
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        WsReq.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.WsReq();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.msgId = reader.int32();
                        break;
                    }
                case 2: {
                        message.playerId = reader.int32();
                        break;
                    }
                case 3: {
                        message.act = reader.int32();
                        break;
                    }
                case 4: {
                        message.joinIndex = reader.int32();
                        break;
                    }
                case 5: {
                        message.ackingFrameId = reader.int32();
                        break;
                    }
                case 6: {
                        message.ackingInputFrameId = reader.int32();
                        break;
                    }
                case 7: {
                        if (!(message.inputFrameUpsyncBatch && message.inputFrameUpsyncBatch.length))
                            message.inputFrameUpsyncBatch = [];
                        message.inputFrameUpsyncBatch.push($root.protos.InputFrameUpsync.decode(reader, reader.uint32()));
                        break;
                    }
                case 8: {
                        message.hb = $root.protos.HeartbeatUpsync.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a WsReq message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.WsReq
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.WsReq} WsReq
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        WsReq.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a WsReq message.
         * @function verify
         * @memberof protos.WsReq
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        WsReq.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.msgId != null && message.hasOwnProperty("msgId"))
                if (!$util.isInteger(message.msgId))
                    return "msgId: integer expected";
            if (message.playerId != null && message.hasOwnProperty("playerId"))
                if (!$util.isInteger(message.playerId))
                    return "playerId: integer expected";
            if (message.act != null && message.hasOwnProperty("act"))
                if (!$util.isInteger(message.act))
                    return "act: integer expected";
            if (message.joinIndex != null && message.hasOwnProperty("joinIndex"))
                if (!$util.isInteger(message.joinIndex))
                    return "joinIndex: integer expected";
            if (message.ackingFrameId != null && message.hasOwnProperty("ackingFrameId"))
                if (!$util.isInteger(message.ackingFrameId))
                    return "ackingFrameId: integer expected";
            if (message.ackingInputFrameId != null && message.hasOwnProperty("ackingInputFrameId"))
                if (!$util.isInteger(message.ackingInputFrameId))
                    return "ackingInputFrameId: integer expected";
            if (message.inputFrameUpsyncBatch != null && message.hasOwnProperty("inputFrameUpsyncBatch")) {
                if (!Array.isArray(message.inputFrameUpsyncBatch))
                    return "inputFrameUpsyncBatch: array expected";
                for (var i = 0; i < message.inputFrameUpsyncBatch.length; ++i) {
                    var error = $root.protos.InputFrameUpsync.verify(message.inputFrameUpsyncBatch[i]);
                    if (error)
                        return "inputFrameUpsyncBatch." + error;
                }
            }
            if (message.hb != null && message.hasOwnProperty("hb")) {
                var error = $root.protos.HeartbeatUpsync.verify(message.hb);
                if (error)
                    return "hb." + error;
            }
            return null;
        };

        /**
         * Creates a WsReq message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.WsReq
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.WsReq} WsReq
         */
        WsReq.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.WsReq)
                return object;
            var message = new $root.protos.WsReq();
            if (object.msgId != null)
                message.msgId = object.msgId | 0;
            if (object.playerId != null)
                message.playerId = object.playerId | 0;
            if (object.act != null)
                message.act = object.act | 0;
            if (object.joinIndex != null)
                message.joinIndex = object.joinIndex | 0;
            if (object.ackingFrameId != null)
                message.ackingFrameId = object.ackingFrameId | 0;
            if (object.ackingInputFrameId != null)
                message.ackingInputFrameId = object.ackingInputFrameId | 0;
            if (object.inputFrameUpsyncBatch) {
                if (!Array.isArray(object.inputFrameUpsyncBatch))
                    throw TypeError(".protos.WsReq.inputFrameUpsyncBatch: array expected");
                message.inputFrameUpsyncBatch = [];
                for (var i = 0; i < object.inputFrameUpsyncBatch.length; ++i) {
                    if (typeof object.inputFrameUpsyncBatch[i] !== "object")
                        throw TypeError(".protos.WsReq.inputFrameUpsyncBatch: object expected");
                    message.inputFrameUpsyncBatch[i] = $root.protos.InputFrameUpsync.fromObject(object.inputFrameUpsyncBatch[i]);
                }
            }
            if (object.hb != null) {
                if (typeof object.hb !== "object")
                    throw TypeError(".protos.WsReq.hb: object expected");
                message.hb = $root.protos.HeartbeatUpsync.fromObject(object.hb);
            }
            return message;
        };

        /**
         * Creates a plain object from a WsReq message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.WsReq
         * @static
         * @param {protos.WsReq} message WsReq
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        WsReq.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.inputFrameUpsyncBatch = [];
            if (options.defaults) {
                object.msgId = 0;
                object.playerId = 0;
                object.act = 0;
                object.joinIndex = 0;
                object.ackingFrameId = 0;
                object.ackingInputFrameId = 0;
                object.hb = null;
            }
            if (message.msgId != null && message.hasOwnProperty("msgId"))
                object.msgId = message.msgId;
            if (message.playerId != null && message.hasOwnProperty("playerId"))
                object.playerId = message.playerId;
            if (message.act != null && message.hasOwnProperty("act"))
                object.act = message.act;
            if (message.joinIndex != null && message.hasOwnProperty("joinIndex"))
                object.joinIndex = message.joinIndex;
            if (message.ackingFrameId != null && message.hasOwnProperty("ackingFrameId"))
                object.ackingFrameId = message.ackingFrameId;
            if (message.ackingInputFrameId != null && message.hasOwnProperty("ackingInputFrameId"))
                object.ackingInputFrameId = message.ackingInputFrameId;
            if (message.inputFrameUpsyncBatch && message.inputFrameUpsyncBatch.length) {
                object.inputFrameUpsyncBatch = [];
                for (var j = 0; j < message.inputFrameUpsyncBatch.length; ++j)
                    object.inputFrameUpsyncBatch[j] = $root.protos.InputFrameUpsync.toObject(message.inputFrameUpsyncBatch[j], options);
            }
            if (message.hb != null && message.hasOwnProperty("hb"))
                object.hb = $root.protos.HeartbeatUpsync.toObject(message.hb, options);
            return object;
        };

        /**
         * Converts this WsReq to JSON.
         * @function toJSON
         * @memberof protos.WsReq
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        WsReq.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for WsReq
         * @function getTypeUrl
         * @memberof protos.WsReq
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        WsReq.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.WsReq";
        };

        return WsReq;
    })();

    protos.WsResp = (function() {

        /**
         * Properties of a WsResp.
         * @memberof protos
         * @interface IWsResp
         * @property {number|null} [ret] WsResp ret
         * @property {number|null} [echoedMsgId] WsResp echoedMsgId
         * @property {number|null} [act] WsResp act
         * @property {protos.RoomDownsyncFrame|null} [rdf] WsResp rdf
         * @property {Array.<protos.InputFrameDownsync>|null} [inputFrameDownsyncBatch] WsResp inputFrameDownsyncBatch
         * @property {protos.BattleColliderInfo|null} [bciFrame] WsResp bciFrame
         */

        /**
         * Constructs a new WsResp.
         * @memberof protos
         * @classdesc Represents a WsResp.
         * @implements IWsResp
         * @constructor
         * @param {protos.IWsResp=} [properties] Properties to set
         */
        function WsResp(properties) {
            this.inputFrameDownsyncBatch = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * WsResp ret.
         * @member {number} ret
         * @memberof protos.WsResp
         * @instance
         */
        WsResp.prototype.ret = 0;

        /**
         * WsResp echoedMsgId.
         * @member {number} echoedMsgId
         * @memberof protos.WsResp
         * @instance
         */
        WsResp.prototype.echoedMsgId = 0;

        /**
         * WsResp act.
         * @member {number} act
         * @memberof protos.WsResp
         * @instance
         */
        WsResp.prototype.act = 0;

        /**
         * WsResp rdf.
         * @member {protos.RoomDownsyncFrame|null|undefined} rdf
         * @memberof protos.WsResp
         * @instance
         */
        WsResp.prototype.rdf = null;

        /**
         * WsResp inputFrameDownsyncBatch.
         * @member {Array.<protos.InputFrameDownsync>} inputFrameDownsyncBatch
         * @memberof protos.WsResp
         * @instance
         */
        WsResp.prototype.inputFrameDownsyncBatch = $util.emptyArray;

        /**
         * WsResp bciFrame.
         * @member {protos.BattleColliderInfo|null|undefined} bciFrame
         * @memberof protos.WsResp
         * @instance
         */
        WsResp.prototype.bciFrame = null;

        /**
         * Creates a new WsResp instance using the specified properties.
         * @function create
         * @memberof protos.WsResp
         * @static
         * @param {protos.IWsResp=} [properties] Properties to set
         * @returns {protos.WsResp} WsResp instance
         */
        WsResp.create = function create(properties) {
            return new WsResp(properties);
        };

        /**
         * Encodes the specified WsResp message. Does not implicitly {@link protos.WsResp.verify|verify} messages.
         * @function encode
         * @memberof protos.WsResp
         * @static
         * @param {protos.WsResp} message WsResp message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        WsResp.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.ret != null && Object.hasOwnProperty.call(message, "ret"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.ret);
            if (message.echoedMsgId != null && Object.hasOwnProperty.call(message, "echoedMsgId"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.echoedMsgId);
            if (message.act != null && Object.hasOwnProperty.call(message, "act"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.act);
            if (message.rdf != null && Object.hasOwnProperty.call(message, "rdf"))
                $root.protos.RoomDownsyncFrame.encode(message.rdf, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.inputFrameDownsyncBatch != null && message.inputFrameDownsyncBatch.length)
                for (var i = 0; i < message.inputFrameDownsyncBatch.length; ++i)
                    $root.protos.InputFrameDownsync.encode(message.inputFrameDownsyncBatch[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.bciFrame != null && Object.hasOwnProperty.call(message, "bciFrame"))
                $root.protos.BattleColliderInfo.encode(message.bciFrame, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified WsResp message, length delimited. Does not implicitly {@link protos.WsResp.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.WsResp
         * @static
         * @param {protos.WsResp} message WsResp message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        WsResp.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a WsResp message from the specified reader or buffer.
         * @function decode
         * @memberof protos.WsResp
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.WsResp} WsResp
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        WsResp.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.WsResp();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.ret = reader.int32();
                        break;
                    }
                case 2: {
                        message.echoedMsgId = reader.int32();
                        break;
                    }
                case 3: {
                        message.act = reader.int32();
                        break;
                    }
                case 4: {
                        message.rdf = $root.protos.RoomDownsyncFrame.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        if (!(message.inputFrameDownsyncBatch && message.inputFrameDownsyncBatch.length))
                            message.inputFrameDownsyncBatch = [];
                        message.inputFrameDownsyncBatch.push($root.protos.InputFrameDownsync.decode(reader, reader.uint32()));
                        break;
                    }
                case 6: {
                        message.bciFrame = $root.protos.BattleColliderInfo.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a WsResp message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.WsResp
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.WsResp} WsResp
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        WsResp.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a WsResp message.
         * @function verify
         * @memberof protos.WsResp
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        WsResp.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.ret != null && message.hasOwnProperty("ret"))
                if (!$util.isInteger(message.ret))
                    return "ret: integer expected";
            if (message.echoedMsgId != null && message.hasOwnProperty("echoedMsgId"))
                if (!$util.isInteger(message.echoedMsgId))
                    return "echoedMsgId: integer expected";
            if (message.act != null && message.hasOwnProperty("act"))
                if (!$util.isInteger(message.act))
                    return "act: integer expected";
            if (message.rdf != null && message.hasOwnProperty("rdf")) {
                var error = $root.protos.RoomDownsyncFrame.verify(message.rdf);
                if (error)
                    return "rdf." + error;
            }
            if (message.inputFrameDownsyncBatch != null && message.hasOwnProperty("inputFrameDownsyncBatch")) {
                if (!Array.isArray(message.inputFrameDownsyncBatch))
                    return "inputFrameDownsyncBatch: array expected";
                for (var i = 0; i < message.inputFrameDownsyncBatch.length; ++i) {
                    var error = $root.protos.InputFrameDownsync.verify(message.inputFrameDownsyncBatch[i]);
                    if (error)
                        return "inputFrameDownsyncBatch." + error;
                }
            }
            if (message.bciFrame != null && message.hasOwnProperty("bciFrame")) {
                var error = $root.protos.BattleColliderInfo.verify(message.bciFrame);
                if (error)
                    return "bciFrame." + error;
            }
            return null;
        };

        /**
         * Creates a WsResp message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.WsResp
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.WsResp} WsResp
         */
        WsResp.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.WsResp)
                return object;
            var message = new $root.protos.WsResp();
            if (object.ret != null)
                message.ret = object.ret | 0;
            if (object.echoedMsgId != null)
                message.echoedMsgId = object.echoedMsgId | 0;
            if (object.act != null)
                message.act = object.act | 0;
            if (object.rdf != null) {
                if (typeof object.rdf !== "object")
                    throw TypeError(".protos.WsResp.rdf: object expected");
                message.rdf = $root.protos.RoomDownsyncFrame.fromObject(object.rdf);
            }
            if (object.inputFrameDownsyncBatch) {
                if (!Array.isArray(object.inputFrameDownsyncBatch))
                    throw TypeError(".protos.WsResp.inputFrameDownsyncBatch: array expected");
                message.inputFrameDownsyncBatch = [];
                for (var i = 0; i < object.inputFrameDownsyncBatch.length; ++i) {
                    if (typeof object.inputFrameDownsyncBatch[i] !== "object")
                        throw TypeError(".protos.WsResp.inputFrameDownsyncBatch: object expected");
                    message.inputFrameDownsyncBatch[i] = $root.protos.InputFrameDownsync.fromObject(object.inputFrameDownsyncBatch[i]);
                }
            }
            if (object.bciFrame != null) {
                if (typeof object.bciFrame !== "object")
                    throw TypeError(".protos.WsResp.bciFrame: object expected");
                message.bciFrame = $root.protos.BattleColliderInfo.fromObject(object.bciFrame);
            }
            return message;
        };

        /**
         * Creates a plain object from a WsResp message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.WsResp
         * @static
         * @param {protos.WsResp} message WsResp
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        WsResp.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.inputFrameDownsyncBatch = [];
            if (options.defaults) {
                object.ret = 0;
                object.echoedMsgId = 0;
                object.act = 0;
                object.rdf = null;
                object.bciFrame = null;
            }
            if (message.ret != null && message.hasOwnProperty("ret"))
                object.ret = message.ret;
            if (message.echoedMsgId != null && message.hasOwnProperty("echoedMsgId"))
                object.echoedMsgId = message.echoedMsgId;
            if (message.act != null && message.hasOwnProperty("act"))
                object.act = message.act;
            if (message.rdf != null && message.hasOwnProperty("rdf"))
                object.rdf = $root.protos.RoomDownsyncFrame.toObject(message.rdf, options);
            if (message.inputFrameDownsyncBatch && message.inputFrameDownsyncBatch.length) {
                object.inputFrameDownsyncBatch = [];
                for (var j = 0; j < message.inputFrameDownsyncBatch.length; ++j)
                    object.inputFrameDownsyncBatch[j] = $root.protos.InputFrameDownsync.toObject(message.inputFrameDownsyncBatch[j], options);
            }
            if (message.bciFrame != null && message.hasOwnProperty("bciFrame"))
                object.bciFrame = $root.protos.BattleColliderInfo.toObject(message.bciFrame, options);
            return object;
        };

        /**
         * Converts this WsResp to JSON.
         * @function toJSON
         * @memberof protos.WsResp
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        WsResp.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for WsResp
         * @function getTypeUrl
         * @memberof protos.WsResp
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        WsResp.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.WsResp";
        };

        return WsResp;
    })();

    protos.MeleeBullet = (function() {

        /**
         * Properties of a MeleeBullet.
         * @memberof protos
         * @interface IMeleeBullet
         * @property {number|null} [battleLocalId] MeleeBullet battleLocalId
         * @property {number|null} [startupFrames] MeleeBullet startupFrames
         * @property {number|null} [activeFrames] MeleeBullet activeFrames
         * @property {number|null} [recoveryFrames] MeleeBullet recoveryFrames
         * @property {number|null} [recoveryFramesOnBlock] MeleeBullet recoveryFramesOnBlock
         * @property {number|null} [recoveryFramesOnHit] MeleeBullet recoveryFramesOnHit
         * @property {sharedprotos.Vec2D|null} [moveforward] MeleeBullet moveforward
         * @property {number|null} [hitboxOffset] MeleeBullet hitboxOffset
         * @property {sharedprotos.Vec2D|null} [hitboxSize] MeleeBullet hitboxSize
         * @property {number|null} [originatedRenderFrameId] MeleeBullet originatedRenderFrameId
         * @property {number|null} [hitStunFrames] MeleeBullet hitStunFrames
         * @property {number|null} [blockStunFrames] MeleeBullet blockStunFrames
         * @property {number|null} [pushback] MeleeBullet pushback
         * @property {number|null} [releaseTriggerType] MeleeBullet releaseTriggerType
         * @property {number|null} [damage] MeleeBullet damage
         * @property {number|null} [offenderJoinIndex] MeleeBullet offenderJoinIndex
         * @property {number|null} [offenderPlayerId] MeleeBullet offenderPlayerId
         */

        /**
         * Constructs a new MeleeBullet.
         * @memberof protos
         * @classdesc Represents a MeleeBullet.
         * @implements IMeleeBullet
         * @constructor
         * @param {protos.IMeleeBullet=} [properties] Properties to set
         */
        function MeleeBullet(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MeleeBullet battleLocalId.
         * @member {number} battleLocalId
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.battleLocalId = 0;

        /**
         * MeleeBullet startupFrames.
         * @member {number} startupFrames
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.startupFrames = 0;

        /**
         * MeleeBullet activeFrames.
         * @member {number} activeFrames
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.activeFrames = 0;

        /**
         * MeleeBullet recoveryFrames.
         * @member {number} recoveryFrames
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.recoveryFrames = 0;

        /**
         * MeleeBullet recoveryFramesOnBlock.
         * @member {number} recoveryFramesOnBlock
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.recoveryFramesOnBlock = 0;

        /**
         * MeleeBullet recoveryFramesOnHit.
         * @member {number} recoveryFramesOnHit
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.recoveryFramesOnHit = 0;

        /**
         * MeleeBullet moveforward.
         * @member {sharedprotos.Vec2D|null|undefined} moveforward
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.moveforward = null;

        /**
         * MeleeBullet hitboxOffset.
         * @member {number} hitboxOffset
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.hitboxOffset = 0;

        /**
         * MeleeBullet hitboxSize.
         * @member {sharedprotos.Vec2D|null|undefined} hitboxSize
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.hitboxSize = null;

        /**
         * MeleeBullet originatedRenderFrameId.
         * @member {number} originatedRenderFrameId
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.originatedRenderFrameId = 0;

        /**
         * MeleeBullet hitStunFrames.
         * @member {number} hitStunFrames
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.hitStunFrames = 0;

        /**
         * MeleeBullet blockStunFrames.
         * @member {number} blockStunFrames
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.blockStunFrames = 0;

        /**
         * MeleeBullet pushback.
         * @member {number} pushback
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.pushback = 0;

        /**
         * MeleeBullet releaseTriggerType.
         * @member {number} releaseTriggerType
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.releaseTriggerType = 0;

        /**
         * MeleeBullet damage.
         * @member {number} damage
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.damage = 0;

        /**
         * MeleeBullet offenderJoinIndex.
         * @member {number} offenderJoinIndex
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.offenderJoinIndex = 0;

        /**
         * MeleeBullet offenderPlayerId.
         * @member {number} offenderPlayerId
         * @memberof protos.MeleeBullet
         * @instance
         */
        MeleeBullet.prototype.offenderPlayerId = 0;

        /**
         * Creates a new MeleeBullet instance using the specified properties.
         * @function create
         * @memberof protos.MeleeBullet
         * @static
         * @param {protos.IMeleeBullet=} [properties] Properties to set
         * @returns {protos.MeleeBullet} MeleeBullet instance
         */
        MeleeBullet.create = function create(properties) {
            return new MeleeBullet(properties);
        };

        /**
         * Encodes the specified MeleeBullet message. Does not implicitly {@link protos.MeleeBullet.verify|verify} messages.
         * @function encode
         * @memberof protos.MeleeBullet
         * @static
         * @param {protos.MeleeBullet} message MeleeBullet message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MeleeBullet.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.battleLocalId != null && Object.hasOwnProperty.call(message, "battleLocalId"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.battleLocalId);
            if (message.startupFrames != null && Object.hasOwnProperty.call(message, "startupFrames"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.startupFrames);
            if (message.activeFrames != null && Object.hasOwnProperty.call(message, "activeFrames"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.activeFrames);
            if (message.recoveryFrames != null && Object.hasOwnProperty.call(message, "recoveryFrames"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.recoveryFrames);
            if (message.recoveryFramesOnBlock != null && Object.hasOwnProperty.call(message, "recoveryFramesOnBlock"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.recoveryFramesOnBlock);
            if (message.recoveryFramesOnHit != null && Object.hasOwnProperty.call(message, "recoveryFramesOnHit"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.recoveryFramesOnHit);
            if (message.moveforward != null && Object.hasOwnProperty.call(message, "moveforward"))
                $root.sharedprotos.Vec2D.encode(message.moveforward, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
            if (message.hitboxOffset != null && Object.hasOwnProperty.call(message, "hitboxOffset"))
                writer.uint32(/* id 8, wireType 1 =*/65).double(message.hitboxOffset);
            if (message.hitboxSize != null && Object.hasOwnProperty.call(message, "hitboxSize"))
                $root.sharedprotos.Vec2D.encode(message.hitboxSize, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
            if (message.originatedRenderFrameId != null && Object.hasOwnProperty.call(message, "originatedRenderFrameId"))
                writer.uint32(/* id 10, wireType 0 =*/80).int32(message.originatedRenderFrameId);
            if (message.hitStunFrames != null && Object.hasOwnProperty.call(message, "hitStunFrames"))
                writer.uint32(/* id 11, wireType 0 =*/88).int32(message.hitStunFrames);
            if (message.blockStunFrames != null && Object.hasOwnProperty.call(message, "blockStunFrames"))
                writer.uint32(/* id 12, wireType 0 =*/96).int32(message.blockStunFrames);
            if (message.pushback != null && Object.hasOwnProperty.call(message, "pushback"))
                writer.uint32(/* id 13, wireType 1 =*/105).double(message.pushback);
            if (message.releaseTriggerType != null && Object.hasOwnProperty.call(message, "releaseTriggerType"))
                writer.uint32(/* id 14, wireType 0 =*/112).int32(message.releaseTriggerType);
            if (message.damage != null && Object.hasOwnProperty.call(message, "damage"))
                writer.uint32(/* id 15, wireType 0 =*/120).int32(message.damage);
            if (message.offenderJoinIndex != null && Object.hasOwnProperty.call(message, "offenderJoinIndex"))
                writer.uint32(/* id 16, wireType 0 =*/128).int32(message.offenderJoinIndex);
            if (message.offenderPlayerId != null && Object.hasOwnProperty.call(message, "offenderPlayerId"))
                writer.uint32(/* id 17, wireType 0 =*/136).int32(message.offenderPlayerId);
            return writer;
        };

        /**
         * Encodes the specified MeleeBullet message, length delimited. Does not implicitly {@link protos.MeleeBullet.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.MeleeBullet
         * @static
         * @param {protos.MeleeBullet} message MeleeBullet message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MeleeBullet.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a MeleeBullet message from the specified reader or buffer.
         * @function decode
         * @memberof protos.MeleeBullet
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.MeleeBullet} MeleeBullet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MeleeBullet.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.MeleeBullet();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.battleLocalId = reader.int32();
                        break;
                    }
                case 2: {
                        message.startupFrames = reader.int32();
                        break;
                    }
                case 3: {
                        message.activeFrames = reader.int32();
                        break;
                    }
                case 4: {
                        message.recoveryFrames = reader.int32();
                        break;
                    }
                case 5: {
                        message.recoveryFramesOnBlock = reader.int32();
                        break;
                    }
                case 6: {
                        message.recoveryFramesOnHit = reader.int32();
                        break;
                    }
                case 7: {
                        message.moveforward = $root.sharedprotos.Vec2D.decode(reader, reader.uint32());
                        break;
                    }
                case 8: {
                        message.hitboxOffset = reader.double();
                        break;
                    }
                case 9: {
                        message.hitboxSize = $root.sharedprotos.Vec2D.decode(reader, reader.uint32());
                        break;
                    }
                case 10: {
                        message.originatedRenderFrameId = reader.int32();
                        break;
                    }
                case 11: {
                        message.hitStunFrames = reader.int32();
                        break;
                    }
                case 12: {
                        message.blockStunFrames = reader.int32();
                        break;
                    }
                case 13: {
                        message.pushback = reader.double();
                        break;
                    }
                case 14: {
                        message.releaseTriggerType = reader.int32();
                        break;
                    }
                case 15: {
                        message.damage = reader.int32();
                        break;
                    }
                case 16: {
                        message.offenderJoinIndex = reader.int32();
                        break;
                    }
                case 17: {
                        message.offenderPlayerId = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a MeleeBullet message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.MeleeBullet
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.MeleeBullet} MeleeBullet
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MeleeBullet.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MeleeBullet message.
         * @function verify
         * @memberof protos.MeleeBullet
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MeleeBullet.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.battleLocalId != null && message.hasOwnProperty("battleLocalId"))
                if (!$util.isInteger(message.battleLocalId))
                    return "battleLocalId: integer expected";
            if (message.startupFrames != null && message.hasOwnProperty("startupFrames"))
                if (!$util.isInteger(message.startupFrames))
                    return "startupFrames: integer expected";
            if (message.activeFrames != null && message.hasOwnProperty("activeFrames"))
                if (!$util.isInteger(message.activeFrames))
                    return "activeFrames: integer expected";
            if (message.recoveryFrames != null && message.hasOwnProperty("recoveryFrames"))
                if (!$util.isInteger(message.recoveryFrames))
                    return "recoveryFrames: integer expected";
            if (message.recoveryFramesOnBlock != null && message.hasOwnProperty("recoveryFramesOnBlock"))
                if (!$util.isInteger(message.recoveryFramesOnBlock))
                    return "recoveryFramesOnBlock: integer expected";
            if (message.recoveryFramesOnHit != null && message.hasOwnProperty("recoveryFramesOnHit"))
                if (!$util.isInteger(message.recoveryFramesOnHit))
                    return "recoveryFramesOnHit: integer expected";
            if (message.moveforward != null && message.hasOwnProperty("moveforward")) {
                var error = $root.sharedprotos.Vec2D.verify(message.moveforward);
                if (error)
                    return "moveforward." + error;
            }
            if (message.hitboxOffset != null && message.hasOwnProperty("hitboxOffset"))
                if (typeof message.hitboxOffset !== "number")
                    return "hitboxOffset: number expected";
            if (message.hitboxSize != null && message.hasOwnProperty("hitboxSize")) {
                var error = $root.sharedprotos.Vec2D.verify(message.hitboxSize);
                if (error)
                    return "hitboxSize." + error;
            }
            if (message.originatedRenderFrameId != null && message.hasOwnProperty("originatedRenderFrameId"))
                if (!$util.isInteger(message.originatedRenderFrameId))
                    return "originatedRenderFrameId: integer expected";
            if (message.hitStunFrames != null && message.hasOwnProperty("hitStunFrames"))
                if (!$util.isInteger(message.hitStunFrames))
                    return "hitStunFrames: integer expected";
            if (message.blockStunFrames != null && message.hasOwnProperty("blockStunFrames"))
                if (!$util.isInteger(message.blockStunFrames))
                    return "blockStunFrames: integer expected";
            if (message.pushback != null && message.hasOwnProperty("pushback"))
                if (typeof message.pushback !== "number")
                    return "pushback: number expected";
            if (message.releaseTriggerType != null && message.hasOwnProperty("releaseTriggerType"))
                if (!$util.isInteger(message.releaseTriggerType))
                    return "releaseTriggerType: integer expected";
            if (message.damage != null && message.hasOwnProperty("damage"))
                if (!$util.isInteger(message.damage))
                    return "damage: integer expected";
            if (message.offenderJoinIndex != null && message.hasOwnProperty("offenderJoinIndex"))
                if (!$util.isInteger(message.offenderJoinIndex))
                    return "offenderJoinIndex: integer expected";
            if (message.offenderPlayerId != null && message.hasOwnProperty("offenderPlayerId"))
                if (!$util.isInteger(message.offenderPlayerId))
                    return "offenderPlayerId: integer expected";
            return null;
        };

        /**
         * Creates a MeleeBullet message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.MeleeBullet
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.MeleeBullet} MeleeBullet
         */
        MeleeBullet.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.MeleeBullet)
                return object;
            var message = new $root.protos.MeleeBullet();
            if (object.battleLocalId != null)
                message.battleLocalId = object.battleLocalId | 0;
            if (object.startupFrames != null)
                message.startupFrames = object.startupFrames | 0;
            if (object.activeFrames != null)
                message.activeFrames = object.activeFrames | 0;
            if (object.recoveryFrames != null)
                message.recoveryFrames = object.recoveryFrames | 0;
            if (object.recoveryFramesOnBlock != null)
                message.recoveryFramesOnBlock = object.recoveryFramesOnBlock | 0;
            if (object.recoveryFramesOnHit != null)
                message.recoveryFramesOnHit = object.recoveryFramesOnHit | 0;
            if (object.moveforward != null) {
                if (typeof object.moveforward !== "object")
                    throw TypeError(".protos.MeleeBullet.moveforward: object expected");
                message.moveforward = $root.sharedprotos.Vec2D.fromObject(object.moveforward);
            }
            if (object.hitboxOffset != null)
                message.hitboxOffset = Number(object.hitboxOffset);
            if (object.hitboxSize != null) {
                if (typeof object.hitboxSize !== "object")
                    throw TypeError(".protos.MeleeBullet.hitboxSize: object expected");
                message.hitboxSize = $root.sharedprotos.Vec2D.fromObject(object.hitboxSize);
            }
            if (object.originatedRenderFrameId != null)
                message.originatedRenderFrameId = object.originatedRenderFrameId | 0;
            if (object.hitStunFrames != null)
                message.hitStunFrames = object.hitStunFrames | 0;
            if (object.blockStunFrames != null)
                message.blockStunFrames = object.blockStunFrames | 0;
            if (object.pushback != null)
                message.pushback = Number(object.pushback);
            if (object.releaseTriggerType != null)
                message.releaseTriggerType = object.releaseTriggerType | 0;
            if (object.damage != null)
                message.damage = object.damage | 0;
            if (object.offenderJoinIndex != null)
                message.offenderJoinIndex = object.offenderJoinIndex | 0;
            if (object.offenderPlayerId != null)
                message.offenderPlayerId = object.offenderPlayerId | 0;
            return message;
        };

        /**
         * Creates a plain object from a MeleeBullet message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.MeleeBullet
         * @static
         * @param {protos.MeleeBullet} message MeleeBullet
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MeleeBullet.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.battleLocalId = 0;
                object.startupFrames = 0;
                object.activeFrames = 0;
                object.recoveryFrames = 0;
                object.recoveryFramesOnBlock = 0;
                object.recoveryFramesOnHit = 0;
                object.moveforward = null;
                object.hitboxOffset = 0;
                object.hitboxSize = null;
                object.originatedRenderFrameId = 0;
                object.hitStunFrames = 0;
                object.blockStunFrames = 0;
                object.pushback = 0;
                object.releaseTriggerType = 0;
                object.damage = 0;
                object.offenderJoinIndex = 0;
                object.offenderPlayerId = 0;
            }
            if (message.battleLocalId != null && message.hasOwnProperty("battleLocalId"))
                object.battleLocalId = message.battleLocalId;
            if (message.startupFrames != null && message.hasOwnProperty("startupFrames"))
                object.startupFrames = message.startupFrames;
            if (message.activeFrames != null && message.hasOwnProperty("activeFrames"))
                object.activeFrames = message.activeFrames;
            if (message.recoveryFrames != null && message.hasOwnProperty("recoveryFrames"))
                object.recoveryFrames = message.recoveryFrames;
            if (message.recoveryFramesOnBlock != null && message.hasOwnProperty("recoveryFramesOnBlock"))
                object.recoveryFramesOnBlock = message.recoveryFramesOnBlock;
            if (message.recoveryFramesOnHit != null && message.hasOwnProperty("recoveryFramesOnHit"))
                object.recoveryFramesOnHit = message.recoveryFramesOnHit;
            if (message.moveforward != null && message.hasOwnProperty("moveforward"))
                object.moveforward = $root.sharedprotos.Vec2D.toObject(message.moveforward, options);
            if (message.hitboxOffset != null && message.hasOwnProperty("hitboxOffset"))
                object.hitboxOffset = options.json && !isFinite(message.hitboxOffset) ? String(message.hitboxOffset) : message.hitboxOffset;
            if (message.hitboxSize != null && message.hasOwnProperty("hitboxSize"))
                object.hitboxSize = $root.sharedprotos.Vec2D.toObject(message.hitboxSize, options);
            if (message.originatedRenderFrameId != null && message.hasOwnProperty("originatedRenderFrameId"))
                object.originatedRenderFrameId = message.originatedRenderFrameId;
            if (message.hitStunFrames != null && message.hasOwnProperty("hitStunFrames"))
                object.hitStunFrames = message.hitStunFrames;
            if (message.blockStunFrames != null && message.hasOwnProperty("blockStunFrames"))
                object.blockStunFrames = message.blockStunFrames;
            if (message.pushback != null && message.hasOwnProperty("pushback"))
                object.pushback = options.json && !isFinite(message.pushback) ? String(message.pushback) : message.pushback;
            if (message.releaseTriggerType != null && message.hasOwnProperty("releaseTriggerType"))
                object.releaseTriggerType = message.releaseTriggerType;
            if (message.damage != null && message.hasOwnProperty("damage"))
                object.damage = message.damage;
            if (message.offenderJoinIndex != null && message.hasOwnProperty("offenderJoinIndex"))
                object.offenderJoinIndex = message.offenderJoinIndex;
            if (message.offenderPlayerId != null && message.hasOwnProperty("offenderPlayerId"))
                object.offenderPlayerId = message.offenderPlayerId;
            return object;
        };

        /**
         * Converts this MeleeBullet to JSON.
         * @function toJSON
         * @memberof protos.MeleeBullet
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MeleeBullet.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for MeleeBullet
         * @function getTypeUrl
         * @memberof protos.MeleeBullet
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        MeleeBullet.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.MeleeBullet";
        };

        return MeleeBullet;
    })();

    protos.RoomDownsyncFrame = (function() {

        /**
         * Properties of a RoomDownsyncFrame.
         * @memberof protos
         * @interface IRoomDownsyncFrame
         * @property {number|null} [id] RoomDownsyncFrame id
         * @property {Object.<string,protos.PlayerDownsync>|null} [players] RoomDownsyncFrame players
         * @property {number|Long|null} [countdownNanos] RoomDownsyncFrame countdownNanos
         * @property {Array.<protos.MeleeBullet>|null} [meleeBullets] RoomDownsyncFrame meleeBullets
         */

        /**
         * Constructs a new RoomDownsyncFrame.
         * @memberof protos
         * @classdesc Represents a RoomDownsyncFrame.
         * @implements IRoomDownsyncFrame
         * @constructor
         * @param {protos.IRoomDownsyncFrame=} [properties] Properties to set
         */
        function RoomDownsyncFrame(properties) {
            this.players = {};
            this.meleeBullets = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * RoomDownsyncFrame id.
         * @member {number} id
         * @memberof protos.RoomDownsyncFrame
         * @instance
         */
        RoomDownsyncFrame.prototype.id = 0;

        /**
         * RoomDownsyncFrame players.
         * @member {Object.<string,protos.PlayerDownsync>} players
         * @memberof protos.RoomDownsyncFrame
         * @instance
         */
        RoomDownsyncFrame.prototype.players = $util.emptyObject;

        /**
         * RoomDownsyncFrame countdownNanos.
         * @member {number|Long} countdownNanos
         * @memberof protos.RoomDownsyncFrame
         * @instance
         */
        RoomDownsyncFrame.prototype.countdownNanos = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * RoomDownsyncFrame meleeBullets.
         * @member {Array.<protos.MeleeBullet>} meleeBullets
         * @memberof protos.RoomDownsyncFrame
         * @instance
         */
        RoomDownsyncFrame.prototype.meleeBullets = $util.emptyArray;

        /**
         * Creates a new RoomDownsyncFrame instance using the specified properties.
         * @function create
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {protos.IRoomDownsyncFrame=} [properties] Properties to set
         * @returns {protos.RoomDownsyncFrame} RoomDownsyncFrame instance
         */
        RoomDownsyncFrame.create = function create(properties) {
            return new RoomDownsyncFrame(properties);
        };

        /**
         * Encodes the specified RoomDownsyncFrame message. Does not implicitly {@link protos.RoomDownsyncFrame.verify|verify} messages.
         * @function encode
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {protos.RoomDownsyncFrame} message RoomDownsyncFrame message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        RoomDownsyncFrame.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.players != null && Object.hasOwnProperty.call(message, "players"))
                for (var keys = Object.keys(message.players), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 2, wireType 2 =*/18).fork().uint32(/* id 1, wireType 0 =*/8).int32(keys[i]);
                    $root.protos.PlayerDownsync.encode(message.players[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                }
            if (message.countdownNanos != null && Object.hasOwnProperty.call(message, "countdownNanos"))
                writer.uint32(/* id 3, wireType 0 =*/24).int64(message.countdownNanos);
            if (message.meleeBullets != null && message.meleeBullets.length)
                for (var i = 0; i < message.meleeBullets.length; ++i)
                    $root.protos.MeleeBullet.encode(message.meleeBullets[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified RoomDownsyncFrame message, length delimited. Does not implicitly {@link protos.RoomDownsyncFrame.verify|verify} messages.
         * @function encodeDelimited
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {protos.RoomDownsyncFrame} message RoomDownsyncFrame message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        RoomDownsyncFrame.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a RoomDownsyncFrame message from the specified reader or buffer.
         * @function decode
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {protos.RoomDownsyncFrame} RoomDownsyncFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        RoomDownsyncFrame.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.protos.RoomDownsyncFrame(), key, value;
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.int32();
                        break;
                    }
                case 2: {
                        if (message.players === $util.emptyObject)
                            message.players = {};
                        var end2 = reader.uint32() + reader.pos;
                        key = 0;
                        value = null;
                        while (reader.pos < end2) {
                            var tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.int32();
                                break;
                            case 2:
                                value = $root.protos.PlayerDownsync.decode(reader, reader.uint32());
                                break;
                            default:
                                reader.skipType(tag2 & 7);
                                break;
                            }
                        }
                        message.players[key] = value;
                        break;
                    }
                case 3: {
                        message.countdownNanos = reader.int64();
                        break;
                    }
                case 4: {
                        if (!(message.meleeBullets && message.meleeBullets.length))
                            message.meleeBullets = [];
                        message.meleeBullets.push($root.protos.MeleeBullet.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a RoomDownsyncFrame message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {protos.RoomDownsyncFrame} RoomDownsyncFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        RoomDownsyncFrame.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a RoomDownsyncFrame message.
         * @function verify
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        RoomDownsyncFrame.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.players != null && message.hasOwnProperty("players")) {
                if (!$util.isObject(message.players))
                    return "players: object expected";
                var key = Object.keys(message.players);
                for (var i = 0; i < key.length; ++i) {
                    if (!$util.key32Re.test(key[i]))
                        return "players: integer key{k:int32} expected";
                    {
                        var error = $root.protos.PlayerDownsync.verify(message.players[key[i]]);
                        if (error)
                            return "players." + error;
                    }
                }
            }
            if (message.countdownNanos != null && message.hasOwnProperty("countdownNanos"))
                if (!$util.isInteger(message.countdownNanos) && !(message.countdownNanos && $util.isInteger(message.countdownNanos.low) && $util.isInteger(message.countdownNanos.high)))
                    return "countdownNanos: integer|Long expected";
            if (message.meleeBullets != null && message.hasOwnProperty("meleeBullets")) {
                if (!Array.isArray(message.meleeBullets))
                    return "meleeBullets: array expected";
                for (var i = 0; i < message.meleeBullets.length; ++i) {
                    var error = $root.protos.MeleeBullet.verify(message.meleeBullets[i]);
                    if (error)
                        return "meleeBullets." + error;
                }
            }
            return null;
        };

        /**
         * Creates a RoomDownsyncFrame message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {protos.RoomDownsyncFrame} RoomDownsyncFrame
         */
        RoomDownsyncFrame.fromObject = function fromObject(object) {
            if (object instanceof $root.protos.RoomDownsyncFrame)
                return object;
            var message = new $root.protos.RoomDownsyncFrame();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.players) {
                if (typeof object.players !== "object")
                    throw TypeError(".protos.RoomDownsyncFrame.players: object expected");
                message.players = {};
                for (var keys = Object.keys(object.players), i = 0; i < keys.length; ++i) {
                    if (typeof object.players[keys[i]] !== "object")
                        throw TypeError(".protos.RoomDownsyncFrame.players: object expected");
                    message.players[keys[i]] = $root.protos.PlayerDownsync.fromObject(object.players[keys[i]]);
                }
            }
            if (object.countdownNanos != null)
                if ($util.Long)
                    (message.countdownNanos = $util.Long.fromValue(object.countdownNanos)).unsigned = false;
                else if (typeof object.countdownNanos === "string")
                    message.countdownNanos = parseInt(object.countdownNanos, 10);
                else if (typeof object.countdownNanos === "number")
                    message.countdownNanos = object.countdownNanos;
                else if (typeof object.countdownNanos === "object")
                    message.countdownNanos = new $util.LongBits(object.countdownNanos.low >>> 0, object.countdownNanos.high >>> 0).toNumber();
            if (object.meleeBullets) {
                if (!Array.isArray(object.meleeBullets))
                    throw TypeError(".protos.RoomDownsyncFrame.meleeBullets: array expected");
                message.meleeBullets = [];
                for (var i = 0; i < object.meleeBullets.length; ++i) {
                    if (typeof object.meleeBullets[i] !== "object")
                        throw TypeError(".protos.RoomDownsyncFrame.meleeBullets: object expected");
                    message.meleeBullets[i] = $root.protos.MeleeBullet.fromObject(object.meleeBullets[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a RoomDownsyncFrame message. Also converts values to other types if specified.
         * @function toObject
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {protos.RoomDownsyncFrame} message RoomDownsyncFrame
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        RoomDownsyncFrame.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.meleeBullets = [];
            if (options.objects || options.defaults)
                object.players = {};
            if (options.defaults) {
                object.id = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.countdownNanos = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.countdownNanos = options.longs === String ? "0" : 0;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            var keys2;
            if (message.players && (keys2 = Object.keys(message.players)).length) {
                object.players = {};
                for (var j = 0; j < keys2.length; ++j)
                    object.players[keys2[j]] = $root.protos.PlayerDownsync.toObject(message.players[keys2[j]], options);
            }
            if (message.countdownNanos != null && message.hasOwnProperty("countdownNanos"))
                if (typeof message.countdownNanos === "number")
                    object.countdownNanos = options.longs === String ? String(message.countdownNanos) : message.countdownNanos;
                else
                    object.countdownNanos = options.longs === String ? $util.Long.prototype.toString.call(message.countdownNanos) : options.longs === Number ? new $util.LongBits(message.countdownNanos.low >>> 0, message.countdownNanos.high >>> 0).toNumber() : message.countdownNanos;
            if (message.meleeBullets && message.meleeBullets.length) {
                object.meleeBullets = [];
                for (var j = 0; j < message.meleeBullets.length; ++j)
                    object.meleeBullets[j] = $root.protos.MeleeBullet.toObject(message.meleeBullets[j], options);
            }
            return object;
        };

        /**
         * Converts this RoomDownsyncFrame to JSON.
         * @function toJSON
         * @memberof protos.RoomDownsyncFrame
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        RoomDownsyncFrame.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for RoomDownsyncFrame
         * @function getTypeUrl
         * @memberof protos.RoomDownsyncFrame
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        RoomDownsyncFrame.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/protos.RoomDownsyncFrame";
        };

        return RoomDownsyncFrame;
    })();

    return protos;
})();

module.exports = $root;
