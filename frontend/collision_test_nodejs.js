const collisions = require('./assets/scripts/modules/Collisions');

const collisionSys = new collisions.Collisions();

function polygonStr(body) {
  let coords = [];
  let cnt = body._coords.length;
  for (let ix = 0, iy = 1; ix < cnt; ix += 2, iy += 2) {
    coords.push([body._coords[ix], body._coords[iy]]);
  }
  return JSON.stringify(coords);
}

const playerCollider1 = collisionSys.createPolygon(944.000, 676.000, [[0, 0], [24, 0], [24, 48], [0, 48]]);
playerCollider1.data = {isPlayer: true};
const playerCollider2 = collisionSys.createPolygon(958.000, 724.000, [[0, 0], [24, 0], [24, 48], [0, 48]]);
playerCollider2.data = {isPlayer: true};

const barrierCollider1 = collisionSys.createPolygon(1277.7159000000001, 1570.5575, [[642.5696, 319.159], [0, 319.15680000000003], [5.7286, 0], [643.7451, 0.9014999999999986]]);
const barrierCollider2 = collisionSys.createPolygon(1289.039, 1318.0805, [[628.626, 54.254500000000064], [0, 56.03250000000003], [0.42449999999999477, 1.1229999999999905], [625.9715000000001, 0]]);
const barrierCollider3 = collisionSys.createPolygon(1207, 1310, [[69, 581], [0, 579], [8, 3], [79, 0]]);

collisionSys.update();

const effPushback = [0.0, 0.0];

const result = collisionSys.createResult();

// Check collision for player1
const potentials = playerCollider1.potentials();
for (const potential of potentials) {
  if (null == potential.data || true != potential.data.isPlayer) continue;
  console.log(`Collided player potential of a=${polygonStr(playerCollider1)}: b=${polygonStr(potential)}`);
  if (!playerCollider1.collides(potential, result)) continue;
  console.log(`Collided player of a=${polygonStr(playerCollider1)}: b=${polygonStr(potential)}`);
  const pushbackX = result.overlap * result.overlap_x; 
  const pushbackY = result.overlap * result.overlap_y; 
  console.log(`Overlapped: a=${polygonStr(result.a)}, b=${polygonStr(result.b)}, pushbackX=${pushbackX}, pushbackY=${pushbackY}`);
  effPushback[0] += pushbackX;
  effPushback[1] += pushbackY;
}

console.log(`effPushback=${effPushback}`);
