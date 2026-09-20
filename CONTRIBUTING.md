# Contributing

Fork it, experiment, and send a pull request. Code and contributed scenarios are offered under the repository's MIT license. Product naming remains a decision for the students; `collaborative-math-lab` is the neutral repository name.

## Add a scenario

1. Create and test a scenario in the app, or copy an existing JSON file in `scenarios/`.
2. Follow [the scenario format](scenarios/README.md). Include your creator attribution, supplied information, questions, hints, role outputs, intended solutions, and the kind of puzzle you intend.
3. Register the JSON file in `scenarios/catalog.ts`. The home page reads this catalog automatically.
4. Run `npm run scenarios:check`, `npm test`, and `npm run typecheck`. Open the mission and test-play it as a solver.
5. Submit a PR describing the idea, grade-level skills, assumptions, and anything another person should review.

Multiple solutions and contradictory constraints are welcome when intentional. Explain the intended discovery. Keep grade-level algebra central; label optional extensions. Prefer sourceable facts or explicitly invented practice data to claims about current game statistics. Include material you have the right to contribute, and retain attribution when remixing.

## Change the application

See the README for local setup. Keep equality-preserving steps, exact fractions, branch completeness, and readable feedback central. Significant checker or collaboration changes need behavioral tests. Do not make the checker silently accept unsupported mathematics. The interface should support keyboards and small screens.

Reviews should explain the reasoning behind a change request. Offer a concrete example, check an assumption, or propose an alternative. This project is also a place for students to learn how a technical team works.

## Formal proof checks

Scenario PRs also run **Lean proof checks**. Give every mathematical task an intended solution that describes all solutions, including any constraints and absolute-value branches. Open investigations can omit an equation and remain explicitly uncertified. See [the verification guide](verification/README.md) to reproduce checks, inspect proof artifacts, or contribute more rigorous examples. No Lean installation is required just to submit a scenario PR.
