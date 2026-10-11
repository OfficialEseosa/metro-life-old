# HUD review — 11 October 2026

Owner checkpoint precedes M4. Sources and visual direction are in reference-notes.md and hud-design.md. This is a local self-review, not independent owner acceptance.

## Evidence

- `evidence/ui-redesign/round3/`: seven required states at 375×812 and 1280×800, contacts, idle/night/lenses/full/job views and machine-readable flow report.
- `hud-comparison-375.png`, `hud-comparison-1280.png`: old HUD, annotated mockup, actual implementation. Old captures predate the art rebuild; these compare HUD structure rather than identical scene geometry.
- `reference-comparison-375.png`, `reference-comparison-1280.png`: fresh read-only lagoslife.app and Metro Life, same native viewport and 100% browser zoom. Different city/camera layouts prevent claiming an exact scene-scale or whole-image colour match. Bright green ground and coloured kits remain; the redesign adds opaque cream and semantic colour mass rather than desaturating the scene.
- `interactions/`: drag, map pan, full-sheet result, reduced motion, landscape primary, world join/error and controlled critical-needs checks. Reports explicitly identify fixtures.

## Vercel interface checklist

| Area | Result and evidence |
|---|---|
| Keyboard and focus | Native buttons/selects/inputs, explicit icon-button names and visible focus rings. Modal Tab trap and trigger return tested. Sheet handle click, drag and arrow alternatives tested. Map search is the keyboard alternative to pins. Inset handle focus ring cannot cover the title. |
| Touch and input | Buttons ≥44px, primary ≥60px; map point hit radius24 CSS px. Input text16px, safe-area padding, paste enabled, no user-scalable/max-scale restriction. Actual hardware pinch/haptics not checked. |
| Forms | Existing labels/autocomplete/password types retained; Enter submits. Chosen loading button keeps its label with delayed200ms spinner and aria-busy. Inline request errors use role=alert; form errors receive focus. Empty search and job-loading states exist. Invalid private code visibly rejected, then valid code joins. |
| Feedback | One completion result, polite role=status, dismiss44px, hover/focus pause and swipe. Full-height result is inside body below fixed primary; modal holds it. Server cash/needs remain unchanged during progress. Exact-deadline, repeated read and restart tests pass. Critical need warnings follow chips/marker thought bubble and offer care. |
| Motion | Press80ms, plate entrance240ms, opacity fade200ms, cash650ms, reward1350ms/punch180ms. Transform/opacity animations; sheet height changes snap then camera re-eases. Reduced-motion CSS and camera cut tested. Optional coin/level/error/low sounds follow a user gesture; mute persists. Audible quality and physical vibration not verified. |
| Layout | Native 375×812 and1280×800 views inspected. No horizontal overflow or settled panel offscreen in flow report. Phone dock hides when sheet/search opens; peek/half/full keep primary visible. 667×375 primary checked and screenshot inspected. Desktop idle occupied bounds ~6.1%, phone ~16.0%; empty space is intentional city space. Ultrawide and Safari are M8 checks, not claimed here. |
| Content and visuals | Main labels16px, supporting text≥15px, tabular cash30px. 2px edges, substantial button lips, opaque cream, filled icon tiles and labelled category colours. Needs use native labelled meters and coloured segmented tracks. User/API content wraps; setup choices remain real. No emoji, blur, hairline dashboard layout or fabricated metrics. |
| Navigation | External OSM attribution is a real link. Gameplay panels/lenses remain transient local game state; URL history/deep links are intentionally deferred, not claimed as a checklist pass. No unsaved external document or destructive remote action exists in this flow. |
| Performance | Intel Arc D3D11 flow samples ~60FPS, P95 17.6–17.9ms,45 calls/178,948 triangles. Pins use one atlas; marker is an ordinary DOM overlay driven by scene projection. No React state updates per animation frame. Production build passes; large JS chunk warning remains. iOS low power mode and macOS Safari unavailable here. |

## React review

Applied vercel:react-best-practices after multiple TSX edits. Global feedback listeners are installed once and cleaned up; store uses narrow selectors; transient camera/counter/marker animation stays in refs. API bootstrap reads remain parallel. Timing/progress hooks clean up on unmount, assets dispose, and async result settlement verifies current world before updating. Shared action rules read structured API data, not raw content labels. Separate sound/hooks avoid Fast Refresh export warnings. `npm run lint` passes without warnings after repair. No extra component library, remote runtime font or animation library was introduced.

## Practical limits

Screen-reader speech, audible sound quality, physical-phone haptics, Safari/iOS, long-session memory and ultrawide remain M8 checks. Critical-needs visual proof uses intercepted read responses, explicitly recorded; it never changes server needs. Work/low-mood consequences remain server rules. M4 must also reconcile the Home shortcut and need-care destinations after intercity travel, when the sim's home belongs to another city. No claim that this HUD checkpoint completes M4–M8.

## M8 review additions

Primary actions now sit below the scrolling body, with an opaque cream divider. Chat has a fixed bottom input/Send row; own candidates carry a You label and explicit self-voting explanation. Font sizes for connection status and chat metadata are at least15px. Visual evidence distinguishes live vote checks from injected candidate layout fixtures. Public meetings are required for social actions; private homes are separate.

Scene loading is lazy and visible, and the top bar exposes reconnect status. Search focuses its input and restores keyboard focus on Escape; modal traps and reduced motion are checked in the M8 browser flow. Async chat/resource/sim responses verify world/city before applying, and pending requests have a15-second timeout. New resident/kit geometry and materials dispose on unmount; scene motion still uses instance refs rather than frame-driven React state. No additional component library, remote font or postprocessing pass was introduced.

Physical phone, virtual keyboard, screen reader, human sound/haptic quality and long-session memory remain unchecked. Final results and current run addresses are in PLAN.md and final-report.md.

## Final owner review additions

Sound storage is guarded. Client deadlines use a server epoch anchored to performance.now; old polls are rejected across mutations and location actions share one synchronous submit guard. Session mutations close old sockets and invalidate resource generations before cookie changes; plot fetches and billboard images cancel during layout cleanup. Rejected account requests restore their panel after resync. Chat merges by immutable id, and presence fetches cannot overwrite newer socket frames. A new city shows a loading label until its residents arrive rather than claiming zero online.

Resident/booking sizing uses existing instance buffers, city geometries explicitly dispose, and lighting subscribes to a boolean rather than every clock tick. Rendering requests frames only during loading, camera/crowd movement, visible water or activities. No frame-driven React HUD state, extra animation library or postprocessing pass was added. Final browser proof and practical limits are indexed in final-review.md.
