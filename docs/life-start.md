# Beginning a life

This server has one public world. Opening it automatically creates or restores a guest identity through an HttpOnly session cookie (SameSite=Lax on the same site, SameSite=None; Secure; Partitioned when the frontend is hosted on another site). There are no login, signup, password or room endpoints. Each person has a private home; streets, public rooms, residents, elections, bookings and city chat are shared.

The creator accepts a 2–20-character name made from letters, spaces, hyphens and apostrophes, plus she/he/they, either base body, eight skin tones, six hair colours and a starting outfit (casual or street; work, smart and party outfits unlock later). The preview and portrait use the same rigged model and material colours as the controlled player. Visible portraits share a queued renderer instead of creating one WebGL context per resident row.

Four arrival cards lead from the chosen city to the home door. Turning the key enters a 7 x 6 metre studio containing a bed, two-ring stove, shower and one chair. Starting cash is $150; the shared world clock continues while personal Day 1 starts on arrival.

## Teaching by doing

The server owns six durable flags: leave home, accept an entry job at its workplace desk, complete a paid shift, finish a cafe meal, wave/hang out with a nearby neighbour, and pay first rent. Actions set the shift/meal flags only when their accepted deadline settles, including after a restart. First rent can be paid from home, is idempotent, and covers the next midnight. An automatic rent payment also counts. Existing stories and dream rewards wait until these goals are complete. Help wanted signs identify workplaces; applying still requires the physical desk and an open workplace.

## A tight start with a way forward

- Studio rent: $35 per game day. Basic cafe meal: $12. Free pantry cooking, sleep, shower and a call from the chair remain available at home.
- Career shifts: $70 / $100 / $140 / $190 / $250 by level. A low-mood entry shift pays $49, covering rent and a cafe meal ($47). Non-career paid activities pay $22 before mood/policy modifiers. Daily goals pay $5.
- Entry workplaces run staffed day/night rotas. Policies that extend closing hours cannot shorten an all-day rota. Other venues keep their own hours.
- Offline rent uses the existing six-hour eligible window and the policy at each midnight. Starter arrears stop at two instalments ($70), and automatic collection leaves $12 for a meal. No foreclosure or negative-cash loop is introduced.
- Casual/street are owned. A job unlocks work clothes; party costs $90 and smart costs $120 once each. Changing while busy or in a story is refused.
- Gifts and voting require one game day of age. Gifts received are capped at $50 per game day. Plots ($35 per cell / seven days) and billboards ($300 / three days) unlock after the teaching goals. Moving to a normal neighbourhood home costs its listed daily rent upfront.

Settings explains and confirms Start a new life. Cancelling preserves everything; confirming removes that character and its bookings/candidacy/votes, revokes its old sessions/socket, and creates a fresh guest identity. The shared city and other lives remain intact.

## Save migration

Schema 1 is copied byte for byte to a sibling backup before migration to schema 2. The public world and its clock/civic/property/chat state are retained; other room worlds and their sim rows are archived in the full backup and removed from the active store. Existing user cookies remain valid, password hashes are removed, and identities without a main-world sim enter the creator. Backups stay local and are ignored by Git.
