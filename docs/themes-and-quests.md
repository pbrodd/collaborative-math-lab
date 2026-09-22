# Theatrical worlds and visible quests

## Feedback and direction

September 21, 2026: the owner's older son could solve the Siege workbook problems, but the presentation appeared to read as more textbooks. The owner wants dramatically stronger graphics and themes: an over-the-top briefing screen with readouts, lights, and mission-critical objects rotating in space. His younger son, in third grade, seemed more interested. That child regularly describes Roblox adventures inspired by One Piece, where desirable abilities depend on smaller accomplishments, travel, and conversations with characters.

Treat this as feedback from two children and a direction to explore. The working hypothesis is that a compelling world, a desired outcome, and visible progress can invite students into mathematical work they are capable of doing. Validate that hypothesis by letting them use a small playable prototype and observing whether they choose to continue.

## Themes shape the experience

Give each world its own composition, artwork, typography, motion, objects, vocabulary, and response to the student's decisions. Let the opening screen establish what the student wants to accomplish and show the object, team, place, or creation at stake. The mathematical work should visibly affect that world.

| World               | Visual direction                                                                                                         | Mathematical consequences to explore                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Siege               | Dark operations room, luminous tactical map, squad status panels, rotating mission device, route traces, readiness lamps | A chosen delay changes the predicted arrival schedule; compatible windows make the squad ready to launch |
| Brawl Stars         | Saturated arena colors, chunky character or equipment cards, impact effects, animated health and shield bars             | A damage or shield calculation changes a displayed matchup and reveals an upgrade threshold              |
| Pokémon             | Expedition map, creature field guide, specimen turntable, habitat and collection displays                                | Supplied quantities drive resource planning, comparisons, and collection goals                           |
| FIFA / football     | Stadium lighting, broadcast graphics, team formation board, player cards                                                 | Compare supplied statistics, allocate a team budget, and inspect a proposed lineup                       |
| Lemonade Stand      | Sunny street scene, pitcher filling, ingredient crates, serving counter, changing customer queue                         | Recipe batches, stock, prices, and costs change what can be made and sold                                |
| Friendship Bracelet | Tactile bead trays, vivid materials, a growing bracelet preview, gift and design cards                                   | Repeated patterns, counts, symmetry, and material budgets change the student's own design                |
| Island adventure    | A chain of islands, character portraits, inventory, branching quest trails, a magical sword on display                   | Prerequisites, route choices, skill progress, and resource spending determine the available next actions |

These are proposed theme families, with original artwork as the initial asset path. Franchise names identify the interests that inspired them. Supplied game quantities remain labeled as practice data unless a scenario has an actual cited or measured source.

For Siege, make the scene deliberately extravagant: the mission device rotates above the table; selecting a route brings its squad and timing into focus; keeping a supported result updates the schedule; publishing and peer review have distinct readiness indicators. Allow students to replay the predicted schedule. The display must retain the current distinction between a calculated schedule and observations from a real match.

Keep math and controls legible within the spectacle. Support reduced motion, keyboard and touch interaction, and a saved quiet/paper option. Decorative motion can pause independently of the task. A mission deadline belongs to the modeled operation; any real-time challenge would be a separate, optional activity. Preserve the readable offline mission cards.

Theme choice and mathematical help remain independent. Students can use Build, Guide, or Notebook in any world. Support students who want to customize a theme or bring a different interest to an existing problem.

## Younger students: make the goal structure visible

Start with something the child wants: wield the storm sword, reach a new island, recruit a companion, or finish a bracelet for a friend. Show the larger goal from the beginning. Selecting it reveals the smaller goals that make it possible, and selecting a smaller goal reveals an action the student can take now.

Use a small quest map with pictures, short labels, arrows, and countable objects. Offer a matching list view. Introduce formal notation as an optional way to describe an already understood relationship.

| Relationship                | First representation                                          | Optional mathematical connection      |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| One action enables another  | An arrow from a character conversation to a boat pass         | Order and prerequisites               |
| Several things are required | A goal card labeled “Need all” with separate item/skill slots | AND / conjunction                     |
| Different paths can work    | A fork labeled “Choose a way”                                 | OR / alternatives                     |
| More progress is needed     | “7 of 12” with visible filled and empty spaces                | `7 + □ = 12`                          |
| An action repeats           | Groups of objects or repeated stops on a route                | Repeated addition and multiplication  |
| A purchase changes options  | Coins move from inventory into a fare or equipment slot       | Subtraction, budgeting, and tradeoffs |

Keep the first prototype small: one desired object, a few locations, one fork, and one goal that combines prerequisites. Let the child inspect why a goal is unavailable and trace what would make it available.

### Example: earn the storm sword

The sword needs **a wind skill, two crystals, and the swordsmith's permission**. The wind trainer lives on another island. Reaching that island requires a boat pass; crystals can come from either of two visible quests. These are invented adventure rules for the prototype.

The child can plan with cards before acting. A travel decision might involve 20 coins, an 8-coin fare, and 7 coins needed for equipment: “Can I buy this 6-coin hat and still make the trip?” Moving the coins makes the consequence visible. A skill meter might show 7 of 12 points and invite the child to find the missing 5. A friend can pursue another prerequisite, and the map shows how the team's results fit together.

Let students explain a plan by arranging cards, pointing to quantities, or writing a short sentence. Offer expressions such as `20 - 8 - 7 = 5` alongside the objects when useful. Keep the actions and quantities connected to the adventure's rules. Students should also be able to invent or remix a quest and challenge a friend to find a workable path.

Distinguish lasting achievements from spendable resources. Knowing a skill can satisfy several later goals; spending the same coins twice cannot. Shared prerequisites count once, repeatable tasks record each completion, and alternative paths remain available where the rules permit them. Completing any valid plan should work.

## Existing foundation and new work

The application already has saved workbook appearances, named role outputs, task dependencies, collaborative rooms, review history, and map stages with earlier-stage prerequisites. The current scenario schema supports `brawl`, `siege`, and `original` themes and `paper` or `briefing` appearances. Its role tasks and checker are designed around the existing algebra activities.

The first Siege environment is now prototyped. Siege playthroughs using the briefing appearance open in mission control, with a CSS 3D relay, published timing readouts, distinct publication/peer-review counts, an optional arrival rehearsal, and a quiet-view switch. The visual switch and rehearsal controls are temporary display state; the existing workbook saving and mathematical checks remain in use. Reduced-motion preferences stop the animation; the rehearsal also has a manual time slider.

`/siege` is a standalone playable preview of the three initial role problems. It uses the existing equation editor and algebra checks, and fills the readouts only after a finding is transmitted. Its progress is held in memory and resets on reload; saved accounts and workbooks remain in the main application. It exposes no private workbook data. The arrival rehearsal uses the supplied `travel`, `arrival`, `deadline`, and `tolerance` quantities, with exact integer milliseconds for supported nonnegative values up to one hour. Missing values or finer precision leave the rehearsal unavailable. Its schematic movement does not predict geometry, combat, or outcomes in a real game; trying a delay never publishes an answer or confers a proof badge.

A junior quest model still needs explicit alternatives, completion conditions, inventory changes, repeatable actions, and progress records; the current dependency list does not establish those semantics. Build a bounded first adventure before designing a general quest engine. Reuse durable ownership, sharing, remix attribution, and conflict handling. Keep presentation changes separate from mathematical state so changing a theme does not reset progress or invalidate a correct result.

Glyph may later help express facts and prerequisites after its supported execution model is reviewed. This prototype need not depend on that integration. Algebra checks and Lean receipts retain their documented scope; a solved arithmetic question does not certify a whole adventure or arbitrary simulation.

## Candidate prototypes and what to observe

1. **Siege spectacle:** carry one existing mission from its opening briefing through a visibly changed tactical state. Use the current mathematics and saved work. Evaluate whether the student understands the objective, starts without adult translation, and wants to continue after solving it.
2. **Junior island adventure:** let the younger child plan and complete a small branching quest with pictures and quantities, then alter a rule or build a quest for a friend. Observe whether they can explain what is needed, choose a valid next action, and notice a resource tradeoff.

The owner selected Siege as the first prototype. The next evaluation is to try that briefing with the older child and watch whether the spectacle invites continued work. Further worlds should grow from tested interactions and the children's interests.
