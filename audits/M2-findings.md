# M2 audit: Atlanta scene

Audited: Sunday 11 October 2026, about 00:09 to 00:25 Eastern, against commit "M2: build and verify Atlanta scene; resolve backend audit findings". Address from PLAN.md: http://127.0.0.1:5173 (backend http://localhost:8080).

Important context: Codex had already started M3 when I audited, and the dev server reloads as files change. The landing panel and HUD changed while I was looking (first load showed unstyled landing text, a few minutes later it was styled). Everything below is what the running game showed at the time, so some HUD items may belong to M3 work in progress. Screenshots are in audits/M2/.

Screen sizes: the browser window could not be resized, so "laptop" screenshots are at a 1638 x 863 CSS viewport (device pixel ratio 1.75). The phone check used the game loaded in a 375 x 812 frame.

## What I did

- Loaded the game as a new visitor, then signed in with my M1 test account.
- Used the scene's own development hook to fly to each landmark by day and captured close-ups of 11 Atlanta landmarks, plus the whole city by day and by night.
- Dragged and scrolled the camera and read the scene's own frame metrics.
- Clicked map pins.
- Loaded the game at 375 x 812.
- Checked whether my M1 test account survived the backend restarts since M1.

## Passed

- M1 restart persistence: logging in as auditm1test35935 after the backend was restarted (new process since M1) returned both worlds, cash $2,673 and XP 125 exactly as I left them.
- All four M1 findings are reported fixed in PLAN.md (I did not re-test their text and values in this audit).
- The city reads as a tidy, calm diorama: leafy, many trees, lit windows at night, soft shadows by day.
- Landmarks I would name within a second as someone who knows Atlanta:
  - Mercedes-Benz Stadium: yes. Eight-sided bowl with the pinwheel of triangular roof petals around an opening (02).
  - Georgia State Capitol: yes. Gold dome on a columned drum with a pedimented portico (03).
  - Fox Theatre: yes, mostly. Striped red-and-cream brick, onion domes and minarets, a marquee (04). The tall vertical FOX sign is missing.
  - Centennial Olympic Park: yes. The Olympic rings are visible from above.
  - Georgia Aquarium: partly. A white dome plus an angular glass volume with a swooping canopy is close to the real shape (06).
  - Hartsfield-Jackson airport: partly. Parallel concourses and a control tower (10).
- Clicking a pin flies the camera to the place and opens its panel (16).
- With the camera at the default view after interaction: 32 draw calls and 158,694 triangles, inside the 150 calls / 300k triangles budget.
- No emoji seen anywhere in the scene, pins or HUD.

## Problems

1. A large black wedge appears in the sky above the city. What I did: dragged the map once to tilt the camera at the laptop size. What happened: a solid black triangle or trapezoid sat on the horizon at the top centre, and stayed there as the view slowly rotated (15). Expected: sky only.
2. The first screen showed the landing text unstyled and overlapping the top bar: "A CITY. A DREAM. A NEW YOU.", "Make a little life of your own", the Start playing button and the login link all ran under and over the top bar in plain browser text (01, laptop size). A few minutes later it was styled, so this may have been mid-edit. Please confirm the landing never renders like this.
3. On first load, the scene development hook reported 58 draw calls and 307,118 triangles at the landing view, above the 300k triangle budget. After a reload the same view reported 32 calls and 158,694 triangles. Expected: the budget holds on every view, including the first one a visitor sees.
4. Camera movement is not smooth. After dragging and scrolling, the scene's own metrics read 52.6 fps with a 95th-percentile frame time of 40.7 ms (laptop size). Expected: steady 60 fps, frames near 16.7 ms.
5. The camera keeps moving on its own after you stop touching it. Between two screenshots taken seconds apart with no input, the city had rotated, so a pin I aimed at had moved by the time I clicked it. Expected: either no drift, or drift that stops while the pointer is over the map.
6. Landmarks that read as generic or wrong:
   - Ponce City Market: a plain red-brick block with a water tower and a gold ring on the roof (05). Missing the tall central tower with the sign that makes it recognisable.
   - Truist Park: a round green disc with a ring of dark green tubes for stands and a small square for the infield (08). It looks like pipes around a pond, not a ballpark. A baseball park is fan-shaped, with a diamond and an outfield wall.
   - The BeltLine: a short wooden deck and an orange ring sculpture (12). There is no visible trail loop around the city, which CODEX_PROMPT.md asks for.
   - Piedmont Park: a lake with a bridge and a small pavilion (07). Generic park; no Midtown skyline framing or other signature.
   - Georgia Tech: a red-brick school with a spire tower (09). The tower has a blank yellow panel where the TECH letters should be.
   - High Museum: a beige cylinder next to a block with rows of roof cylinders (11). The white panelled Meier building is not recognisable.
   - The downtown towers are three similar grey-green spires. None reads as a specific Atlanta tower.
   Gold or orange ring sculptures appear on several unrelated landmarks (Ponce, Piedmont, BeltLine), which makes them look alike.
7. Districts look the same everywhere. The same olive mid-rise blocks and brown-roofed houses fill every side of the city (13). I could not tell Midtown, Buckhead, Old Fourth Ward, East Atlanta, West End or Decatur apart.
8. The night view looks like murky green fog rather than night (14). The whole scene is tinted dark teal-green, the sky is a flat green-grey with no stars, and there is no street-light glow. Lit windows are the only night cue. The day view is also strongly tinted olive-yellow.
9. Beyond the edge of the city there is an empty flat olive plain (10, 13). The map ends abruptly at a square of trees.
10. The day/night button and the clock disagree. At game time 13:15 the button switched to the night look, and on the first load at 23:04 the scene was night. Expected: either the look follows the clock, or the button says it is a preview.
11. Phone width (375 x 812, 17):
    - The city is washed out by haze: buildings are pale and low contrast, and landmarks are hard to pick out.
    - Map pins crowd and overlap each other, and pins at the right edge are cut off.
    - The "Your next good thing" card plus the bottom navigation cover roughly the bottom third of the screen.
    - The footer text "METRO LIFE · The city in a forest" shows through behind the bottom navigation, overlapping it.
    - The default framing shows mainly the left half of the city; Mercedes-Benz Stadium is cut off at the left edge.
12. Every action in the Truist Park panel uses the same compass icon (16). This may be M3 work in progress.

## Could not check

- "Renders with the backend down": I cannot stop the backend from here. PLAN.md reports a pass from scripts/scene-offline.cjs.
- A true 1280 x 800 window: the browser window could not be resized. The laptop findings are at 1638 x 863.
- Frame rate on another machine. All numbers above are from this laptop (Intel Arc, ANGLE D3D11) through the scene's own metrics.
- Hover labels on pins: the camera drifted while I hovered, so I could not confirm a label appeared.
- Claude Code was not asked for help this milestone.
