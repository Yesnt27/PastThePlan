# PastThePlan · FGL

**The agent takes on the planning nobody wants.** FGL is a lore book for a friend group plus a set of narrow agents: a group planner (Lore Keeper), one private agent per person that holds limits nobody says out loud, a chat reader (Scribe), live context (Scout), friendship upkeep (Rekindler) and delivery (Herald). Agents talk to capabilities through MCP servers. Nobody's agent ever speaks for them.

Demo group: *The Wizards Pit* (seed data, Oct 24, 2026).

## Status

- [x] **Phase 0** – the Figma Make prototype ported to Next.js 16 (App Router) + Tailwind v4, all 13 routes on in-memory seed data.
- [ ] Phase 1 – Supabase data, Discord login
- [ ] Phase 2 – Lore Keeper on AI SDK + MCP servers (`book`, `world`)
- [ ] Phase 3 – sealed private limits (`member` MCP server)
- [ ] Phase 4 – Discord bot + Scribe

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Layout

- `app/` – Next.js routes. `app/[[...slug]]` mounts the book (client-side routing via react-router 8).
- `client/` – the book: screens, UI kit, store, agent stand-ins, seed data.
- `public/assets/` – art and demo photos exported from the Figma comps.
