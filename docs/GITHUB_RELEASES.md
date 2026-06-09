# GitHub releases

Tags are pushed to [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban).

| Tag | Notes file |
|-----|------------|
| `v1.0.0` | [RELEASE_v1.0.md](./RELEASE_v1.0.md) |
| `v1.1.0` | [RELEASE_v1.1.md](./RELEASE_v1.1.md) — fixes, features, upgrade, rollback |
| `v1.2.0` | [RELEASE_v1.2.md](./RELEASE_v1.2.md) — collapse/minimize, tasks list modal, template delete, AND keywords, crash banner, AGENTS.md, polish |
| `v1.4.5` | [RELEASE_v1.4.5.md](./RELEASE_v1.4.5.md) — Side-by-side preview note editor (left/top + delete + manual refresh btn), presence AFD (tab-away vs offline), today feed white left lines, crash banner (amber right, persistent, 30s/admin text) + full tile render (CRM sections empty), quick note side auto-refresh. All prior presence/kanban/rich notes foundations. |
| `v1.4.0` | [RELEASE_v1.4.md](./RELEASE_v1.4.md) — Local kanban title bar edit + column color + slide via edit (scrapped drag) + add-task blur crash fix; Presence demo indicator stable (no flash, session flag) + inbox unread/read shading (blue border/dot, demo special) + update on close (v1.4.0) |
| `v1.3.0` | [RELEASE_v1.3.md](./RELEASE_v1.3.md) — Team/Presence (DMs+replies+reads+emojis+colors+inbox+admin+indicators), resizable+taller modal, instant button, routing fixes (v1.3.0) |

**Server deploy (verify each step):** [UPDATE_AND_DEPLOY.txt](./UPDATE_AND_DEPLOY.txt) (Part B) and the v1.1 verify checklist (still applicable; hard-refresh browser after deploy for static assets).

## Publish releases in the GitHub UI

1. Open **Releases** → **Draft a new release**.
2. Choose tag `v1.0.0` → paste body from `docs/RELEASE_v1.0.md` → **Publish release**.
3. Repeat for `v1.1.0` with `docs/RELEASE_v1.1.md`.

## Or with GitHub CLI

```bash
gh release create v1.0.0 --title "v1.0.0" --notes-file docs/RELEASE_v1.0.md
gh release create v1.1.0 --title "v1.1.0" --notes-file docs/RELEASE_v1.1.md
```