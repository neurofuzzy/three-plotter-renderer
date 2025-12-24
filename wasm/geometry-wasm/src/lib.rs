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
        
        // Get edge's mesh and face IDs
        let edge_mesh_id = if i * 2 + 1 < edge_mesh_face.len() {
            edge_mesh_face[i * 2] as i32
        } else {
            -1
        };
        let edge_face_id = if i * 2 + 1 < edge_mesh_face.len() {
            edge_mesh_face[i * 2 + 1] as i32
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
            
            // Skip if this is the edge's parent face
            if edge_mesh_id == face_mesh_id && edge_face_id == face_face_id {
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

