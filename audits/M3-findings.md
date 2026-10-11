# M3 audit: HUD and core loop

Audited: Sunday 11 October 2026, about 00:38 to 00:45 Eastern, against commit "M3: build playable life loop and resolve Atlanta scene audit". Address from PLAN.md: http://127.0.0.1:5173 (I used http://localhost:5173, the same dev server, so that I started without my earlier test login). Screenshots are in audits/M3/.

Screen sizes: laptop is a 1638 x 863 CSS viewport (the browser window cannot be resized). Phone is the game loaded in a 375 x 812 frame.

## The "Done when" test

New visitor, no instructions, from the landing page to money earned at a job:

- Laptop: Start playing, Play solo, Start my life, Apply (Support Associate), Work a shift. Cash went from $2,500 to $2,665 ($120 pay plus the $45 "Earn money" goal). Time: 74 seconds from page load. That includes several seconds per step for my screenshots, so a person would be faster.
- Phone: the same path took 89 seconds, including a scripted scroll (see "Could not check").
- Result: PASS at both sizes. At every step it was obvious what to do next: the job list opens by itself after onboarding, and hiring flies you to the workplace with "Work a shift" in the panel.

## Also passed

- M2 fixes visible: the night view is now blue with lit windows and street lights (01). The day palette is cooler. The black sky wedge did not appear during this audit (I did not repeat the drag-tilt test).
- Onboarding is one page: city, neighbourhood with daily rent, dream, hair, skin tone, favourite colour. The guest gets a friendly generated name (Casey Hart, Skyler Banks), so the M1 finding is fixed.
- The play-mode picker is clear: solo, online, create a private world, join with a code (02).
- The top bar shows the wordmark, city switcher, game clock, cash, online count and the day/night control.
- The "My life" panel shows level and XP, mood, four need meters with whole numbers, a "Recharge at home" shortcut, three daily goals with rewards, seven skills, and "Save this life with an account" (08, 09).
- The home panel shows sleep, cook, shower and invite, each with time, cost and effect (10). Cooking cost $12 and completed the cooking goal; the notice explained both.
- Result notices say what changed, for example "Work a shift. Earned $120 · Hunger -7 · Fun -3 · Energy -10 · Tech +25 XP · 1 daily goal completed."
- While busy, other actions are disabled and say "Finish your current activity first".
- No emoji anywhere on the page text; every icon-only button has an accessible label.
- Phone landing, play picker, onboarding and job list all fit inside 375 px with readable text.

## Problems

1. Pay arrives before the work is done. What I did: clicked "Work a shift" (laptop). What happened: the notice "$165 added to your life" and the new balance appeared at once, while the shift's progress bar still read "Making progress · 3s" (07). Expected: the money, or at least the notice, lands when the progress bar finishes, so the wait feels like work paying off. The same happens with cooking.
2. The action in progress appears twice. What I did: started a shift, then a meal (laptop and phone). What happened: the busy card "Work a shift · Making progress" sits at the top of the list, and the original "Work a shift" row is still further down, greyed out (07). Expected: one entry for the running action.
3. On the phone, the action you were just hired for is hidden. What I did: applied for Support Associate at 375 x 812. What happened: the Tech Village sheet opened with "Pitch your startup", "Co-work" and "Find a co-founder" in view; "Work a shift" was below the fold, and the "A good little step" notice covered the bottom of the list. Expected: after being hired, "Work a shift" is visible without scrolling (for example listed first, or the sheet scrolls to it).
4. On the phone, the location sheet covers almost the whole map (12). The place you flew to cannot be seen behind the sheet. Expected: the landmark stays visible above a shorter sheet, or the sheet can be pulled down.
5. On the phone, the sheet's top edge cuts across the "Find your next stop" bar, leaving it half hidden behind the sheet (12). Expected: the sheet sits below the bar or hides it fully.
6. A result notice covers the World panel. What I did: cooked at home, then tapped World within a few seconds (laptop). What happened: the notice "$33 added to your life" sat on top of the World panel's title and close button (11). Expected: notices never cover a dialog's title or close button.
7. The cooking notice's headline says "$33 added to your life" when the meal cost $12. The extra money came from the daily goal. The body explains it, but the headline reads as if cooking earns money. Expected: a headline that separates spending from the goal reward.
8. All three non-job actions at Tech Village use the same building icon (06, 12). The work action has a briefcase. Expected: distinct icons per action, as M2 problem 12 asked.
9. "Your life, lately" shows the dream ("Startup Founder") but no aspiration milestones or progress. The spec lists aspiration progress for the sim panel. This may be planned for M5.
10. Home has no place on the map: tapping Home shows the overview with no marker for where you live. Expected: your home is visible somewhere in your chosen neighbourhood.
11. The Hair option reads "short" in lower case, while every other option is capitalised (03).

## Could not check

- Scrolling inside the phone frame with the mouse wheel did not move the onboarding sheet. That may be a limit of scrolling inside a frame with my tools rather than a fault, so I scrolled by script. Please confirm touch scrolling works on a real phone.
- Story-beat modal: no action triggered a choice event during my play. PLAN.md says the story engine is M5.
- Private-world join with two separate browser profiles: PLAN.md reports a pass. I will test live multiplayer properly at M7.
- Claude Code was not asked for help this milestone.
