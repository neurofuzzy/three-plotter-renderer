import { Vector2, Vector3, Camera, Scene, Mesh, WebGLRenderer } from 'three';

// ============================================================================
// PlotterRenderer
// ============================================================================

export interface SilhouetteOptions {
    normalBuckets?: number;
    simplifyTolerance?: number;
    minArea?: number;
}

export interface HatchOptions {
    baseSpacing?: number;
    minSpacing?: number;
    maxSpacing?: number;
    depthFactor?: number;
    insetPixels?: number;
    stroke?: string;
    strokeWidth?: string;
    axisSettings?: {
        x?: { rotation?: number; spacing?: number };
        y?: { rotation?: number; spacing?: number };
        z?: { rotation?: number; spacing?: number };
    };
}

export interface EdgeOptions {
    stroke?: string;
    strokeWidth?: string;
}

export interface HiddenLineOptions {
    smoothThreshold?: number;
}

export class PlotterRenderer {
    domElement: SVGElement;

    showSilhouettes: boolean;
    showEdges: boolean;
    showHatches: boolean;

    silhouetteOptions: SilhouetteOptions;
    hatchOptions: HatchOptions;
    edgeOptions: EdgeOptions;
    hiddenLineOptions: HiddenLineOptions;

    autoClear: boolean;

    setClearColor(color: number | string): void;
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number): void;
    getSize(): { width: number; height: number };
    setGLRenderer(glRenderer: WebGLRenderer): void;
    clear(): void;
    renderGPULayers(scene: Scene, camera: Camera): void;
    render(scene: Scene, camera: Camera): void;
}

export class SVGObject {
    node: SVGElement;
    constructor(node: SVGElement);
}

// ============================================================================
// Hidden Line Computation
// ============================================================================

export interface Edge2D {
    a: Vector2;
    b: Vector2;
    a3d: Vector3;
    b3d: Vector3;
    midpoint3d: Vector3;
    isProfile: boolean;
    visible: boolean;
    faceIdx: number;
    faceIdx2?: number;
    mesh: Mesh;
    isHatch?: boolean;
    isSilhouette?: boolean;
    normal1?: Vector3;
    normal2?: Vector3;
}

export interface HiddenLineOptions {
    smoothThreshold?: number;
    width?: number;
    height?: number;
}

export interface HiddenLineResult {
    edges: Edge2D[];
}

export function computeHiddenLines(
    mesh: Mesh,
    camera: Camera,
    scene: Scene,
    options?: HiddenLineOptions
): HiddenLineResult;

export function computeHiddenLinesMultiple(
    meshes: Mesh[],
    camera: Camera,
    scene: Scene,
    options?: HiddenLineOptions
): HiddenLineResult;

export function optimizeEdges(
    edges: Edge2D[],
    tolerance?: number
): Edge2D[];

export function cleanupOrphanedEdges(
    edges: Edge2D[],
    tolerance?: number,
    maxExtension?: number
): Edge2D[];

// ============================================================================
// GPU Silhouette Extraction
// ============================================================================

export interface NormalRegion {
    boundary: Vector2[];
    normal: Vector3;
    depth: number;
    area: number;
    regionId: number;
}

export interface ExtractNormalRegionsOptions {
    resolution?: number;
    normalBuckets?: number;
    minArea?: number;
    simplifyTolerance?: number;
    insetPixels?: number;
}

export function extractNormalRegions(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    options?: ExtractNormalRegionsOptions
): NormalRegion[];

// ============================================================================
// Perspective Hatching
// ============================================================================

export interface HatchLine {
    start: Vector2;
    end: Vector2;
}

export interface PerspectiveHatchOptions {
    baseSpacing?: number;
    minSpacing?: number;
    maxSpacing?: number;
    depthFactor?: number;
    screenWidth?: number;
    screenHeight?: number;
    axisSettings?: {
        x?: { rotation?: number; spacing?: number };
        y?: { rotation?: number; spacing?: number };
        z?: { rotation?: number; spacing?: number };
    };
}

export function generatePerspectiveHatches(
    region: NormalRegion,
    camera: Camera,
    options?: PerspectiveHatchOptions
): HatchLine[];

export function clipLineToPolygon(
    line: HatchLine,
    polygon: Vector2[]
): HatchLine[];

export function clipLineOutsidePolygon(
    line: HatchLine,
    polygon: Vector2[]
): HatchLine[];

// ============================================================================
// Line Optimization
// ============================================================================

export interface Point {
    x: number;
    y: number;
}

export interface Segment {
    a: Point;
    b: Point;
    tags?: Record<string, unknown>;
}

export class Optimize {
    static optimize(segments: Segment[]): Segment[];
    static reverseSegment(segment: Segment): Segment;
    static joinPaths(paths: Segment[][]): Segment[][];
}

// ============================================================================
// Geometry Utilities
// ============================================================================

export class GeomUtil {
    static lerp(a: number, b: number, d: number): number;
    static angleBetween(ptA: Point, ptB: Point): number;
    static lerpPoints(ptA: Point, ptB: Point, d: number): Point;
    static rotatePoint(pt: Point, rad: number): void;
    static rotatePointDeg(pt: Point, deg: number): void;
    static pointsEqual(ptA: Point, ptB: Point, scale?: number): boolean;
    static distanceBetween(ptA: Point, ptB: Point): number;
    static polygonArea(pts: Point[]): number;
}

export class Segments {
    pivot: Point;
    rotation: number;
    isOpen: boolean;

    constructor(segments: Segment[]);
    add(...segs: Segment[]): void;
    toPoints(local?: boolean): Point[];
    toSegments(local?: boolean): Segment[];
    static clone(segs: Segments): Segments;
}
