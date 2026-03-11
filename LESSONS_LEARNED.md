# Building Cube Diff with AI — Lessons Learned

---

## What We Built

Cube Diff is a collaborative web app for reviewing MTG cube changes with friends.
Load two CubeCobra cube lists, see what's different, propose swaps, leave comment
threads, and share a snapshot URL when you're done — like Google Docs Track Changes
for a card collection.

**Stack:** Vite + React + TypeScript + Tailwind CSS + Firebase (Firestore + Auth),
deployed to Cloudflare Pages. No backend server.

**Total time:** ~13–15 hours across 3 sessions over 2 days.

---

## The Initial Prompt

This was the message that kicked off the build:

> I enjoy cube cobra's diff and changelog features, though I would like to extend
> them so I can discuss and iterate on diffs with my friends. I would like you to
> create a web frontend or wrapper that treats a cube diff like a merge conflict on
> software. I would like to view and comment on swaps, additions or subtractions in
> a way that I can share with others and have them iterate and comment on. So comment
> threads, a diff changelog with owners, and a shareable url. I think we can
> accomplish this with firestore, vite, and bun with no server. For desktop I would
> like two main pannels with an edit or comment state. In edit state, there will be
> two independantly scrollable lists, grouped by color and mana value. The cards will
> be represented by chips with the card name. They will have four states, unselected
> (outlined), selected (filled), accepted (outlined green), removed (outlined red).
> A user will start a review with the first populated category in the order cube cobra
> has it (wubrg acending mana value) with the color and mana value as header of each
> section and the background color of the sections will be the same one cube cobra
> uses. There will be a button that will dynamically change between add/remove/swap
> depending on what the users selection would entail. When pressing it, a modal
> appears with an optional comment box and a save button. There will also be a next
> section and previous section buttons that will set the scroll of both lists to the
> next section for the user to review. The view mode will show the current proposed
> swaps with any comments and the ability to add comments thread style. We'll use
> google auth through firebase and have the comments attributed to the names and
> pictures on the google user accounts. On desktop viewports, card names will show a
> preview of the card on hover and clicking on them will toggle them from selected to
> not selected. If a card in a current change, hover still works, but clicking doesn't
> do anything. On mobile, we can do an eye icon and if tapped opens a fullscreen
> preview of the card with an x to close it. We may have to use blockier ui elements
> than chips on mobile so users have an easy time clicking the view button or toggle
> button. On mobile we can do a stack the lists in a column. So the buttons are
> dynamic swap/add/remove, view current changes, next, previous, and publish. Publish
> generates a hash corresponding to a firebase document that you can pass into the url
> and it will load with the state of the review at time of publish. For the card
> images, I think we can batch fetch the list of cards in the diff in the scryfall api
> and cache them. If that's too big we can try to stay a section or two ahead of the
> user and doing an individual fetch for the card if we don't have it cached. See the
> docs here https://scryfall.com/docs/api. I want you to search the internet for diff
> tools in software that have incredible ux for us to pull inspiration from. I would
> like links so I can try them as well. I do want you to find patterns they have that
> could be a good fit for Cube Diff. Here is an example cube cobra diff is here
> https://cubecobra.com/cube/compare/... and a changelog here https://cubecobra.com/...
> interview me with any additional questions you have or spots I missed

This prompt is genuinely good. It produced a working scaffold in a single session.
But the gaps in it are also where all the rework came from.

---

## What the Prompt Got Right

**It described behavior, not just appearance.** "When the button is pressed, a modal
appears with an optional comment box" is buildable. "Make it look nice" is not. Every
piece of the spec that said *when X happens, Y happens* translated directly into
working code.

**It named the tech stack with a reason.** "Firestore, Vite, and Bun with no server"
told Claude not just what tools to use but why — serverless was a constraint, not a
preference. That context shapes architecture decisions throughout the build.

**It ended with "interview me."** This was the most effective thing in the whole
prompt. Claude asked follow-up questions about the auth model, the sharing flow, and
what should happen when a card is already in a change. Those answers resolved
ambiguities that would otherwise have become bugs.

**It linked reference material.** The CubeCobra diff URL, the Scryfall docs link, and
the request to find comparable tools gave Claude concrete context rather than asking
it to imagine the problem from scratch.

---

## What the Prompt Got Wrong (and What It Cost)

### 1. "The background color of the sections will be the same one CubeCobra uses"

**What happened:** Claude doesn't have visual access to CubeCobra's exact color
palette. It approximated — and got it close but not right. > You have to tell it to boot chrome and pull the hex


The general principle: >Anything external needs to have a specfic tool referenced with /{tool name}
---

### 2. "Two independently scrollable lists"

**What happened:** The frontend had a number of issues and didn't build to the 
plan that it made. I should've used Impeccable /audit and then /critique off the bat


There was a long iterative process that wouldn't been less long, though some things 
I had to figure out what I wanted


### 4. "We'll use Google Auth"

**What happened:** Auth was built as required — you had to sign in to use anything.
A few sessions later the requirement changed: signing in should be optional, with
anonymous users reviewing as "Reviewer 1." This touched the auth flow, comment
attribution, and the UI for the sign-in prompt. It wasn't a huge refactor, but it
was avoidable.

**What would have been better:** Think through the full user journey before
specifying auth. "A first-time visitor with a shared link should be able to read
and comment without signing in. Sign-in is for attribution and identity, not
access." One sentence. Would have saved a refactor.

The general pattern: **auth decisions ripple everywhere.** They affect data models,
UI flows, and permissions. It's worth spending extra time in the spec on who can do
what and when they need to prove who they are.

---

### 5. Cards as chips

**What happened:** The spec said cards would be "chips with the card name." Chips
got built. They looked fine on desktop. On mobile, a list of 80+ cards as chips
requires constant precise tapping and eye-icon hunting. The list also didn't sort
or group as cleanly in chip form.

Mid-build, chips were replaced with rows — a wider card with the name on the left,
the mana cost on the right, and the eye button at a comfortable tap size. This was
mostly a CSS change but required revisiting several interaction states.

**What would have been better:** Specify separately. "On desktop, cards are compact
chips — name and mana cost, small enough to show many per section. On mobile, cards
are full-width rows with larger tap targets." The visual treatment can differ between
platforms even if the data is the same.

---

### 6. "Publish generates a hash corresponding to a Firebase document"

**What happened:** The sharing model was underspecified. Claude built a basic
snapshot that saved state to Firestore and generated a URL. This worked, but several
questions weren't answered: Can you edit after publishing? Can someone who receives
the link continue the review? Does publishing lock the original? What's the URL
format?

These questions surfaced one at a time across multiple sessions, each requiring
small redesigns of the sharing flow. The final model — an immutable snapshot that
anyone can fork and build on, with clean URLs and a refresh button to update — is
significantly better than the initial implementation, but got there through iteration
rather than design.

**What would have been better:** "Publishing creates an immutable snapshot. The URL
should be clean — no `/r/` prefix, just a short hash. The snapshot captures the full
state at that moment. Anyone with the link can add their own comments and proposed
changes and publish a new snapshot from that. The original author can continue
working from their draft and republish without affecting existing snapshots."

Sharing models are surprisingly complex. **If sharing is a core feature, spec it
completely** — what's mutable, what's immutable, who can do what with a shared link,
and what the URL looks like.

---

### 7. Double-faced cards weren't mentioned at all

**What happened:** Magic has cards with two faces — you transform them mid-game.
These need two separate images, a flip button in the preview, and careful handling
because the card's name in CubeCobra might not match either face name in Scryfall's
database.

This wasn't in the spec at all, so it wasn't built. It surfaced as a bug report
("card preview is showing the wrong art") and required a dedicated investigation
into how Scryfall's API handles DFCs, plus special casing for IP-licensed cards
where the MTG face name was renamed (e.g., CubeCobra has "Cren, Undercity Dreamer"
but Scryfall's current database has "Ultimate Spider-Man").

**What would have been better:** "Some cards are double-faced — they have two
different images. The hover preview and fullscreen preview should show both, with
a flip button between them. Some newer cards have IP-licensed names in CubeCobra
that differ from their Scryfall names — treat these as a known edge case that may
need manual lookup."

The broader point: **the AI has general knowledge but not specific knowledge of
your domain's edge cases.** MTG card data is full of them. DFCs, split cards,
adventure cards, Arena-only names, IP renamed cards — each one is a special case
that will surface as a bug if not anticipated. You're the domain expert; put that
knowledge in the spec.

---

### 8. Image caching was underspecified

**What happened:** The prompt mentioned batch-fetching from Scryfall and caching,
but didn't say where the cache lives, how it's shared, or what happens on failure.
Claude built local caching (browser localStorage) which worked for one person.
The Firestore shared cache — where one user's fetch benefits everyone else — came
later as a separate feature request.

The caching system also had a race condition that only showed up on a real phone:
the Firestore cache and the image fetcher both started at the same time, and on
a slower connection the fetcher would run before the cache was ready, causing
every card to fall back to a fresh Scryfall request. On desktop it was fast
enough not to matter. On a phone, the first load showed all placeholders.

**What would have been better:** "Cache card images in Firestore so every user
benefits from lookups other users have already done. Also cache locally in the
browser. On first load, wait for the Firestore cache to be ready before falling
back to Scryfall — the delay is worth it because Scryfall has rate limits and
cold requests are slow on mobile." The pattern — "wait for X before doing Y" — is
easy to spec but easy to miss, and the consequences only appear on slow connections.

---

## Features That Weren't in the Spec at All

These were added mid-build or late in the project. Each one was straightforward
to add once requested — the point is that specifying them upfront would have
produced a cleaner architecture:

- **Anonymous reviewing** (no account required) — changed how auth gates the whole app
- **Comment resolution** — resolve/unresolve threads; affects how changes display
- **@mentions and /card references** — autocomplete in the comment box, card chips in rendered comments
- **Split a change** — extract cards from an existing change into a new one
- **Cube statistics** — total in/out count, net change, how the cube size shifts if changes are applied
- **Refresh icon on share button** — after publishing, the button becomes a re-publish button

None of these are hard to build. But adding them mid-build means going back to
touch data models, UI components, and interaction flows that were already written
with different assumptions. "What are all the things a user might want to do in
a comment?" asked upfront costs nothing. Asked after comments are built, it costs
a refactor.

---

## The Polish Pass

No matter how good the spec is, a first build will have things that feel slightly
off. In this project that meant:

- Spacing and font sizes that were inconsistent between mobile and desktop
- Section headers that were visually too loud — they competed with the cards
- A scrollbar with a visible track background that looked wrong on dark UI
- Buttons that were the right size but didn't communicate their state clearly enough
- Missing favicon, missing SEO metadata, tab title showing the cube IDs instead of the app name

These aren't bugs and they aren't missing features — they're craft. They get caught
by looking at the app with fresh eyes and asking "does this feel right?" Running a
structured design audit (`/impeccable:audit`) at the end of the build is a useful
forcing function for this. It generates a prioritized list of issues that's more
useful than a vague sense that something is off.

The important thing: **budget for a polish pass.** It's not optional if you want
something that feels finished.

---

## On Bugs

Most bugs in this project fell into two categories:

**Bugs from underspecified behavior** — the spec left something ambiguous, Claude
made a reasonable choice, the choice turned out to be wrong for the use case.
Example: when you click a card that's already part of a change, what should happen?
The spec didn't say, so Claude built one behavior, which turned out to be wrong
when tested. Fix was straightforward once the correct behavior was articulated.

**Bugs from real-world conditions the dev environment doesn't simulate** — the
most painful category. The app worked perfectly in development and on desktop.
On a real phone on a real network:

- Slower connection meant the image cache race condition mattered
- iOS double-tap detection caused buttons to need two taps
- A React effect that re-ran when background data changed reset the flip state

None of these were visible until tested on the actual target device. The rule:
**test on a real phone before you think you're done, not after.** Browser
developer tools have a mobile emulator but it doesn't simulate real network
conditions or iOS's touch behavior.

The other thing that helped: learning to read the browser's network tab and
console. The single biggest improvement in bug report quality over the course of
the project was going from "images aren't working" to "sections 4R–2G show no
image, no network request in the tab, no console error — but sections before them
load fine." The second description points to a completely different root cause
than the first, and Claude found it in minutes rather than hours.

---

## What Agentic AI Actually Does

It's worth being direct about what Claude Code is and isn't doing here.

Claude isn't "writing an app." It's executing a continuous loop: read the
codebase, understand the context, make targeted changes, verify they compile,
explain what it did. It holds the entire project in memory and can trace a bug
from a symptom in the UI back through 4 layers of code to the root cause.

What it can't do: see your screen, know your domain, know what you meant when
you were ambiguous, test on your actual phone, or make product decisions.

The sessions where things went fastest were the ones where the human input was
most specific — clear behavior descriptions, real error messages, concrete
examples of what was wrong. The sessions where things went slowest were the
ones with vague inputs that required Claude to guess.

**The quality of what comes out is directly proportional to the quality of what
goes in.** That's the whole game.
