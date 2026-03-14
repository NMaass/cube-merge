# Cube Merge

A collaborative review tool for Magic: The Gathering cube curators. Compare two cube lists side-by-side, annotate proposed changes, and work with your playgroup in real-time — no accounts required.

**[→ Try it live](https://cube-merge.pages.dev)**

## What it does

Cube Merge lets you load two CubeCobra cubes and start a shared review session. You select cards from the diff, group them into changes (add, remove, swap, keep, or reject), and leave comments for your group to discuss. Everyone works in the same session simultaneously — changes sync live across devices.

Notable features:
- **Real-time collaboration** — anonymous, no sign-in needed; just share the link
- **Session changelog** — all work is grouped by author and time into sessions, with full edit history
- **Branching** — fork a review from any set of sessions to continue work in a new direction
- **Card images** — hover to preview, click to enlarge; images are cached across all users
- **Export** — copy results as a summary or as CubeCobra-ready add/remove lists
- **CubeCobra integration** — paste a cube ID, URL, or compare URL to get started instantly

## Running locally

Requires [Bun](https://bun.sh) and your own Firebase project with Firestore enabled.

```sh
bun install
cp .env.example .env   # fill in your Firebase credentials
bun dev
```

See `.env.example` for the required environment variables.

## Example review

Add a concrete walkthrough here once you have one ready. A good example section should include:
- the two source cubes or compare URL
- a link to the generated review
- a short before/after summary of the changes discussed
- one screenshot or GIF of the review UI

This is worth adding for first-time users because the app is more immediately understandable when they can inspect a real review before creating their own.

## Tech stack

Vite · React · TypeScript · Firebase Firestore · Tailwind CSS
