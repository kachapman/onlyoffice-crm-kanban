# GitHub releases

Tags are pushed to [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban).

| Tag | Notes file |
|-----|------------|
| `v1.0.0` | [RELEASE_v1.0.md](./RELEASE_v1.0.md) |
| `v1.1.0` | [RELEASE_v1.1.md](./RELEASE_v1.1.md) — fixes, features, upgrade, rollback |
| `v1.2.0` | [RELEASE_v1.2.md](./RELEASE_v1.2.md) — collapse/minimize, tasks list modal, template delete, AND keywords, crash banner, AGENTS.md, polish |

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