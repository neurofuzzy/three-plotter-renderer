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
}
