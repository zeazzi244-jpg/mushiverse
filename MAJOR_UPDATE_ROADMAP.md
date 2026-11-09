# MUSHIVERSE — Major Update Roadmap

## Founder vision and product north star (2026-11-08)
The founder's enduring goals are **financial success**, **sharing the beauty and fascination of insects worldwide**, **building global recognition**, and **creating a lasting historical contribution through MUSHIVERSE**. Treat these goals as the north star for future design, product, engineering and marketing decisions.

Aim for a world-leading insect app. There is no guarantee of reaching #1, but do not impose arbitrary limits on the ambition. Test bold hypotheses through measurable, responsible iteration.

### Engagement principles
- Create voluntary, sustainable return visits through curiosity, discovery, meaningful progression, collection, learning and community.
- Study user motivations and behavior patterns: first-time explorers, children with guardians, casual nature lovers, collectors, photographers, students and expert naturalists.
- Give each group a satisfying path from first discovery to long-term mastery.
- Reward **real learning and safe outdoor exploration**, not compulsive checking.
- Use transparent, fair reward mechanics. No deceptive scarcity, manipulative notifications, exploitative streak penalties or pressure on children to purchase.
- Optimize for meaningful 7-day/30-day retention, genuine discoveries, learning outcomes, user trust and sustainable revenue—not screen time at any cost.
- Keep virtual fantasy insect cards separate from verified wildlife records.

### Business principles
- Evaluate monetization through ethical premium features, appropriate digital purchases and optional ads with child/privacy safeguards.
- Track activation, retained explorers, purchase conversion, refunds, satisfaction and real operating costs.
- Protect user trust and wildlife conservation as competitive advantages.

## Product vision
Turn MUSHIVERSE into a joyful insect discovery adventure: **find real insects, document sightings, learn responsibly, connect with other explorers, and collect fantasy insect cards**. Keep real wildlife observations clearly separate from fictional gacha cards.

## Release 1: quality and delight, without breaking existing users
- [x] Adventure-themed hero on Home with Record / Collection shortcuts.
- [x] New introductions on Record, Gacha, Collection, Map and Profile.
- [x] Shared responsive styling in `css/adventure-ui.css` with visible keyboard focus and reduced-motion support.
- [x] Regression test ensuring the CSS and six screens ship in the offline web bundle.
- [ ] Verify six-screen navigation and iPhone safe areas on device.
- [ ] Reduce Home clutter based on real screenshot and runtime behavior, without hiding important notices or controls.
- [ ] Test new and existing users, login, records, camera, offline behavior and cold start.
- [ ] Test screen reader labels, contrast and minimum touch target size.
- [ ] Confirm production backend access rules and prevent location exposure.

## Release 2: core experience
- [ ] Guided first discovery for new users, with skip and return options.
- [ ] Seasonal field challenges backed by verified data, not fabricated wildlife sightings.
- [ ] More rewarding collection milestones and accurate completion metrics.
- [ ] Meaningful social feed with loading, empty and error states.
- [ ] Map discovery with city-level privacy defaults; precise locations only by explicit consent.
- [ ] Quality AI species identification with uncertainty and manual correction.

## Release 3: community and global readiness
- [ ] Accessible Japanese/English localization without mixed-language UI.
- [ ] Moderation/report/block tools and child safety controls.
- [ ] Analytics for activation, 7-day retention, crash-free sessions and content quality.
- [ ] Privacy policy, account deletion, App Store disclosures and child-directed compliance review.
- [ ] Purchase entitlement server verification, restore purchases and clear odds/price disclosures.
- [ ] Performance budget and tests on lower-end iPhones.

## Non-negotiables
- Do not claim that real sightings are confirmed solely by AI or camera capture.
- Keep fantasy gacha distinct from biological records; do not encourage unsafe collecting or disturbing protected species.
- No speculative revenue guarantees, fake user counts or fake rankings.
- Never expose secrets, signing certificates, exact private coordinates or personal data in public commits.
- No new monetization switches or payment charges without verified platform compliance and user authorization.

## Next Work execution order
1. Fetch latest `main` and review `WORK_HANDOFF.md`.
2. Check CI status and fix failures; run `npm run test:release` in a real Node environment.
3. Place the **approved** icon PNG at `assets/MUSHIVERSE-AppIcon-1024.png`; do not regenerate it.
4. Run `npm install`, `npm run ios:prepare` on macOS with Xcode; verify native icon and build.
5. Test on iPhone/TestFlight, especially cold start, white screen, all tabs and purchase safety.
6. Prepare App Store Connect metadata, screenshots, privacy declarations and submit only with required approvals.

## Completion criteria
A commit is not a shipped release. Mark features as complete only when the code is merged, automated tests pass, and relevant device/production checks are verified.
