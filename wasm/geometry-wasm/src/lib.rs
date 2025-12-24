//! WASM geometry processing for three-plotter-renderer
//!
//! Provides fast boolean operations using i_overlay (pure Rust).

use i_overlay::core::fill_rule::FillRule;
use i_overlay::core::overlay_rule::OverlayRule;
use i_overlay::float::single::SingleFloatOverlay;
use wasm_bindgen::prelude::*;

#[cfg(feature = "console_error_panic_hook")]
use console_error_panic_hook;

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

type Point = [f64; 2];
type Contour = Vec<Point>;
type Shape = Vec<Contour>;

/// Internal scale factor for 2D coordinate precision
/// Scale up coordinates during processing, scale down on output
/// Higher values = better precision but more memory
const INTERNAL_SCALE: f32 = 16.0;

/// A processor for boolean operations on polygons.
/// Accumulates shapes and computes boolean results.
#[wasm_bindgen]
pub struct BooleanProcessor {
    /// Subject polygons (for union base)
    subjects: Vec<Shape>,
    /// Clip polygons (for union or difference)
    clips: Vec<Shape>,
}

#[wasm_bindgen]
impl BooleanProcessor {
    /// Create a new BooleanProcessor
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            subjects: Vec::new(),
            clips: Vec::new(),
        }
    }

    /// Add a polygon as subject (for union base).
    /// Points should be a flat array: [x1, y1, x2, y2, ...]
    #[wasm_bindgen]
    pub fn add_subject(&mut self, points: &[f64]) {
        let contour = flat_to_contour(points);
        if contour.len() >= 3 {
            self.subjects.push(vec![contour]);
        }
    }

    /// Add a polygon as clip (to union with or subtract from subject).
    /// Points should be a flat array: [x1, y1, x2, y2, ...]
    #[wasm_bindgen]
    pub fn add_clip(&mut self, points: &[f64]) {
        let contour = flat_to_contour(points);
        if contour.len() >= 3 {
            self.clips.push(vec![contour]);
        }
    }

    /// Compute union of all shapes and return as segments.
    /// Returns a flat array: [x1, y1, x2, y2, ...] per segment (4 values each)
    #[wasm_bindgen]
    pub fn compute_union(&self) -> Vec<f64> {
        if self.subjects.is_empty() && self.clips.is_empty() {
            return Vec::new();
        }

        // Start with first subject or empty
        let first_subj: Shape = if !self.subjects.is_empty() {
            self.subjects[0].clone()
        } else if !self.clips.is_empty() {
            self.clips[0].clone()
        } else {
            return Vec::new();
        };

        // Union all subjects together first
        let mut result = first_subj;
        for subj in self.subjects.iter().skip(1) {
            let shapes = result.overlay(subj, OverlayRule::Union, FillRule::EvenOdd);
            result = shapes.into_iter().flatten().collect();
        }

        // Union all clips
        for clip in &self.clips {
            let shapes = result.overlay(clip, OverlayRule::Union, FillRule::EvenOdd);
            result = shapes.into_iter().flatten().collect();
        }

        shape_to_segments(&result)
    }

    /// Compute difference (subjects - clips) and return as segments.
    #[wasm_bindgen]
    pub fn compute_difference(&self) -> Vec<f64> {
        if self.subjects.is_empty() {
            return Vec::new();
        }

        // Union all subjects first
        let first_subj = self.subjects[0].clone();
        let mut result = first_subj;

        for subj in self.subjects.iter().skip(1) {
            let shapes = result.overlay(subj, OverlayRule::Union, FillRule::EvenOdd);
            result = shapes.into_iter().flatten().collect();
        }

        // Subtract each clip
        for clip in &self.clips {
            let shapes = result.overlay(clip, OverlayRule::Difference, FillRule::EvenOdd);
            result = shapes.into_iter().flatten().collect();
        }

        shape_to_segments(&result)
    }

    /// Get count of subject shapes
    #[wasm_bindgen]
    pub fn subject_count(&self) -> usize {
        self.subjects.len()
    }

    /// Get count of clip shapes
    #[wasm_bindgen]
    pub fn clip_count(&self) -> usize {
        self.clips.len()
    }

    /// Clear all shapes
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.subjects.clear();
        self.clips.clear();
    }
}

/// Quick union of two polygons.
/// Both inputs are flat arrays: [x1, y1, x2, y2, ...]
/// Returns segments as flat array
#[wasm_bindgen]
pub fn union_polygons(poly_a: &[f64], poly_b: &[f64]) -> Vec<f64> {
    let contour_a = flat_to_contour(poly_a);
    let contour_b = flat_to_contour(poly_b);

    if contour_a.len() < 3 || contour_b.len() < 3 {
        return Vec::new();
    }

    let shape_a: Shape = vec![contour_a];
    let shape_b: Shape = vec![contour_b];

    let shapes = shape_a.overlay(&shape_b, OverlayRule::Union, FillRule::EvenOdd);

    shapes_to_segments(&shapes)
}

/// Quick difference of two polygons (a - b).
#[wasm_bindgen]
pub fn difference_polygons(poly_a: &[f64], poly_b: &[f64]) -> Vec<f64> {
    let contour_a = flat_to_contour(poly_a);
    let contour_b = flat_to_contour(poly_b);

    if contour_a.len() < 3 || contour_b.len() < 3 {
        return Vec::new();
    }

    let shape_a: Shape = vec![contour_a];
    let shape_b: Shape = vec![contour_b];

    let shapes = shape_a.overlay(&shape_b, OverlayRule::Difference, FillRule::EvenOdd);

    shapes_to_segments(&shapes)
}

// ============ Geometry Functions (ported from geom.js) ============

/// Segment-segment intersection test
/// Returns intersection point [x, y, t1, t2] or empty if no intersection
/// t1 and t2 are parametric positions on each segment (0-1)
#[wasm_bindgen]
pub fn segment_intersect(
    ax1: f64, ay1: f64, ax2: f64, ay2: f64,
    bx1: f64, by1: f64, bx2: f64, by2: f64,
) -> Vec<f64> {
    let s1_x = ax2 - ax1;
    let s1_y = ay2 - ay1;
    let s2_x = bx2 - bx1;
    let s2_y = by2 - by1;

    let denom = -s2_x * s1_y + s1_x * s2_y;
    if denom.abs() < 1e-10 {
        return Vec::new(); // parallel
    }

    let s = (-s1_y * (ax1 - bx1) + s1_x * (ay1 - by1)) / denom;
    let t = (s2_x * (ay1 - by1) - s2_y * (ax1 - bx1)) / denom;

    if s >= 0.0 && s <= 1.0 && t >= 0.0 && t <= 1.0 {
        let ix = ax1 + t * s1_x;
        let iy = ay1 + t * s1_y;
        vec![ix, iy, t, s]
    } else {
        Vec::new()
    }
}

/// Point in triangle test using barycentric coordinates
/// Returns true if point (px, py) is inside triangle (ax,ay)-(bx,by)-(cx,cy)
#[wasm_bindgen]
pub fn point_in_triangle(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64) -> bool {
    fn sign(p1x: f64, p1y: f64, p2x: f64, p2y: f64, p3x: f64, p3y: f64) -> f64 {
        (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y)
    }

    let d1 = sign(px, py, ax, ay, bx, by);
    let d2 = sign(px, py, bx, by, cx, cy);
    let d3 = sign(px, py, cx, cy, ax, ay);

    let has_neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
    let has_pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;

    !(has_neg && has_pos)
}

/// Distance between two points
#[wasm_bindgen]
pub fn distance_between(x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    (dx * dx + dy * dy).sqrt()
}

/// Closest point on segment to a given point
/// Returns [x, y] of closest point
#[wasm_bindgen]
pub fn closest_point_on_segment(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64) -> Vec<f64> {
    let ab_x = bx - ax;
    let ab_y = by - ay;
    let ca_x = px - ax;
    let ca_y = py - ay;
    
    let t = ca_x * ab_x + ca_y * ab_y; // dot(ca, ab)
    
    if t <= 0.0 {
        vec![ax, ay]
    } else {
        let denom = ab_x * ab_x + ab_y * ab_y; // dot(ab, ab)
        if t >= denom {
            vec![bx, by]
        } else {
            let t_norm = t / denom;
            vec![ax + t_norm * ab_x, ay + t_norm * ab_y]
        }
    }
}

/// Distance from point to segment
#[wasm_bindgen]
pub fn distance_point_segment(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let closest = closest_point_on_segment(px, py, ax, ay, bx, by);
    distance_between(px, py, closest[0], closest[1])
}

/// Compute polygon area (signed - positive = clockwise)
/// Points as flat array: [x1, y1, x2, y2, ...]
#[wasm_bindgen]
pub fn polygon_area(points: &[f64]) -> f64 {
    if points.len() < 6 {
        return 0.0; // need at least 3 points
    }
    
    let n = points.len() / 2;
    let mut area = 0.0;
    let mut j = n - 1;
    
    for i in 0..n {
        let ix = points[i * 2];
        let iy = points[i * 2 + 1];
        let jx = points[j * 2];
        let jy = points[j * 2 + 1];
        
        area += ix * jy;
        area -= jx * iy;
        j = i;
    }
    
    area / 2.0
}

/// Check if polygon is clockwise (area > 0)
#[wasm_bindgen]
pub fn polygon_is_clockwise(points: &[f64]) -> bool {
    polygon_area(points) > 0.0
}

/// Batch segment-segment intersection for array of segments
/// Input: segments as flat array [ax1, ay1, ax2, ay2, bx1, by1, bx2, by2, ...]
/// Returns: intersection points [x, y, seg_idx_a, seg_idx_b, ...]
#[wasm_bindgen]
pub fn batch_segment_intersections(segments: &[f64]) -> Vec<f64> {
    let n = segments.len() / 8; // each pair of segments is 8 floats
    let seg_count = segments.len() / 4; // each segment is 4 floats
    
    if seg_count < 2 {
        return Vec::new();
    }
    
    let mut results = Vec::new();
    
    // Get individual segments
    let get_seg = |i: usize| -> (f64, f64, f64, f64) {
        let base = i * 4;
        (segments[base], segments[base + 1], segments[base + 2], segments[base + 3])
    };
    
    // Test all pairs
    for i in 0..seg_count {
        let (ax1, ay1, ax2, ay2) = get_seg(i);
        for j in (i + 1)..seg_count {
            let (bx1, by1, bx2, by2) = get_seg(j);
            let isect = segment_intersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
            if isect.len() == 4 {
                results.push(isect[0]); // x
                results.push(isect[1]); // y
                results.push(i as f64); // segment A index
                results.push(j as f64); // segment B index
            }
        }
    }
    
    results
}

// ============ Segment Optimization (ported from optimize.js) ============

/// Deduplicate segments - removes exact duplicates (including reversed)
/// Input: flat array [ax1, ay1, ax2, ay2, bx1, by1, bx2, by2, ...]
/// Returns: deduplicated segments in same format
#[wasm_bindgen]
pub fn dedupe_segments(segments: &[f64]) -> Vec<f64> {
    let seg_count = segments.len() / 4;
    if seg_count < 2 {
        return segments.to_vec();
    }
    
    let mut result = Vec::with_capacity(segments.len());
    let tolerance = 0.0001;
    
    let points_equal = |x1: f64, y1: f64, x2: f64, y2: f64| -> bool {
        (x1 - x2).abs() < tolerance && (y1 - y2).abs() < tolerance
    };
    
    let segments_equal = |i: usize, j: usize| -> bool {
        let a1x = segments[i * 4];
        let a1y = segments[i * 4 + 1];
        let a2x = segments[i * 4 + 2];
        let a2y = segments[i * 4 + 3];
        let b1x = segments[j * 4];
        let b1y = segments[j * 4 + 1];
        let b2x = segments[j * 4 + 2];
        let b2y = segments[j * 4 + 3];
        
        // Same direction
        (points_equal(a1x, a1y, b1x, b1y) && points_equal(a2x, a2y, b2x, b2y)) ||
        // Reversed direction
        (points_equal(a1x, a1y, b2x, b2y) && points_equal(a2x, a2y, b1x, b1y))
    };
    
    let mut kept = vec![true; seg_count];
    
    for i in 0..seg_count {
        if !kept[i] {
            continue;
        }
        for j in (i + 1)..seg_count {
            if kept[j] && segments_equal(i, j) {
                kept[j] = false;
            }
        }
    }
    
    for i in 0..seg_count {
        if kept[i] {
            result.push(segments[i * 4]);
            result.push(segments[i * 4 + 1]);
            result.push(segments[i * 4 + 2]);
            result.push(segments[i * 4 + 3]);
        }
    }
    
    result
}

/// Trim small segments - removes segments shorter than threshold
/// Input: flat array [ax1, ay1, ax2, ay2, ...]
/// Returns: filtered segments
#[wasm_bindgen]
pub fn trim_small_segments(segments: &[f64], min_length: f64) -> Vec<f64> {
    let seg_count = segments.len() / 4;
    let mut result = Vec::with_capacity(segments.len());
    
    for i in 0..seg_count {
        let x1 = segments[i * 4];
        let y1 = segments[i * 4 + 1];
        let x2 = segments[i * 4 + 2];
        let y2 = segments[i * 4 + 3];
        
        let dx = x2 - x1;
        let dy = y2 - y1;
        let len = (dx * dx + dy * dy).sqrt();
        
        if len >= min_length {
            result.push(x1);
            result.push(y1);
            result.push(x2);
            result.push(y2);
        }
    }
    
    result
}

/// Merge colinear overlapping segments
/// Input: flat array [ax1, ay1, ax2, ay2, ...]
/// Returns: merged segments
#[wasm_bindgen]
pub fn merge_colinear_segments(segments: &[f64]) -> Vec<f64> {
    let seg_count = segments.len() / 4;
    if seg_count < 2 {
        return segments.to_vec();
    }
    
    let angle_tolerance = 0.001;
    let y_tolerance = 0.1;
    
    // Convert to mutable segment list
    let mut segs: Vec<Option<(f64, f64, f64, f64)>> = (0..seg_count)
        .map(|i| Some((
            segments[i * 4],
            segments[i * 4 + 1],
            segments[i * 4 + 2],
            segments[i * 4 + 3],
        )))
        .collect();
    
    let angle_between = |x1: f64, y1: f64, x2: f64, y2: f64| -> f64 {
        (y2 - y1).atan2(x2 - x1)
    };
    
    let rotate_point = |x: f64, y: f64, angle: f64| -> (f64, f64) {
        let cos = angle.cos();
        let sin = angle.sin();
        (sin * y + cos * x, cos * y - sin * x)
    };
    
    // Run 3 passes like the original
    for _ in 0..3 {
        for i in 0..seg_count {
            if segs[i].is_none() {
                continue;
            }
            let (ax1, ay1, ax2, ay2) = segs[i].unwrap();
            let angle_a = angle_between(ax1, ay1, ax2, ay2);
            
            for j in 0..i {
                if segs[j].is_none() {
                    continue;
                }
                let (bx1, by1, bx2, by2) = segs[j].unwrap();
                let angle_b = angle_between(bx1, by1, bx2, by2);
                let angle_b_rev = angle_between(bx2, by2, bx1, by1);
                
                let (same, is_rev) = if (angle_a - angle_b).abs() < angle_tolerance {
                    (true, false)
                } else if (angle_a - angle_b_rev).abs() < angle_tolerance {
                    (true, true)
                } else {
                    (false, false)
                };
                
                if !same {
                    continue;
                }
                
                // Rotate to align with X axis
                let heading = angle_a;
                let (mut aa_x, aa_y) = if !is_rev {
                    rotate_point(ax1, ay1, heading)
                } else {
                    rotate_point(ax2, ay2, heading)
                };
                let (mut ab_x, _ab_y) = if !is_rev {
                    rotate_point(ax2, ay2, heading)
                } else {
                    rotate_point(ax1, ay1, heading)
                };
                let (mut ba_x, ba_y) = rotate_point(bx1, by1, heading);
                let (mut bb_x, _bb_y) = rotate_point(bx2, by2, heading);
                
                // Check if on same line and overlapping
                if (aa_y - ba_y).abs() < y_tolerance && ab_x >= ba_x - 0.0001 && aa_x <= bb_x + 0.0001 {
                    // Merge: extend segment j to cover both
                    let new_a = if aa_x < ba_x {
                        if !is_rev { (ax1, ay1) } else { (ax2, ay2) }
                    } else {
                        (bx1, by1)
                    };
                    let new_b = if ab_x > bb_x {
                        if !is_rev { (ax2, ay2) } else { (ax1, ay1) }
                    } else {
                        (bx2, by2)
                    };
                    
                    segs[j] = Some((new_a.0, new_a.1, new_b.0, new_b.1));
                    segs[i] = None;
                    break;
                }
            }
        }
    }
    
    // Collect results
    let mut result = Vec::new();
    for seg in segs {
        if let Some((x1, y1, x2, y2)) = seg {
            result.push(x1);
            result.push(y1);
            result.push(x2);
            result.push(y2);
        }
    }
    
    result
}

/// Combined optimization: dedupe, merge colinear, trim small
#[wasm_bindgen]
pub fn optimize_segments(segments: &[f64], trim_small: bool, small_dist: f64, merge_colinear: bool) -> Vec<f64> {
    let mut result = dedupe_segments(segments);
    
    if merge_colinear {
        result = merge_colinear_segments(&result);
    }
    
    if trim_small {
        result = trim_small_segments(&result, small_dist);
    }
    
    result
}

// ============ Hidden Line Processing (ported from hidden-line.js) ============

/// Split edges at all intersection points
/// Input: segments as flat array [ax1, ay1, ax2, ay2, ...]
/// Returns: split segments in same format, plus T-junction flags
#[wasm_bindgen]
pub fn split_edges_at_intersections(segments: &[f64]) -> Vec<f64> {
    let seg_count = segments.len() / 4;
    if seg_count < 2 {
        return segments.to_vec();
    }
    
    let eps = 0.01;
    
    // Store split points for each segment: (t, x, y)
    let mut splits: Vec<Vec<(f64, f64, f64)>> = vec![Vec::new(); seg_count];
    
    // Helper to check if point lies on edge interior
    let point_on_edge_interior = |px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64| -> Option<f64> {
        let dx = bx - ax;
        let dy = by - ay;
        let len_sq = dx * dx + dy * dy;
        if len_sq < 1e-10 {
            return None;
        }
        
        let t = ((px - ax) * dx + (py - ay) * dy) / len_sq;
        if t <= eps || t >= 1.0 - eps {
            return None;
        }
        
        let proj_x = ax + t * dx;
        let proj_y = ay + t * dy;
        let dist_sq = (px - proj_x) * (px - proj_x) + (py - proj_y) * (py - proj_y);
        
        if dist_sq < 1.0 {
            Some(t)
        } else {
            None
        }
    };
    
    // Find all intersections
    for i in 0..seg_count {
        let ax1 = segments[i * 4];
        let ay1 = segments[i * 4 + 1];
        let ax2 = segments[i * 4 + 2];
        let ay2 = segments[i * 4 + 3];
        
        for j in (i + 1)..seg_count {
            let bx1 = segments[j * 4];
            let by1 = segments[j * 4 + 1];
            let bx2 = segments[j * 4 + 2];
            let by2 = segments[j * 4 + 3];
            
            // Check for crossing intersection
            let isect = segment_intersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2);
            if isect.len() == 4 {
                let ix = isect[0];
                let iy = isect[1];
                let t1 = isect[2];
                let t2 = isect[3];
                
                splits[i].push((t1, ix, iy));
                splits[j].push((t2, ix, iy));
            } else {
                // Check for T-junctions
                if let Some(t) = point_on_edge_interior(ax1, ay1, bx1, by1, bx2, by2) {
                    splits[j].push((t, ax1, ay1));
                }
                if let Some(t) = point_on_edge_interior(ax2, ay2, bx1, by1, bx2, by2) {
                    splits[j].push((t, ax2, ay2));
                }
                if let Some(t) = point_on_edge_interior(bx1, by1, ax1, ay1, ax2, ay2) {
                    splits[i].push((t, bx1, by1));
                }
                if let Some(t) = point_on_edge_interior(bx2, by2, ax1, ay1, ax2, ay2) {
                    splits[i].push((t, bx2, by2));
                }
            }
        }
    }
    
    // Create split segments
    let mut result = Vec::new();
    
    for i in 0..seg_count {
        let ax1 = segments[i * 4];
        let ay1 = segments[i * 4 + 1];
        let ax2 = segments[i * 4 + 2];
        let ay2 = segments[i * 4 + 3];
        
        let mut edge_splits = splits[i].clone();
        if edge_splits.is_empty() {
            result.push(ax1);
            result.push(ay1);
            result.push(ax2);
            result.push(ay2);
            continue;
        }
        
        // Sort by t
        edge_splits.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        
        // Create sub-segments
        let mut prev_x = ax1;
        let mut prev_y = ay1;
        
        for (_, sx, sy) in &edge_splits {
            result.push(prev_x);
            result.push(prev_y);
            result.push(*sx);
            result.push(*sy);
            prev_x = *sx;
            prev_y = *sy;
        }
        
        // Final segment
        result.push(prev_x);
        result.push(prev_y);
        result.push(ax2);
        result.push(ay2);
    }
    
    result
}

/// Test edge visibility using point-in-triangle + depth comparison
/// Edges: [ax, ay, ax3d_depth, bx, by, bx3d_depth, ...] (6 floats per edge)
/// Faces: [ax, ay, a_depth, bx, by, b_depth, cx, cy, c_depth, mesh_id, face_id, ...] (11 floats per face)
/// Returns: indices of visible edges
#[wasm_bindgen]
pub fn test_occlusion_math(edges: &[f64], faces: &[f64], edge_mesh_face: &[f64]) -> Vec<f64> {
    let edge_count = edges.len() / 6;
    let face_count = faces.len() / 11;
    let mut visible = Vec::new();
    
    for i in 0..edge_count {
        let ax = edges[i * 6];
        let ay = edges[i * 6 + 1];
        let a_depth = edges[i * 6 + 2];
        let bx = edges[i * 6 + 3];
        let by = edges[i * 6 + 4];
        let b_depth = edges[i * 6 + 5];
        
        let mid_x = (ax + bx) / 2.0;
        let mid_y = (ay + by) / 2.0;
        let edge_depth = (a_depth + b_depth) / 2.0;
        
        // Get edge's mesh and face IDs (3 values per edge: mesh_id, face_id, face_id2)
        let edge_mesh_id = if i * 3 + 2 < edge_mesh_face.len() {
            edge_mesh_face[i * 3] as i32
        } else {
            -1
        };
        let edge_face_id = if i * 3 + 2 < edge_mesh_face.len() {
            edge_mesh_face[i * 3 + 1] as i32
        } else {
            -1
        };
        let edge_face_id2 = if i * 3 + 2 < edge_mesh_face.len() {
            edge_mesh_face[i * 3 + 2] as i32
        } else {
            -1
        };
        
        let mut occluded = false;
        
        for j in 0..face_count {
            let fax = faces[j * 11];
            let fay = faces[j * 11 + 1];
            let fa_depth = faces[j * 11 + 2];
            let fbx = faces[j * 11 + 3];
            let fby = faces[j * 11 + 4];
            let fb_depth = faces[j * 11 + 5];
            let fcx = faces[j * 11 + 6];
            let fcy = faces[j * 11 + 7];
            let fc_depth = faces[j * 11 + 8];
            let face_mesh_id = faces[j * 11 + 9] as i32;
            let face_face_id = faces[j * 11 + 10] as i32;
            
            // Skip if this is one of the edge's parent faces (check both)
            if edge_mesh_id == face_mesh_id && 
               (edge_face_id == face_face_id || edge_face_id2 == face_face_id) {
                continue;
            }
            
            // Point-in-triangle test
            if !point_in_triangle(mid_x, mid_y, fax, fay, fbx, fby, fcx, fcy) {
                continue;
            }
            
            // Compute depth at midpoint using barycentric interpolation
            let face_depth = barycentric_depth(
                mid_x, mid_y,
                fax, fay, fbx, fby, fcx, fcy,
                fa_depth, fb_depth, fc_depth
            );
            
            // If face is closer, edge is occluded
            if face_depth < edge_depth - 0.001 {
                occluded = true;
                break;
            }
        }
        
        if !occluded {
            visible.push(i as f64);
        }
    }
    
    visible
}

/// Compute depth at a point inside a triangle using barycentric interpolation
fn barycentric_depth(
    px: f64, py: f64,
    ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64,
    depth_a: f64, depth_b: f64, depth_c: f64
) -> f64 {
    let v0x = cx - ax;
    let v0y = cy - ay;
    let v1x = bx - ax;
    let v1y = by - ay;
    let v2x = px - ax;
    let v2y = py - ay;
    
    let dot00 = v0x * v0x + v0y * v0y;
    let dot01 = v0x * v1x + v0y * v1y;
    let dot02 = v0x * v2x + v0y * v2y;
    let dot11 = v1x * v1x + v1y * v1y;
    let dot12 = v1x * v2x + v1y * v2y;
    
    let inv_denom = 1.0 / (dot00 * dot11 - dot01 * dot01);
    let u = (dot11 * dot02 - dot01 * dot12) * inv_denom;
    let v = (dot00 * dot12 - dot01 * dot02) * inv_denom;
    let w = 1.0 - u - v;
    
    w * depth_a + v * depth_b + u * depth_c
}

// ============ Slicer (ported from slicer.js) ============

/// Check if edge intersects plane, return intersection t-parameter
/// Returns Some(t) where 0 < t < 1 if intersection exists
fn edge_plane_intersect_t(d1: f64, d2: f64, plane_d: f64) -> Option<f64> {
    // Check if points are on opposite sides of plane
    if (d1 < plane_d && d2 > plane_d) || (d1 > plane_d && d2 < plane_d) {
        let t = (plane_d - d1) / (d2 - d1);
        Some(t)
    } else {
        None
    }
}

/// Slice a batch of triangles with a plane normal
/// Input triangles: [v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, ...] (9 floats per triangle)
/// Normal: [nx, ny, nz]
/// Returns: intersection segments [ax, ay, az, bx, by, bz, face_idx, ...] (7 floats per segment)
#[wasm_bindgen]
pub fn slice_triangles(triangles: &[f64], normal: &[f64], spacing: f64, offset: f64) -> Vec<f64> {
    let tri_count = triangles.len() / 9;
    if tri_count == 0 || normal.len() < 3 {
        return Vec::new();
    }
    
    let nx = normal[0];
    let ny = normal[1];
    let nz = normal[2];
    
    let mut result = Vec::new();
    
    for f in 0..tri_count {
        let base = f * 9;
        let v0x = triangles[base];
        let v0y = triangles[base + 1];
        let v0z = triangles[base + 2];
        let v1x = triangles[base + 3];
        let v1y = triangles[base + 4];
        let v1z = triangles[base + 5];
        let v2x = triangles[base + 6];
        let v2y = triangles[base + 7];
        let v2z = triangles[base + 8];
        
        // Project vertices onto plane normal (dot product)
        let d0 = v0x * nx + v0y * ny + v0z * nz;
        let d1 = v1x * nx + v1y * ny + v1z * nz;
        let d2 = v2x * nx + v2y * ny + v2z * nz;
        
        let min_d = d0.min(d1).min(d2);
        let max_d = d0.max(d1).max(d2);
        
        // Determine which planes intersect this face
        let start_plane = ((min_d - offset) / spacing).ceil() as i32;
        let end_plane = ((max_d - offset) / spacing).floor() as i32;
        
        for plane_idx in start_plane..=end_plane {
            let plane_d = (plane_idx as f64) * spacing + offset;
            
            let mut intersections = Vec::with_capacity(2);
            
            // Check edge v0-v1
            if let Some(t) = edge_plane_intersect_t(d0, d1, plane_d) {
                let ix = v0x + t * (v1x - v0x);
                let iy = v0y + t * (v1y - v0y);
                let iz = v0z + t * (v1z - v0z);
                intersections.push((ix, iy, iz));
            }
            
            // Check edge v1-v2
            if let Some(t) = edge_plane_intersect_t(d1, d2, plane_d) {
                let ix = v1x + t * (v2x - v1x);
                let iy = v1y + t * (v2y - v1y);
                let iz = v1z + t * (v2z - v1z);
                intersections.push((ix, iy, iz));
            }
            
            // Check edge v2-v0
            if let Some(t) = edge_plane_intersect_t(d2, d0, plane_d) {
                let ix = v2x + t * (v0x - v2x);
                let iy = v2y + t * (v0y - v2y);
                let iz = v2z + t * (v0z - v2z);
                intersections.push((ix, iy, iz));
            }
            
            if intersections.len() == 2 {
                // Output segment: ax, ay, az, bx, by, bz, face_idx
                result.push(intersections[0].0);
                result.push(intersections[0].1);
                result.push(intersections[0].2);
                result.push(intersections[1].0);
                result.push(intersections[1].1);
                result.push(intersections[1].2);
                result.push(f as f64);
            }
        }
    }
    
    result
}

// ============ Internal helpers ============

/// Convert flat point array to contour
fn flat_to_contour(points: &[f64]) -> Contour {
    points
        .chunks(2)
        .filter_map(|chunk| {
            if chunk.len() == 2 {
                Some([chunk[0], chunk[1]])
            } else {
                None
            }
        })
        .collect()
}

/// Convert shapes to flat segment array
fn shapes_to_segments(shapes: &[Shape]) -> Vec<f64> {
    let mut segments = Vec::new();
    for shape in shapes {
        shape_to_segments_into(shape, &mut segments);
    }
    segments
}

/// Convert single shape to segments
fn shape_to_segments(shape: &Shape) -> Vec<f64> {
    let mut segments = Vec::new();
    shape_to_segments_into(shape, &mut segments);
    segments
}

/// Convert shape to segments, appending to output
fn shape_to_segments_into(shape: &Shape, out: &mut Vec<f64>) {
    for contour in shape {
        if contour.len() < 2 {
            continue;
        }
        for i in 0..contour.len() {
            let p1 = &contour[i];
            let p2 = &contour[(i + 1) % contour.len()];
            out.push(p1[0]);
            out.push(p1[1]);
            out.push(p2[0]);
            out.push(p2[1]);
        }
    }
}

// =============================================================================
// HIDDEN LINE PROCESSOR - Full pipeline in WASM
// =============================================================================

/// Edge type for classification in output
const EDGE_SILHOUETTE: f32 = 0.0;
const EDGE_CREASE: f32 = 1.0;
const EDGE_HATCH: f32 = 2.0;

/// A processor for hidden line removal.
/// Receives mesh geometry and camera, computes visible edges entirely in WASM.
#[wasm_bindgen]
pub struct HiddenLineProcessor {
    // Geometry: vertices as [x,y,z, x,y,z, ...]
    vertices: Vec<f32>,
    // Triangle indices as [i0,i1,i2, ...]
    indices: Vec<u32>,
    // Per-mesh ranges in indices array: [start0, count0, start1, count1, ...]
    mesh_ranges: Vec<u32>,
    // Camera view-projection matrix (4x4, column-major)
    view_proj: [f32; 16],
    // Camera position in world space
    camera_pos: [f32; 3],
    // Viewport size
    width: f32,
    height: f32,
    // Crease angle threshold (dot product)
    crease_threshold: f32,
    // Hatch line spacing (world units)
    hatch_spacing: f32,
    // Hatch plane normal [x, y, z] (direction of slicing planes)
    hatch_normal: [f32; 3],
}

#[wasm_bindgen]
impl HiddenLineProcessor {
    /// Create a new HiddenLineProcessor
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            indices: Vec::new(),
            mesh_ranges: Vec::new(),
            view_proj: [
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
            camera_pos: [0.0, 0.0, 10.0],
            width: 800.0,
            height: 600.0,
            crease_threshold: 0.99,
            hatch_spacing: 0.1,  // Default hatch spacing
            hatch_normal: [0.0, 1.0, 0.0], // Default: horizontal slices (Y normal)
        }
    }
    
    /// Configure hatch generation
    /// normal: [nx, ny, nz] - direction of slicing planes
    /// spacing: distance between hatch lines (world units)
    #[wasm_bindgen]
    pub fn set_hatch_config(&mut self, normal: &[f32], spacing: f32) {
        if normal.len() >= 3 {
            // Normalize the input normal
            let len = (normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]).sqrt();
            if len > 0.0001 {
                self.hatch_normal = [normal[0] / len, normal[1] / len, normal[2] / len];
            }
        }
        self.hatch_spacing = spacing;
    }
    
    /// Set geometry from flat arrays
    /// vertices: [x,y,z, x,y,z, ...] in world space
    /// indices: [i0,i1,i2, ...] triangle indices
    /// mesh_ranges: [start0, count0, start1, count1, ...] per-mesh index ranges
    #[wasm_bindgen]
    pub fn set_geometry(&mut self, vertices: &[f32], indices: &[u32], mesh_ranges: &[u32]) {
        self.vertices = vertices.to_vec();
        self.indices = indices.to_vec();
        self.mesh_ranges = mesh_ranges.to_vec();
    }
    
    /// Set camera view-projection matrix, position, and viewport
    #[wasm_bindgen]
    pub fn set_camera(&mut self, view_proj: &[f32], camera_pos: &[f32], width: f32, height: f32) {
        if view_proj.len() >= 16 {
            self.view_proj.copy_from_slice(&view_proj[0..16]);
        }
        if camera_pos.len() >= 3 {
            self.camera_pos = [camera_pos[0], camera_pos[1], camera_pos[2]];
        }
        self.width = width;
        self.height = height;
    }
    
    /// Set crease angle threshold (as cosine, 0.0 = 90°, 1.0 = 0°)
    #[wasm_bindgen]
    pub fn set_crease_threshold(&mut self, threshold: f32) {
        self.crease_threshold = threshold;
    }
    
    /// Compute visible edges
    /// Returns flat array: [x1, y1, x2, y2, type, x1, y1, x2, y2, type, ...]
    /// where type is 0=silhouette, 1=crease, 2=hatch
    #[wasm_bindgen]
    pub fn compute(&self) -> Vec<f32> {
        use web_sys::console;
        
        if self.vertices.is_empty() || self.indices.is_empty() {
            return Vec::new();
        }
        
        // Step 1: Project all vertices to 2D
        let projected = self.project_vertices();
        console::log_1(&format!("WASM Step 1: {} vertices projected", projected.len()).into());
        
        // Step 2: Extract edges with adjacency info
        let edges = self.extract_edges();
        console::log_1(&format!("WASM Step 2: {} raw edges extracted", edges.len()).into());
        
        // Step 3: Classify edges (silhouette, crease, interior)
        let classified = self.classify_edges(&edges, &projected);
        console::log_1(&format!("WASM Step 3: {} edges after classification (interior filtered)", classified.len()).into());
        
        // Step 4: Build spatial hash for O(1) neighbor lookup
        let hash = SpatialHash::new(&classified, 50.0);
        
        // Step 5: Generate hatch lines from geometry (disabled for debugging)
        const HATCHING_ENABLED: bool = false;
        let mut all_edges = classified;
        if HATCHING_ENABLED {
            let hatch_edges = self.generate_hatches(&projected);
            all_edges.extend(hatch_edges);
        }
        
        // Step 7: Find intersections and split edges
        let split_edges = self.split_at_intersections(&all_edges, &hash);
        console::log_1(&format!("WASM Step 7: {} edges after splitting", split_edges.len()).into());
        
        // Step 7.5: Filter out coplanar straggler edges
        let filtered_edges = self.filter_coplanar_stragglers(&split_edges, &projected);
        console::log_1(&format!("WASM Step 7.5: {} edges after straggler filter", filtered_edges.len()).into());
        
        // Step 8: Test occlusion for each edge
        let visible = self.test_occlusion(&filtered_edges, &projected);
        console::log_1(&format!("WASM Step 8: {} visible edge values (5 per edge)", visible.len()).into());
        
        // Step 9: Output visible edges
        visible
    }
    
    /// Filter out edges that lie between coplanar faces (straggler edges)
    fn filter_coplanar_stragglers(&self, edges: &[ClassifiedEdge], projected: &[[f32; 3]]) -> Vec<ClassifiedEdge> {
        use web_sys::console;
        
        let num_tris = self.indices.len() / 3;
        let mut result = Vec::new();
        let coplanar_threshold = 0.99_f32;
        let distance_threshold = 0.5_f32;
        let mut removed_count = 0;
        let mut edges_with_2plus_faces = 0;
        let mut edges_with_0_or_1_faces = 0;
        
        for edge in edges {
            // Find all faces that this edge lies along (geometrically)
            // CRITICAL: Only consider FRONT-FACING faces (matches JS projectedFaces filter)
            let mut adjacent_faces: Vec<u32> = Vec::new();
            
            for tri in 0..num_tris {
                // First check if face is front-facing (like JS line 1994)
                let face_normal = self.face_normal(tri as u32);
                
                // Get face center for view direction
                let i0 = self.indices[tri * 3] as usize;
                let i1 = self.indices[tri * 3 + 1] as usize;
                let i2 = self.indices[tri * 3 + 2] as usize;
                
                let center_x = (self.vertices[i0 * 3] + self.vertices[i1 * 3] + self.vertices[i2 * 3]) / 3.0;
                let center_y = (self.vertices[i0 * 3 + 1] + self.vertices[i1 * 3 + 1] + self.vertices[i2 * 3 + 1]) / 3.0;
                let center_z = (self.vertices[i0 * 3 + 2] + self.vertices[i1 * 3 + 2] + self.vertices[i2 * 3 + 2]) / 3.0;
                
                // View direction from face center to camera
                let view_x = self.camera_pos[0] - center_x;
                let view_y = self.camera_pos[1] - center_y;
                let view_z = self.camera_pos[2] - center_z;
                
                // Check if front-facing (normal.dot(viewDir) > 0)
                let dot_view = face_normal.0 * view_x + face_normal.1 * view_y + face_normal.2 * view_z;
                if dot_view <= 0.0 {
                    continue; // Skip back-facing faces (matches JS)
                }
                
                let p0 = &projected[i0];
                let p1 = &projected[i1];
                let p2 = &projected[i2];
                
                // Check if edge lies along any triangle edge
                if Self::edge_lies_along_triangle_edge(
                    edge.x1, edge.y1, edge.x2, edge.y2,
                    p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]
                ) {
                    adjacent_faces.push(tri as u32);
                }
            }
            
            // Check if all adjacent faces are coplanar
            let mut should_remove = false;
            if adjacent_faces.len() >= 2 {
                edges_with_2plus_faces += 1;
                let n0 = self.face_normal(adjacent_faces[0]);
                let c0 = self.face_plane_constant(adjacent_faces[0]);
                let mut all_coplanar = true;
                
                for i in 1..adjacent_faces.len() {
                    let ni = self.face_normal(adjacent_faces[i]);
                    let ci = self.face_plane_constant(adjacent_faces[i]);
                    
                    // Check normal similarity
                    let dot = n0.0 * ni.0 + n0.1 * ni.1 + n0.2 * ni.2;
                    let similarity = dot.abs();
                    
                    // Check plane distance
                    let dist_diff = if dot > 0.0 { 
                        (c0 - ci).abs() 
                    } else { 
                        (c0 + ci).abs() 
                    };
                    
                    if similarity < coplanar_threshold || dist_diff >= distance_threshold {
                        all_coplanar = false;
                        break;
                    }
                }
                
                if all_coplanar {
                    should_remove = true;
                    removed_count += 1;
                }
            } else {
                edges_with_0_or_1_faces += 1;
            }
            
            if !should_remove {
                result.push(edge.clone());
            }
        }
        
        // Log summary to browser console
        console::log_1(&format!(
            "WASM straggler filter: {} edges, {} with 2+ adj faces, {} with 0-1 faces, {} removed",
            edges.len(), edges_with_2plus_faces, edges_with_0_or_1_faces, removed_count
        ).into());
        
        result
    }
    
    /// Check if an edge lies along one of the triangle's edges
    fn edge_lies_along_triangle_edge(
        ex1: f32, ey1: f32, ex2: f32, ey2: f32,
        ax: f32, ay: f32, bx: f32, by: f32, cx: f32, cy: f32
    ) -> bool {
        // Check if edge lies along AB, BC, or CA
        Self::edges_collinear(ex1, ey1, ex2, ey2, ax, ay, bx, by) ||
        Self::edges_collinear(ex1, ey1, ex2, ey2, bx, by, cx, cy) ||
        Self::edges_collinear(ex1, ey1, ex2, ey2, cx, cy, ax, ay)
    }
    
    /// Check if two edges are collinear and overlapping (matches JS edgeLiesAlongFaceEdge)
    fn edges_collinear(
        ax1: f32, ay1: f32, ax2: f32, ay2: f32,
        bx1: f32, by1: f32, bx2: f32, by2: f32
    ) -> bool {
        // Match JS tolerance of 2.0 pixels, scaled by internal scale factor
        let tolerance = 2.0_f32 * INTERNAL_SCALE;
        
        // Direction of segment B (the face edge)
        let dx = bx2 - bx1;
        let dy = by2 - by1;
        let len_sq = dx * dx + dy * dy;
        if len_sq < 1e-10 { return false; } // Degenerate face edge
        
        // Project and check function (matches JS projectAndCheck)
        let project_and_check = |px: f32, py: f32| -> bool {
            // Project p onto line defined by b1->b2
            let t = ((px - bx1) * dx + (py - by1) * dy) / len_sq;
            
            // Projected point
            let proj_x = bx1 + t * dx;
            let proj_y = by1 + t * dy;
            
            // Distance from p to projected point
            let dist_sq = (px - proj_x) * (px - proj_x) + (py - proj_y) * (py - proj_y);
            
            // Check if close to line and within segment (with small margin) - matches JS
            dist_sq < tolerance * tolerance && t >= -0.01 && t <= 1.01
        };
        
        // Both edge endpoints must lie along the face edge
        project_and_check(ax1, ay1) && project_and_check(ax2, ay2)
    }
    
    /// Compute plane constant for a face (d in ax + by + cz + d = 0)
    /// Matches JS: d = -normal.dot(v0)
    fn face_plane_constant(&self, face_idx: u32) -> f32 {
        let base = (face_idx as usize) * 3;
        if base + 2 >= self.indices.len() {
            return 0.0;
        }
        
        let i0 = self.indices[base] as usize;
        let v0x = self.vertices[i0 * 3];
        let v0y = self.vertices[i0 * 3 + 1];
        let v0z = self.vertices[i0 * 3 + 2];
        
        let n = self.face_normal(face_idx);
        // Match JS: d = -normal.dot(v0)
        -(n.0 * v0x + n.1 * v0y + n.2 * v0z)
    }
    
    /// Generate hatch lines by slicing triangles with parallel planes
    fn generate_hatches(&self, _projected: &[[f32; 3]]) -> Vec<ClassifiedEdge> {
        let mut hatches = Vec::new();
        let n = self.hatch_normal;
        let spacing = self.hatch_spacing;
        
        if spacing <= 0.0 {
            return hatches;
        }
        
        // Process each triangle
        let num_tris = self.indices.len() / 3;
        for tri in 0..num_tris {
            let i0 = self.indices[tri * 3] as usize;
            let i1 = self.indices[tri * 3 + 1] as usize;
            let i2 = self.indices[tri * 3 + 2] as usize;
            
            // Get 3D vertices
            let v0 = (self.vertices[i0 * 3], self.vertices[i0 * 3 + 1], self.vertices[i0 * 3 + 2]);
            let v1 = (self.vertices[i1 * 3], self.vertices[i1 * 3 + 1], self.vertices[i1 * 3 + 2]);
            let v2 = (self.vertices[i2 * 3], self.vertices[i2 * 3 + 1], self.vertices[i2 * 3 + 2]);
            
            // Compute face normal for front-face culling
            let e1 = (v1.0 - v0.0, v1.1 - v0.1, v1.2 - v0.2);
            let e2 = (v2.0 - v0.0, v2.1 - v0.1, v2.2 - v0.2);
            let fn_x = e1.1 * e2.2 - e1.2 * e2.1;
            let fn_y = e1.2 * e2.0 - e1.0 * e2.2;
            let fn_z = e1.0 * e2.1 - e1.1 * e2.0;
            
            // Check if face is front-facing
            let center = ((v0.0 + v1.0 + v2.0) / 3.0, (v0.1 + v1.1 + v2.1) / 3.0, (v0.2 + v1.2 + v2.2) / 3.0);
            let view_dir = (
                self.camera_pos[0] - center.0,
                self.camera_pos[1] - center.1,
                self.camera_pos[2] - center.2,
            );
            let dot_view = fn_x * view_dir.0 + fn_y * view_dir.1 + fn_z * view_dir.2;
            if dot_view <= 0.0 {
                continue; // Back-facing, skip hatching
            }
            
            // Project vertices onto slice plane normal
            let d0 = v0.0 * n[0] + v0.1 * n[1] + v0.2 * n[2];
            let d1 = v1.0 * n[0] + v1.1 * n[1] + v1.2 * n[2];
            let d2 = v2.0 * n[0] + v2.1 * n[1] + v2.2 * n[2];
            
            let min_d = d0.min(d1).min(d2);
            let max_d = d0.max(d1).max(d2);
            
            // Find which slice planes intersect this triangle
            let start_plane = (min_d / spacing).ceil() as i32;
            let end_plane = (max_d / spacing).floor() as i32;
            
            for plane_idx in start_plane..=end_plane {
                // Add tiny offset to avoid exactly hitting vertices
                let plane_d = (plane_idx as f32) * spacing + 0.0001;
                
                // Find intersection points of each edge with the plane
                let mut intersections = Vec::new();
                
                // Edge v0-v1
                Self::edge_plane_intersection(v0, v1, d0, d1, plane_d, &mut intersections);
                // Edge v1-v2
                Self::edge_plane_intersection(v1, v2, d1, d2, plane_d, &mut intersections);
                // Edge v2-v0
                Self::edge_plane_intersection(v2, v0, d2, d0, plane_d, &mut intersections);
                
                if intersections.len() == 2 {
                    let p0 = &intersections[0];
                    let p1 = &intersections[1];
                    
                    // Project 3D hatch endpoints to 2D
                    let proj0 = self.project_point(p0.0, p0.1, p0.2);
                    let proj1 = self.project_point(p1.0, p1.1, p1.2);
                    
                    hatches.push(ClassifiedEdge {
                        x1: proj0.0, y1: proj0.1, depth1: proj0.2,
                        x2: proj1.0, y2: proj1.1, depth2: proj1.2,
                        edge_type: EdgeType::Hatch,
                        face1: tri as u32,
                        face2: None,
                        mesh_idx: 0,
                    });
                }
            }
        }
        
        hatches
    }
    
    /// Find intersection of an edge with a plane (d = plane_d)
    fn edge_plane_intersection(
        v0: (f32, f32, f32), v1: (f32, f32, f32),
        d0: f32, d1: f32, plane_d: f32,
        out: &mut Vec<(f32, f32, f32)>
    ) {
        // Check if edge crosses plane
        if (d0 < plane_d && d1 > plane_d) || (d0 > plane_d && d1 < plane_d) {
            let t = (plane_d - d0) / (d1 - d0);
            let px = v0.0 + t * (v1.0 - v0.0);
            let py = v0.1 + t * (v1.1 - v0.1);
            let pz = v0.2 + t * (v1.2 - v0.2);
            out.push((px, py, pz));
        }
    }
    
    /// Project a single 3D point to 2D screen coordinates with depth
    fn project_point(&self, x: f32, y: f32, z: f32) -> (f32, f32, f32) {
        let half_w = self.width / 2.0;
        let half_h = self.height / 2.0;
        let m = &self.view_proj;
        
        let clip_x = m[0] * x + m[4] * y + m[8] * z + m[12];
        let clip_y = m[1] * x + m[5] * y + m[9] * z + m[13];
        let clip_z = m[2] * x + m[6] * y + m[10] * z + m[14];
        let clip_w = m[3] * x + m[7] * y + m[11] * z + m[15];
        
        if clip_w.abs() > 0.0001 {
            let ndc_x = clip_x / clip_w;
            let ndc_y = clip_y / clip_w;
            let ndc_z = clip_z / clip_w;
            (ndc_x * half_w, -ndc_y * half_h, ndc_z)
        } else {
            (0.0, 0.0, 1.0)
        }
    }
    
    /// Project all 3D vertices to 2D screen coordinates
    fn project_vertices(&self) -> Vec<[f32; 3]> {

        
        let mut result = Vec::with_capacity(self.vertices.len() / 3);
        let half_w = self.width / 2.0;
        let half_h = self.height / 2.0;
        
        for i in (0..self.vertices.len()).step_by(3) {
            let x = self.vertices[i];
            let y = self.vertices[i + 1];
            let z = self.vertices[i + 2];
            
            // Apply view-projection matrix
            let m = &self.view_proj;
            let clip_x = m[0] * x + m[4] * y + m[8] * z + m[12];
            let clip_y = m[1] * x + m[5] * y + m[9] * z + m[13];
            let clip_w = m[3] * x + m[7] * y + m[11] * z + m[15];
            
            // Perspective divide
            let ndc_x = clip_x / clip_w;
            let ndc_y = clip_y / clip_w;
            
            // Compute depth as distance from camera (like JS version)
            let dx = x - self.camera_pos[0];
            let dy = y - self.camera_pos[1];
            let dz = z - self.camera_pos[2];
            let depth = (dx * dx + dy * dy + dz * dz).sqrt();
            
            // Screen coordinates with internal scale for precision
            let screen_x = ndc_x * half_w * INTERNAL_SCALE;
            let screen_y = -ndc_y * half_h * INTERNAL_SCALE; // Flip Y for screen space
            
            result.push([screen_x, screen_y, depth]);
        }
        
        result
    }
    
    /// Extract unique edges from triangles with adjacency info
    fn extract_edges(&self) -> Vec<Edge> {
        use std::collections::HashMap;
        
        let mut edge_map: HashMap<(u32, u32), Edge> = HashMap::new();
        
        for mesh_idx in (0..self.mesh_ranges.len()).step_by(2) {
            let start = self.mesh_ranges[mesh_idx] as usize;
            let count = self.mesh_ranges[mesh_idx + 1] as usize;
            
            for tri in (start..start + count).step_by(3) {
                if tri + 2 >= self.indices.len() {
                    break;
                }
                let i0 = self.indices[tri];
                let i1 = self.indices[tri + 1];
                let i2 = self.indices[tri + 2];
                let face_idx = (tri / 3) as u32;
                
                // Add three edges
                for &(a, b) in &[(i0, i1), (i1, i2), (i2, i0)] {
                    let key = if a < b { (a, b) } else { (b, a) };
                    edge_map.entry(key)
                        .and_modify(|e| e.face2 = Some(face_idx))
                        .or_insert(Edge {
                            v0: a,
                            v1: b,
                            face1: face_idx,
                            face2: None,
                            mesh_idx: (mesh_idx / 2) as u32,
                        });
                }
            }
        }
        
        edge_map.into_values().collect()
    }
    
    /// Classify edges as silhouette, crease, or interior
    fn classify_edges(&self, edges: &[Edge], projected: &[[f32; 3]]) -> Vec<ClassifiedEdge> {
        let mut result = Vec::with_capacity(edges.len());
        
        for edge in edges {
            let p0 = &projected[edge.v0 as usize];
            let p1 = &projected[edge.v1 as usize];
            
            // Compute view direction from edge midpoint to camera
            let i0 = edge.v0 as usize;
            let i1 = edge.v1 as usize;
            let mid_x = (self.vertices[i0 * 3] + self.vertices[i1 * 3]) / 2.0;
            let mid_y = (self.vertices[i0 * 3 + 1] + self.vertices[i1 * 3 + 1]) / 2.0;
            let mid_z = (self.vertices[i0 * 3 + 2] + self.vertices[i1 * 3 + 2]) / 2.0;
            
            let view_x = self.camera_pos[0] - mid_x;
            let view_y = self.camera_pos[1] - mid_y;
            let view_z = self.camera_pos[2] - mid_z;
            let view_len = (view_x * view_x + view_y * view_y + view_z * view_z).sqrt();
            let cam_dir = if view_len > 0.0001 {
                (view_x / view_len, view_y / view_len, view_z / view_len)
            } else {
                (0.0, 0.0, 1.0)
            };
            
            // Compute face normals and facing
            let n1 = self.face_normal(edge.face1);
            let dot1 = n1.0 * cam_dir.0 + n1.1 * cam_dir.1 + n1.2 * cam_dir.2;
            let face1_front = dot1 > 0.0;
            
            let edge_type = if let Some(face2) = edge.face2 {
                let n2 = self.face_normal(face2);
                let dot2 = n2.0 * cam_dir.0 + n2.1 * cam_dir.1 + n2.2 * cam_dir.2;
                let face2_front = dot2 > 0.0;
                let dot = n1.0 * n2.0 + n1.1 * n2.1 + n1.2 * n2.2;
                
                if !face1_front && !face2_front {
                    // Both faces back-facing: skip edge entirely
                    EdgeType::Interior
                } else if face1_front != face2_front {
                    // One front, one back: visible edge
                    EdgeType::Crease
                } else if dot < self.crease_threshold {
                    // Both front-facing but with a crease: visible edge
                    EdgeType::Crease
                } else {
                    // Both front-facing and smooth
                    EdgeType::Interior
                }
            } else {
                // Boundary edge (only one face) - vertex merging didn't find the neighbor
                // BUT this is still a real crease edge if the face is front-facing
                if face1_front {
                    EdgeType::Crease
                } else {
                    EdgeType::Interior
                }
            };
            
            // Skip interior edges
            if matches!(edge_type, EdgeType::Interior) {
                continue;
            }
            
            result.push(ClassifiedEdge {
                x1: p0[0], y1: p0[1], depth1: p0[2],
                x2: p1[0], y2: p1[1], depth2: p1[2],
                edge_type,
                face1: edge.face1,
                face2: edge.face2,
                mesh_idx: edge.mesh_idx,
            });
        }
        
        result
    }
    
    /// Compute face normal from triangle indices
    fn face_normal(&self, face_idx: u32) -> (f32, f32, f32) {
        let base = (face_idx as usize) * 3;
        if base + 2 >= self.indices.len() {
            return (0.0, 0.0, 1.0);
        }
        
        let i0 = self.indices[base] as usize;
        let i1 = self.indices[base + 1] as usize;
        let i2 = self.indices[base + 2] as usize;
        
        let v0 = (
            self.vertices[i0 * 3],
            self.vertices[i0 * 3 + 1],
            self.vertices[i0 * 3 + 2],
        );
        let v1 = (
            self.vertices[i1 * 3],
            self.vertices[i1 * 3 + 1],
            self.vertices[i1 * 3 + 2],
        );
        let v2 = (
            self.vertices[i2 * 3],
            self.vertices[i2 * 3 + 1],
            self.vertices[i2 * 3 + 2],
        );
        
        // Edge vectors
        let e1 = (v1.0 - v0.0, v1.1 - v0.1, v1.2 - v0.2);
        let e2 = (v2.0 - v0.0, v2.1 - v0.1, v2.2 - v0.2);
        
        // Cross product
        let nx = e1.1 * e2.2 - e1.2 * e2.1;
        let ny = e1.2 * e2.0 - e1.0 * e2.2;
        let nz = e1.0 * e2.1 - e1.1 * e2.0;
        
        // Normalize
        let len = (nx * nx + ny * ny + nz * nz).sqrt();
        if len > 0.0001 {
            (nx / len, ny / len, nz / len)
        } else {
            (0.0, 0.0, 1.0)
        }
    }
    
    /// Split edges at intersections with other edges (including T-junctions)
    fn split_at_intersections(&self, edges: &[ClassifiedEdge], _hash: &SpatialHash) -> Vec<ClassifiedEdge> {
        let mut result = Vec::with_capacity(edges.len() * 2);
        
        // For each edge, collect all intersection t-values
        for (i, edge) in edges.iter().enumerate() {
            let mut t_values: Vec<f32> = vec![0.0, 1.0]; // Start and end
            
            // Check against all other edges for intersections
            for (j, other) in edges.iter().enumerate() {
                if i == j { continue; }
                
                // 1. Check for crossing intersection
                if let Some((t, _u)) = Self::segment_intersection_2d(
                    edge.x1, edge.y1, edge.x2, edge.y2,
                    other.x1, other.y1, other.x2, other.y2,
                ) {
                    // Only add if intersection is strictly inside this edge
                    if t > 0.001 && t < 0.999 {
                        t_values.push(t);
                    }
                }
                
                // 2. Check for T-junctions: other's endpoints on this edge's interior
                // This detects when another edge ends/starts in the middle of this edge
                if let Some(t) = Self::point_on_edge_interior(
                    other.x1, other.y1,
                    edge.x1, edge.y1, edge.x2, edge.y2
                ) {
                    t_values.push(t);
                }
                if let Some(t) = Self::point_on_edge_interior(
                    other.x2, other.y2,
                    edge.x1, edge.y1, edge.x2, edge.y2
                ) {
                    t_values.push(t);
                }
            }
            
            // Sort t values and remove duplicates
            t_values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            t_values.dedup_by(|a, b| (*a - *b).abs() < 0.001);
            
            // Create edge segments between consecutive t values
            for k in 0..t_values.len() - 1 {
                let t0 = t_values[k];
                let t1 = t_values[k + 1];
                
                // Skip very small segments
                if t1 - t0 < 0.001 { continue; }
                
                // Interpolate endpoints
                let x1 = edge.x1 + t0 * (edge.x2 - edge.x1);
                let y1 = edge.y1 + t0 * (edge.y2 - edge.y1);
                let d1 = edge.depth1 + t0 * (edge.depth2 - edge.depth1);
                
                let x2 = edge.x1 + t1 * (edge.x2 - edge.x1);
                let y2 = edge.y1 + t1 * (edge.y2 - edge.y1);
                let d2 = edge.depth1 + t1 * (edge.depth2 - edge.depth1);
                
                result.push(ClassifiedEdge {
                    x1, y1, depth1: d1,
                    x2, y2, depth2: d2,
                    edge_type: edge.edge_type.clone(),
                    face1: edge.face1,
                    face2: edge.face2,
                    mesh_idx: edge.mesh_idx,
                });
            }
        }
        
        result
    }
    
    /// Check if point (px,py) lies on edge interior (not endpoints)
    /// Returns Some(t) parameter if on edge interior, None otherwise
    fn point_on_edge_interior(px: f32, py: f32, ex1: f32, ey1: f32, ex2: f32, ey2: f32) -> Option<f32> {
        let dx = ex2 - ex1;
        let dy = ey2 - ey1;
        let len_sq = dx * dx + dy * dy;
        if len_sq < 1e-10 { return None; } // Degenerate edge
        
        // Project point onto edge line
        let t = ((px - ex1) * dx + (py - ey1) * dy) / len_sq;
        
        // Check if t is in interior (not at endpoints) - matches JS eps = 0.01
        if t <= 0.01 || t >= 0.99 { return None; }
        
        // Check distance from point to projected point on line
        let proj_x = ex1 + t * dx;
        let proj_y = ey1 + t * dy;
        let dist_sq = (px - proj_x) * (px - proj_x) + (py - proj_y) * (py - proj_y);
        
        // 1 pixel tolerance, scaled by INTERNAL_SCALE (matches JS distSq < 1.0)
        let tolerance = 1.0 * INTERNAL_SCALE;
        if dist_sq < tolerance * tolerance {
            Some(t)
        } else {
            None
        }
    }
    
    /// Find 2D segment-segment intersection, returns (t, u) parameters
    fn segment_intersection_2d(
        ax1: f32, ay1: f32, ax2: f32, ay2: f32,
        bx1: f32, by1: f32, bx2: f32, by2: f32,
    ) -> Option<(f32, f32)> {
        let dx1 = ax2 - ax1;
        let dy1 = ay2 - ay1;
        let dx2 = bx2 - bx1;
        let dy2 = by2 - by1;
        
        let denom = dx1 * dy2 - dy1 * dx2;
        if denom.abs() < 0.0001 { return None; } // Parallel
        
        let dx = bx1 - ax1;
        let dy = by1 - ay1;
        
        let t = (dx * dy2 - dy * dx2) / denom;
        let u = (dx * dy1 - dy * dx1) / denom;
        
        // Both t and u must be in [0, 1] for segments to intersect
        if t >= 0.0 && t <= 1.0 && u >= 0.0 && u <= 1.0 {
            Some((t, u))
        } else {
            None
        }
    }
    
    /// Test occlusion for each edge against all triangles
    fn test_occlusion(&self, edges: &[ClassifiedEdge], projected: &[[f32; 3]]) -> Vec<f32> {
        let mut visible = Vec::new();
        let num_tris = self.indices.len() / 3;
        
        for edge in edges {
            // Test edge midpoint
            let mid_x = (edge.x1 + edge.x2) / 2.0;
            let mid_y = (edge.y1 + edge.y2) / 2.0;
            let mid_depth = (edge.depth1 + edge.depth2) / 2.0;
            
            let mut occluded = false;
            
            // Check against all triangles
            for tri in 0..num_tris {
                let i0 = self.indices[tri * 3] as usize;
                let i1 = self.indices[tri * 3 + 1] as usize;
                let i2 = self.indices[tri * 3 + 2] as usize;
                
                // Skip if this triangle is the edge's parent
                if tri as u32 == edge.face1 || Some(tri as u32) == edge.face2 {
                    continue;
                }
                
                let p0 = &projected[i0];
                let p1 = &projected[i1];
                let p2 = &projected[i2];
                
                // Point-in-triangle test
                if !Self::point_in_triangle_2d(mid_x, mid_y, p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]) {
                    continue;
                }
                
                // Compute depth at point using barycentric interpolation
                let tri_depth = Self::barycentric_depth(
                    mid_x, mid_y,
                    p0[0], p0[1], p1[0], p1[1], p2[0], p2[1],
                    p0[2], p1[2], p2[2]
                );
                
                // If triangle is closer, edge is occluded
                // Use relative epsilon (0.1% of depth) for large-scale models
                let epsilon = mid_depth * 0.001;
                if tri_depth < mid_depth - epsilon {
                    occluded = true;
                    break;
                }
            }
            
            if !occluded {

                visible.push(edge.x1 / INTERNAL_SCALE);
                visible.push(edge.y1 / INTERNAL_SCALE);
                visible.push(edge.x2 / INTERNAL_SCALE);
                visible.push(edge.y2 / INTERNAL_SCALE);
                visible.push(match edge.edge_type {
                    EdgeType::Silhouette => EDGE_SILHOUETTE,
                    EdgeType::Crease => EDGE_CREASE,
                    EdgeType::Hatch => EDGE_HATCH,
                    EdgeType::Interior => EDGE_CREASE,
                });
            }
        }
        
        visible
    }
    
    fn point_in_triangle_2d(px: f32, py: f32, ax: f32, ay: f32, bx: f32, by: f32, cx: f32, cy: f32) -> bool {
        let d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
        let d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
        let d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
        
        let has_neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
        let has_pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;
        
        !(has_neg && has_pos)
    }
    
    fn barycentric_depth(
        px: f32, py: f32,
        ax: f32, ay: f32, bx: f32, by: f32, cx: f32, cy: f32,
        da: f32, db: f32, dc: f32
    ) -> f32 {
        let v0x = cx - ax;
        let v0y = cy - ay;
        let v1x = bx - ax;
        let v1y = by - ay;
        let v2x = px - ax;
        let v2y = py - ay;
        
        let dot00 = v0x * v0x + v0y * v0y;
        let dot01 = v0x * v1x + v0y * v1y;
        let dot02 = v0x * v2x + v0y * v2y;
        let dot11 = v1x * v1x + v1y * v1y;
        let dot12 = v1x * v2x + v1y * v2y;
        
        let inv_denom = 1.0 / (dot00 * dot11 - dot01 * dot01);
        let u = (dot11 * dot02 - dot01 * dot12) * inv_denom;
        let v = (dot00 * dot12 - dot01 * dot02) * inv_denom;
        
        da * (1.0 - u - v) + db * v + dc * u
    }
}

// Internal types for HiddenLineProcessor
struct Edge {
    v0: u32,
    v1: u32,
    face1: u32,
    face2: Option<u32>,
    mesh_idx: u32,
}

#[derive(Clone, Copy)]
enum EdgeType {
    Silhouette,
    Crease,
    Interior,
    Hatch,
}

#[derive(Clone)]
struct ClassifiedEdge {
    x1: f32, y1: f32, depth1: f32,
    x2: f32, y2: f32, depth2: f32,
    edge_type: EdgeType,
    face1: u32,
    face2: Option<u32>,
    mesh_idx: u32,
}

/// Simple spatial hash for O(1) neighbor lookup
struct SpatialHash {
    cell_size: f32,
    cells: std::collections::HashMap<(i32, i32), Vec<usize>>,
}

impl SpatialHash {
    fn new(edges: &[ClassifiedEdge], cell_size: f32) -> Self {
        use std::collections::HashMap;
        let mut cells: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
        
        for (i, edge) in edges.iter().enumerate() {
            let min_x = edge.x1.min(edge.x2);
            let max_x = edge.x1.max(edge.x2);
            let min_y = edge.y1.min(edge.y2);
            let max_y = edge.y1.max(edge.y2);
            
            let start_cx = (min_x / cell_size).floor() as i32;
            let end_cx = (max_x / cell_size).floor() as i32;
            let start_cy = (min_y / cell_size).floor() as i32;
            let end_cy = (max_y / cell_size).floor() as i32;
            
            for cx in start_cx..=end_cx {
                for cy in start_cy..=end_cy {
                    cells.entry((cx, cy)).or_default().push(i);
                }
            }
        }
        
        Self { cell_size, cells }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_union_two_squares() {
        // Square 1: (0,0) to (10,10)
        let sq1 = [0.0, 0.0, 10.0, 0.0, 10.0, 10.0, 0.0, 10.0];
        // Square 2: (5,5) to (15,15) - overlapping
        let sq2 = [5.0, 5.0, 15.0, 5.0, 15.0, 15.0, 5.0, 15.0];

        let result = union_polygons(&sq1, &sq2);

        assert!(!result.is_empty());
        assert!(result.len() % 4 == 0);
    }

    #[test]
    fn test_boolean_processor() {
        let mut proc = BooleanProcessor::new();

        proc.add_subject(&[0.0, 0.0, 10.0, 0.0, 10.0, 10.0, 0.0, 10.0]);
        proc.add_clip(&[5.0, 5.0, 15.0, 5.0, 15.0, 15.0, 5.0, 15.0]);

        let result = proc.compute_union();
        assert!(!result.is_empty());
    }

    #[test]
    fn test_difference() {
        let sq1 = [0.0, 0.0, 20.0, 0.0, 20.0, 20.0, 0.0, 20.0];
        let sq2 = [5.0, 5.0, 15.0, 5.0, 15.0, 15.0, 5.0, 15.0];

        let result = difference_polygons(&sq1, &sq2);

        assert!(!result.is_empty());
    }

    // Geometry function tests

    #[test]
    fn test_segment_intersect() {
        // Crossing segments
        let result = segment_intersect(0.0, 0.0, 10.0, 10.0, 0.0, 10.0, 10.0, 0.0);
        assert_eq!(result.len(), 4);
        assert!((result[0] - 5.0).abs() < 0.001);
        assert!((result[1] - 5.0).abs() < 0.001);
        
        // Parallel segments (no intersection)
        let result = segment_intersect(0.0, 0.0, 10.0, 0.0, 0.0, 5.0, 10.0, 5.0);
        assert!(result.is_empty());
        
        // Non-crossing segments
        let result = segment_intersect(0.0, 0.0, 5.0, 0.0, 10.0, 0.0, 15.0, 0.0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_point_in_triangle() {
        // Point inside triangle
        assert!(point_in_triangle(5.0, 5.0, 0.0, 0.0, 10.0, 0.0, 5.0, 10.0));
        
        // Point outside triangle
        assert!(!point_in_triangle(15.0, 5.0, 0.0, 0.0, 10.0, 0.0, 5.0, 10.0));
        
        // Point on edge (still inside for this implementation)
        assert!(point_in_triangle(5.0, 0.0, 0.0, 0.0, 10.0, 0.0, 5.0, 10.0));
    }

    #[test]
    fn test_distance_between() {
        assert!((distance_between(0.0, 0.0, 3.0, 4.0) - 5.0).abs() < 0.001);
        assert!((distance_between(0.0, 0.0, 0.0, 0.0)).abs() < 0.001);
    }

    #[test]
    fn test_closest_point_on_segment() {
        // Point projects to middle
        let result = closest_point_on_segment(5.0, 5.0, 0.0, 0.0, 10.0, 0.0);
        assert!((result[0] - 5.0).abs() < 0.001);
        assert!((result[1] - 0.0).abs() < 0.001);
        
        // Point projects before segment start
        let result = closest_point_on_segment(-5.0, 0.0, 0.0, 0.0, 10.0, 0.0);
        assert!((result[0] - 0.0).abs() < 0.001);
        
        // Point projects after segment end
        let result = closest_point_on_segment(15.0, 0.0, 0.0, 0.0, 10.0, 0.0);
        assert!((result[0] - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_polygon_area() {
        // Unit square (counterclockwise = negative area)
        let ccw_square = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
        assert!((polygon_area(&ccw_square) - (-1.0)).abs() < 0.001);
        
        // Clockwise square (positive area)
        let cw_square = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0];
        assert!((polygon_area(&cw_square) - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_batch_segment_intersections() {
        // Two crossing segments
        let segments = [
            0.0, 0.0, 10.0, 10.0,  // segment 0: diagonal
            0.0, 10.0, 10.0, 0.0,  // segment 1: opposite diagonal
        ];
        let result = batch_segment_intersections(&segments);
        assert_eq!(result.len(), 4); // x, y, idx_a, idx_b
        assert!((result[0] - 5.0).abs() < 0.001); // x
        assert!((result[1] - 5.0).abs() < 0.001); // y
    }
}

