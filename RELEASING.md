# Releasing the frontend

Production must always run a commit that is on `master`.

## Rules

1. **All work is built on `master`.** Start feature and fix branches from the current `origin/master`.
2. **Deploying = pushing to `master`.** A push to `master` runs **Deploy Frontend**, which deploys that
   `master` build. Tag the deployed `master` commit (`v2.5.47.<n>-<short-name>`, same number as the matching
   backend release when there is one) for the record. Tag pushes run **Frontend Release** in verify-only
   mode; they never deploy.
3. **Release branches are short-lived.** A `release/<n>-<name>` branch may only be created from
   `origin/master`, and it must be merged back into `master` (a real merge, no force push) immediately.
   Never deploy from a release branch: the next `master` push would overwrite it.
4. No force pushes or history rewriting on `master`.

## Before pushing to master

```bash
npm ci
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run check:guides
npm run build
```

After the push, confirm **Deploy Frontend** succeeded and that the live bundle on https://equip.iitr.ac.in/
contains the new change.
