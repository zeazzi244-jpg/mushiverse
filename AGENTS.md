# MUSHIVERSE development handoff

Before development, read `docs/DEVELOPMENT_STATUS.md`. It is the shared handoff document with the owner; older reports provide history, not current completion evidence.

For every development session, update that document in the same PR branch with: changes, tested commit/commands/results/CI links, progress and its calculation, unfinished tasks, and tasks requiring the owner. Separate coded, locally tested, CI tested, staged, device tested and Apple approved states. Never increase progress solely because source code was added.

Continue on PR #2 (`codex/verified-changes-20261028`) unless the owner changes scope. Do not merge main, change production services, enable real purchases or submit to the App Store under the current authorization. Apple Sandbox and device verification are release requirements. Keep all native, client and server purchase/spending gates off; test injected handlers against mocks/local databases.

Keep secrets out of source, logs, issues and chat. Preserve user records and unverified legacy balances. Use additive, reviewed SQL candidates and isolated test data; do not deploy them to production. Prefer cloud CI for iOS, because the owner uses only an iPhone.

Record blockers precisely and continue independent work. Do not repeat requests for already provided authorization or ask the owner to do work that can be completed and verified in this branch.
