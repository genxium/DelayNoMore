const collisions = require('./modules/Collisions');

const collisionSys = new collisions.Collisions();

/*
Backend result reference

2022-10-22T12:11:25.156+0800	INFO	collider_visualizer/worldColliderDisplay.go:77	Collided: player.X=1257.665, player.Y=1415.335, oldDx=-2.98, oldDy=-50, playerShape=&{[[0 0] [64 0] [64 64] [0 64]] 1254.685 1365.335 true}, toCheckBarrier=&{[[628.626 54.254500000000064] [0 56.03250000000003] [0.42449999999999477 1.1229999999999905] [625.9715000000001 0]] 1289.039 1318.0805 true}, pushbackX=-0.15848054013127655, pushbackY=-56.03205175509715, result=&{56.03227587710039 -0.0028283794946841584 -0.9999960001267175 false false [0.9988052279193613 -0.04886836073527201]}
*/
function polygonStr(body) {
  let coords = [];
  let cnt = body._coords.length;
  for (let ix = 0, iy = 1; ix < cnt; ix += 2, iy += 2) {
    coords.push([body._coords[ix], body._coords[iy]]);
  }
  return JSON.stringify(coords);
}

const playerCollider = collisionSys.createPolygon(1257.665, 1415.335, [[0, 0], [64, 0], [64, 64], [0, 64]]);
const barrierCollider = collisionSys.createPolygon(1289.039, 1318.0805, [[628.626, 54.254500000000064], [0, 56.03250000000003], [0.42449999999999477, 1.1229999999999905], [625.9715000000001, 0]]);

const oldDx = -2.98;
const oldDy = -50.0;

playerCollider.x += oldDx;
playerCollider.y += oldDy;

collisionSys.update();
const result = collisionSys.createResult();

const potentials = playerCollider.potentials();

let overlapCheckId = 0;
for (const barrier of potentials) {
  if (!playerCollider.collides(barrier, result)) continue;
  const pushbackX = result.overlap * result.overlap_x;
  const pushbackY = result.overlap * result.overlap_y;
  console.log("For overlapCheckId=" + overlapCheckId + ", the overlap: a=", polygonStr(result.a), ", b=", polygonStr(result.b), ", pushbackX=", pushbackX, ", pushbackY=", pushbackY);
}
