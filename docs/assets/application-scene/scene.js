import { Matrix4, Quaternion, Vector3 } from "./three-math.js";
import { unpackMesh } from "./render.js?v=20261126h";

const palette = {
  "Satin laboratory epoxy": "#d6d5c9",
  "Warehouse worn concrete": "#343947",
  "Muted blue grey laboratory plaster": "#d7dedb",
  "Cool industrial plaster": "#3c414c",
  "Concrete joint": "#363c47",
  "Black rubber": "#282d36",
  "Brushed aluminium": "#8b99ac",
  "Powder-coated steel": "#4b5465",
  "Powder-coated white cabinet": "#eee8dc",
  "Dark non-emissive monitor glass": "#527b94",
  "Industrial purple polymer": "#68639c",
  "Kraft corrugated cardboard": "#927b64",
  "Pallet wood": "#8b715e",
  "Translucent packing tape": "#c7af96",
  "Unprinted shipping paper": "#d4cabb",
  "UniGeom theme 8080FF": "#8080ff",
  black: "#282c37",
  white: "#dee1e7",
  gray: "#a6adbb",
  metal: "#717c94",
  Paint_Matte_Black: "#373c4b",
  Paint_Metallic_White: "#e2e3e8",
};
function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}
const units = new Vector3(1, 1, 1);
const vector = (a) => new Vector3(...a);
const rotation = (q) => new Quaternion(q[1], q[2], q[3], q[0]).normalize();
const matrix = (p, q) => new Matrix4().compose(vector(p), rotation(q), units);
const identity = new Matrix4();
const clamp = (x) => Math.max(0, Math.min(1, x));
function ease(x) {
  x = clamp(x);
  return x * x * (3 - 2 * x);
}
function mix(a, b, k) {
  return a + (b - a) * k;
}
function ramp(t, a, b) {
  return ease((t - a) / (b - a));
}
function sampleKeys(t, keys) {
  let i = keys.findIndex(([end]) => end >= t);
  if (i < 1) return keys[i === 0 ? 0 : keys.length - 1][1];
  const [start, a] = keys[i - 1],
    [end, b] = keys[i];
  return mix(a, b, clamp((t - start) / (end - start)));
}
const path = [
  [0, -3.28],
  [12, -1.23],
  [24, 1.32],
  [27, 1.98],
  [29, 2.2],
];
// Smooth acceleration and deceleration while preserving the measured model scale.
function baseX(t) {
  if (t < 1.6) return -3.28 + ((2.05 / 11.2) * t * t) / 3.2;
  if (t < 12) return -3.28 + (2.05 / 11.2) * (t - 0.8);
  if (t < 27) return sampleKeys(t, path);
  if (t < 29) return 2.2 - 0.22 * ((29 - t) / 2) ** 2;
  return 2.2;
}
const armTimeline = [
  [0, 0],
  [10, 0],
  [15, 1],
  [19, 2],
  [24, 3],
  [27, 3],
  [29.8, 4],
  [32.5, 5],
  [33.8, 5],
  [36, 6],
];
function armAngles(rig, t) {
  const end = armTimeline.findIndex(([time]) => time >= t);
  if (end <= 0) return rig.arm[end === 0 ? 0 : 6];
  const [ta, ia] = armTimeline[end - 1],
    [tb, ib] = armTimeline[end],
    w = ramp(t, ta, tb);
  return rig.arm[ia].map((a, j) => mix(a, rig.arm[ib][j], w));
}
function gait(distance, weight, diagonal, side, zBase) {
  const phase = (distance / 0.31 + diagonal) % 1;
  const swing = phase > 0.5;
  const u = swing ? (phase - 0.5) * 2 : phase * 2;
  const footX = 0.0775 * (swing ? 2 * ease(u) - 1 : 1 - 2 * u) - 0.0155;
  const footZ = 0.022 + (swing ? 0.067 * Math.sin(Math.PI * u) ** 2 : 0);
  const roll = 0.1 * side;
  const zLocal =
    (footZ - zBase - 0.0955 * side * Math.sin(roll)) / Math.cos(roll);
  const knee = -2 * Math.acos(Math.min(1, Math.hypot(footX, zLocal) / 0.426));
  const hip = Math.atan2(-footX, -zLocal) - knee / 2;
  return [roll, mix(0.8, hip, weight), mix(-1.5, knee, weight)];
}
function cylinder(radius, height, segments = 30) {
  const positions = [],
    normals = [],
    indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments,
      b = ((i + 1) * Math.PI * 2) / segments;
    const ca = Math.cos(a),
      sa = Math.sin(a),
      cb = Math.cos(b),
      sb = Math.sin(b),
      j = positions.length / 3;
    const lo = -height / 2,
      hi = height / 2;
    positions.push(
      radius * ca,
      radius * sa,
      lo,
      radius * cb,
      radius * sb,
      lo,
      radius * cb,
      radius * sb,
      hi,
      radius * ca,
      radius * sa,
      hi,
      0,
      0,
      hi,
      radius * ca,
      radius * sa,
      hi,
      radius * cb,
      radius * sb,
      hi,
      0,
      0,
      lo,
      radius * cb,
      radius * sb,
      lo,
      radius * ca,
      radius * sa,
      lo,
    );
    normals.push(
      ca,
      sa,
      0,
      cb,
      sb,
      0,
      cb,
      sb,
      0,
      ca,
      sa,
      0,
      0,
      0,
      1,
      0,
      0,
      1,
      0,
      0,
      1,
      0,
      0,
      -1,
      0,
      0,
      -1,
      0,
      0,
      -1,
    );
    indices.push(
      j,
      j + 1,
      j + 2,
      j,
      j + 2,
      j + 3,
      j + 4,
      j + 5,
      j + 6,
      j + 7,
      j + 8,
      j + 9,
    );
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}
const disc = (() => {
  const positions = [0, 0, 0],
    normals = [0, 0, 1],
    indices = [];
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI * 2) / 48;
    positions.push(Math.cos(a), Math.sin(a), 0);
    normals.push(0, 0, 1);
    indices.push(0, i + 1, ((i + 1) % 48) + 1);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
})();
const makeItem = (mesh, hex) => ({
  mesh,
  transform: new Matrix4(),
  rgb: rgb(hex),
});

export function buildScene(meshes, rig) {
  const objects = Object.entries(meshes.room).map(([material, source]) =>
    makeItem(unpackMesh(source), palette[material]),
  );
  const geometry = Object.fromEntries(
    Object.entries(meshes.robot).map(([key, m]) => [key, unpackMesh(m)]),
  );
  const links = rig.body.map((b) => ({
    ...b,
    position: vector(b.p),
    orientation: rotation(b.q),
    axis: b.joint ? vector(b.joint.axis) : null,
    world: new Matrix4(),
  }));
  const robot = rig.geoms.map((g) => {
    const item = makeItem(geometry[g.mesh], palette[g.material]);
    objects.push(item);
    return { item, body: g.body, offset: matrix(g.p, g.q) };
  });
  const part = makeItem(cylinder(0.0115, 0.055), "#ccd5df");
  const band = makeItem(cylinder(0.012, 0.016), "#8af0d9");
  const shadows = Array.from({ length: 8 }, () => makeItem(disc, "#000000"));
  objects.push(...shadows, part, band);
  const left = vector(rig.pad.p),
    right = vector(rig.otherPad.p);
  const pos = new Vector3(),
    qa = new Quaternion(),
    local = new Matrix4(),
    p2 = new Vector3();
  const delta = new Quaternion(),
    factor = new Vector3();
  const placed = new Matrix4();
  function pose(t) {
    const x = baseX(t),
      distance = x + 3.28;
    const weight = ramp(distance, 0, 0.1) * (1 - ramp(distance, 5.25, 5.48));
    const z =
      rig.baseZ +
      0.009 * weight * Math.sin((2 * Math.PI * distance) / 0.31) ** 2;
    const joints = {};
    for (const [leg, phase, side] of [
      ["FL", 0.5, 1],
      ["FR", 0, -1],
      ["RL", 0, 1],
      ["RR", 0.5, -1],
    ]) {
      const [roll, hip, knee] = gait(distance, weight, phase, side, z);
      joints[leg + "_hip_joint"] = roll;
      joints[leg + "_thigh_joint"] = hip;
      joints[leg + "_calf_joint"] = knee;
    }
    armAngles(rig, t).forEach((q, i) => (joints["joint" + (i + 1)] = q));
    for (let i = 1; i < links.length; i++) {
      const b = links[i];
      pos.copy(b.position);
      qa.copy(b.orientation);
      if (b.name === "base") pos.set(x, -0.55, z);
      else if (b.joint)
        qa.multiply(delta.setFromAxisAngle(b.axis, joints[b.joint.name] || 0));
      if (i === rig.pad.b || i === rig.otherPad.b)
        pos.y += Math.sign(pos.y) * 0.013 * ramp(t, 32.65, 33.55);
      local.compose(pos, qa, units);
      b.world.multiplyMatrices(links[b.parent].world, local);
    }
    for (const { item, body, offset } of robot)
      item.transform.multiplyMatrices(links[body].world, offset);
    if (t <= 33.2) {
      const hand = links[rig.pad.b].world;
      pos.copy(left).applyMatrix4(hand);
      pos.lerp(p2.copy(right).applyMatrix4(links[rig.otherPad.b].world), 0.5);
      qa.setFromRotationMatrix(hand);
      part.transform.compose(pos, qa, units);
    } else part.transform.copy(placed);
    band.transform.copy(part.transform);
    shadows.forEach((item, j) => {
      const f = j / (shadows.length - 1);
      pos.set(x - 0.02, -0.53, 0.009 + f * 0.0008);
      factor.set(0.51 - 0.19 * f, 0.25 - 0.095 * f, 1);
      item.transform.compose(pos, identityQuaternion, factor);
      item.opacity = 0.025 + 0.06 * f * f;
    });
  }
  pose(33.18);
  placed.copy(part.transform);
  const projection = new Matrix4(),
    cameraWorld = new Matrix4(),
    view = new Matrix4();
  const eye = new Vector3(),
    target = new Vector3(),
    up = new Vector3(0, 0, 1);
  function frame(t, aspect, orbit) {
    pose(t);
    const x = baseX(t);
    const close = ramp(t, 25, 32);
    const wide = Math.max(1 - ramp(t, 1.2, 4.2), ramp(t, 36, 39));
    const height = mix(1.9, 1.44, close);
    const width = mix(Math.max(height * aspect, 1.47), 8.4, wide);
    const halfHeight = width / aspect / 2;
    const angle = mix(0.25, -0.24, close) + orbit;
    target.set(
      mix(x + mix(0.12, 0.24, close), -0.35, wide),
      mix(-0.31, 0.12, wide),
      mix(mix(0.58, 0.49, close), 0.65, wide),
    );
    eye.set(
      target.x + 4 * Math.sin(angle),
      target.y - 4 * Math.cos(angle),
      target.z + mix(1.53, 1.72, close),
    );
    cameraWorld.lookAt(eye, target, up).setPosition(eye);
    projection.makeOrthographic(
      -width / 2,
      width / 2,
      halfHeight,
      -halfHeight,
      0.01,
      20,
    );
    view.multiplyMatrices(projection, local.copy(cameraWorld).invert());
    return { view, objects };
  }
  return { frame };
}
const identityQuaternion = new Quaternion();
