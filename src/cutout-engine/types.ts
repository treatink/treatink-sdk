import type { PetNamePosition, Transform } from '../types.js';

/** Fixed print canvas (docs/05 §1). Every cutout PNG and the print composite are this size. */
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 1200;
/** Zoom coverage cap for maxScale (docs/05 §1, useFileHandlers.js:26). */
export const MAX_CANVAS_COVERAGE = 1.3;
/** Clamp floor for scale — matches the store slider/pinch (docs/05 §5). */
export const MIN_SCALE = 0.5;

/** A photo placed in canvas space (docs/05 §2). width/height are the fitted box, not natural px. */
export interface EditorImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  maxScale: number;
}

/** 2D drawing surface injected into the engine (browser Canvas or @napi-rs/canvas in Node). */
export interface CanvasLike {
  readonly width: number;
  readonly height: number;
  getContext(type: '2d'): Context2DLike | null;
}
export interface Context2DLike {
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  scale(x: number, y: number): void;
  drawImage(img: unknown, dx: number, dy: number, dw: number, dh: number): void;
  globalAlpha: number;
  font: string;
  fillStyle: string;
  textAlign: CanvasTextAlign;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

export interface RenderInputs {
  photo: unknown; // drawable image (injected)
  cutout: unknown; // the cutout PNG (injected)
  transform: Transform;
  personalizationText?: string | null;
  petNamePosition?: PetNamePosition;
  theme?: 'light' | 'dark';
}

export interface ExportResult {
  /** 900×1200 print composite (staticBg excluded, docs/05 §8). */
  print: Blob;
  /** Product-mockup preview with the label in label_zone (docs/05 §8.1). Backs previewUrl. */
  display: Blob;
  /** The untouched source upload. */
  source: Blob;
  lowRes: boolean;
}
