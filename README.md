# Everything Shields

Shield runes, materials, and automation for Pathfinder 2e in Foundry VTT.

## Native package support

- Reviewable JSON pack sources remain in `packs/Everything-Shields/`.
- `npm run build` compiles those sources to native LevelDB packs for Foundry V11–V14.
- The release artifact is compatible with V13 and V14. V10 users should remain on the final registered V10-compatible release because V10 predates the shared LevelDB release format.

## Validation

Run:

```bash
npm test -- --runInBand
npm run build
```

## Automated Foundry upgrades

The daily `Watch Foundry major releases` workflow starts when a new Foundry major reaches Testing or Stable. It opens an assigned GitHub issue, which produces normal GitHub email notifications. If `COPILOT_GITHUB_TOKEN` is configured, Copilot CLI may open a draft migration PR only after local tests pass with at least 0.90 confidence. Complex or uncertain migrations stop with a detailed issue comment.

The agent cannot publish. GitHub releases build native LevelDB assets. The separate `Register Foundry package release` workflow can then validate or publish the corresponding package-listing entry. It uses the `foundry-publish` environment and is dry-run by default.

Older releases are preserved through version-pinned GitHub assets and Foundry package entries. If automatic fallback is not available in a particular older Foundry client, users can install the older version's pinned manifest URL manually.

Repository setup required before agent use:

1. Create `COPILOT_GITHUB_TOKEN` as an Actions repository secret using a fine-grained PAT with **Copilot Requests** permission.
2. Create a `foundry-publish` environment, require yourself as its reviewer, and restrict it to `main` or approved release tags.
3. Add `FOUNDRY_RELEASE_TOKEN` to that environment using this module's private Foundry package token.
4. Protect `main` with required checks and require review for migration PRs.
5. Allow Actions to create pull requests and use read/write workflow permissions.
