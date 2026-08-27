# Photographs

Files here are served at `/images/…` and are part of the build, so they
survive on Render's free tier — nothing is written at runtime.

## Two kinds

**Editorial** — fixed slots referenced directly in the locale files:
`pillars/` (the three archive traditions) and `projects/` (the three offset
sites).

**Per record** — one photograph per database row, referenced by the
`imageUrl` column on `Listing`, `Product`, `ArchiveEntry` and `Provider`:
`listings/`, `products/`, `archive/`, `portraits/`. Set the column to the
path, e.g. `/images/listings/hbia-longhouse.jpg`.

A row with no `imageUrl` renders a labelled placeholder. That is a normal
state, not a broken one — photographs arrive a few at a time, and every
screen has to render a mix for a long while.

## Before adding a photograph

This platform's claim is that what it publishes was contributed by the
household it belongs to and cleared by the Community Governance Committee.
A stock photograph of "an ethnic minority person" placed in the archive
would contradict that claim in exactly the place it is being made.

So: only photographs the community has actually given, with permission
recorded. If one is not available yet, leave the placeholder — it is
honest, and it says what the picture will be.

## Format

JPEG or WebP, longest edge ~1600px, under ~300KB. Name by content, not by
slot (`ami-hbia-loom.jpg`, not `image1.jpg`), so a file that moves between
screens still makes sense.

Note `longhouse.png` in `src/assets/` is 2.8MB — larger than everything
else on the landing page combined. Worth re-exporting.
