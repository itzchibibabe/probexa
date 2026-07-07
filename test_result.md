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
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "server.py scan_markets and get_setup both accept fresh:int=0. When fresh=1, cache is bypassed. Need to confirm second call returns fresh price snapshot."

  - task: "Consistent Analysis (no contradictions)"
    implemented: true
    working: "NA"
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Grade/action anchored to display_checklist (single source of truth). Additional clamps ensure: action==WAIT ⇒ grade cannot be A+/A silently; A+ requires all checks + structure_ok + trend_ok."

  - task: "Dynamic Setup Validation"
    implemented: true
    working: "NA"
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "structure_ok (HH-HL or LH-LL) and trend_ok gates demote setups that lack structural quality even if numeric bias is strong."

  - task: "Auto Risk:Reward computation"
    implemented: true
    working: "NA"
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "auto_rr picks highest candidate from (3.0, 2.5, 2.0, 1.5) where TP1 stays within resistance*1.03 (long) / support*0.97 (short). TP1/TP2 recomputed using auto_rr. Response includes both risk_reward and auto_rr equal."

  - task: "Strict A+ Grading"
    implemented: true
    working: "NA"
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "A+ requires: direction != neutral AND passed == total_checks AND structure_ok AND trend_ok. HTF unconfirmed and liquidity_sweep=possible_sweep demote A+."

  - task: "Entry Quality metric"
    implemented: true
    working: "NA"
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "entry_quality_score based on distance-from-support (long) or distance-from-resistance (short) normalised by ATR. Label: Excellent ≥85, Good ≥70, Fair ≥50, else Wait for Pullback."

  - task: "Final Validation clamps"
    implemented: true
    working: "NA"
    file: "/app/backend/scan_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Clamps: (a) !structure_ok ⇒ downgrade A+→A; (b) !trend_ok ⇒ A+/A → B/WAIT; (c) action==WAIT ⇒ confidence ≤ 82; (d) A+ ⇒ confidence ≥ 88; (e) A ⇒ 80-89."

frontend:
  - task: "TradeCard renders auto_rr and entry_quality"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/TradeCard.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Card should show Auto RR pill and Entry Quality metric alongside grade/score/action without crashes."

  - task: "Analyze screen passes fresh=1"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/analyze/[symbol].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Refresh action should call /api/setup/{symbol}?fresh=1 and render updated numbers without contradictions."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus:
    - "Live Analysis Refresh via ?fresh=1"
    - "Consistent Analysis (no contradictions)"
    - "Dynamic Setup Validation"
    - "Auto Risk:Reward computation"
    - "Strict A+ Grading"
    - "Entry Quality metric"
    - "Final Validation clamps"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Please perform BACKEND-ONLY verification of the 7 Trading Engine Logic Updates on live data.
      Endpoints:
        GET /api/scan?timeframe=30m
        GET /api/scan?timeframe=30m&fresh=1
        GET /api/setup/BTCUSDT?timeframe=1h
        GET /api/setup/BTCUSDT?timeframe=1h&fresh=1
        GET /api/setup/ETHUSDT?timeframe=30m
        GET /api/setup/SOLUSDT?timeframe=1h
      For every returned setup, invariants to VERIFY (fail if violated):
        (1) grade in {A+, A, B, C}
        (2) action in {BUY, SELL, WAIT}
        (3) If grade == 'A+' → action in {BUY, SELL}, all display_checklist values True, confidence >= 88, direction != 'neutral'
        (4) If action == 'WAIT' → grade in {B, C} AND confidence <= 82
        (5) auto_rr in {1.5, 2.0, 2.5, 3.0} AND auto_rr == risk_reward
        (6) entry_quality_score is int in [0,100] AND label matches band (>=85 Excellent, >=70 Good, >=50 Fair, else Wait for Pullback)
        (7) direction == 'long'  → stop_loss < entry < take_profit_1
            direction == 'short' → stop_loss > entry > take_profit_1
        (8) fresh=1 returns HTTP 200 in <15s (cache bypass) and structure is identical to non-fresh
        (9) No 500s, no missing keys, response schema stable across all pairs.
      Backend uses OKX (do not attempt Binance). Auth is NOT required for /api/scan or /api/setup.
      Please skip frontend for now; I'll take screenshots after backend passes.