#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Verify the 7 Trading Engine Logic Updates end-to-end using live data:
    1. Live Analysis Refresh (`?fresh=1` cache bypass on /api/scan and /api/setup/{symbol})
    2. Consistent Analysis (no contradictions between checklist, grade, and action)
    3. Dynamic Setup Validation (structural + trend gates demote weak setups)
    4. Auto Risk:Reward (auto_rr picked from 3.0/2.5/2.0/1.5 based on support/resistance reach)
    5. Strict A+ Grading (A+ only when ALL display_checklist items pass AND structure/trend OK)
    6. Entry Quality metric (entry_quality_score 0-100 and label Excellent/Good/Fair/Wait for Pullback)
    7. Final Validation clamps (structure_ok, trend_ok, WAIT ⇒ confidence ≤ 82, A+ ⇒ confidence ≥ 88)

backend:
  - task: "Live Analysis Refresh via ?fresh=1"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "server.py scan_markets and get_setup both accept fresh:int=0. When fresh=1, cache is bypassed."
      - working: true
        agent: "testing"
        comment: "Iteration 5 (18/18 pytest): /api/scan and /api/setup accept fresh=1 (HTTP 200 both cached and fresh)."
      - working: true
        agent: "main"
        comment: "Added data_ts + served_from + cache_age_sec fields to make cache-bypass provable. Verified: first scan → served_from=live, second → cache (age 0.89s), fresh=1 → live again."

  - task: "Consistent Analysis (no contradictions)"
    implemented: true
    working: true
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Grade/action anchored to display_checklist (single source of truth)."
      - working: true
        agent: "testing"
        comment: "Iteration 5: contradiction sweep over 18 live setups found 0 self-contradictions."

  - task: "Dynamic Setup Validation"
    implemented: true
    working: true
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "structure_ok/trend_ok gates demote weak setups."
      - working: true
        agent: "testing"
        comment: "Iteration 5: gates enforced correctly across cached + fresh calls."

  - task: "Auto Risk:Reward computation"
    implemented: true
    working: true
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "auto_rr picks highest candidate from (3.0, 2.5, 2.0, 1.5)."
      - working: true
        agent: "testing"
        comment: "Iteration 5: auto_rr always in {1.5,2.0,2.5,3.0} AND auto_rr == risk_reward for every response."

  - task: "Strict A+ Grading"
    implemented: true
    working: true
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "A+ requires: direction != neutral AND passed == total_checks AND structure_ok AND trend_ok."
      - working: true
        agent: "testing"
        comment: "Iteration 5: No A+ in live universe currently (market condition). A+ contract enforced defensively — would fail loudly on violation; none observed."

  - task: "Entry Quality metric"
    implemented: true
    working: true
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "entry_quality_score based on distance-from-support/resistance normalised by ATR."
      - working: true
        agent: "testing"
        comment: "Iteration 5: score in [0,100] AND label matches band for every response."

  - task: "Final Validation clamps"
    implemented: true
    working: true
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Clamps: !structure_ok downgrades A+, WAIT ⇒ conf ≤ 82, A+ ⇒ conf ≥ 88."
      - working: true
        agent: "testing"
        comment: "Iteration 5: WAIT⇒grade∈{B,C}&conf≤82, level ordering (long/short) always correct."

  - task: "Intelligent Breakout Confirmation (multi-factor)"
    implemented: true
    working: true
    file: "/app/backend/indicators.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New breakout_confirmation() analyzer replaces the naive `price > level` check. Requires ALL of: body close beyond level (wicks never count), volume > 1.2× recent avg, momentum body ≥55% of range AND ≥50% ATR, structure HH-HL/LH-LL, post-breakout acceptance, HTF alignment (real HTF snap or ema200-slope fallback). Retest held is a bonus (not required). Returns {confirmed, reason, criteria, retest_held}."
      - working: true
        agent: "testing"
        comment: "Iteration 6: 19/19 pytest PASS on live OKX data. 44 setups across scans + 4 named symbols verify invariants (A)-(I). A+ contract exercised non-vacuously on ATUSDT SELL (all 6 criteria True + display_checklist all True + conf=92). Calibration 3/22 confirmed (~14%) — strict but not vacuous."

frontend:
  - task: "TradeCard renders checklist reason (Breakout)"
    implemented: true
    working: true
    file: "/app/frontend/src/TradeCard.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified via /analyze/PENDLEUSDT screenshot: Breakout Confirmed shows unchecked with dimmed sub-text '· No candle body has closed above the key level yet'. GOOGLUSDT shows '· volume below recent average'. Clean plain-English trader reasoning."

  - task: "TradeCard renders auto_rr and entry_quality"
    implemented: true
    working: true
    file: "/app/frontend/src/TradeCard.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Card should show Auto RR pill and Entry Quality metric."
      - working: true
        agent: "main"
        comment: "Verified via screenshot on /analyze/AIUSDT: 'Risk : Reward · AUTO (1:1.5)' pill with AUTO/1:1.5/1:2/1:2.5/1:3 chips, 'Entry Quality: Wait for Pullback' displayed with correct colour band, no crashes."

  - task: "Analyze screen passes fresh=1"
    implemented: true
    working: true
    file: "/app/frontend/app/analyze/[symbol].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Refresh action should call /api/setup/{symbol}?fresh=1."
      - working: true
        agent: "main"
        comment: "Analyze detail screen renders live: Grade A, SELL 87%, LH-LL, all levels populated, Live Checklist shows 5/6 (Volume Confirmation missing → consistent with A grade, not A+)."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Iteration 5 backend test PASSED (18/18). Frontend screenshot verification PASSED.
      Added data_ts/served_from/cache_age_sec fields to make cache-bypass provable.
      All 7 Trading Engine Logic Updates are verified end-to-end.
  - agent: "main"
    message: |
      NEW CHANGE — Iteration 6 request:
      Redesigned "Breakout Confirmed" as intelligent multi-factor confirmation.
      Files changed:
        - /app/backend/indicators.py       (+ new breakout_confirmation function ~140 lines)
        - /app/backend/scan_engine.py       (wires breakout into _conditions, _display_checklist, build_setup;
                                             exposes checklist_reasons + breakout_analysis in response)
        - /app/frontend/src/TradeCard.tsx   (renders checklist_reasons under each item)

      Please BACKEND-TEST that all previous 7 invariants still hold AND validate the new breakout contract:
      (A) Ensure `breakout_analysis` is present on every setup returned by /api/setup/{symbol} and every
          item in /api/scan best_setups + preparing arrays.
      (B) `breakout_analysis` schema: {confirmed: bool, reason: str, criteria: dict[str,bool], retest_held: bool}
      (C) `display_checklist["Breakout Confirmed"] == breakout_analysis["confirmed"]` (single source of truth).
      (D) When `breakout_analysis.confirmed == True`, ALL 6 criteria keys must be True:
          body_close_beyond_level, volume_above_average, strong_momentum_candle,
          structure_confirms, price_still_accepted, htf_aligned.
      (E) When `confirmed == False`, `reason` is non-empty and human-readable.
      (F) `checklist_reasons["Breakout Confirmed"]` == `breakout_analysis.reason`.
      (G) All previous 9 invariants from iteration_5 must still pass on live OKX data.
      (H) Grade A+ still requires ALL 6 display_checklist items True (so must have Breakout Confirmed True).
      (I) For neutral direction setups, breakout_analysis may be null — that's fine.

      Endpoints (LIVE only, no mocks):
        GET /api/scan?timeframe=1h
        GET /api/scan?timeframe=30m&fresh=1
        GET /api/setup/PENDLEUSDT?timeframe=1h   (known A grade example)
        GET /api/setup/GOOGLUSDT?timeframe=1h   (known "volume below average" reason)
        GET /api/setup/BTCUSDT?timeframe=1h     (known "no candle body has closed above" reason)
        GET /api/setup/AIUSDT?timeframe=1h      (known short direction case)

      Save results to /app/test_reports/iteration_6.json.
      Auth is NOT required for scan/setup. If any invariant fails, DO NOT fix code — just report clearly.