### User Input

Lovely. So.. I need some thinking here. Imagine we have a cube with an oblong cut out of the middle like a square donut. Some of the inner corners have edges that protude and are still drawn. They are correctly splitting now, which is great! But now, the smoothing pass isn't removing those stragglers because it's probably comparing to the inner face of the cutout instead of the coplanar face it extends into. I'm wondering if we need another smoothing pass after the fact. But how to choose the right faces? By they way - the reason I mention this is that I remember old CAD programs used to do this - they'd have to do a second pass with a slower heuristic

### Planner Response

You're describing a classic CAD hidden line problem. After T-junction splitting, you can have "straggler" edge segments that:

1. Were originally part of a crease edge (valid)
2. Got split at a T-junction
3. Now the split segment extends into a coplanar face region
4. The pre-split smooth filter can't catch these because it runs before splitting

**Two approaches I'm thinking about:**

### Option A: Post-Split Smooth Filter (Simpler)
After splitting, check each edge segment:
- Is the edge's midpoint inside a projected face?
- Is that face coplanar with one of the edge's parent faces (normal similarity > threshold)?
- If both true → remove the edge

This catches segments that lie on a smooth surface extension.

### Option B: Edge Collinearity Merge (More Complex)
Check if a split edge segment is collinear with another edge segment from a coplanar face, and merge/remove redundant segments.

---

**My recommendation**: Option A is simpler and matches what you described (second pass, slower heuristic). It leverages the `projectedFaces` array we already have.

Want me to implement Option A as a post-split filtering pass? Or do you have a different heuristic in mind?

### User Input

option A sounds legit

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

Let me see where the projectedFaces are built and where to insert the post-split filter:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

I see the structure. I need to add the face normal to projectedFaces so we can compare normals for coplanarity. Then after splitting, I'll add a post-split filter. Let me implement this:

*Edited relevant file*

### Planner Response

Now let me create the post-split smooth filter function and integrate it into the pipeline:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

Let me add the post-split smooth filter function. I'll add it after the pointInTriangle2D function and before testOcclusionMath:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### Planner Response

Now I need to integrate this filter into the pipeline. Let me update computeHiddenLinesMultiple to call it after splitting and before occlusion:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

I see the pipeline. I need to add the post-split smooth filter AFTER buildProjectedFaces but BEFORE the occlusion test. Let me insert it:

*Edited relevant file*

### User Input

Unfortunately it didn't find any - I still see them and see nothing in logs. I bet we could earmark the stragglers from our t-junction splittling - one of the split edges could be a straggler.

### Planner Response

Smart idea! When we split at a T-junction, we know one segment extends from the original edge endpoint to the T-junction point - that's the potential straggler. Let me mark edges during T-junction splitting:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

I see the split edge creation. The key insight is: when we split an edge because of a T-junction (endpoint of another edge on this edge's interior), we can mark one half as a potential straggler. Let me first add a flag to track which splits are from T-junctions:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

I see the T-junction detection. The issue is that when another edge's endpoint lands on this edge's interior, the split happens on THIS edge, not the edge that caused the T. Each T-junction split creates TWO segments from the edge being split - and we need to mark both with info about which side is "toward the T-junction edge".

Actually, the simpler approach: when an edge is split at a T-junction, we should mark the edge that CAUSED the T (the one whose endpoint lies on another) as a potential straggler. Let me rethink:

- Edge A has endpoint that lies on edge B's interior
- Edge B gets split at that point
- Edge A is NOT split (its endpoint is already at the T-junction)
- The straggler is actually Edge A itself (or a portion of it)

Wait, that's not right either. Let me think about the geometry:
- A crease edge extends from the inner corner of the cutout
- This edge's endpoint lands on the flat face's edge
- The straggler is the portion of the crease edge that extends past where it should logically end

Actually, the straggler edge is edge A (the one whose endpoint caused the T-junction). Let me mark edges when they participate in a T-junction as the "causing" edge:

*Edited relevant file*

### Planner Response

Now I need to mark the straggler edges with a flag so we can filter them later. Let me mark them when creating split edges:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

I see - the edges being added to result don't include a flag for whether they came from a potential straggler. I need to propagate this flag. Also, I realize the key insight: the straggler edge ITSELF isn't split (its endpoint just touches another edge), so we should mark the ORIGINAL edge (not its splits) as a straggler and then filter it in the post-processing step.

Let me update the edge creation to add the straggler flag:

*Edited relevant file*

### Planner Response

Now I need to update the [filterSmoothSplitEdges](cci:1://file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js:941:0-997:1) function to use this flag instead of the point-in-triangle approach:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### User Input

Hmm. I am seeing no logs when running @[examples/stl-viewer.html] 

### Planner Response

Let me check the stl-viewer.html to see if there's an issue preventing execution:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

### Planner Response

The code looks fine. Let me open the browser to test directly and check for errors:

### Planner Response

The browser test confirmed the issue! The T-junction detection found **142 potential straggler edges**, and the filter **checked 409 T-junction edges** but **removed 0 stragglers**. This means the point-in-triangle check or coplanarity check isn't matching.

The issue is likely that the straggler edge midpoint lies exactly ON the boundary of a face, not inside it. Let me think about this differently:

**The real problem:** When a T-junction edge's endpoint touches another edge, the straggler extends past that intersection point. After splitting at the intersection, the straggler segment is BETWEEN the split point and the original endpoint - NOT its midpoint inside a face.

Let me take a different approach - simply filter out T-junction stragglers that are very short (likely artifacts) or that lie entirely along another edge's direction:

### Planner Response

Actually, wait - I realize the issue. When an edge's endpoint causes a T-junction on ANOTHER edge, we mark the CAUSING edge as a straggler, but that edge doesn't actually get split - its endpoints stay the same! The splitting only happens to the edge that was INTERSECTED.

So the straggler edge's midpoint is still in its original location, which may not be inside any face. The real solution is:

**When an edge causes a T-junction, the portion from its endpoint to the intersection point is a potential straggler.** But since that edge isn't split, the whole edge is marked but we can't distinguish which part.

Let me try a simpler approach: **filter based on edge length**. Straggler edges from T-junctions tend to be very short (they're just the small extension past the intersection). Let me add a minimum length filter for T-junction marked edges:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

I think the real issue is that T-junction stragglers lie along the EDGE of a face, not inside it. Let me try checking if the edge lies along any face edge (collinear) rather than inside the triangle:

### User Input

no you can't make that assumption - mark BOTH as potential stragglers. Let's take this a step at a time please. Mark them both as stragglers and color them red for now. I need to hold your hand through this

### Planner Response

You're right, let me take this step by step. First, mark BOTH edges in a T-junction as potential stragglers:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

Now I need to mark BOTH edges as potential stragglers. Let me update the T-junction detection:

*Edited relevant file*

### Planner Response

Now update stl-viewer.html to color T-junction straggler edges red for visualization:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### User Input

YAY! You caught every straggler, and more. now, crazy idea - can you attach metadata to the edges so I can select them in the browser and send you the ones that are stragglers? would that help? would you also need a list of the ones that are not? maybe I can capture a list of all of them in the developer console and then multiselect the ones that are stragglers and send you two lists

### Planner Response

Great idea! Let me add interactive edge selection and expose the data to the console so you can categorize them:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

Now I need to update the drawing code to make each T-junction edge clickable and individually selectable:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

*Edited relevant file*

### User Input

okay, so all stragglers is 100K lines of JSON. Let's try something else. when I click on an edge, log a list of all adjacent face normals

### Planner Response

Good idea! Let me update the click handler to log the adjacent face normals:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

**Done!** Now when you click any red edge, the console will log:

```
--- Edge 5 ---
  faceIdx: 123, faceIdx2: 456
  isProfile: false
  normal1: [0.707, 0.707, 0.000]
  normal2: [0.707, 0.707, 0.000]
  normal similarity: 1.0000 (>0.99 = smooth)
  2D length: 45.2px
```

This will help you identify patterns:
- **Profile edges** (`isProfile: true`) - boundary edges that should be kept
- **Normal similarity** - if close to 1.0, the faces are coplanar (smooth surface edge)
- **no normal2** - boundary edge (single face)

Refresh, render, and click some edges to compare real stragglers vs false positives!

### User Input

please remove multiselect. it's not always finding all the adjacent faces.

```
faceIdx: 433, faceIdx2: none
stl-viewer.html:285   isProfile: false
stl-viewer.html:286   normal1: [undefined, undefined, undefined]
stl-viewer.html:287   normal2: none (boundary)
```

### Planner Response

The normals are undefined - that's the bug! The `normal1` isn't being propagated properly. Let me fix both issues:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

### Planner Response

I see the issue! [projectEdges](cci:1://file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js:233:0-265:1) doesn't copy `normal1` or `normal2`. Let me fix that and simplify the click handler:

*Edited relevant file*

### Planner Response

Now let me also simplify the click handler and remove multiselect as requested:

*Edited relevant file*

### User Input

please make all edges clickable - and when I select and edge, draw the adjacentfaces as solid polygons 

### Planner Response

Good idea! Let me make all edges clickable and draw the adjacent faces when clicked:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

### Planner Response

Let me first see how the edges are drawn and update the entire drawing section to make all edges clickable and add face visualization:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

Now I need to expose the projected faces in the debug object. Let me update that:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

### Planner Response

I need to add `projectedFaces` to the debug object. First, let me check if [computeHiddenLinesMultiple](cci:1://file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js:1296:0-1442:1) returns it:

*Grep searched codebase*

### Planner Response

I need to return `projectedFaces` from [computeHiddenLinesMultiple](cci:1://file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js:1296:0-1442:1). Let me check the return statement:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### Planner Response

Now I need to expose `projectedFaces` in the debug object in stl-viewer.html:

*Edited relevant file*

### User Input

uh oh somehow we're dropping/losing some edges all of a sudden.

### Planner Response

Let me check what might be causing edges to be dropped. I'll look at the console logs to trace the pipeline:

### Planner Response

Aha! The **post-split smooth filter is now removing 191 edges** - that's the issue! Previously it was removing 0. This is because edges are now being correctly marked as T-junction stragglers.

The problem is that the filter is being **too aggressive** - it's removing edges that are legitimate T-junction splits but should be kept. The filter is supposed to only remove edges whose midpoint lies inside a coplanar face, but it seems like it's catching too many.

Let me check the filter logic - we may need to disable it temporarily or refine it:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

The issue is that the filter IS working as designed - it's removing edges whose midpoints lie inside coplanar faces. But this is being too aggressive because we're marking BOTH edges in a T-junction as stragglers, and some of those edges are legitimate (they just happen to be involved in a T-junction, but aren't actually the "straggler" part).

For debugging, let me **disable the post-split filter temporarily** so you can continue investigating:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

Let me disable the filter temporarily so you can continue debugging the face visualization:

*Edited relevant file*

### Planner Response

**Done!** I've disabled the post-split smooth filter temporarily. The edges were being dropped because the filter was working (it was removing edges whose midpoints lie inside coplanar faces), but it was too aggressive.

Now you should see all the edges again, with the red T-junction markers. Refresh and continue your debugging with the interactive face visualization - clicking an edge will show its adjacent faces as polygons.

Once we understand the pattern better from your investigation, we can refine the filter to be more surgical about which edges to remove.

### User Input

okay, I think we're not finding at least two faces for each edge. A lot are showing 1 (boundary) even though they are within the model's projected profile. we may need to do a check for all visible faces with the logic: 

1. matches face edge?
2. is colinear and within with a face edge?

### Planner Response

Great observation! The issue is that when edges get split at T-junctions, they lose the association with the second face because the split segments don't match any original edge exactly. We need to find adjacent faces geometrically instead of relying solely on the face indices from extraction.

Let me implement a function to find all faces that share a given edge geometrically:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

Let me add a function to find all faces adjacent to an edge geometrically, then use it in the click handler to show all matching faces:

*Edited relevant file*

### Planner Response

Now let me update the stl-viewer.html to use this new function for finding adjacent faces:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

Now let me update the click handler to use [findAdjacentFaces](cci:1://file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js:951:0-981:1):

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### User Input

its' finding two faces now! yay! I am not seein a second normal:
```
--- Edge 114 ---
stl-viewer.html:327   isTJunctionStraggler: true
stl-viewer.html:328   Original faceIdx: 482, faceIdx2: none
stl-viewer.html:329   Geometric matches: 2 faces found
stl-viewer.html:331     Face 0: faceIdx=482, edge=BC
stl-viewer.html:331     Face 1: faceIdx=509, edge=AB
stl-viewer.html:333   normal1: [1.000, 0.000, 0.000]
stl-viewer.html:334   normal2: none (boundary)
```

### Planner Response

The geometric matching is working perfectly - it found 2 faces. But `normal2: none` is from the **original extraction data**, which didn't know about the second face. 

Let me update the logging to also show the **normals from the geometrically matched faces** - those are stored in the `projectedFaces` objects:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

**Done!** Now the console will show:

```
--- Edge 114 ---
  isTJunctionStraggler: true
  Original faceIdx: 482, faceIdx2: none
  Geometric matches: 2 faces found
    Face 0: faceIdx=482, edge=BC, normal=[1.000, 0.000, 0.000]
    Face 1: faceIdx=509, edge=AB, normal=[1.000, 0.000, 0.000]
  Face normal similarity: 1.0000 (>0.99 = COPLANAR/SMOOTH)
  ⚠️ This edge lies between COPLANAR faces - potential straggler!
  Original normal1: [1.000, 0.000, 0.000]
  Original normal2: none (boundary)
```

This tells you:
1. **Geometric matching found 2 faces** - both with their normals
2. **Face normal similarity** - if >0.99, faces are coplanar 
3. **⚠️ Warning** if this is a coplanar edge (real straggler to remove)

Refresh and try clicking edges - you should now see which ones are truly between coplanar faces (stragglers to remove) vs actual creases/profile edges!

### User Input

Perfect. you are finding the stragglers! Let's integrate this new pass completely and hide them

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

### Planner Response

Let me create a new filter function that uses the geometric face matching approach:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### Planner Response

Now I need to re-enable the filter call in the pipeline. Let me find and update it:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### User Input

oof. close but we're being too agressive - a couple of false positives. let's disable it and color only the ones we want to remove red

### Planner Response

Let me disable the filter and add a flag to mark edges that would be removed, then color those red for review:

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### Planner Response

Now let me update the viewer to color edges with `isCoplanarCandidate` as red:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

Also let me update the logging to show the new flag:

*Viewed [stl-viewer.html](file:///Users/geoff/dev/three-plotter-renderer/examples/stl-viewer.html) *

*Edited relevant file*

### Planner Response

**Done!** Now:

1. **Filter marks edges but doesn't remove them** - sets `isCoplanarCandidate=true` for edges between 2+ coplanar faces
2. **Red edges = candidates to remove** - edges with `isCoplanarCandidate=true`
3. **Black edges = keep** - everything else

**Console shows:**
```
Geometric straggler filter: marked X edges as coplanar candidates (NOT REMOVED - debug mode)
```

**When you click an edge:**
```
--- Edge X ---
  isCoplanarCandidate: true (faceSimilarity: 1.0000)
  adjacentFaceCount: 2
```

Refresh and look at the red edges - let me know which ones are false positives so we can figure out what condition distinguishes them!

### User Input

Here are some being removed that shouldn't be:

```
--- Edge 77 ---
stl-viewer.html:327   isCoplanarCandidate: true (faceSimilarity: 1.0000)
stl-viewer.html:328   adjacentFaceCount: 3
stl-viewer.html:329   Original faceIdx: 303, faceIdx2: none
stl-viewer.html:330   Geometric matches: 3 faces found
stl-viewer.html:336     Face 0: faceIdx=138, edge=BC, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 1: faceIdx=174, edge=CA, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 2: faceIdx=303, edge=AB, normal=[0.000, 1.000, 0.000]
stl-viewer.html:345   Face normal similarity: 1.0000 (>0.99 = COPLANAR/SMOOTH)
stl-viewer.html:347   ⚠️ This edge lies between COPLANAR faces - potential straggler!
```
```
--- Edge 210 ---
stl-viewer.html:327   isCoplanarCandidate: true (faceSimilarity: 1.0000)
stl-viewer.html:328   adjacentFaceCount: 3
stl-viewer.html:329   Original faceIdx: 278, faceIdx2: none
stl-viewer.html:330   Geometric matches: 3 faces found
stl-viewer.html:336     Face 0: faceIdx=278, edge=AB, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 1: faceIdx=279, edge=BC, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 2: faceIdx=319, edge=BC, normal=[1.000, 0.000, 0.000]
stl-viewer.html:345   Face normal similarity: 1.0000 (>0.99 = COPLANAR/SMOOTH)
stl-viewer.html:347   ⚠️ This edge lies between COPLANAR faces - potential straggler!
stl-viewer.html:354   Original normal1: [0.000, 1.000, 0.000]
stl-viewer.html:355   Original normal2: none (boundary)
```
```
--- Edge 69 ---
stl-viewer.html:327   isCoplanarCandidate: true (faceSimilarity: 1.0000)
stl-viewer.html:328   adjacentFaceCount: 3
stl-viewer.html:329   Original faceIdx: 283, faceIdx2: none
stl-viewer.html:330   Geometric matches: 3 faces found
stl-viewer.html:336     Face 0: faceIdx=126, edge=BC, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 1: faceIdx=127, edge=AB, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 2: faceIdx=283, edge=AB, normal=[0.000, 1.000, 0.000]
stl-viewer.html:345   Face normal similarity: 1.0000 (>0.99 = COPLANAR/SMOOTH)
stl-viewer.html:347   ⚠️ This edge lies between COPLANAR faces - potential straggler!
stl-viewer.html:354   Original normal1: [0.000, 1.000, 0.000]
stl-viewer.html:355   Original normal2: none (boundary)
```


### Planner Response

Excellent data! I see the pattern:

**Edge 210** has 3 faces but Face 2 (`faceIdx=319`) has normal `[1, 0, 0]` while Face 0 and 1 have `[0, 1, 0]` - these are **perpendicular**! This edge is at a **crease** where two different planes meet. We're only checking faces 0 and 1 but ignoring Face 2.

**Fix: Check ALL adjacent faces - if ANY face has a different normal, it's a crease edge and should be kept.**

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### User Input

getting better! here's one
```
--- Edge 87 ---
stl-viewer.html:327   isCoplanarCandidate: true (faceSimilarity: 1.0000)
stl-viewer.html:328   adjacentFaceCount: 3
stl-viewer.html:329   Original faceIdx: 303, faceIdx2: none
stl-viewer.html:330   Geometric matches: 3 faces found
stl-viewer.html:336     Face 0: faceIdx=138, edge=BC, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 1: faceIdx=174, edge=CA, normal=[0.000, 1.000, 0.000]
stl-viewer.html:336     Face 2: faceIdx=303, edge=AB, normal=[0.000, 1.000, 0.000]
stl-viewer.html:345   Face normal similarity: 1.0000 (>0.99 = COPLANAR/SMOOTH)
stl-viewer.html:347   ⚠️ This edge lies between COPLANAR faces - potential straggler!
stl-viewer.html:354   Original normal1: [0.000, 1.000, 0.000]
stl-viewer.html:355   Original normal2: none (boundary)
```


### Planner Response

I see the issue! This edge has:
- **Original faceIdx2: none** - it was originally extracted as a **boundary/profile edge**
- All 3 matched faces are coplanar

But this is likely a **silhouette edge** - it's at the model's boundary where the surface turns away. The geometric matching finds faces that happen to be collinear, but this edge is a **real profile edge** that should be kept.

**Fix: If original `faceIdx2` is undefined (boundary edge from extraction), keep it unless it was specifically flagged as a T-junction split.**

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### Planner Response

**Fixed!** Now edges with `faceIdx2: none` (original boundary edges = silhouette/profile edges) are **skipped entirely** and never marked as candidates.

This should fix Edge 87 - it had `Original faceIdx2: none`, meaning it's a true profile edge that should always be kept, regardless of how many coplanar faces the geometric matching finds.

Refresh and check if Edge 87 is now black (kept) instead of red!

### User Input

oof. undo that. now we're finding no stragglers. 

*Edited relevant file*

*Viewed [hidden-line.js](file:///Users/geoff/dev/three-plotter-renderer/src/hidden-line.js) *

*Edited relevant file*

### Planner Response

Reverted! The faceIdx2 check was wrong because all edges after splitting likely don't have faceIdx2 propagated properly.

Looking at Edge 87 again - all 3 faces have the same normal `[0, 1, 0]`. The issue is: **how do we tell the difference between a true straggler and a profile edge that happens to be collinear with internal edges?**

One key difference might be: **is the edge at the boundary of the model's silhouette?** Can you click Edge 87 and see in the visualization whether it's at the **outer edge** of the model (profile) or **inside** the model's projected shape (internal straggler)?

If it's at the outer boundary, we might need to add a check for whether the edge lies on the convex hull of the mesh in 2D, or use the `isProfile` flag if that's being set correctly.

### User Input

We're as close as we're going to get. let's hide those red edge now.