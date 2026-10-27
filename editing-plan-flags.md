# Flags the V2 editing plan depends on

This list was read from origin/main of every repo involved on Oct 25, 2026. Flags are evaluated per user unless marked otherwise.

**Fail-closed:** the flag is off when it's missing or LaunchDarkly can't be reached.
**Fail-open:** the flag is on in those cases.

## 1. Who gets the plan at all (all of these must hold)

| Flag (LaunchDarkly key) | Repo | What it gates | Default |
|---|---|---|---|
| `feat_first_edit_editing_plan` (client: `featFirstEditEditingPlan`) | agents, co_creator, agents_panel, editor, nexus | The master switch: welcome, plan cards, Let's start, resume, panel opens from plan rows, the Editor agent opening on edits (nexus#560) | Fail-closed |
| `feat_AT-893_agents-experiment` (client: `featAt893AgentsExperiment`) | agents, co_creator, agents_panel, editor, nexus | The plan only runs in the `Treatment` or `NexusAgents` arm. `NexusAgents` also turns on Nexus hosting of the editor and the agents dock | Fail-closed (no arm) |
| `feat_agents_v2_web_client` (client: `featAgentsV2WebClient`) | co_creator, agents_panel | V1 or V2 chat. The plan is V2 only | Off |
| `ops_agents_v2_runtime_ownership` | agents | `v2` serves the user. `v1` skips the welcome. Anything else retries or refuses | Neither open nor closed |
| env `EDITING_PLAN_WELCOME_DELIVERY` | agents | Master switch for every proactive path: welcome, preparing, export-ready, sweepers | prod `enabled`; **staging unset (off)** |
| env `EDITING_PLAN_MIN_RECORDING_SECONDS` | agents | No welcome or new-edit plan below this length. A plan the user asks for in chat has no minimum | prod `600`; staging unset (0) |
| Not a flag: client capabilities | co_creator | The client must declare the plan card capabilities. iOS doesn't, so iOS has no plan | — |

## 2. Delivery and plan UI (agents runtime, co_creator)

| Flag | Repo | What it gates | Default |
|---|---|---|---|
| `ops_agents_v2_plan_step_cards` | agents | Kill switch for the per-step cards and questions | **Fail-open** |
| `ops_agents_v2_welcome_retry_parking` | agents | Parks a stuck welcome after 45 s instead of retrying it in place | Fail-closed. **Read before the user is known, so it's effectively global** |
| `ops_agents_v2_plan_export_ready_message` | agents | The "export ready" message | Fail-closed (literal true) |
| `ops_agents_v2_plan_motion_prefetch` | agents | Starts motion suggestions early, at the wait line | Fail-closed (literal true) |
| `ops_agents_v2_editing_plan_bi` (client: `opsAgentsV2EditingPlanBi`) | agents, co_creator | BI events such as `aiChatEditingPlanWelcomePosted`. Also needs `ANALYTICS_EVENTS_TOPIC` | Fail-closed (now on for all) |
| `ops_agents_v2_realtime_publish` | agents | Live realtime push for every conversation write, plan messages included | Fail-closed |
| `feat_AT-187_…` (client: `featAt187RequestProgressV2`, inferred key) | co_creator | The "preparing your plan" progress row shows only with this on | Off |
| `featAt1288FastFirstChatOpen`, `featAt1258ParkClosedDock` | co_creator, agents_panel | Chat opening and dock behaviour the plan chat uses | Off |
| env `EDITING_PLAN_READY_PUSH` | agents | Phone push for a ready plan | Disabled in prod and staging |

## 3. Where the user sees it (Nexus dock, editor)

| Flag | Repo | What it gates | Default |
|---|---|---|---|
| `featShi809SidebarRewrite` | nexus | Sidebar V2. The agents page and the editor dock default need it | Off |
| `feat_AT-1263_editor-agents-start-closed` | nexus | Internal opt-out: the Editor's agents dock starts closed | Off |
| `featAt876DashboardSidebarAgents` | nexus | Agents list in the dashboard sidebar | Off |
| `fix_AT-1254_agents-dock-idle-open` | nexus | How the dock opens in studio | Off |
| `coCreatorInWasmEditor` | editor | Legacy Co-Creator sidebar, hidden in the Nexus view | — |

## 4. Plan steps: Director, editing-mcp, engine, editor panels

| Step | Flag | Repo | Effect when off (or when not in the arm) | Default |
|---|---|---|---|---|
| All | `ops_agents_v2_red_routing` | agents | Routes Director tasks to RED roles; off means everything goes to the old Director | **Fail-open** |
| All | `ai-director-kill-switch` | ai-director | On: every Director feature falls back, and RED is downgraded to the old Director | Off |
| All | `ai-director-model-profile` / `-skills-assembly` / `-tool-policy` | ai-director | Director prompt, tools and model | "default" |
| All | `ops_director_conflict_auto_retry` | ai-director | Redo automatically on a revision conflict, or ask the user | Off |
| All writes | `ops_agent_write_retry`, `ops_agent_write_always_locked`, `ops_commit_readback_guard_disabled` | editing-mcp | Save retry, locking, and the read-back guard (the last one is a kill switch) | Off |
| Rough cut | `ai-director-rough-cuts-version`, `ai-director-rough-cuts-generic-skeleton-arm` | ai-director | Which rough-cut version and arm | "v1" / none |
| Rough cut | `ai-director-editorial-questions-card` → `ai-director-cut-suggestions-ab-test` → `ai-director-editorial-lenient-curation` | ai-director | Only the "Treatment" arm gives the old Director the cut review card (`propose_cut_suggestions`) | Off / "Exclude" |
| Rough cut | `ops_EB-389_clamp_trailing_range` | editing-mcp | Clamps trailing cut ranges | Off |
| Fillers | `feat_PLAY-2229_filler_words` | engine (seeded by editing-mcp) | **Off: the filler list is "unavailable", so all fillers are removed at once with no review (about 22% of users, Shir included)** | Inferred off |
| Fillers | `feat_EUA-2311_…` (client: `featEua2311FillerWordsReview`) | editor | The plan's filler row opens the review; otherwise it opens the old Remove Filler Words tool. Prerequisite of PLAY-2229 | Off |
| Fillers / cuts | `feat_PLAY-2508_avoid_harsh_cuts`, `feat_PLAY-1911_smooth_audio_cuts`, `fix_PLAY-2637_context_filler_captions` | engine | Harsh-cut marking, cut padding, filler captions | Compiled default |
| Pauses | `featEua2530RemovePausesV2` (+ remove-pauses A/B) | editor | The pauses row opens the V2 panel; otherwise the old tool | Off |
| Layouts | `feat_PLAY-2566_smart_layouts` (client: `featPlay2566SmartLayouts`) | engine, editor | Off: the smart-layout options are "unavailable", and the step falls back to the current Smart Layouts | Inferred off |
| Layouts | `config_PLAY-2570_smart_layouts_pacing`, `smartLayoutsControlsConfig` | engine, agents | Pace presets. Missing means no pace question | Built-in / none |
| Layouts | `ai-director-skill-smart-layouts` | ai-director | v2 = refinement tools, v3 = ai-smart-layouts service. Absent means no refinement skill | Absent |
| Layouts | `ops_EB-491_visual_geometry_guard` | editing-mcp | Rejects geometry writes to recording tiles | Off |
| Sound | `ops_EB-1287_magic_audio_generation` | editing-mcp | **Off: Magic Audio is switched on but enhancement never starts** | Off |
| Brand / captions | `ops_EB-1267_apply_brand_captions_list` | editing-mcp | Off: the brand kit's caption style is ignored | Off |
| Motion | `feat_COCO-866_motion_suggestions` | ai-director, editor | Off: no motion suggestion cards. In the editor, also motion review in the comments panel | Off |
| Motion | `feat_AT-900_open_prompt_motion_suggestions` | hyperframes-mcp | Open-prompt generation instead of templates. Targeting is by user and account keys only | Off |
| Motion | `ai-director-hyperframe-overlay`, `feat_AT-567_motion_composer` | ai-director, co_creator | HyperFrames tools and the composer | Off |
| Music (extra step) | `ai-director-skill-stock-audio` | ai-director | Exposes stock music | Absent |
| Export | `feat_EEU-979_…` (client: `featEeu979ShareDropdownMenu`) | editor | The export step opens the share dropdown or the export panel | Off |
| Export | `feat_PLAY-2108_export_enhanced_audio`, `feat_PLAY-2228_export_scene_bound_sync_shift` | engine (export renderer) | Export rendering | Compiled default |

Smart Mute and pauses (in the engine) read no flag.

## Things worth fixing or knowing

1. **The welcome can't be tested on staging.** `EDITING_PLAN_WELCOME_DELIVERY` is unset on staging, so recording-ready and new-edit welcomes only fire in prod.
2. **Flags that quietly degrade a step while the plan still says done:**
   - `feat_PLAY-2229` (fillers);
   - `ops_EB-1287` (Magic Audio never generates);
   - `ai-director-skill-smart-layouts` absent (no layout refinement);
   - the cut-suggestions arm (no cut review card on the old Director);
   - `ops_EB-1267` (brand caption style).
3. **The plan flag is checked differently in different repos.** co_creator and agents_panel need the plan flag AND the AT-893 arm. The editor and Nexus read the raw plan flag. If the plan flag is opened to everyone, Control-arm editor users get motion review in the comments panel.
4. **Fail-open kill switches:** `ops_agents_v2_red_routing` and `ops_agents_v2_plan_step_cards` stay on if LaunchDarkly is down. Everything else in the plan fails closed.
5. **`ops_agents_v2_welcome_retry_parking` can't be targeted per user.** It's evaluated before the user is known.
6. **Proactive paths (welcome, export-ready) evaluate flags as the recording's owner.** riversidefm/agents#650 changes the recipient to the maker; the plan flag is then evaluated for that user.
7. **Leftovers:**
   - `ops_agents_v2_mcp_additions` is no longer read, but config comments and the RUNBOOK still describe it.
   - The `EDITING_PLAN_FLAG` constant is unused.
   - The "literal true" comment on the plan flag isn't enforced: any truthy value turns it on.
8. **Targeting gaps:** editing-mcp and engine flags depend on the forwarded LaunchDarkly profile; without it, the anonymous profile is used. hyperframes-mcp only targets on user and account keys.

Keys marked "inferred" come from the repo's naming pattern; check them in LaunchDarkly.
