# GitHub releases

Tags are pushed to [onlyoffice-crm-kanban](https://github.com/kachapman/onlyoffice-crm-kanban).

| Tag | Notes file |
|-----|------------|
| `v1.0.0` | [RELEASE_v1.0.md](./RELEASE_v1.0.md) |
| `v1.1.0` | [RELEASE_v1.1.md](./RELEASE_v1.1.md) |

## Publish releases in the GitHub UI

1. Open **Releases** → **Draft a new release**.
2. Choose tag `v1.0.0` → paste body from `docs/RELEASE_v1.0.md` → **Publish release**.
3. Repeat for `v1.1.0` with `docs/RELEASE_v1.1.md`.

## Or with GitHub CLI

```bash
gh release create v1.0.0 --title "v1.0.0" --notes-file docs/RELEASE_v1.0.md
gh release create v1.1.0 --title "v1.1.0" --notes-file docs/RELEASE_v1.1.md
```