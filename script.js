import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* =========================================================
   SCENE MANAGER
========================================================= */
const scenes = {
  menu: document.getElementById('scene-menu'),
  boss: document.getElementById('scene-boss'),
};
function showScene(name){
  Object.values(scenes).forEach(s => s.classList.remove('active'));
  scenes[name].classList.add('active');
  if (name !== 'boss') stopBossAudio();
}

/* =========================================================
   SHARED TEXTURES — glow dot / ring, used by all FX
========================================================= */
function makeGlowTexture(){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeRingTexture(){
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 40, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeBeamTexture(){
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(230,215,255,0.18)');
  grad.addColorStop(1, 'rgba(230,215,255,0)');
  const hgrad = g.createLinearGradient(0, 0, 64, 0);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 512);
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createLinearGradient(0, 0, 64, 0);
  mask.addColorStop(0, 'rgba(255,255,255,0)');
  mask.addColorStop(0.5, 'rgba(255,255,255,1)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = makeGlowTexture();
const ringTex = makeRingTexture();
const beamTex = makeBeamTexture();

/* =========================================================
   RENDERER / SCENE / CAMERA
========================================================= */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020103, 0.05);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 0.2, 9.2);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.42, 0.6);
composer.addPass(bloomPass);

function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

function planeHalfExtents(z){
  const dist = camera.position.z - z;
  const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
  const w = h * camera.aspect;
  return { w, h };
}

/* =========================================================
   LIGHTS — white / violet only
========================================================= */
scene.add(new THREE.AmbientLight(0x6a4fb0, 0.55));
const key = new THREE.PointLight(0xd8c8ff, 1.3, 30, 2);
key.position.set(2, 4, 6);
scene.add(key);
const rim = new THREE.PointLight(0xffffff, 0.9, 30, 2);
rim.position.set(-3, 1, -3);
scene.add(rim);

/* =========================================================
   PALETTE HELPERS — strictly white / black / violet
========================================================= */
const VIOLET_H = 0.755; // hue for every "purple" used in the scene
function violet(l, s = 0.65){ return new THREE.Color().setHSL(VIOLET_H, s, l); }
const WHITE = 0xffffff;

/* =========================================================
   BACKGROUND — a painted cathedral backdrop (2D) with real 3D
   light shafts and drifting motes floating in front of it
========================================================= */
function drawGothicArch(ctx, cx, baseY, halfW, height){
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.lineTo(cx - halfW, baseY - height * 0.5);
  ctx.quadraticCurveTo(cx - halfW, baseY - height, cx, baseY - height);
  ctx.quadraticCurveTo(cx + halfW, baseY - height, cx + halfW, baseY - height * 0.5);
  ctx.lineTo(cx + halfW, baseY);
  ctx.stroke();
}
function makeCathedralTexture(){
  const W = 1600, H = 1900;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050208';
  ctx.fillRect(0, 0, W, H);

  const cx = W * 0.5, cy = H * 0.4;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.62);
  glow.addColorStop(0, 'rgba(255,255,255,0.85)');
  glow.addColorStop(0.28, 'rgba(200,175,240,0.4)');
  glow.addColorStop(0.6, 'rgba(70,40,110,0.22)');
  glow.addColorStop(1, 'rgba(5,2,8,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // radiating light rays
  ctx.save();
  ctx.globalAlpha = 0.10;
  for (let i = 0; i < 40; i++){
    const a = (i / 40) * Math.PI * 2;
    const len = W * (0.5 + Math.random() * 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
  ctx.restore();

  // concentric gothic arches framing the scene
  ctx.save();
  ctx.strokeStyle = 'rgba(150,120,200,0.45)';
  for (let i = 0; i < 4; i++){
    ctx.lineWidth = W * 0.0035;
    drawGothicArch(ctx, W * 0.5, H * 0.98, W * (0.5 - i * 0.1), H * (0.92 - i * 0.13));
  }
  ctx.restore();

  // tall side columns with capitals, receding into the distance
  ctx.save();
  for (let side = -1; side <= 1; side += 2){
    for (let i = 0; i < 4; i++){
      const cxp = W * 0.5 + side * (W * 0.32 + i * W * 0.11);
      const top = H * (0.14 + i * 0.05);
      const w = W * (0.02 - i * 0.002);
      const a = 0.5 - i * 0.1;
      ctx.fillStyle = `rgba(90,65,140,${a * 0.5})`;
      ctx.fillRect(cxp - w / 2, top, w, H - top);
      ctx.strokeStyle = `rgba(200,180,235,${a})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(cxp - w / 2, top, w, H - top);
      // capital
      ctx.fillStyle = `rgba(150,120,200,${a})`;
      ctx.fillRect(cxp - w * 1.1, top - w * 0.5, w * 2.2, w * 0.5);
    }
  }
  ctx.restore();

  // distant flight of feathers etched faintly into the stone, either side
  ctx.save();
  ctx.globalAlpha = 0.14;
  for (let side = -1; side <= 1; side += 2){
    const fx = W * 0.5 + side * W * 0.3, fy = H * 0.32;
    for (let i = 0; i < 10; i++){
      const a = (i / 9) * 1.1 - 0.55;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + side * Math.cos(a) * W * 0.1, fy - Math.sin(a + 1) * W * 0.12 - W * 0.05,
        fx + side * Math.cos(a) * W * 0.22, fy - Math.sin(a + 1) * W * 0.26 - W * 0.05);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.restore();

  // tracery: small rose-window circles + radiating mullions at the very top arch
  ctx.save();
  ctx.strokeStyle = 'rgba(210,190,240,0.35)';
  ctx.lineWidth = 2;
  const rr = W * 0.16;
  for (let i = 0; i < 16; i++){
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - H * 0.02);
    ctx.lineTo(cx + Math.cos(a) * rr, cy - H * 0.02 + Math.sin(a) * rr);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy - H * 0.02, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - H * 0.02, rr * 0.6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // floor reflection - soft vertical gradient at the bottom
  const floorG = ctx.createLinearGradient(0, H * 0.75, 0, H);
  floorG.addColorStop(0, 'rgba(5,2,8,0)');
  floorG.addColorStop(1, 'rgba(10,4,16,0.9)');
  ctx.fillStyle = floorG;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);

  // vignette
  const vg = ctx.createRadialGradient(cx, H * 0.5, H * 0.3, cx, H * 0.5, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const backdropGeo = new THREE.PlaneGeometry(46, 55);
const backdropMat = new THREE.MeshBasicMaterial({ map: makeCathedralTexture(), fog: false });
const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
backdrop.position.set(0, 3, -22);
scene.add(backdrop);

const beams = [];
for (let i = 0; i < 7; i++){
  const mat = new THREE.SpriteMaterial({
    map: beamTex, color: 0xffffff, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  const a = (i / 7 - 0.5) * 1.6;
  s.position.set(Math.sin(a) * 3, 6, -8 - Math.cos(a) * 2);
  s.scale.set(3.4, 16, 1);
  s.material.rotation = a * 0.5;
  scene.add(s);
  beams.push({ obj: s, baseA: a });
}

function buildMotes(count, radius, size){
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++){
    const r = radius * (0.3 + Math.random() * 0.7);
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.3) * radius * 0.7;
    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * r * 0.4 - 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size, map: glowTex, color: 0xffffff, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}
const motesNear = buildMotes(160, 12, 0.05);
const motesFar = buildMotes(220, 22, 0.035);
scene.add(motesFar, motesNear);

// slow halo arcs behind the boss - a heavenly rather than sci-fi accent
const haloArcs = [];
for (let i = 0; i < 4; i++){
  const geo = new THREE.TorusGeometry(4.2 + i * 1.5, 0.016, 8, 96, Math.PI * 1.5);
  const mat = new THREE.MeshBasicMaterial({
    color: i % 2 === 0 ? 0xffffff : violet(0.7, 0.5).getHex(),
    transparent: true, opacity: 0.13 - i * 0.015, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(0, 2, -6 - i * 2.6);
  ring.rotation.z = i * 0.5;
  scene.add(ring);
  haloArcs.push(ring);
}

/* =========================================================
   BOSS ART — the wings are built from layered triangular
   facets (many triangles stacked on other triangles, like the
   menu sigil but with real depth), each an independently
   animated 3D mesh; the core stays a simple glowing white sphere
========================================================= */
const DARK = '#08040c', DARK2 = '#150a24', MID = '#5c3d96', MID2 = '#40295f', LIGHT = '#c9b8e8', LIGHT2 = '#efe8fb';

// one triangle, pivoting at the middle of its base edge, gradient-coloured base->tip
const triGeo = new THREE.BufferGeometry();
triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
  -0.5, 0, 0,
   0.5, 0, 0,
   0, 1, 0,
]), 3));
triGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([
  0.05, 0.03, 0.09,
  0.05, 0.03, 0.09,
  1, 1, 1,
]), 3));
triGeo.setIndex([0, 1, 2]);

function buildTriangleWing(group, angleFrom, angleTo, layers){
  const tris = [];
  layers.forEach(layer => {
    for (let i = 0; i < layer.count; i++){
      const ang = angleFrom + Math.random() * (angleTo - angleFrom);
      const tt = (ang - angleFrom) / (angleTo - angleFrom);
      const rStart = layer.radiusStart + Math.random() * layer.radiusGrow;
      const ox = Math.cos(ang) * rStart, oy = Math.sin(ang) * rStart;
      const len = layer.lenMin + Math.random() * (layer.lenMax - layer.lenMin);
      const width = layer.widthMin + Math.random() * (layer.widthMax - layer.widthMin);
      const tint = violet(0.32 + tt * 0.4 + Math.random() * 0.15, 0.5 + Math.random() * 0.25);
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: layer.opacity, side: THREE.DoubleSide, depthWrite: false,
        color: tint,
      });
      const mesh = new THREE.Mesh(triGeo, mat);
      const baseRot = ang - Math.PI / 2 + (Math.random() - 0.5) * 0.55;
      mesh.position.set(ox, oy, layer.z + Math.random() * 0.02);
      mesh.rotation.z = baseRot;
      mesh.scale.set(Math.max(0.015, width), Math.max(0.03, len), 1);
      mesh.userData = {
        baseRot, phase: Math.random() * Math.PI * 2,
        flutterAmp: 0.02 + Math.random() * 0.05, flutterSpeed: 1.2 + Math.random() * 2.6,
        flapFactor: layer.flapFactor !== undefined ? layer.flapFactor : 1,
        baseOpacity: layer.opacity,
      };
      group.add(mesh);
      tris.push(mesh);
    }
  });
  return tris;
}

const D2R = Math.PI / 180;
function upperLayers(reach){
  return [
    { count: 4, lenMin: 0.75 * reach, lenMax: 1.2 * reach, widthMin: 0.36 * reach, widthMax: 0.58 * reach, radiusStart: 0.05, radiusGrow: 0.1, opacity: 0.42, z: -0.05, flapFactor: 0.6 },
    { count: 9, lenMin: 0.55 * reach, lenMax: 1.05 * reach, widthMin: 0.2 * reach, widthMax: 0.36 * reach, radiusStart: 0.04, radiusGrow: 0.22, opacity: 0.52, z: -0.03, flapFactor: 0.8 },
    { count: 20, lenMin: 0.32 * reach, lenMax: 0.74 * reach, widthMin: 0.1 * reach, widthMax: 0.2 * reach, radiusStart: 0.03, radiusGrow: 0.38, opacity: 0.6, z: -0.01, flapFactor: 0.95 },
    { count: 42, lenMin: 0.16 * reach, lenMax: 0.42 * reach, widthMin: 0.05 * reach, widthMax: 0.11 * reach, radiusStart: 0.02, radiusGrow: 0.55, opacity: 0.72, z: 0.01, flapFactor: 1.1 },
    { count: 80, lenMin: 0.06 * reach, lenMax: 0.22 * reach, widthMin: 0.018 * reach, widthMax: 0.06 * reach, radiusStart: 0.02, radiusGrow: 0.7, opacity: 0.8, z: 0.03, flapFactor: 1.25 },
    // delicate fringe of tiny facets right at the wingtips
    { count: 90, lenMin: 0.03 * reach, lenMax: 0.1 * reach, widthMin: 0.01 * reach, widthMax: 0.03 * reach, radiusStart: 0.62 * reach, radiusGrow: 0.36 * reach, opacity: 0.85, z: 0.045, flapFactor: 1.4 },
  ];
}
function lowerLayers(reach){
  return [
    { count: 3, lenMin: 0.55 * reach, lenMax: 0.9 * reach, widthMin: 0.26 * reach, widthMax: 0.44 * reach, radiusStart: 0.02, radiusGrow: 0.08, opacity: 0.4, z: 0.05, flapFactor: 0.5 },
    { count: 7, lenMin: 0.4 * reach, lenMax: 0.78 * reach, widthMin: 0.15 * reach, widthMax: 0.26 * reach, radiusStart: 0.015, radiusGrow: 0.16, opacity: 0.48, z: 0.07, flapFactor: 0.7 },
    { count: 16, lenMin: 0.24 * reach, lenMax: 0.55 * reach, widthMin: 0.07 * reach, widthMax: 0.14 * reach, radiusStart: 0.012, radiusGrow: 0.3, opacity: 0.56, z: 0.09, flapFactor: 0.85 },
    { count: 32, lenMin: 0.09 * reach, lenMax: 0.28 * reach, widthMin: 0.03 * reach, widthMax: 0.065 * reach, radiusStart: 0.01, radiusGrow: 0.44, opacity: 0.68, z: 0.11, flapFactor: 1 },
    { count: 60, lenMin: 0.03 * reach, lenMax: 0.09 * reach, widthMin: 0.01 * reach, widthMax: 0.025 * reach, radiusStart: 0.58 * reach, radiusGrow: 0.34 * reach, opacity: 0.78, z: 0.125, flapFactor: 1.3 },
  ];
}

const bossGroup = new THREE.Group();
bossGroup.position.set(0, 1.9, 0);
scene.add(bossGroup);

const REACH = 2.0; // overall wing reach, world units
const wingURGroup = new THREE.Group(); bossGroup.add(wingURGroup);
const wingULGroup = new THREE.Group(); bossGroup.add(wingULGroup);
const wingLRGroup = new THREE.Group(); bossGroup.add(wingLRGroup);
const wingLLGroup = new THREE.Group(); bossGroup.add(wingLLGroup);

const UPPER_R_FROM = 8 * D2R, UPPER_R_TO = 96 * D2R;
const LOWER_R_FROM = 208 * D2R, LOWER_R_TO = 255 * D2R;

const wingURTris = buildTriangleWing(wingURGroup, UPPER_R_FROM, UPPER_R_TO, upperLayers(REACH));
const wingULTris = buildTriangleWing(wingULGroup, Math.PI - UPPER_R_TO, Math.PI - UPPER_R_FROM, upperLayers(REACH));
const wingLRTris = buildTriangleWing(wingLRGroup, LOWER_R_FROM, LOWER_R_TO, lowerLayers(REACH * 0.8));
const wingLLTris = buildTriangleWing(wingLLGroup, Math.PI - LOWER_R_TO, Math.PI - LOWER_R_FROM, lowerLayers(REACH * 0.8));
const allTriangles = [...wingURTris, ...wingULTris, ...wingLRTris, ...wingLLTris];
const wingGroups = [wingURGroup, wingULGroup, wingLRGroup, wingLLGroup];

// soft ambient-occlusion pool grounding the wings at the shoulder
const shoulderAO = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false,
}));
shoulderAO.scale.set(1.3, 1.3, 1);
shoulderAO.position.set(0, 0, -0.08);
bossGroup.add(shoulderAO);

// the core — a simple glowing white sphere, like the menu sigil
const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffffff, transparent: true, opacity: 0.95,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
coreGlow.scale.set(1.5, 1.5, 1);
coreGlow.position.set(0, 0, 0.1);
bossGroup.add(coreGlow);
const coreMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
);
coreMesh.position.set(0, 0, 0.15);
bossGroup.add(coreMesh);

const auraSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: violet(0.6, 0.7).getHex(), transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
auraSprite.scale.set(6.5, 6.5, 1);
auraSprite.position.set(0, 0, -0.3);
bossGroup.add(auraSprite);

/* =========================================================
   PLAYER — a small white glowing spark
========================================================= */
const player = { x: 0, y: -1.9, z: 0, r: 0.13, hp: 100, maxHp: 100, invuln: 0 };
const playerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffffff, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
playerGlow.scale.set(0.75, 0.75, 1);
const playerCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.095, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
scene.add(playerGlow, playerCore);

/* =========================================================
   INPUT
========================================================= */
const mouseNDC = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const keys = {};
let isFiring = false;
let usingPointer = true;

function updateMouseFromEvent(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  usingPointer = true;
}
renderer.domElement.addEventListener('pointermove', updateMouseFromEvent);
renderer.domElement.addEventListener('pointerdown', e => { updateMouseFromEvent(e); isFiring = true; });
window.addEventListener('pointerup', () => { isFiring = false; });
renderer.domElement.addEventListener('touchmove', e => {
  if (e.touches[0]) updateMouseFromEvent(e.touches[0]);
  e.preventDefault();
}, { passive: false });

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') isFiring = true;
});
window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key === ' ') isFiring = false;
});

function pointerWorldXY(){
  raycaster.setFromCamera(mouseNDC, camera);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, pt);
  return pt || new THREE.Vector3(player.x, player.y, 0);
}

/* =========================================================
   FX POOLS — sprites (trails / bursts / glows) & shockwave rings
========================================================= */
const MAX_SPRITES = 220;
const fxSprites = [];
for (let i = 0; i < MAX_SPRITES; i++){
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.visible = false;
  scene.add(m);
  fxSprites.push({ obj: m, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 0.2 });
}
let fxCursor = 0;
function spawnSpark(x, y, z, color, size, life, vx = 0, vy = 0, vz = 0){
  const s = fxSprites[fxCursor];
  fxCursor = (fxCursor + 1) % MAX_SPRITES;
  s.obj.material.color.set(color);
  s.obj.position.set(x, y, z);
  s.obj.scale.set(size, size, 1);
  s.obj.visible = true;
  s.obj.material.opacity = 0.95;
  s.life = life; s.maxLife = life;
  s.vx = vx; s.vy = vy; s.vz = vz;
  s.size = size;
  return s;
}

const MAX_RINGS = 8;
const fxRings = [];
for (let i = 0; i < MAX_RINGS; i++){
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: ringTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.visible = false;
  scene.add(m);
  fxRings.push({ obj: m, life: 0, maxLife: 1, base: 0.3, grow: 1 });
}
let ringCursor = 0;
function spawnRing(x, y, z, color, startSize, grow, life){
  const r = fxRings[ringCursor];
  ringCursor = (ringCursor + 1) % MAX_RINGS;
  r.obj.material.color.set(color);
  r.obj.position.set(x, y, z);
  r.obj.scale.set(startSize, startSize, 1);
  r.obj.visible = true;
  r.obj.material.opacity = 0.9;
  r.life = life; r.maxLife = life; r.base = startSize; r.grow = grow;
  return r;
}

/* =========================================================
   PROJECTILE / BOLT POOLS — white / violet shards only
========================================================= */
const shapeGeos = {
  tetra: new THREE.TetrahedronGeometry(0.13, 0),
  octa: new THREE.OctahedronGeometry(0.12, 0),
  shard: new THREE.ConeGeometry(0.07, 0.34, 5),
  orb: new THREE.IcosahedronGeometry(0.13, 1),
};
function spawnMesh(geo){
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}
const MAX_PROJ = 140;
const projPool = [];
for (let i = 0; i < MAX_PROJ; i++){
  projPool.push({
    mesh: spawnMesh(shapeGeos.octa), active: false,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.14, lightness: 0.7, homing: false, speed: 0, trailT: 0,
  });
}
function fireProjectile({ x, y, z = 0, vx, vy, vz = 0, r, lightness = 0.68, homing = false, speed = 0, shape = 'octa' }){
  const p = projPool.find(p => !p.active);
  if (!p) return;
  p.active = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
  p.r = r; p.lightness = lightness; p.homing = homing; p.speed = speed; p.trailT = 0; p.shape = shape;
  const geo = shapeGeos[shape] || shapeGeos.octa;
  if (p.mesh.geometry !== geo) p.mesh.geometry = geo;
  p.mesh.material.color.copy(violet(lightness, lightness > 0.85 ? 0.08 : 0.6));
  p.mesh.visible = true;
  p.mesh.position.set(x, y, z);
}

const MAX_BOLTS = 60;
const boltPool = [];
for (let i = 0; i < MAX_BOLTS; i++){
  boltPool.push({ mesh: spawnMesh(shapeGeos.shard), active: false, x: 0, y: 0, z: 0, vy: 0, r: 0.11, trailT: 0 });
}
let lastFireTime = 0;
function fireBolt(){
  if (!fightRunning) return;
  const now = performance.now();
  if (now - lastFireTime < 150) return;
  lastFireTime = now;
  const b = boltPool.find(b => !b.active);
  if (!b) return;
  b.active = true; b.x = player.x; b.y = player.y + 0.25; b.z = 0; b.vy = 9.5; b.trailT = 0;
  b.mesh.visible = true;
  b.mesh.material.color.set(0xffffff);
  b.mesh.position.set(b.x, b.y, b.z);
  b.mesh.rotation.x = 0;
}

/* =========================================================
   HEAL PICKUP — a fast white orb marked with a green cross;
   catch it to heal 50% of max HP, it despawns after 5s or off-screen
========================================================= */
const HEAL_GREEN = 0x39d353;
const healGroup = new THREE.Group();
const healGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
}));
healGlow.scale.set(0.85, 0.85, 1);
healGroup.add(healGlow);
const healSphere = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 18), new THREE.MeshBasicMaterial({ color: 0xffffff }));
healGroup.add(healSphere);
const healCrossMat = new THREE.MeshBasicMaterial({ color: HEAL_GREEN });
const healBarH = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.08), healCrossMat);
const healBarV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), healCrossMat);
healGroup.add(healBarH, healBarV);
healGroup.visible = false;
scene.add(healGroup);

const healOrb = { active: false, x: 0, y: 0, z: 0.15, vx: 0, vy: 0, life: 0 };
let healTimer = 6000 + Math.random() * 3000;

function spawnHealOrb(){
  const b = planeHalfExtents(0);
  const fromLeft = Math.random() < 0.5;
  const yLevel = THREE.MathUtils.lerp(-b.h * 0.55, 0.1, Math.random());
  const x0 = fromLeft ? -b.w - 0.6 : b.w + 0.6;
  const x1 = fromLeft ? b.w + 0.6 : -b.w - 0.6;
  const y1 = yLevel + (Math.random() - 0.5) * 1.4;
  const dx = x1 - x0, dy = y1 - yLevel;
  const d = Math.hypot(dx, dy) || 1;
  const speed = 4.8 + Math.random() * 1.6;
  healOrb.active = true;
  healOrb.x = x0; healOrb.y = yLevel;
  healOrb.vx = dx / d * speed; healOrb.vy = dy / d * speed;
  healOrb.life = 5000;
  healGroup.position.set(x0, yLevel, 0.15);
  healGroup.rotation.z = 0;
  healGroup.visible = true;
}

/* =========================================================
   BOSS STATE / FIGHT
========================================================= */
const bossAudio = document.getElementById('a-boss');
const bossFill = document.getElementById('boss-fill');
const bossFillTrail = document.getElementById('boss-fill-trail');
const bossHealthBar = document.querySelector('.boss-health');
const playerFill = document.getElementById('player-fill');
const resultSigil = document.getElementById('result-sigil');
const exitBtn = document.getElementById('exit-fight');
const phasePips = Array.from(document.querySelectorAll('.phase-pips i'));

const PHASE_DURATION = 2200;
const boss = {
  x: 0, y: 1.9, hp: 1500, maxHp: 1500, t: 0,
  phase: 0, phaseTimer: 0, phaseCount: 5,
  hitFlash: 0, recoil: 0, castFlash: 0, dying: false,
};
let fightRunning = false;
let spiralAngle = 0;

function stopBossAudio(){ bossAudio.pause(); bossAudio.currentTime = 0; }
function updatePhasePips(){ phasePips.forEach((p, i) => p.classList.toggle('active', i === boss.phase)); }

function startBossFight(){
  resize();
  player.x = 0; player.y = -1.9; player.hp = player.maxHp; player.invuln = 0;
  boss.x = 0; boss.hp = boss.maxHp; boss.t = 0; boss.phase = 0; boss.phaseTimer = PHASE_DURATION;
  boss.hitFlash = 0; boss.recoil = 0; boss.castFlash = 300; boss.dying = false;
  bossGroup.visible = true; bossGroup.scale.setScalar(1); bossGroup.rotation.y = 0;
  allTriangles.forEach(f => { f.material.opacity = f.userData.baseOpacity; f.visible = true; });
  coreGlow.material.opacity = 0.95; coreMesh.material.opacity = 1;
  projPool.forEach(p => { p.active = false; p.mesh.visible = false; });
  boltPool.forEach(b => { b.active = false; b.mesh.visible = false; });
  healOrb.active = false; healGroup.visible = false; healTimer = 6000 + Math.random() * 3000;
  fightRunning = true;
  resultSigil.classList.remove('show');
  resultSigil.style.color = '';
  resultSigil.innerHTML = '';
  bossFill.style.width = '100%';
  bossFillTrail.style.width = '100%';
  bossHealthBar.classList.remove('enrage');
  playerFill.style.width = '100%';
  updatePhasePips();

  bossAudio.currentTime = 0;
  bossAudio.play().catch(() => {});

  lastTime = performance.now();
  requestAnimationFrame(loop);
}

document.getElementById('enter-fight').addEventListener('click', () => {
  showScene('boss');
  startBossFight();
});
exitBtn.addEventListener('click', () => { fightRunning = false; showScene('menu'); });

/* ---- attack patterns — density & speed ramp up as HP drops ---- */
function bossAttack(){
  const hpRatio = Math.max(0, boss.hp / boss.maxHp);
  const intensity = 1 + (1 - hpRatio) * 1.1;
  const gapScale = 1 - (1 - hpRatio) * 0.45;

  boss.phaseTimer -= 16;
  if (boss.phaseTimer <= 0){
    boss.phase = (boss.phase + 1) % boss.phaseCount;
    boss.phaseTimer = PHASE_DURATION * gapScale;
    boss.castFlash = 260;
    spawnRing(boss.x, boss.y, 0.2, 0xffffff, 0.4, 5.5, 550);
    updatePhasePips();
  }

  const bx = boss.x, by = boss.y - 0.1;

  if (boss.phase === 0 && boss.t % Math.max(80, 240 * gapScale) < 16){
    const n = 18, spd = 3.5 * intensity;
    for (let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2 + boss.t * 0.0006;
      fireProjectile({ x: bx, y: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + 1.2, r: 0.16, lightness: 0.55, shape: 'tetra' });
    }
  } else if (boss.phase === 1 && boss.t % Math.max(60, 130 * gapScale) < 16){
    const dx = player.x - bx, dy = player.y - by;
    const d = Math.hypot(dx, dy) || 1;
    const spd = 6.3 * intensity;
    [-1.1, 0, 1.1].forEach(off => {
      fireProjectile({ x: bx + off, y: by, vx: (dx / d) * spd, vy: (dy / d) * spd, r: 0.14, lightness: 0.9, shape: 'shard' });
    });
  } else if (boss.phase === 2 && boss.t % Math.max(38, 88 * gapScale) < 16){
    const x1 = bx + Math.sin(boss.t * 0.005) * 3.6;
    const x2 = bx - Math.sin(boss.t * 0.005) * 3.6;
    const spd = 5.1 * intensity;
    fireProjectile({ x: x1, y: by + 0.3, vx: Math.sin(boss.t * 0.005) * 2.1, vy: -spd, r: 0.15, lightness: 0.62, shape: 'orb' });
    fireProjectile({ x: x2, y: by + 0.3, vx: -Math.sin(boss.t * 0.005) * 2.1, vy: -spd, r: 0.15, lightness: 0.62, shape: 'orb' });
  } else if (boss.phase === 3 && boss.t % Math.max(32, 62 * gapScale) < 16){
    spiralAngle += 0.5;
    const spd = 3.9 * intensity;
    for (let k = 0; k < 2; k++){
      const a = spiralAngle + k * Math.PI;
      fireProjectile({ x: bx, y: by, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + 0.7, r: 0.14, lightness: 0.5, shape: 'octa' });
    }
  } else if (boss.phase === 4 && boss.t % Math.max(340, 520 * gapScale) < 16){
    [-0.9, 0.9].forEach(off => {
      fireProjectile({ x: bx + off, y: by, vx: 0, vy: -2.4 * intensity, r: 0.18, lightness: 0.92, homing: true, speed: 4.2 * intensity, shape: 'orb' });
    });
  }
}

/* =========================================================
   MAIN LOOP
========================================================= */
let lastTime = performance.now();

function updateBossVisual(dt){
  const bob = Math.sin(boss.t * 0.0016) * 0.14;
  bossGroup.position.y = boss.y + bob - boss.recoil;
  bossGroup.rotation.y = Math.sin(boss.t * 0.00028) * 0.16;
  bossGroup.rotation.z = Math.sin(boss.t * 0.0009) * 0.025;

  const flap = Math.sin(boss.t * 0.0032) * 0.1;
  const flutter = Math.sin(boss.t * 0.005 + 1.4) * 0.08;
  wingURGroup.rotation.z = flap;
  wingULGroup.rotation.z = -flap;
  wingLRGroup.rotation.z = flutter * 0.7;
  wingLLGroup.rotation.z = -flutter * 0.7;

  // each triangular facet flutters independently on top of its wing's group motion
  for (const f of allTriangles){
    const u = f.userData;
    f.rotation.z = u.baseRot + Math.sin(boss.t * 0.001 * u.flutterSpeed + u.phase) * u.flutterAmp * (0.4 + Math.abs(flap) * 4);
  }

  auraSprite.material.opacity = 0.4 + Math.sin(boss.t * 0.0014) * 0.1;
  const pulse = 1 + Math.sin(boss.t * 0.0022) * 0.06;
  coreGlow.scale.set(1.5 * pulse, 1.5 * pulse, 1);

  if (boss.hitFlash > 0){
    boss.hitFlash -= dt;
    const k = Math.max(0, boss.hitFlash / 150);
    bossGroup.scale.setScalar(1 - k * 0.05);
  } else {
    bossGroup.scale.setScalar(1);
  }
  boss.recoil *= Math.pow(0.002, dt / 1000);

  if (boss.castFlash > 0){
    boss.castFlash -= dt;
    const k = Math.max(0, boss.castFlash / 260);
    coreGlow.scale.set(1.5 * pulse * (1 + k * 0.5), 1.5 * pulse * (1 + k * 0.5), 1);
  }

  boss.x = bossGroup.position.x;
}

function loop(now){
  if (!fightRunning) return;
  const dt = Math.min(now - lastTime, 50);
  lastTime = now;
  boss.t += dt;

  const bounds = planeHalfExtents(0);
  const leashX = 2.8;

  const speed = 8.2 * (dt / 1000);
  if (keys['arrowleft'] || keys['a']) { player.x -= speed; usingPointer = false; }
  if (keys['arrowright'] || keys['d']) { player.x += speed; usingPointer = false; }
  if (keys['arrowup'] || keys['w']) { player.y += speed; usingPointer = false; }
  if (keys['arrowdown'] || keys['s']) { player.y -= speed; usingPointer = false; }
  if (usingPointer){
    const target = pointerWorldXY();
    player.x += (target.x - player.x) * 0.34;
    player.y += (target.y - player.y) * 0.34;
  }
  player.x = Math.max(-bounds.w + 0.3, Math.min(bounds.w - 0.3, player.x));
  player.x = Math.max(boss.x - leashX, Math.min(boss.x + leashX, player.x));
  player.y = Math.max(-bounds.h + 0.3, Math.min(0.4, player.y));

  if (isFiring) fireBolt();

  updateBossVisual(dt);
  bossAttack();

  healTimer -= dt;
  if (!healOrb.active && healTimer <= 0){
    spawnHealOrb();
    healTimer = 15000 + Math.random() * 5000;
  }
  if (healOrb.active){
    healOrb.life -= dt;
    healOrb.x += healOrb.vx * dt / 1000;
    healOrb.y += healOrb.vy * dt / 1000;
    healGroup.position.set(healOrb.x, healOrb.y, healOrb.z);
    healGroup.rotation.z += dt * 0.005;
    const outOfBounds = healOrb.x < -bounds.w - 1 || healOrb.x > bounds.w + 1 || healOrb.y < -bounds.h - 1 || healOrb.y > bounds.h + 1;
    if (healOrb.life <= 0 || outOfBounds){
      healOrb.active = false; healGroup.visible = false;
    } else if (Math.hypot(healOrb.x - player.x, healOrb.y - player.y) < (0.22 + player.r)){
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.5);
      playerFill.style.width = (player.hp / player.maxHp * 100) + '%';
      healOrb.active = false; healGroup.visible = false;
      spawnRing(healOrb.x, healOrb.y, 0.2, HEAL_GREEN, 0.15, 3.4, 420);
      for (let k = 0; k < 12; k++){
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6;
        spawnSpark(healOrb.x, healOrb.y, 0.2, HEAL_GREEN, 0.16, 400, Math.cos(a) * sp, Math.sin(a) * sp, 0);
      }
    }
  }

  {
    for (const p of projPool){
      if (!p.active) continue;
      if (p.homing){
        const dx = player.x - p.x, dy = player.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d * p.speed - p.vx) * 0.05;
        p.vy += (dy / d * p.speed - p.vy) * 0.05;
      }
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.shape === 'shard' || p.homing){
        p.mesh.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2;
        p.mesh.rotation.x += dt * 0.002;
      } else {
        p.mesh.rotation.x += dt * 0.006;
        p.mesh.rotation.y += dt * 0.005;
      }

      p.trailT -= dt;
      if (p.trailT <= 0){
        p.trailT = 35;
        spawnSpark(p.x, p.y, p.z, p.mesh.material.color, 0.22, 260, 0, 0, 0);
      }

      if (p.y < -bounds.h - 1 || p.y > bounds.h + 1 || p.x < -bounds.w - 1 || p.x > bounds.w + 1){
        p.active = false; p.mesh.visible = false; continue;
      }
      if (player.invuln <= 0 && Math.hypot(p.x - player.x, p.y - player.y) < (p.r + player.r)){
        player.hp = Math.max(0, player.hp - 8);
        player.invuln = 700;
        playerFill.style.width = (player.hp / player.maxHp * 100) + '%';
        p.active = false; p.mesh.visible = false;
        spawnRing(p.x, p.y, 0, 0xffffff, 0.15, 3.4, 300);
        for (let k = 0; k < 6; k++){
          const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
          spawnSpark(p.x, p.y, 0, p.mesh.material.color, 0.14, 320, Math.cos(a) * sp, Math.sin(a) * sp, 0);
        }
      }
    }

    for (const b of boltPool){
      if (!b.active) continue;
      b.y += b.vy * dt / 1000;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.x = 0;
      b.trailT -= dt;
      if (b.trailT <= 0){
        b.trailT = 25;
        spawnSpark(b.x, b.y, b.z, 0xffffff, 0.16, 220, 0, -0.3, 0);
      }
      if (b.y > bounds.h + 1){ b.active = false; b.mesh.visible = false; continue; }
      if (!boss.dying && Math.hypot(b.x - boss.x, b.y - boss.y) < 0.9){
        boss.hp = Math.max(0, boss.hp - 5);
        boss.hitFlash = 150; boss.recoil = 0.22;
        const pct = (boss.hp / boss.maxHp * 100) + '%';
        bossFill.style.width = pct; bossFillTrail.style.width = pct;
        bossHealthBar.classList.toggle('enrage', boss.hp / boss.maxHp < 0.32);
        b.active = false; b.mesh.visible = false;
        spawnRing(b.x, b.y, 0.2, violet(0.8, 0.35).getHex(), 0.08, 1.6, 220);
        for (let k = 0; k < 7; k++){
          const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
          spawnSpark(b.x, b.y, 0.2, k % 2 === 0 ? 0xffffff : violet(0.75, 0.4).getHex(), 0.1, 260, Math.cos(a) * sp, Math.sin(a) * sp, 0.4);
        }
        if (boss.hp <= 0 && !boss.dying) triggerBossDeath();
      }
    }
  }

  for (const s of fxSprites){
    if (!s.obj.visible) continue;
    s.life -= dt;
    if (s.life <= 0){ s.obj.visible = false; continue; }
    s.obj.position.x += s.vx * dt / 1000;
    s.obj.position.y += s.vy * dt / 1000;
    const k = s.life / s.maxLife;
    s.obj.material.opacity = k * 0.95;
    s.obj.scale.setScalar(s.size * (0.6 + (1 - k) * 0.8));
  }
  for (const r of fxRings){
    if (!r.obj.visible) continue;
    r.life -= dt;
    if (r.life <= 0){ r.obj.visible = false; continue; }
    const k = 1 - r.life / r.maxLife;
    r.obj.scale.setScalar(r.base + r.grow * k);
    r.obj.material.opacity = (1 - k) * 0.9;
  }

  if (player.invuln > 0) player.invuln -= dt;
  const flicker = player.invuln > 0 && Math.floor(now / 80) % 2 === 0;
  playerGlow.visible = !flicker;
  playerCore.visible = !flicker;
  playerGlow.position.set(player.x, player.y, 0.05);
  playerCore.position.set(player.x, player.y, 0.05);

  motesNear.rotation.y += dt * 0.00004;
  motesFar.rotation.y -= dt * 0.00002;
  haloArcs.forEach((r, i) => { r.rotation.z += dt * 0.00005 * (i % 2 === 0 ? 1 : -1); });
  beams.forEach((b, i) => { b.obj.material.opacity = 0.1 + Math.sin(boss.t * 0.0005 + i) * 0.06; });
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouseNDC.x * 0.5, 0.03);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.2 + mouseNDC.y * 0.3, 0.03);
  camera.lookAt(0, 0.6, 0);

  if (player.hp <= 0 && !boss.dying){ endFight(false); return; }

  composer.render();
  requestAnimationFrame(loop);
}

function triggerBossDeath(){
  boss.dying = true;
  spawnRing(boss.x, boss.y, 0.3, 0xffffff, 0.2, 9, 900);
  const dur = 1400;
  const start = performance.now();
  (function deathTick(){
    if (!fightRunning) return;
    const now = performance.now();
    const k = Math.min(1, (now - start) / dur);
    bossGroup.scale.setScalar(1 + k * 1.6);
    bloomPass.strength = 0.5 + k * 2.6;
    allTriangles.forEach(f => { f.material.opacity = Math.max(0, f.userData.baseOpacity * (1 - k * 1.3)); });
    coreGlow.material.opacity = Math.max(0, 0.95 * (1 - k * 1.2));
    coreMesh.material.opacity = Math.max(0, 1 - k * 1.2);
    if (k < 1){ requestAnimationFrame(deathTick); }
    else {
      bloomPass.strength = 0.5;
      bossGroup.visible = false;
      endFight(true);
    }
  })();
}

function endFight(won){
  fightRunning = false;
  resultSigil.innerHTML = '<div class="glow"></div>';
  resultSigil.style.color = won ? '#ffffff' : '#12081f';
  resultSigil.classList.add('show');
  setTimeout(() => {
    if (!won){ startBossFight(); }
    else { showScene('menu'); }
  }, 2200);
}
