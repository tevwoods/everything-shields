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

The daily `Watch Foundry major releases` workflow starts when a new Foundry major reaches Testing or Stable. It opens an assigned GitHub issue, which produces normal GitHub email notifications. Copilot CLI authenticates with the workflow's built-in `GITHUB_TOKEN` and `copilot-requests: write` permission. It may open a draft migration PR only after local tests pass with at least 0.90 confidence. If the account or plan cannot authorize the Copilot request, the workflow posts the failure for review instead.

The agent cannot publish. When you create and publish a GitHub Release, the release workflow builds native LevelDB assets and uploads the versioned ZIP plus `module.json`. Users continue to install from the repository's stable `releases/latest/download/module.json` URL.

Older releases are preserved through version-pinned GitHub assets and Foundry package entries. If automatic fallback is not available in a particular older Foundry client, users can install the older version's pinned manifest URL manually.

Repository setup required before agent use:

1. Confirm the account has Copilot access for Actions/Copilot CLI; no PAT is normally required.
2. Keep older GitHub Releases and their versioned manifest assets available for users who remain on older Foundry versions.
