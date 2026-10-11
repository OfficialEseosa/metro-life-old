# M1 audit: backend core

Codex settings selected in step zero: model GPT-6.1 Sol, reasoning effort High, speed Standard (the 1.5x speed option left off). A "Daybreak" toggle in the model menu was off and left off.

Audited: Sunday 11 October 2026, about 23:45 to 23:50 Eastern, against commits "M1: implement persistent worlds, guest auth and authoritative life simulation" and "M1: validate career workplaces against canonical landmark ids". Server: http://localhost:8080 (address from PLAN.md), build reported by /api/version: metro-life-m1.

## What I did

Using a browser on the running server, I called the API directly as a new visitor would through the client:

1. POST /api/auth/guest, POST /api/worlds (solo), POST /api/sim/setup (Atlanta, Old Fourth Ward, Startup Founder).
2. Five successful actions: cook at home, jog the loop at Piedmont Park, invite a friend over, work a concession shift at Mercedes-Benz Stadium, take a shower.
3. Validation: an action while busy, an action in another city, an unknown place, an unknown action, places outside opening hours.
4. World scoping: created a private world, checked the sim there, selected the solo world again.
5. Signup upgrade from guest with a throwaway test account (auditm1test35935).
6. Scanned /api/world, /api/daily and /api/stats for emoji characters.

## Passed

- Guest creation, solo world creation and sim setup all returned 200. Starting cash 2,500; needs 85 each; sim starts at home; clock starts Day 1, 9:00, Monday.
- Cooking cost $12 and completed the "Cook a meal at home" daily goal (+$45, +25 XP): net +$33, as expected.
- Concession shift paid $95 plus the "Earn money" goal $45: cash 2,533 to 2,673, as expected.
- Needs moved in the right direction: cooking raised hunger to 100, inviting a friend raised social from about 85 to about 99, jogging cost energy and hunger and added fitness XP.
- Mercedes-Benz Stadium and State Farm Arena refused actions at 9:00 game time with "This place is closed. Try home or an open place" (opening hours 10 and 11). The shift worked after 10:00.
- Busy: "Finish your current activity first" (409). Other city: "Fly to this city before doing an activity here" (403). Unknown place: 404. Unknown action: 400. All messages are plain and readable.
- Game clock runs at 1 game minute per real second, matching the spec.
- A new private world gets an 8-character join code (F92F05D2); the sim there is empty; selecting the solo world again restores the sim with the same cash.
- Signup while a guest kept the same sim, cash and world.
- No emoji found in /api/world (60 KB), /api/daily or /api/stats.

## Problems

1. Need values come back with long unrounded decimals. After cooking, /api/act returned energy 84.55630000000001 and fun 89.55630000000001. Expected: values a player could see on a meter without odd decimals (whole numbers, or rounding guaranteed before display). Seen in the API response; no screen size applies.
2. Every result message I saw used the same wording: "Cook a fresh meal. A little progress, a better day.", "Jog the loop. A little progress, a better day.", "Take a shower. A little progress, a better day." Only the work shift said something specific ("You earned $95."). Expected: a result that tells the player what changed or adds some flavour, so actions do not feel identical. This text becomes the toast in M3.
3. "Take a shower" at home changed no need upward: energy went from about 75 to 74 and nothing else rose. Expected: a visible benefit for spending the time, or the action should say what it is for.
4. The guest's display name is "Neighbor df4fe918", which shows a raw hex code to the player and to anyone who sees them in a shared world. Expected: a friendlier generated name.

## Could not check

- Restart persistence. I cannot stop and start the server from here. PLAN.md reports a pass with evidence in evidence/m1 (before-restart.json, after-restart.json). I will check at the next audit whether test account auditm1test35935 and world "Audit M1 solo" are still there if the server has been restarted.
- I did not run the Maven test suite myself; PLAN.md reports 8 tests passing.
- Nothing visual exists yet in M1 (scene and HUD start in M2 and M3), so no screenshots, layout, phone-width or stutter checks apply.
- Claude Code was not asked for help this milestone.
