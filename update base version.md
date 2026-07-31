Check whether local data matches TfL’s active base version:

1. npm run check:ibus-base-versions
To fail the process when outdated (same as CI):

npm run check:ibus-base-versions -- --fail-on-outdated
Update to the active version:

npm run import:ibus:active
npm run rebuild:ibus-manifest
npm run verify:ibus-local
Optional sanity check after that: npm run typecheck.


2. Then stage the new data (version dirs are gitignored, so force-add):

git add public/data/ibus/current.json
git add -f public/data/ibus/20260731

3. Commit & push (when you're ready):


git commit -m "Update iBus static data to active base version 20260731"
git push