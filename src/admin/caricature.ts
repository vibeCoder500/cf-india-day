import { FaceDetector, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { INK } from '../components/Caricature';

// Matches Caricature.tsx: 660 × 780 head canvas, cheek-to-cheek face width 264 px, eye midpoint at (330, 375).
const OUT_W = 660;
const OUT_H = 780;
const EYE_X = 330;
const EYE_Y = 375;
const TARGET_FACE_W = 264;
const OUTLINE_PX = 11;
const INK_RGB: [number, number, number] = [0x3b, 0x24, 0x17];

export type CaricatureStyle = 'caricature' | 'cartoon' | 'cutout';

export interface CaricatureOptions {
  style: CaricatureStyle;
  exaggeration: number; // 0..1 (used when style === 'caricature')
  zoom: number; // 0.75..1.35
  offsetX: number; // -80..80 px on output canvas
  offsetY: number; // -80..80 px on output canvas
  handColor?: string;
  hairColor?: string;
}

export const DEFAULT_CARICATURE_OPTIONS: CaricatureOptions = {
  style: 'caricature',
  exaggeration: 0.55,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export interface DetectedPerson {
  eyeX: number;
  eyeY: number;
  tiltRad: number;
  faceWidthPx: number;
  chinDistPx: number;
}

export interface PreparedLeader {
  sourceCanvas: HTMLCanvasElement;
  personMask: Float32Array;
  personW: number;
  personH: number;
  hairMask: Float32Array;
  hairW: number;
  hairH: number;
  faces: DetectedPerson[];
  faceIndex: number;
  eyeX: number;
  eyeY: number;
  tiltRad: number;
  faceWidthPx: number;
  chinDistPx: number;
  detectedSkinHex: string;
  detectedHairHex: string;
  suggestedName: string;
}

export interface RenderedCaricature {
  frontBlob: Blob;
  backBlob: Blob;
  frontPreviewUrl: string;
  backPreviewUrl: string;
  handColor: string;
  hairColor: string;
}

type VisionSuite = {
  face: FaceDetector;
  person: ImageSegmenter;
  hair: ImageSegmenter;
};

let suitePromise: Promise<VisionSuite> | null = null;

function loadVision(): Promise<VisionSuite> {
  suitePromise ??= (async () => {
    const wasm = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    const [face, person, hair] = await Promise.all([
      FaceDetector.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/mediapipe/models/blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.35,
      }),
      ImageSegmenter.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/mediapipe/models/selfie_segmenter.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
      ImageSegmenter.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/mediapipe/models/hair_segmenter.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    ]);
    return { face, person, hair };
  })().catch((err) => {
    suitePromise = null;
    throw err;
  });
  return suitePromise;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('')}`;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0xb5, 0x7a, 0x5f];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function decodeToCanvas(blob: Blob, maxDim: number): Promise<HTMLCanvasElement> {
  let width = 0;
  let height = 0;
  let drawSource: CanvasImageSource;
  let cleanup: (() => void) | undefined;

  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob);
    width = bmp.width;
    height = bmp.height;
    drawSource = bmp;
    cleanup = () => bmp.close();
  } else {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = url;
    });
    width = img.naturalWidth;
    height = img.naturalHeight;
    drawSource = img;
    cleanup = () => URL.revokeObjectURL(url);
  }

  try {
    const scale = Math.min(1, maxDim / Math.max(width, height, 1));
    const cw = Math.max(1, Math.round(width * scale));
    const ch = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(drawSource, 0, 0, cw, ch);
    return canvas;
  } finally {
    cleanup?.();
  }
}

async function canvasToWebp(canvas: HTMLCanvasElement, quality = 0.86): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (blob && blob.type === 'image/webp') return blob;
  const fallback = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!fallback) throw new Error('Failed to encode image');
  return fallback;
}

export async function compressTeamPhoto(file: Blob): Promise<Blob> {
  const canvas = await decodeToCanvas(file, 1280);
  return canvasToWebp(canvas, 0.84);
}

function sampleMaskBilinear(mask: Float32Array, mw: number, mh: number, u: number, v: number): number {
  const x = clamp(u * mw - 0.5, 0, mw - 1);
  const y = clamp(v * mh - 0.5, 0, mh - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(mw - 1, x0 + 1);
  const y1 = Math.min(mh - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const top = mask[y0 * mw + x0] * (1 - fx) + mask[y0 * mw + x1] * fx;
  const bot = mask[y1 * mw + x0] * (1 - fx) + mask[y1 * mw + x1] * fx;
  return top * (1 - fy) + bot * fy;
}

function sampleMedianColor(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  filter?: (x: number, y: number, r: number, g: number, b: number) => boolean,
): [number, number, number] | null {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  const step = Math.max(1, Math.floor(Math.min(rx, ry) / 14));

  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny > 1) continue;
      const idx = (y * w + x) * 4;
      if (pixels[idx + 3] < 200) continue;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      if (filter && !filter(x, y, r, g, b)) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
  if (rs.length < 8) return null;
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  const mid = Math.floor(rs.length / 2);
  return [rs[mid], gs[mid], bs[mid]];
}

function cleanFileLabel(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(img|dsc|photo|pic|whatsapp|image|screenshot|\d{4,})\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

export async function prepareLeaderPhoto(file: File | Blob): Promise<PreparedLeader> {
  const sourceCanvas = await decodeToCanvas(file, 1152);
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  const srcImg = sctx.getImageData(0, 0, sw, sh);

  const { face, person, hair } = await loadVision();

  const detResult = face.detect(sourceCanvas);
  const detections = [...detResult.detections].sort((a, b) => {
    const aa = (a.boundingBox?.width ?? 0) * (a.boundingBox?.height ?? 0);
    const ba = (b.boundingBox?.width ?? 0) * (b.boundingBox?.height ?? 0);
    return ba - aa;
  });

  const faces: DetectedPerson[] = detections.map((det) => {
    const kps = det.keypoints;
    const box = det.boundingBox;
    let eyeX = sw * 0.5;
    let eyeY = sh * 0.4;
    let tiltRad = 0;
    let faceWidthPx = Math.min(sw, sh) * 0.42;
    let chinDistPx = faceWidthPx * 0.72;

    if (kps && kps.length >= 2) {
      const p0 = { x: kps[0].x * sw, y: kps[0].y * sh };
      const p1 = { x: kps[1].x * sw, y: kps[1].y * sh };
      const [leftEye, rightEye] = p0.x <= p1.x ? [p0, p1] : [p1, p0];
      eyeX = (leftEye.x + rightEye.x) / 2;
      eyeY = (leftEye.y + rightEye.y) / 2;
      tiltRad = clamp(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x), -0.55, 0.55);
      const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

      let earWidth = 0;
      if (kps.length >= 6) {
        earWidth = Math.hypot((kps[5].x - kps[4].x) * sw, (kps[5].y - kps[4].y) * sh);
      }
      const fromEyes = eyeDist * 2.38;
      const fromBox = box ? box.width * 0.96 : fromEyes;
      faceWidthPx = clamp(
        earWidth > eyeDist * 1.4 ? earWidth * 0.98 : (fromEyes * 0.6 + fromBox * 0.4),
        Math.min(sw, sh) * 0.08,
        Math.max(sw, sh) * 0.92,
      );

      if (kps.length >= 4) {
        const mouthX = kps[3].x * sw;
        const mouthY = kps[3].y * sh;
        const eyeToMouth = Math.hypot(mouthX - eyeX, mouthY - eyeY);
        chinDistPx = clamp(eyeToMouth * 1.62, faceWidthPx * 0.58, faceWidthPx * 0.92);
      } else {
        chinDistPx = faceWidthPx * 0.72;
      }
    } else if (box) {
      eyeX = box.originX + box.width * 0.5;
      eyeY = box.originY + box.height * 0.38;
      faceWidthPx = box.width * 0.95;
      chinDistPx = faceWidthPx * 0.72;
    }
    return { eyeX, eyeY, tiltRad, faceWidthPx, chinDistPx };
  });

  if (faces.length === 0) {
    const fw = Math.min(sw, sh) * 0.42;
    faces.push({ eyeX: sw * 0.5, eyeY: sh * 0.4, tiltRad: 0, faceWidthPx: fw, chinDistPx: fw * 0.72 });
  }

  const personRes = person.segment(sourceCanvas);
  const pMasks = personRes.confidenceMasks ?? [];
  const pMaskObj = pMasks.length > 1 ? pMasks[1] : pMasks[0];
  const personW = pMaskObj?.width ?? sw;
  const personH = pMaskObj?.height ?? sh;
  const personMask = pMaskObj ? new Float32Array(pMaskObj.getAsFloat32Array()) : new Float32Array(sw * sh).fill(1);
  for (const m of pMasks) m.close();

  const hairRes = hair.segment(sourceCanvas);
  const hMasks = hairRes.confidenceMasks ?? [];
  const hMaskObj = hMasks.length > 1 ? hMasks[1] : hMasks[0];
  const hairW = hMaskObj?.width ?? sw;
  const hairH = hMaskObj?.height ?? sh;
  const hairMask = hMaskObj ? new Float32Array(hMaskObj.getAsFloat32Array()) : new Float32Array(sw * sh);
  for (const m of hMasks) m.close();

  const suggestedName = file instanceof File ? cleanFileLabel(file.name) : '';

  return selectLeaderFace(
    {
      sourceCanvas,
      personMask,
      personW,
      personH,
      hairMask,
      hairW,
      hairH,
      faces,
      faceIndex: 0,
      eyeX: faces[0].eyeX,
      eyeY: faces[0].eyeY,
      tiltRad: faces[0].tiltRad,
      faceWidthPx: faces[0].faceWidthPx,
      chinDistPx: faces[0].chinDistPx,
      detectedSkinHex: '#b57a5f',
      detectedHairHex: '#2e201a',
      suggestedName,
    },
    0,
  );
}

export function selectLeaderFace(base: PreparedLeader, index: number): PreparedLeader {
  const sw = base.sourceCanvas.width;
  const sh = base.sourceCanvas.height;
  const sctx = base.sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  const srcImg = sctx.getImageData(0, 0, sw, sh);
  const i = clamp(index, 0, base.faces.length - 1);
  const chosen = base.faces[i];

  const skinRgb =
    sampleMedianColor(
      srcImg.data,
      sw,
      sh,
      chosen.eyeX,
      chosen.eyeY + chosen.faceWidthPx * 0.22,
      chosen.faceWidthPx * 0.28,
      chosen.faceWidthPx * 0.22,
      (_x, _y, r, g, b) => {
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        return luma > 35 && luma < 242;
      },
    ) ?? [181, 122, 95];

  const hairRgb =
    sampleMedianColor(
      srcImg.data,
      sw,
      sh,
      chosen.eyeX,
      chosen.eyeY - chosen.faceWidthPx * 0.25,
      chosen.faceWidthPx * 0.85,
      chosen.faceWidthPx * 0.9,
      (x, y, r, g, b) => {
        const hp = sampleMaskBilinear(base.hairMask, base.hairW, base.hairH, (x + 0.5) / sw, (y + 0.5) / sh);
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        return hp > 0.55 && luma < 235;
      },
    ) ?? [46, 32, 26];

  return {
    ...base,
    faceIndex: i,
    eyeX: chosen.eyeX,
    eyeY: chosen.eyeY,
    tiltRad: chosen.tiltRad,
    faceWidthPx: chosen.faceWidthPx,
    chinDistPx: chosen.chinDistPx,
    detectedSkinHex: toHex(skinRgb[0], skinRgb[1], skinRgb[2]),
    detectedHairHex: toHex(hairRgb[0], hairRgb[1], hairRgb[2]),
  };
}

// Keeps only the foreground component connected to the face center so background bystanders or stray blobs vanish.
function keepFaceComponent(alpha: Float32Array, w: number, h: number, seedX: number, seedY: number): void {
  const sx = clamp(Math.round(seedX), 0, w - 1);
  const sy = clamp(Math.round(seedY), 0, h - 1);
  if (alpha[sy * w + sx] < 0.2) return;

  // Dilate slightly by 4px when testing connectivity so glasses frames or thin hair strands stay attached.
  const solid = new Uint8Array(w * h);
  const r = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] < 0.22) continue;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * w;
        for (let xx = x0; xx <= x1; xx++) solid[row + xx] = 1;
      }
    }
  }

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const start = sy * w + sx;
  visited[start] = 1;
  queue[tail++] = start;

  while (head < tail) {
    const cur = queue[head++];
    const x = cur % w;
    const y = (cur - x) / w;
    if (x > 0 && solid[cur - 1] && !visited[cur - 1]) {
      visited[cur - 1] = 1;
      queue[tail++] = cur - 1;
    }
    if (x + 1 < w && solid[cur + 1] && !visited[cur + 1]) {
      visited[cur + 1] = 1;
      queue[tail++] = cur + 1;
    }
    if (y > 0 && solid[cur - w] && !visited[cur - w]) {
      visited[cur - w] = 1;
      queue[tail++] = cur - w;
    }
    if (y + 1 < h && solid[cur + w] && !visited[cur + w]) {
      visited[cur + w] = 1;
      queue[tail++] = cur + w;
    }
  }

  for (let i = 0; i < alpha.length; i++) {
    if (!visited[i]) alpha[i] = 0;
  }
}

function blurAlpha(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const diam = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) s += src[row + clamp(x + k, 0, w - 1)];
      tmp[row + x] = s / diam;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) s += tmp[clamp(y + k, 0, h - 1) * w + x];
      dst[y * w + x] = s / diam;
    }
  }
  return dst;
}

// Exact Euclidean signed-distance outer outline alpha for crisp sticker borders around any cutout shape.
function dilateOutline(alpha: Float32Array, w: number, h: number, radius: number): Float32Array {
  const INF = 1e9;
  const distSq = new Float32Array(w * h);
  for (let i = 0; i < distSq.length; i++) distSq[i] = alpha[i] >= 0.48 ? 0 : INF;

  // Meijster / Felzenszwalb exact 2-D squared Euclidean distance transform in O(w * h).
  const f = new Float32Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float32Array(Math.max(w, h) + 1);

  const edt1d = (n: number, dOut: Float32Array, offset: number, stride: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = 0;
      while (true) {
        const vk = v[k];
        s = (f[q] + q * q - (f[vk] + vk * vk)) / (2 * q - 2 * vk);
        if (s > z[k]) break;
        k--;
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      dOut[offset + q * stride] = dx * dx + f[v[k]];
    }
  };

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = distSq[y * w + x];
    edt1d(h, distSq, x, w);
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = distSq[row + x];
    edt1d(w, distSq, row, 1);
  }

  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    const d = Math.sqrt(distSq[i]);
    out[i] = clamp(radius + 0.8 - d, 0, 1);
  }
  return out;
}

// Gentle comic caricature lens warp: pops eyes/cranium & smile while subtly tapering the lower jaw.
function applyCaricatureWarp(
  rgba: Uint8ClampedArray,
  alpha: Float32Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  faceScale: number,
  strength: number,
): { rgba: Uint8ClampedArray; alpha: Float32Array } {
  if (strength <= 0.01) return { rgba, alpha };
  const dstRgba = new Uint8ClampedArray(rgba.length);
  const dstAlpha = new Float32Array(alpha.length);
  const R = 165 * faceScale;
  const eyeCenterY = cy - 12 * faceScale;
  const smileY = cy + 92 * faceScale;
  const jawY = cy + 130 * faceScale;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx = x;
      let sy = y;

      // 1. Cranium & eyes pop (inverse map pulls inward -> magnifies features outward)
      const dx1 = (x - cx) / R;
      const dy1 = (y - eyeCenterY) / (R * 1.08);
      const r2 = dx1 * dx1 + dy1 * dy1;
      if (r2 < 1.9) {
        const w1 = Math.exp(-r2 * 1.45) * 0.16 * strength;
        sx -= (x - cx) * w1;
        sy -= (y - eyeCenterY) * w1 * 0.88;
      }

      // 2. Expressive cheek & grin lift
      const dx2 = (x - cx) / (R * 0.78);
      const dy2 = (y - smileY) / (R * 0.52);
      const s2 = dx2 * dx2 + dy2 * dy2;
      if (s2 < 1.6) {
        const w2 = Math.exp(-s2 * 1.8) * 0.085 * strength;
        sx -= (x - cx) * w2;
        sy += 5.5 * strength * Math.exp(-s2 * 2.0);
      }

      // 3. Subtle bobblehead jaw/neck taper below cheeks
      if (y > jawY) {
        const t = clamp((y - jawY) / (150 * faceScale), 0, 1);
        const taper = 1 + 0.11 * strength * t * (1 - 0.35 * t);
        sx = cx + (sx - cx) * taper;
      }

      sx = clamp(sx, 0, w - 1.001);
      sy = clamp(sy, 0, h - 1.001);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = y0 * w + x0;
      const i10 = i00 + 1;
      const i01 = i00 + w;
      const i11 = i01 + 1;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const outIdx = y * w + x;
      dstAlpha[outIdx] = alpha[i00] * w00 + alpha[i10] * w10 + alpha[i01] * w01 + alpha[i11] * w11;

      const pOut = outIdx * 4;
      for (let c = 0; c < 3; c++) {
        dstRgba[pOut + c] = Math.round(
          rgba[i00 * 4 + c] * w00 +
            rgba[i10 * 4 + c] * w10 +
            rgba[i01 * 4 + c] * w01 +
            rgba[i11 * 4 + c] * w11,
        );
      }
      dstRgba[pOut + 3] = 255;
    }
  }
  return { rgba: dstRgba, alpha: dstAlpha };
}

// Illustrated cartoon shading: edge-preserving bilateral smooth + warm vibrancy + interior comic feature ink lines.
function applyCartoonShading(rgba: Uint8ClampedArray, alpha: Float32Array, w: number, h: number): void {
  const src = new Uint8ClampedArray(rgba);
  const smoothed = new Uint8ClampedArray(rgba);

  // Separable-style 5x5 sparse bilateral pass on opaque pixels for fast, painterly smoothness.
  const offsets = [-4, -2, 0, 2, 4];
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) {
      const idx = y * w + x;
      if (alpha[idx] < 0.05) continue;
      const p = idx * 4;
      const r0 = src[p];
      const g0 = src[p + 1];
      const b0 = src[p + 2];
      let wr = 0;
      let wg = 0;
      let wb = 0;
      let wsum = 0;
      for (const dy of offsets) {
        const row = (y + dy) * w;
        for (const dx of offsets) {
          const qIdx = row + x + dx;
          if (alpha[qIdx] < 0.2) continue;
          const q = qIdx * 4;
          const dr = src[q] - r0;
          const dg = src[q + 1] - g0;
          const db = src[q + 2] - b0;
          const colorDist2 = dr * dr + dg * dg + db * db;
          if (colorDist2 > 2600) continue;
          const wt = colorDist2 < 450 ? 1 : 0.35;
          wr += src[q] * wt;
          wg += src[q + 1] * wt;
          wb += src[q + 2] * wt;
          wsum += wt;
        }
      }
      if (wsum > 0) {
        smoothed[p] = Math.round(wr / wsum);
        smoothed[p + 1] = Math.round(wg / wsum);
        smoothed[p + 2] = Math.round(wb / wsum);
      }
    }
  }

  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const idx = y * w + x;
      if (alpha[idx] < 0.05) continue;
      const p = idx * 4;

      // Unsharp detail from original + painterly base from bilateral smooth
      let r = smoothed[p] + (src[p] - smoothed[p]) * 0.42;
      let g = smoothed[p + 1] + (src[p + 1] - smoothed[p + 1]) * 0.42;
      let b = smoothed[p + 2] + (src[p + 2] - smoothed[p + 2]) * 0.42;

      // Soft cel-tone richness + warm portrait saturation boost
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const celLuma = Math.round(luma / 22) * 22;
      const targetLuma = luma * 0.76 + celLuma * 0.24;
      const lumaScale = luma > 4 ? targetLuma / luma : 1;
      r *= lumaScale;
      g *= lumaScale;
      b *= lumaScale;

      const midLuma = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = 1.2;
      r = midLuma + (r - midLuma) * sat + 3;
      g = midLuma + (g - midLuma) * sat + 1;
      b = midLuma + (b - midLuma) * (sat * 0.96);

      // Gentle S-curve contrast
      const contrast = (v: number) => clamp(((v / 255 - 0.5) * 1.09 + 0.51) * 255, 0, 255);
      r = contrast(r);
      g = contrast(g);
      b = contrast(b);

      // Interior comic ink accentuation along crisp facial edges (glasses, brows, smile, curls)
      const interior =
        alpha[idx - 2] > 0.92 &&
        alpha[idx + 2] > 0.92 &&
        alpha[idx - 2 * w] > 0.92 &&
        alpha[idx + 2 * w] > 0.92;
      if (interior) {
        const lumAt = (i: number) => 0.299 * smoothed[i * 4] + 0.587 * smoothed[i * 4 + 1] + 0.114 * smoothed[i * 4 + 2];
        const gx = lumAt(idx + 1) - lumAt(idx - 1);
        const gy = lumAt(idx + w) - lumAt(idx - w);
        const edge = Math.hypot(gx, gy);
        if (edge > 20) {
          const inkAmt = clamp((edge - 20) / 85, 0, 0.52);
          r = r * (1 - inkAmt) + INK_RGB[0] * inkAmt;
          g = g * (1 - inkAmt) + INK_RGB[1] * inkAmt;
          b = b * (1 - inkAmt) + INK_RGB[2] * inkAmt;
        }
      }

      rgba[p] = clamp(Math.round(r), 0, 255);
      rgba[p + 1] = clamp(Math.round(g), 0, 255);
      rgba[p + 2] = clamp(Math.round(b), 0, 255);
    }
  }
}

export async function renderCaricature(
  prepared: PreparedLeader,
  options: CaricatureOptions = DEFAULT_CARICATURE_OPTIONS,
): Promise<RenderedCaricature> {
  const zoom = clamp(options.zoom, 0.75, 1.35);
  const targetEyesX = EYE_X + clamp(options.offsetX, -80, 80);
  const targetEyesY = EYE_Y + clamp(options.offsetY, -80, 80);
  const scale = (TARGET_FACE_W * zoom) / Math.max(24, prepared.faceWidthPx);
  const skinHex = options.handColor ?? prepared.detectedSkinHex;
  const hairHex = options.hairColor ?? prepared.detectedHairHex;
  const skinRgb = hexToRgb(skinHex);
  const hairRgb = hexToRgb(hairHex);

  // 1. Align, level, and scale source photo onto the 660 × 780 head canvas.
  const alignedCanvas = document.createElement('canvas');
  alignedCanvas.width = OUT_W;
  alignedCanvas.height = OUT_H;
  const actx = alignedCanvas.getContext('2d', { willReadFrequently: true })!;
  actx.save();
  actx.translate(targetEyesX, targetEyesY);
  actx.rotate(-prepared.tiltRad);
  actx.scale(scale, scale);
  actx.translate(-prepared.eyeX, -prepared.eyeY);
  actx.drawImage(prepared.sourceCanvas, 0, 0);
  actx.restore();

  const imgData = actx.getImageData(0, 0, OUT_W, OUT_H);
  const rgba = imgData.data;

  // 2. Project person + hair masks into aligned 660 × 780 space, trim shoulders below chin, and synthesize neck tab.
  const sw = prepared.sourceCanvas.width;
  const sh = prepared.sourceCanvas.height;
  const cosT = Math.cos(prepared.tiltRad);
  const sinT = Math.sin(prepared.tiltRad);
  const chinY = targetEyesY + prepared.chinDistPx * scale;
  const neckBottomY = Math.min(OUT_H - OUTLINE_PX - 16, Math.max(658, chinY + 95 * zoom));
  const neckHalfW = 55 * zoom;

  const rawAlpha = new Float32Array(OUT_W * OUT_H);

  for (let y = OUTLINE_PX + 4; y < OUT_H - OUTLINE_PX - 4; y++) {
    for (let x = OUTLINE_PX + 4; x < OUT_W - OUTLINE_PX - 4; x++) {
      const dx = (x - targetEyesX) / scale;
      const dy = (y - targetEyesY) / scale;
      const srcX = prepared.eyeX + dx * cosT - dy * sinT;
      const srcY = prepared.eyeY + dx * sinT + dy * cosT;
      const idx = y * OUT_W + x;

      const inBounds = srcX >= 0 && srcX < sw && srcY >= 0 && srcY < sh;
      const u = (srcX + 0.5) / sw;
      const v = (srcY + 0.5) / sh;
      const personP = inBounds ? sampleMaskBilinear(prepared.personMask, prepared.personW, prepared.personH, u, v) : 0;
      const hairP = inBounds ? sampleMaskBilinear(prepared.hairMask, prepared.hairW, prepared.hairH, u, v) : 0;

      // Exclude other detected people in group photos when a pixel belongs more closely to another person's head/torso.
      let otherKeep = 1;
      if (prepared.faces.length > 1) {
        const myDist = Math.hypot((srcX - prepared.eyeX) / prepared.faceWidthPx, (srcY - prepared.eyeY) / (prepared.faceWidthPx * 1.25));
        for (let fi = 0; fi < prepared.faces.length; fi++) {
          if (fi === prepared.faceIndex) continue;
          const other = prepared.faces[fi];
          const od = Math.hypot((srcX - other.eyeX) / other.faceWidthPx, (srcY - (other.eyeY + other.faceWidthPx * 0.25)) / (other.faceWidthPx * 1.6));
          if (od < 1.15 && od < myDist * 0.96) {
            otherKeep = Math.min(otherKeep, clamp((od - 0.82) / 0.25, 0, 1));
          }
        }
      }

      if (y <= chinY - 8) {
        // Above chin: tighten non-hair reach to ear width (~160px) so background shoulders/people don't leak in,
        // while letting genuine hair segmentation reach out (~225px) for wide curls/ponytails.
        const faceEllipse = Math.hypot((x - targetEyesX) / (158 * zoom), (y - (targetEyesY + 12 * zoom)) / (215 * zoom));
        const faceHalo = clamp((1.14 - faceEllipse) / 0.16, 0, 1);
        const hairEllipse = Math.hypot((x - targetEyesX) / (225 * zoom), (y - (targetEyesY - 35 * zoom)) / (270 * zoom));
        const hairHalo = clamp((1.16 - hairEllipse) / 0.16, 0, 1);
        const pFg = clamp((personP - 0.4) / 0.26, 0, 1) * faceHalo;
        const hFg = clamp((hairP - 0.38) / 0.26, 0, 1) * hairHalo;
        rawAlpha[idx] = Math.max(pFg, hFg) * otherKeep;
      } else if (y <= neckBottomY) {
        const fg = clamp((Math.max(personP, hairP) - 0.38) / 0.26, 0, 1) * otherKeep;
        // Below chin: keep long hair strands + clean tapered neck column that tucks behind the cartoon collar.
        const tNeck = clamp((y - (chinY - 8)) / 36, 0, 1);
        const allowedHalfW = (1 - tNeck) * (165 * zoom) + tNeck * neckHalfW;
        const absDx = Math.abs(x - targetEyesX);
        const neckCol = clamp((allowedHalfW + 6 - absDx) / 10, 0, 1);
        const bottomFade = clamp((neckBottomY - y) / 12, 0, 1);
        const longHair = y < chinY + 90 * zoom ? clamp((hairP - 0.48) / 0.22, 0, 1) * clamp((225 * zoom - absDx) / 20, 0, 1) : 0;

        // Synthesize skin-toned neck tab inside the collar zone so tight crops or high collars never leave a neck gap.
        const synthNeck =
          absDx <= neckHalfW * 0.92 && y >= chinY - 4 && y <= neckBottomY - 6
            ? clamp((neckHalfW * 0.92 - absDx) / 8, 0, 1) * bottomFade
            : 0;

        if (synthNeck > fg * neckCol || y > chinY + 24) {
          const p = idx * 4;
          const shade = 0.88 - 0.08 * clamp((y - chinY) / 90, 0, 1);
          const blend = inBounds && fg > 0.6 && y < chinY + 34 ? clamp((y - chinY) / 34, 0, 1) : 1;
          rgba[p] = Math.round(rgba[p] * (1 - blend) + skinRgb[0] * shade * blend);
          rgba[p + 1] = Math.round(rgba[p + 1] * (1 - blend) + skinRgb[1] * shade * blend);
          rgba[p + 2] = Math.round(rgba[p + 2] * (1 - blend) + skinRgb[2] * shade * blend);
        }

        rawAlpha[idx] = Math.max(fg * neckCol * bottomFade, synthNeck, longHair * bottomFade);
      }
    }
  }

  keepFaceComponent(rawAlpha, OUT_W, OUT_H, targetEyesX, targetEyesY);
  let smoothAlpha = blurAlpha(rawAlpha, OUT_W, OUT_H, 2);
  for (let i = 0; i < smoothAlpha.length; i++) {
    smoothAlpha[i] = clamp((smoothAlpha[i] - 0.18) / 0.64, 0, 1);
  }

  // 3. Apply caricature lens warp & cartoon shading.
  let finalRgba: Uint8ClampedArray = rgba;
  if (options.style === 'caricature') {
    const warped = applyCaricatureWarp(
      finalRgba,
      smoothAlpha,
      OUT_W,
      OUT_H,
      targetEyesX,
      targetEyesY,
      zoom,
      clamp(options.exaggeration, 0, 1),
    );
    finalRgba = warped.rgba;
    smoothAlpha = warped.alpha;
  }

  if (options.style === 'caricature' || options.style === 'cartoon') {
    applyCartoonShading(finalRgba, smoothAlpha, OUT_W, OUT_H);
  }

  // 4. Composite front head with thick #3b2417 cartoon outline, and matching hair-colored back silhouette.
  const outlineAlpha = dilateOutline(smoothAlpha, OUT_W, OUT_H, OUTLINE_PX);

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = OUT_W;
  frontCanvas.height = OUT_H;
  const fctx = frontCanvas.getContext('2d')!;
  const frontImg = fctx.createImageData(OUT_W, OUT_H);
  const fd = frontImg.data;

  const backCanvas = document.createElement('canvas');
  backCanvas.width = OUT_W;
  backCanvas.height = OUT_H;
  const bctx = backCanvas.getContext('2d')!;
  const backImg = bctx.createImageData(OUT_W, OUT_H);
  const bd = backImg.data;

  for (let y = 0; y < OUT_H; y++) {
    const shade = 1.06 - 0.16 * (y / OUT_H);
    const hr = clamp(Math.round(hairRgb[0] * shade), 0, 255);
    const hg = clamp(Math.round(hairRgb[1] * shade), 0, 255);
    const hb = clamp(Math.round(hairRgb[2] * shade), 0, 255);
    for (let x = 0; x < OUT_W; x++) {
      const i = y * OUT_W + x;
      const oa = outlineAlpha[i];
      if (oa <= 0.004) continue;
      const fa = smoothAlpha[i];
      const outA = Math.max(oa, fa);
      const p = i * 4;

      // Front: stylized head over INK outline
      const mix = outA > 0 ? fa / outA : 0;
      fd[p] = Math.round(INK_RGB[0] * (1 - mix) + finalRgba[p] * mix);
      fd[p + 1] = Math.round(INK_RGB[1] * (1 - mix) + finalRgba[p + 1] * mix);
      fd[p + 2] = Math.round(INK_RGB[2] * (1 - mix) + finalRgba[p + 2] * mix);
      fd[p + 3] = Math.round(outA * 255);

      // Back: hair-colored silhouette over INK outline (used when zoomies turn around and scamper away)
      bd[p] = Math.round(INK_RGB[0] * (1 - mix) + hr * mix);
      bd[p + 1] = Math.round(INK_RGB[1] * (1 - mix) + hg * mix);
      bd[p + 2] = Math.round(INK_RGB[2] * (1 - mix) + hb * mix);
      bd[p + 3] = Math.round(outA * 255);
    }
  }

  fctx.putImageData(frontImg, 0, 0);
  bctx.putImageData(backImg, 0, 0);

  const [frontBlob, backBlob] = await Promise.all([canvasToWebp(frontCanvas, 0.88), canvasToWebp(backCanvas, 0.84)]);
  return {
    frontBlob,
    backBlob,
    frontPreviewUrl: URL.createObjectURL(frontBlob),
    backPreviewUrl: URL.createObjectURL(backBlob),
    handColor: skinHex,
    hairColor: hairHex,
  };
}

export { INK };
