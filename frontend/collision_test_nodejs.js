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

const playerCollider = collisionSys.createPolygon(1269.665, 1353.335, [[0, 0], [64, 0], [64, 64], [0, 64]]);

const barrierCollider1 = collisionSys.createPolygon(1277.7159000000001, 1570.5575, [[642.5696, 319.159], [0, 319.15680000000003], [5.7286, 0], [643.7451, 0.9014999999999986]]);
const barrierCollider2 = collisionSys.createPolygon(1289.039, 1318.0805, [[628.626, 54.254500000000064], [0, 56.03250000000003], [0.42449999999999477, 1.1229999999999905], [625.9715000000001, 0]]);
const barrierCollider3 = collisionSys.createPolygon(1207, 1310, [[69, 581], [0, 579], [8, 3], [79, 0]]);

playerCollider.x += -2.98;
playerCollider.y += -50.0;
collisionSys.update();

const effPushback = [0.0, 0.0];

const result = collisionSys.createResult();

const potentials = playerCollider.potentials();

for (const barrier of potentials) {
  if (!playerCollider.collides(barrier, result)) continue;
  const pushbackX = result.overlap * result.overlap_x; 
  const pushbackY = result.overlap * result.overlap_y; 
  console.log(`Overlapped: a=${polygonStr(result.a)}, b=${polygonStr(result.b)}, pushbackX=${pushbackX}, pushbackY=${pushbackY}`);
  effPushback[0] += pushbackX;
  effPushback[1] += pushbackY;
}

console.log(`effPushback=${effPushback}`);
