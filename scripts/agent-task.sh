#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  agent-task.sh <task-id> [options]

Create + run:
  ./agent-task.sh TASK-123 --base develop --task "Implement checkout validation"
  ./agent-task.sh TASK-123 --base develop --task-file ./task.md

Prepare only:
  ./agent-task.sh TASK-123 --base develop --task-file ./task.md --prepare-only

Run an already prepared task:
  ./agent-task.sh TASK-123 --run-existing

Run bootstrap only:
  ./agent-task.sh TASK-123 --bootstrap-only

Run verification only:
  ./agent-task.sh TASK-123 --verify-only

Run reviewer only:
  ./agent-task.sh TASK-123 --review-only

Options:
  --base <ref>            Base branch/ref. Defaults to current branch.
  --task <text>           Short task description.
  --task-file <path>      Existing Markdown/text task description.
  --prepare-only          Create worktree + task files, but do not run Codex.
  --run-existing          Reuse the expected worktree/run directory and run Codex.
  --bootstrap-only        Reuse an existing task and run only workspace bootstrap.
  --skip-bootstrap         Skip dependency/bootstrap setup.
  --bootstrap-cmd <cmd>    Explicit bootstrap command instead of auto-detection.
  --verify-only           Reuse an existing task and run only deterministic verification.
  --skip-verification     Run Implementer but skip deterministic verification.
  --verify-cmd <command>  Add an explicit verification command. Repeatable.
                          If at least one is supplied, these replace auto-detected
                          package.json scripts (git diff --check still runs).
  --review-only           Run only the independent Reviewer Agent.
                          Requires a PASS verification report.
  --skip-review           Stop after deterministic verification.
  --model <model>         Optional Codex model override for Implementer.
  --review-model <model>  Optional model override for Reviewer.
                          Defaults to --model / Codex config.
  -h, --help              Show help.

Automatic fix loop:
  The normal pipeline allows at most 3 implementation iterations.
  A new iteration is triggered by:
    - deterministic verification FAIL
    - Reviewer verdict NEEDS_CHANGES
  Bootstrap/Codex infrastructure errors and invalid Reviewer output stop immediately.

Default bootstrap:
  If package.json exists, detect the package manager and require a lockfile:
    pnpm -> pnpm install --frozen-lockfile
    npm  -> npm ci
    yarn -> yarn install --immutable (Yarn 2+) or --frozen-lockfile (Yarn 1)
    bun  -> bun install --frozen-lockfile

Default verification:
  1. git diff --check
  2. If package.json exists, auto-detect package manager and run existing scripts:
       lint
       typecheck
       test
       build

Layout:
  <projects>/
    my-app/
    .worktrees/my-app/task-123/
    .agent-runs/my-app/task-123/
      task.md
      IMPLEMENTER.md
      prompt.md
      bootstrap-report.md
      bootstrap.log
      implementation-report.md
      codex.log
      verification-report.md
      verification.log
      REVIEWER.md
      review.diff
      review-prompt.md
      review-report.md
      reviewer.log
      pipeline-summary.md
      iterations/
        01/
        02/
        03/

Notes:
  - Agent metadata stays outside the Git worktree.
  - Ignored files such as .env and node_modules are not copied automatically.
  - The Implementer is instructed NOT to commit or push.
  - Bootstrap runs before the Implementer and before standalone verification.
  - Bootstrap uses frozen/immutable installs by default and fails when a JS
    project has no supported lockfile; use --bootstrap-cmd to override.
  - Verification does not trust the Implementer's report; it runs commands itself.
  - Reviewer runs with a read-only Codex sandbox and cannot intentionally edit
    the worktree through model-generated shell commands.
  - Reviewer PASS is allowed only after deterministic verification PASS.
  - Every automatic iteration is archived under iterations/XX.
  - The automatic fix loop has a hard maximum of 3 implementation iterations.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's#[^a-z0-9._-]+#-#g; s#^-+##; s#-+$##'
}

shell_join() {
  local out=""
  local arg
  for arg in "$@"; do
    printf -v arg '%q' "$arg"
    out+="${out:+ }$arg"
  done
  printf '%s' "$out"
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

TASK_ID="$1"
shift

BASE_REF=""
TASK_TEXT=""
TASK_FILE_INPUT=""
PREPARE_ONLY=false
RUN_EXISTING=false
BOOTSTRAP_ONLY=false
VERIFY_ONLY=false
REVIEW_ONLY=false
SKIP_BOOTSTRAP=false
SKIP_VERIFICATION=false
SKIP_REVIEW=false
BOOTSTRAP_COMMAND=""
MODEL=""
REVIEW_MODEL=""
VERIFY_COMMANDS=()

MAX_ITERATIONS=3
CURRENT_ITERATION=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      [[ $# -ge 2 ]] || die "--base requires a value"
      BASE_REF="$2"
      shift 2
      ;;
    --task)
      [[ $# -ge 2 ]] || die "--task requires text"
      TASK_TEXT="$2"
      shift 2
      ;;
    --task-file)
      [[ $# -ge 2 ]] || die "--task-file requires a path"
      TASK_FILE_INPUT="$2"
      shift 2
      ;;
    --prepare-only)
      PREPARE_ONLY=true
      shift
      ;;
    --run-existing)
      RUN_EXISTING=true
      shift
      ;;
    --bootstrap-only)
      BOOTSTRAP_ONLY=true
      shift
      ;;
    --skip-bootstrap)
      SKIP_BOOTSTRAP=true
      shift
      ;;
    --bootstrap-cmd)
      [[ $# -ge 2 ]] || die "--bootstrap-cmd requires a command"
      BOOTSTRAP_COMMAND="$2"
      shift 2
      ;;
    --verify-only)
      VERIFY_ONLY=true
      shift
      ;;
    --skip-verification)
      SKIP_VERIFICATION=true
      shift
      ;;
    --review-only)
      REVIEW_ONLY=true
      shift
      ;;
    --skip-review)
      SKIP_REVIEW=true
      shift
      ;;
    --verify-cmd)
      [[ $# -ge 2 ]] || die "--verify-cmd requires a command"
      VERIFY_COMMANDS+=("$2")
      shift 2
      ;;
    --model)
      [[ $# -ge 2 ]] || die "--model requires a value"
      MODEL="$2"
      shift 2
      ;;
    --review-model)
      [[ $# -ge 2 ]] || die "--review-model requires a value"
      REVIEW_MODEL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[[ -z "$TASK_TEXT" || -z "$TASK_FILE_INPUT" ]] \
  || die "use only one of --task or --task-file"

MODE_COUNT=0
[[ "$RUN_EXISTING" == true ]] && MODE_COUNT=$((MODE_COUNT + 1))
[[ "$BOOTSTRAP_ONLY" == true ]] && MODE_COUNT=$((MODE_COUNT + 1))
[[ "$VERIFY_ONLY" == true ]] && MODE_COUNT=$((MODE_COUNT + 1))
[[ "$REVIEW_ONLY" == true ]] && MODE_COUNT=$((MODE_COUNT + 1))
[[ "$MODE_COUNT" -le 1 ]] \
  || die "use only one of --run-existing, --bootstrap-only, --verify-only, or --review-only"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO_ROOT" ]] || die "run this script from inside a Git repository"

REPO_NAME="$(basename "$REPO_ROOT")"
TASK_SLUG="$(slugify "$TASK_ID")"
[[ -n "$TASK_SLUG" ]] || die "task id does not contain usable characters"

PARENT_DIR="$(dirname "$REPO_ROOT")"
WORKTREE_ROOT="$PARENT_DIR/.worktrees/$REPO_NAME"
WORKTREE_PATH="$WORKTREE_ROOT/$TASK_SLUG"
RUN_ROOT="$PARENT_DIR/.agent-runs/$REPO_NAME"
RUN_DIR="$RUN_ROOT/$TASK_SLUG"

TASK_MD="$RUN_DIR/task.md"
INSTRUCTIONS_MD="$RUN_DIR/IMPLEMENTER.md"
PROMPT_MD="$RUN_DIR/prompt.md"
BOOTSTRAP_REPORT="$RUN_DIR/bootstrap-report.md"
BOOTSTRAP_LOG="$RUN_DIR/bootstrap.log"
REPORT_MD="$RUN_DIR/implementation-report.md"
CODEX_LOG="$RUN_DIR/codex.log"
VERIFY_REPORT="$RUN_DIR/verification-report.md"
VERIFY_LOG="$RUN_DIR/verification.log"
REVIEWER_INSTRUCTIONS="$RUN_DIR/REVIEWER.md"
REVIEW_DIFF="$RUN_DIR/review.diff"
REVIEW_PROMPT="$RUN_DIR/review-prompt.md"
REVIEW_REPORT="$RUN_DIR/review-report.md"
REVIEW_LOG="$RUN_DIR/reviewer.log"
PIPELINE_SUMMARY="$RUN_DIR/pipeline-summary.md"
ITERATIONS_DIR="$RUN_DIR/iterations"
META_FILE="$RUN_DIR/meta.env"

BRANCH="agent/$TASK_SLUG"

write_instructions() {
  cat > "$INSTRUCTIONS_MD" <<EOF
# Implementer Agent

You are the implementation agent for task **$TASK_ID**.

## Mission

Implement the requested change in the current repository worktree. Work as a
careful senior engineer: understand the existing design first, make the
smallest coherent change, validate it, and leave the worktree ready for an
independent reviewer.

## Rules

1. Treat the task description as the source of truth.
2. Read and obey repository-local guidance such as AGENTS.md when present.
3. Inspect relevant code, tests, package scripts, and nearby patterns before editing.
4. Keep the change tightly scoped. Do not refactor unrelated code.
5. Preserve existing architecture and naming conventions unless the task requires otherwise.
6. Add or update tests when behavior changes and suitable tests exist in the project.
7. Run relevant validation commands that are available locally.
8. Never claim a command passed unless you actually ran it successfully.
9. Do not add dependencies unless they are genuinely required by the task.
10. Do not modify secrets or credential files.
11. Do not push, merge, rebase, reset, or delete branches.
12. Do not create a commit. A later orchestrator/reviewer stage decides when the change is ready.
13. If blocked, preserve useful partial work and explain the blocker clearly.

## Completion standard

Before finishing, inspect your own diff and compare the result with every
explicit acceptance criterion in the task.

Your final response must use this structure:

## Status
COMPLETE | PARTIAL | BLOCKED

## Summary
What was implemented.

## Changed files
- path: what changed and why

## Validation
- command: PASS | FAIL | NOT RUN — short explanation

## Acceptance criteria
- criterion: PASS | FAIL | UNCERTAIN — evidence

## Risks / unknowns
Anything the reviewer should verify.

## Reviewer focus
The most important places or behaviors for an independent reviewer to inspect.
EOF
}

write_task_template() {
  cat > "$TASK_MD" <<EOF
# Task: $TASK_ID

## Goal

<!-- Describe the desired user/business outcome. -->

## Context

<!-- Relevant background, existing behavior, links/paths, constraints. -->

## Requirements

- [ ] <!-- Requirement 1 -->
- [ ] <!-- Requirement 2 -->

## Acceptance criteria

- [ ] <!-- Observable condition that must be true -->
- [ ] <!-- Edge case / error behavior -->

## Out of scope

- <!-- Explicitly exclude unrelated work. -->

## Relevant areas

- <!-- Optional files, modules, routes, components, APIs, etc. -->

## Validation expectations

- <!-- Optional commands or scenarios that should be checked. -->
EOF
}

write_task_from_text() {
  cat > "$TASK_MD" <<EOF
# Task: $TASK_ID

## Task description

$TASK_TEXT

## Acceptance criteria

Use only criteria that are explicit in the task description or can be
unambiguously verified from existing project behavior. If requirements are
ambiguous, make the smallest conservative implementation and call out the
ambiguity in the final report.
EOF
}

write_prompt() {
  {
    cat "$INSTRUCTIONS_MD"
    printf '\n\n---\n\n# Assigned task\n\n'
    cat "$TASK_MD"
    printf '\n'
    printf '\n---\n\n# Iteration\n\n'
    printf 'This is implementation iteration %s of at most %s.\n' "$CURRENT_ITERATION" "$MAX_ITERATIONS"
  } > "$PROMPT_MD"
}

write_fix_prompt() {
  local next_iteration="$1"

  {
    cat "$INSTRUCTIONS_MD"

    printf '\n\n---\n\n# Fix iteration\n\n'
    printf 'This is implementation iteration %s of at most %s.\n' "$next_iteration" "$MAX_ITERATIONS"
    echo
    echo "The worktree already contains the previous implementation."
    echo "Do not restart the task from scratch and do not revert correct existing work."
    echo "Address the concrete failures/findings below, then re-check the original task."

    printf '\n\n---\n\n# Original task\n\n'
    cat "$TASK_MD"

    printf '\n\n---\n\n# Previous Implementer report\n\n'
    if [[ -f "$REPORT_MD" ]]; then
      cat "$REPORT_MD"
    else
      echo "No previous Implementer report is available."
    fi

    printf '\n\n---\n\n# Previous deterministic verification\n\n'
    if [[ -f "$VERIFY_REPORT" ]]; then
      cat "$VERIFY_REPORT"
    else
      echo "No previous deterministic verification report is available."
    fi

    printf '\n\n---\n\n# Previous Reviewer findings\n\n'
    if [[ -f "$REVIEW_REPORT" ]]; then
      cat "$REVIEW_REPORT"
    else
      echo "Reviewer did not run in the previous iteration."
    fi

    printf '\n\n---\n\n# Fix requirements\n\n'
    echo "- Fix every failing deterministic check caused by the implementation."
    echo "- Address every critical and major Reviewer finding."
    echo "- Re-read the original acceptance criteria after making fixes."
    echo "- Preserve correct existing changes."
    echo "- Do not commit, push, merge, rebase, or reset."
  } > "$PROMPT_MD"
}

write_meta() {
  cat > "$META_FILE" <<EOF
TASK_ID='$TASK_ID'
TASK_SLUG='$TASK_SLUG'
REPO_ROOT='$REPO_ROOT'
REPO_NAME='$REPO_NAME'
BASE_REF='$BASE_REF'
BASE_COMMIT='$BASE_COMMIT'
BRANCH='$BRANCH'
WORKTREE_PATH='$WORKTREE_PATH'
RUN_DIR='$RUN_DIR'
EOF
}

prepare_new() {
  if [[ -z "$BASE_REF" ]]; then
    BASE_REF="$(git -C "$REPO_ROOT" branch --show-current)"
    [[ -n "$BASE_REF" ]] || BASE_REF="HEAD"
  fi

  git -C "$REPO_ROOT" rev-parse --verify "${BASE_REF}^{commit}" >/dev/null 2>&1 \
    || die "base ref '$BASE_REF' does not exist"

  BASE_COMMIT="$(git -C "$REPO_ROOT" rev-parse "${BASE_REF}^{commit}")"

  git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH" \
    && die "branch '$BRANCH' already exists; use --run-existing, --bootstrap-only, --verify-only, or --review-only if already prepared"

  [[ ! -e "$WORKTREE_PATH" ]] \
    || die "worktree path already exists: $WORKTREE_PATH"

  [[ ! -e "$RUN_DIR" ]] \
    || die "agent run directory already exists: $RUN_DIR"

  mkdir -p "$WORKTREE_ROOT" "$RUN_DIR" "$ITERATIONS_DIR"
  : > "$PIPELINE_SUMMARY"

  echo "Creating worktree..."
  echo "  Repository: $REPO_ROOT"
  echo "  Base:       $BASE_REF"
  echo "  Base SHA:   $BASE_COMMIT"
  echo "  Branch:     $BRANCH"
  echo "  Worktree:   $WORKTREE_PATH"
  echo "  Run data:   $RUN_DIR"
  echo

  git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH" "$BASE_REF"

  write_instructions

  if [[ -n "$TASK_FILE_INPUT" ]]; then
    [[ -f "$TASK_FILE_INPUT" ]] || die "task file not found: $TASK_FILE_INPUT"
    cp "$TASK_FILE_INPUT" "$TASK_MD"
  elif [[ -n "$TASK_TEXT" ]]; then
    write_task_from_text
  else
    write_task_template
  fi

  write_prompt
  write_meta

  echo
  echo "Prepared:"
  echo "  Task:         $TASK_MD"
  echo "  Instructions: $INSTRUCTIONS_MD"
  echo "  Prompt:       $PROMPT_MD"
  echo

  if [[ -z "$TASK_TEXT" && -z "$TASK_FILE_INPUT" ]]; then
    echo "No task content was supplied, so a template was created."
    echo "Edit:"
    echo "  $TASK_MD"
    echo
    echo "Then run:"
    echo "  $0 \"$TASK_ID\" --run-existing"
    exit 0
  fi

  if [[ "$PREPARE_ONLY" == true ]]; then
    echo "Preparation complete; Codex was not started."
    echo "Run later with:"
    echo "  $0 \"$TASK_ID\" --run-existing"
    exit 0
  fi
}

load_existing() {
  [[ -f "$META_FILE" ]] \
    || die "existing run metadata not found: $META_FILE"

  # shellcheck disable=SC1090
  source "$META_FILE"

  if [[ -z "${BASE_COMMIT:-}" ]]; then
    BASE_COMMIT="$(git -C "$WORKTREE_PATH" merge-base "$BASE_REF" HEAD 2>/dev/null || true)"
    [[ -n "$BASE_COMMIT" ]] || die "could not derive base commit for existing task"
  fi

  [[ -d "$WORKTREE_PATH" ]] \
    || die "existing worktree not found: $WORKTREE_PATH"
  [[ -f "$TASK_MD" ]] \
    || die "task file not found: $TASK_MD"
  [[ -f "$INSTRUCTIONS_MD" ]] \
    || die "implementer instructions not found: $INSTRUCTIONS_MD"

  mkdir -p "$ITERATIONS_DIR"
}

run_codex() {
  command -v codex >/dev/null 2>&1 \
    || die "Codex CLI is not available in PATH"

  echo "Starting Implementer Agent (iteration $CURRENT_ITERATION/$MAX_ITERATIONS)..."
  echo "  Worktree: $WORKTREE_PATH"
  echo "  Task:     $TASK_MD"
  echo "  Report:   $REPORT_MD"
  echo "  Log:      $CODEX_LOG"
  echo

  CODEX_ARGS=(
    exec
    --cd "$WORKTREE_PATH"
    --sandbox workspace-write
    --output-last-message "$REPORT_MD"
  )

  if [[ -n "$MODEL" ]]; then
    CODEX_ARGS+=(--model "$MODEL")
  fi

  set +e
  codex "${CODEX_ARGS[@]}" - < "$PROMPT_MD" 2>&1 | tee "$CODEX_LOG"
  CODEX_EXIT="${PIPESTATUS[0]}"
  set -e

  echo
  if [[ "$CODEX_EXIT" -eq 0 ]]; then
    echo "Implementer Agent finished successfully."
  else
    echo "Implementer Agent exited with code $CODEX_EXIT." >&2
  fi

  return "$CODEX_EXIT"
}

package_manager_runner() {
  local pm="$1"

  if command -v "$pm" >/dev/null 2>&1; then
    printf '%s' "$pm"
    return 0
  fi

  if [[ "$pm" != "npm" && "$pm" != "bun" ]] && command -v corepack >/dev/null 2>&1; then
    printf 'corepack %s' "$pm"
    return 0
  fi

  return 1
}

detect_yarn_major() {
  local runner="$1"
  local version major

  version="$(
    cd "$WORKTREE_PATH"
    bash -lc "$runner --version" 2>/dev/null || true
  )"

  major="${version%%.*}"
  if [[ "$major" =~ ^[0-9]+$ ]]; then
    printf '%s' "$major"
  else
    printf '1'
  fi
}

bootstrap_auto_command() {
  local pm="$1"
  local runner="$2"

  case "$pm" in
    pnpm)
      [[ -f "$WORKTREE_PATH/pnpm-lock.yaml" ]] || return 2
      printf '%s install --frozen-lockfile' "$runner"
      ;;
    npm)
      if [[ -f "$WORKTREE_PATH/package-lock.json" || -f "$WORKTREE_PATH/npm-shrinkwrap.json" ]]; then
        printf '%s ci' "$runner"
      else
        return 2
      fi
      ;;
    yarn)
      [[ -f "$WORKTREE_PATH/yarn.lock" ]] || return 2
      local major
      major="$(detect_yarn_major "$runner")"
      if [[ "$major" -ge 2 ]]; then
        printf '%s install --immutable' "$runner"
      else
        printf '%s install --frozen-lockfile' "$runner"
      fi
      ;;
    bun)
      [[ -f "$WORKTREE_PATH/bun.lock" || -f "$WORKTREE_PATH/bun.lockb" ]] || return 2
      printf '%s install --frozen-lockfile' "$runner"
      ;;
    *)
      return 1
      ;;
  esac
}

run_bootstrap() {
  mkdir -p "$RUN_DIR"
  : > "$BOOTSTRAP_LOG"

  local status="PASS"
  local pm=""
  local runner=""
  local command=""
  local exit_code=0
  local note=""

  echo
  echo "Bootstrapping workspace..."
  echo "  Worktree: $WORKTREE_PATH"
  echo "  Report:   $BOOTSTRAP_REPORT"
  echo "  Log:      $BOOTSTRAP_LOG"
  echo

  if [[ -n "$BOOTSTRAP_COMMAND" ]]; then
    command="$BOOTSTRAP_COMMAND"
    note="explicit --bootstrap-cmd"
  elif [[ ! -f "$WORKTREE_PATH/package.json" ]]; then
    status="SKIPPED"
    note="no package.json found; no JS package bootstrap was auto-detected"
  else
    pm="$(detect_package_manager)"

    if [[ -z "$pm" ]]; then
      status="FAIL"
      exit_code=1
      note="could not detect package manager"
    else
      if ! runner="$(package_manager_runner "$pm")"; then
        status="FAIL"
        exit_code=127
        note="package manager '$pm' is not available in PATH and no Corepack fallback is available"
      else
        set +e
        command="$(bootstrap_auto_command "$pm" "$runner")"
        local detect_exit=$?
        set -e

        if [[ "$detect_exit" -eq 2 ]]; then
          status="FAIL"
          exit_code=2
          note="supported lockfile for '$pm' was not found; refusing a non-frozen install"
        elif [[ "$detect_exit" -ne 0 || -z "$command" ]]; then
          status="FAIL"
          exit_code=1
          note="could not construct bootstrap command for '$pm'"
        fi
      fi
    fi
  fi

  if [[ "$status" == "PASS" && -n "$command" ]]; then
    printf '$ %s\n' "$command" | tee -a "$BOOTSTRAP_LOG"

    set +e
    (
      cd "$WORKTREE_PATH"
      bash -lc "$command"
    ) 2>&1 | tee -a "$BOOTSTRAP_LOG"
    exit_code="${PIPESTATUS[0]}"
    set -e

    if [[ "$exit_code" -ne 0 ]]; then
      status="FAIL"
      note="bootstrap command failed"
    fi
  fi

  {
    echo "# Workspace Bootstrap"
    echo
    echo "- Task: \`$TASK_ID\`"
    echo "- Iteration: $CURRENT_ITERATION/$MAX_ITERATIONS"
    echo "- Branch: \`$BRANCH\`"
    echo "- Base: \`$BASE_REF\`"
    echo "- Status: **$status**"
    [[ -n "$pm" ]] && echo "- Package manager: \`$pm\`"
    [[ -n "$command" ]] && echo "- Command: \`$command\`"
    echo "- Exit code: $exit_code"
    [[ -n "$note" ]] && echo "- Note: $note"
    echo
    echo "## Git status after bootstrap"
    echo
    echo '```text'
    git -C "$WORKTREE_PATH" status --short || true
    echo '```'
    echo
    echo "Full command output is stored in:"
    echo
    echo "\`$BOOTSTRAP_LOG\`"
  } > "$BOOTSTRAP_REPORT"

  echo
  if [[ "$status" == "PASS" ]]; then
    echo "Bootstrap: PASS"
  elif [[ "$status" == "SKIPPED" ]]; then
    echo "Bootstrap: SKIPPED ($note)"
  else
    echo "Bootstrap: FAIL" >&2
    echo "$note" >&2
  fi
  echo "Bootstrap report: $BOOTSTRAP_REPORT"
  echo

  if [[ "$status" == "FAIL" ]]; then
    return "${exit_code:-1}"
  fi
  return 0
}

detect_package_manager() {
  local package_manager=""

  if [[ -f "$WORKTREE_PATH/package.json" ]] && command -v node >/dev/null 2>&1; then
    package_manager="$(
      node -e '
        try {
          const p = require(process.argv[1]);
          if (typeof p.packageManager === "string") {
            process.stdout.write(p.packageManager.split("@")[0]);
          }
        } catch {}
      ' "$WORKTREE_PATH/package.json" 2>/dev/null || true
    )"
  fi

  case "$package_manager" in
    pnpm|yarn|npm|bun)
      printf '%s' "$package_manager"
      return
      ;;
  esac

  if [[ -f "$WORKTREE_PATH/pnpm-lock.yaml" ]]; then
    printf 'pnpm'
  elif [[ -f "$WORKTREE_PATH/yarn.lock" ]]; then
    printf 'yarn'
  elif [[ -f "$WORKTREE_PATH/bun.lock" || -f "$WORKTREE_PATH/bun.lockb" ]]; then
    printf 'bun'
  elif [[ -f "$WORKTREE_PATH/package-lock.json" || -f "$WORKTREE_PATH/npm-shrinkwrap.json" ]]; then
    printf 'npm'
  elif [[ -f "$WORKTREE_PATH/package.json" ]]; then
    printf 'npm'
  fi
}

has_package_script() {
  local script_name="$1"

  [[ -f "$WORKTREE_PATH/package.json" ]] || return 1
  command -v node >/dev/null 2>&1 || return 1

  node -e '
    const p = require(process.argv[1]);
    const name = process.argv[2];
    process.exit(p.scripts && typeof p.scripts[name] === "string" ? 0 : 1);
  ' "$WORKTREE_PATH/package.json" "$script_name"
}

package_script_command() {
  local pm="$1"
  local script_name="$2"

  case "$pm" in
    pnpm) printf 'pnpm run %q' "$script_name" ;;
    yarn) printf 'yarn run %q' "$script_name" ;;
    bun)  printf 'bun run %q' "$script_name" ;;
    npm)  printf 'npm run %q' "$script_name" ;;
    *) return 1 ;;
  esac
}

verify_command() {
  local label="$1"
  local command="$2"
  local cmd_log="$3"

  printf '\n===== %s =====\n' "$label" | tee -a "$VERIFY_LOG"
  printf '$ %s\n' "$command" | tee -a "$VERIFY_LOG"

  set +e
  (
    cd "$WORKTREE_PATH"
    bash -lc "$command"
  ) 2>&1 | tee -a "$VERIFY_LOG"
  local exit_code="${PIPESTATUS[0]}"
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    printf '| `%s` | `%s` | PASS | %s |\n' \
      "$label" "$command" "$exit_code" >> "$cmd_log"
  else
    printf '| `%s` | `%s` | FAIL | %s |\n' \
      "$label" "$command" "$exit_code" >> "$cmd_log"
  fi

  return "$exit_code"
}

run_verification() {
  mkdir -p "$RUN_DIR"
  : > "$VERIFY_LOG"

  local rows_file="$RUN_DIR/.verification-rows.tmp"
  : > "$rows_file"

  local overall=0
  local check_count=0
  local failed_count=0
  local skipped_notes=()

  echo
  echo "Running deterministic verification..."
  echo "  Worktree: $WORKTREE_PATH"
  echo "  Report:   $VERIFY_REPORT"
  echo "  Log:      $VERIFY_LOG"
  echo

  check_count=$((check_count + 1))
  if ! verify_command "git diff --check" "git diff --check HEAD" "$rows_file"; then
    overall=1
    failed_count=$((failed_count + 1))
  fi

  if [[ "${#VERIFY_COMMANDS[@]}" -gt 0 ]]; then
    local i=0
    local custom
    for custom in "${VERIFY_COMMANDS[@]}"; do
      i=$((i + 1))
      check_count=$((check_count + 1))
      if ! verify_command "custom-$i" "$custom" "$rows_file"; then
        overall=1
        failed_count=$((failed_count + 1))
      fi
    done
  elif [[ -f "$WORKTREE_PATH/package.json" ]]; then
    if ! command -v node >/dev/null 2>&1; then
      overall=1
      failed_count=$((failed_count + 1))
      check_count=$((check_count + 1))
      printf '| `package.json detection` | `node` | FAIL | 127 |\n' >> "$rows_file"
      printf '\nNode.js is required to inspect package.json scripts.\n' >> "$VERIFY_LOG"
    else
      local pm
      pm="$(detect_package_manager)"

      if [[ -z "$pm" ]]; then
        overall=1
        failed_count=$((failed_count + 1))
        check_count=$((check_count + 1))
        printf '| `package manager` | `auto-detect` | FAIL | 1 |\n' >> "$rows_file"
        printf '\nCould not detect package manager.\n' >> "$VERIFY_LOG"
      else
        local pm_runner=""
        if ! pm_runner="$(package_manager_runner "$pm")"; then
          overall=1
          failed_count=$((failed_count + 1))
          check_count=$((check_count + 1))
          printf '| `package manager` | `%s` | FAIL | 127 |\n' "$pm" >> "$rows_file"
          printf '\nPackage manager "%s" is not available in PATH and no Corepack fallback is available.\n' "$pm" >> "$VERIFY_LOG"
        else
          local script_name
          for script_name in lint typecheck test build; do
            if has_package_script "$script_name"; then
              local command
              case "$pm" in
                pnpm|yarn)
                  command="$pm_runner run $script_name"
                  ;;
                bun)
                  command="$pm_runner run $script_name"
                  ;;
                npm)
                  command="$pm_runner run $script_name"
                  ;;
              esac
            check_count=$((check_count + 1))
            if ! verify_command "$script_name" "$command" "$rows_file"; then
              overall=1
              failed_count=$((failed_count + 1))
            fi
            else
              skipped_notes+=("package.json has no \`$script_name\` script")
            fi
          done
        fi
      fi
    fi
  else
    skipped_notes+=("no package.json found; only repository-level checks were auto-detected")
  fi

  local status="PASS"
  if [[ "$overall" -ne 0 ]]; then
    status="FAIL"
  fi

  {
    echo "# Deterministic Verification"
    echo
    echo "- Task: \`$TASK_ID\`"
    echo "- Branch: \`$BRANCH\`"
    echo "- Base: \`$BASE_REF\`"
    echo "- Status: **$status**"
    echo "- Checks run: $check_count"
    echo "- Failed: $failed_count"
    echo
    echo "## Checks"
    echo
    echo "| Check | Command | Result | Exit code |"
    echo "|---|---|---:|---:|"
    cat "$rows_file"

    if [[ "${#skipped_notes[@]}" -gt 0 ]]; then
      echo
      echo "## Skipped / not detected"
      echo
      local note
      for note in "${skipped_notes[@]}"; do
        echo "- $note"
      done
    fi

    echo
    echo "## Git status"
    echo
    echo '```text'
    git -C "$WORKTREE_PATH" status --short || true
    echo '```'
    echo
    echo "## Diff summary"
    echo
    echo '```text'
    git -C "$WORKTREE_PATH" diff --stat HEAD || true
    echo '```'
    echo
    echo "Full command output is stored in:"
    echo
    echo "\`$VERIFY_LOG\`"
  } > "$VERIFY_REPORT"

  rm -f "$rows_file"

  echo
  if [[ "$status" == "PASS" ]]; then
    echo "Verification: PASS"
    echo "Next gate: Reviewer Agent"
  else
    echo "Verification: FAIL" >&2
    echo "Do not send this task to Reviewer as ready-to-merge yet." >&2
    echo "Fix the failing checks first." >&2
  fi

  echo "Verification report: $VERIFY_REPORT"
  echo

  return "$overall"
}

verification_passed() {
  [[ -f "$VERIFY_REPORT" ]] || return 1
  grep -Eq '^- Status: \*\*PASS\*\*$' "$VERIFY_REPORT"
}

write_reviewer_instructions() {
  cat > "$REVIEWER_INSTRUCTIONS" <<EOF
# Reviewer Agent

You are the independent senior code reviewer for task **$TASK_ID**.
You are reviewing implementation iteration **$CURRENT_ITERATION of $MAX_ITERATIONS**.

## Role

Review the implementation in the current worktree. You are not the implementer.
Your job is to find correctness problems, missing requirements, regressions,
unsafe behavior, and important maintainability issues introduced by this task.

## Independence rules

1. Treat task.md as the source of truth for requested behavior.
2. Inspect the actual worktree and repository code yourself.
3. The Implementer's report is context, not evidence. Verify its claims.
4. A PASS deterministic verification report proves only that those commands
   succeeded; it does NOT prove the implementation is correct.
5. Do not modify files, create commits, stage changes, or "fix" findings.
6. Focus on issues caused by this task. Do not block on unrelated pre-existing issues.
7. Do not invent requirements that are absent from the task or established project behavior.
8. Prefer concrete findings with file and line evidence over general advice.

## Review checklist

Check:
- task requirements and acceptance criteria
- functional correctness
- edge cases and error paths
- regressions
- API/data contract compatibility
- security and authorization implications
- async/race/state-management problems
- performance problems when material
- architecture consistency
- test quality and missing meaningful coverage
- unnecessary complexity or unrelated scope expansion

## Severity

- critical: security/data-loss/outage-class issue or fundamentally broken behavior
- major: user-visible bug, missed acceptance criterion, meaningful regression,
  or a defect that should block merge
- minor: worthwhile improvement that does not need to block merge

## Verdict policy

Return NEEDS_CHANGES if there is at least one critical or major finding.
Return PASS when there are no critical or major findings.
Minor/non-blocking notes may still be listed with PASS.

## Required output format

The first line MUST be exactly one of:

VERDICT: PASS
VERDICT: NEEDS_CHANGES

Then use:

## Findings

For each finding:
- Severity: critical | major | minor
- Location: path:line (or the narrowest location available)
- Issue: what is wrong
- Impact: why it matters
- Recommendation: concise direction for fixing it

If there are no findings, write:
No findings.

## Acceptance criteria

For each explicit criterion:
- criterion — PASS | FAIL | UNCERTAIN — evidence

## Review summary

A short independent summary of implementation quality and remaining risk.
EOF
}

snapshot_review_diff() {
  {
    echo "# Review snapshot"
    echo "# Task: $TASK_ID"
    echo "# Iteration: $CURRENT_ITERATION/$MAX_ITERATIONS"
    echo "# Base ref: $BASE_REF"
    echo "# Frozen base commit: $BASE_COMMIT"
    echo "# Branch: $BRANCH"
    echo
    echo "## Git status"
    git -C "$WORKTREE_PATH" status --short || true
    echo
    echo "## Committed branch changes since frozen base"
    git -C "$WORKTREE_PATH" diff --no-ext-diff --find-renames "$BASE_COMMIT"...HEAD || true
    echo
    echo "## Staged and unstaged tracked changes since HEAD"
    git -C "$WORKTREE_PATH" diff --no-ext-diff --find-renames HEAD || true
    echo
    echo "## Untracked files"
    git -C "$WORKTREE_PATH" ls-files --others --exclude-standard || true
    echo
    echo "# Note: Reviewer has read-only access to the live worktree and must inspect"
    echo "# untracked files directly because normal git diff does not include them."
  } > "$REVIEW_DIFF"
}

write_review_prompt() {
  write_reviewer_instructions
  snapshot_review_diff

  {
    cat "$REVIEWER_INSTRUCTIONS"

    printf '\n\n---\n\n# Original task\n\n'
    cat "$TASK_MD"

    printf '\n\n---\n\n# Implementer report\n\n'
    if [[ -f "$REPORT_MD" ]]; then
      cat "$REPORT_MD"
    else
      echo "Implementation report is unavailable. Review the actual worktree independently."
    fi

    printf '\n\n---\n\n# Deterministic verification report\n\n'
    cat "$VERIFY_REPORT"

    printf '\n\n---\n\n# Git review snapshot\n\n'
    cat "$REVIEW_DIFF"

    printf '\n\n---\n\n# Final instruction\n\n'
    echo "Now independently inspect the live worktree and return the required verdict."
    echo "Do not edit any files."
  } > "$REVIEW_PROMPT"
}

run_reviewer() {
  command -v codex >/dev/null 2>&1 \
    || die "Codex CLI is not available in PATH"

  verification_passed \
    || die "Reviewer requires deterministic verification PASS. Run --verify-only first."

  write_review_prompt
  : > "$REVIEW_LOG"

  echo
  echo "Starting Reviewer Agent (iteration $CURRENT_ITERATION/$MAX_ITERATIONS)..."
  echo "  Worktree: $WORKTREE_PATH"
  echo "  Base SHA: $BASE_COMMIT"
  echo "  Prompt:   $REVIEW_PROMPT"
  echo "  Report:   $REVIEW_REPORT"
  echo "  Log:      $REVIEW_LOG"
  echo

  local reviewer_model="$REVIEW_MODEL"
  if [[ -z "$reviewer_model" ]]; then
    reviewer_model="$MODEL"
  fi

  REVIEW_ARGS=(
    exec
    --cd "$WORKTREE_PATH"
    --sandbox read-only
    --output-last-message "$REVIEW_REPORT"
  )

  if [[ -n "$reviewer_model" ]]; then
    REVIEW_ARGS+=(--model "$reviewer_model")
  fi

  set +e
  codex "${REVIEW_ARGS[@]}" - < "$REVIEW_PROMPT" 2>&1 | tee "$REVIEW_LOG"
  local codex_exit="${PIPESTATUS[0]}"
  set -e

  if [[ "$codex_exit" -ne 0 ]]; then
    echo
    echo "Reviewer Agent exited with code $codex_exit." >&2
    return "$codex_exit"
  fi

  [[ -f "$REVIEW_REPORT" ]] \
    || die "Reviewer finished without creating review report: $REVIEW_REPORT"

  local verdict
  verdict="$(grep -m1 -E '^VERDICT: (PASS|NEEDS_CHANGES)$' "$REVIEW_REPORT" || true)"

  echo
  case "$verdict" in
    "VERDICT: PASS")
      echo "Reviewer verdict: PASS"
      echo "All current gates passed."
      return 0
      ;;
    "VERDICT: NEEDS_CHANGES")
      echo "Reviewer verdict: NEEDS_CHANGES" >&2
      echo "Return findings to the Implementer before committing." >&2
      return 3
      ;;
    *)
      echo "Reviewer verdict: INVALID/MISSING" >&2
      echo "Expected first-line verdict: PASS or NEEDS_CHANGES." >&2
      return 4
      ;;
  esac
}

clear_iteration_outputs() {
  rm -f \
    "$REPORT_MD" \
    "$CODEX_LOG" \
    "$VERIFY_REPORT" \
    "$VERIFY_LOG" \
    "$REVIEWER_INSTRUCTIONS" \
    "$REVIEW_DIFF" \
    "$REVIEW_PROMPT" \
    "$REVIEW_REPORT" \
    "$REVIEW_LOG"
}

archive_iteration() {
  local iteration="$1"
  local outcome="$2"
  local dir
  dir="$(printf '%s/%02d' "$ITERATIONS_DIR" "$iteration")"

  mkdir -p "$dir"

  local src_file
  for src_file in \
    "$PROMPT_MD" \
    "$REPORT_MD" \
    "$CODEX_LOG" \
    "$VERIFY_REPORT" \
    "$VERIFY_LOG" \
    "$REVIEWER_INSTRUCTIONS" \
    "$REVIEW_DIFF" \
    "$REVIEW_PROMPT" \
    "$REVIEW_REPORT" \
    "$REVIEW_LOG"; do
    if [[ -f "$src_file" ]]; then
      cp "$src_file" "$dir/$(basename "$src_file")"
    fi
  done

  {
    echo "# Iteration $iteration"
    echo
    echo "- Outcome: **$outcome**"
    echo "- Task: \`$TASK_ID\`"
    echo "- Branch: \`$BRANCH\`"
    echo "- Frozen base: \`$BASE_COMMIT\`"
    echo
    echo "## Git status"
    echo
    echo '```text'
    git -C "$WORKTREE_PATH" status --short || true
    echo '```'
  } > "$dir/iteration-summary.md"

  {
    echo "Iteration $iteration/$MAX_ITERATIONS: $outcome"
  } >> "$PIPELINE_SUMMARY"

  echo "Archived iteration $iteration -> $dir"
}

archived_iteration_count() {
  if [[ ! -d "$ITERATIONS_DIR" ]]; then
    printf '0'
    return
  fi

  find "$ITERATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]' \
    | wc -l \
    | tr -d ' '
}

prepare_iteration() {
  local iteration="$1"

  CURRENT_ITERATION="$iteration"

  if [[ "$iteration" -eq 1 ]]; then
    write_prompt
  else
    write_fix_prompt "$iteration"
  fi

  # The prompt above captures the previous iteration's reports before they are
  # cleared. The next run must then create fresh outputs.
  clear_iteration_outputs
}

iteration_limit_reached() {
  [[ "$CURRENT_ITERATION" -ge "$MAX_ITERATIONS" ]]
}

print_summary() {
  echo
  echo "Git status:"
  git -C "$WORKTREE_PATH" status --short || true
  echo
  echo "Artifacts:"
  [[ -f "$BOOTSTRAP_REPORT" ]] && echo "  Bootstrap report:   $BOOTSTRAP_REPORT"
  [[ -f "$BOOTSTRAP_LOG" ]] && echo "  Bootstrap log:      $BOOTSTRAP_LOG"
  [[ -f "$REPORT_MD" ]] && echo "  Implementer report: $REPORT_MD"
  [[ -f "$CODEX_LOG" ]] && echo "  Codex log:          $CODEX_LOG"
  [[ -f "$VERIFY_REPORT" ]] && echo "  Verification:       $VERIFY_REPORT"
  [[ -f "$VERIFY_LOG" ]] && echo "  Verification log:   $VERIFY_LOG"
  [[ -f "$REVIEW_REPORT" ]] && echo "  Review report:      $REVIEW_REPORT"
  [[ -f "$REVIEW_LOG" ]] && echo "  Reviewer log:       $REVIEW_LOG"
  [[ -f "$REVIEW_DIFF" ]] && echo "  Review diff:        $REVIEW_DIFF"
  [[ -f "$PIPELINE_SUMMARY" ]] && echo "  Pipeline summary:   $PIPELINE_SUMMARY"
  [[ -d "$ITERATIONS_DIR" ]] && echo "  Iteration history:  $ITERATIONS_DIR"
  echo
  echo "Inspect code changes with:"
  echo "  git -C \"$WORKTREE_PATH\" diff --stat"
  echo "  git -C \"$WORKTREE_PATH\" diff"
}

if [[ "$BOOTSTRAP_ONLY" == true ]]; then
  load_existing
  BOOTSTRAP_ONLY_EXIT=0
  run_bootstrap || BOOTSTRAP_ONLY_EXIT=$?
  print_summary
  exit "$BOOTSTRAP_ONLY_EXIT"
fi

if [[ "$VERIFY_ONLY" == true ]]; then
  load_existing

  if [[ "$SKIP_BOOTSTRAP" != true ]]; then
    BOOTSTRAP_FOR_VERIFY_EXIT=0
    run_bootstrap || BOOTSTRAP_FOR_VERIFY_EXIT=$?
    if [[ "$BOOTSTRAP_FOR_VERIFY_EXIT" -ne 0 ]]; then
      print_summary
      exit "$BOOTSTRAP_FOR_VERIFY_EXIT"
    fi
  else
    echo
    echo "Workspace bootstrap skipped by --skip-bootstrap."
  fi

  VERIFY_ONLY_EXIT=0
  run_verification || VERIFY_ONLY_EXIT=$?
  print_summary
  exit "$VERIFY_ONLY_EXIT"
fi


if [[ "$REVIEW_ONLY" == true ]]; then
  load_existing
  REVIEW_ONLY_EXIT=0
  run_reviewer || REVIEW_ONLY_EXIT=$?
  print_summary
  exit "$REVIEW_ONLY_EXIT"
fi

if [[ "$RUN_EXISTING" == true ]]; then
  load_existing
else
  prepare_new
fi

BOOTSTRAP_EXIT=0
if [[ "$SKIP_BOOTSTRAP" != true ]]; then
  run_bootstrap || BOOTSTRAP_EXIT=$?
else
  echo
  echo "Workspace bootstrap skipped by --skip-bootstrap."
fi

if [[ "$BOOTSTRAP_EXIT" -ne 0 ]]; then
  echo "Implementer was not started because workspace bootstrap failed." >&2
  print_summary
  exit "$BOOTSTRAP_EXIT"
fi

COMPLETED_ITERATIONS="$(archived_iteration_count)"
START_ITERATION=$((COMPLETED_ITERATIONS + 1))

if [[ "$START_ITERATION" -gt "$MAX_ITERATIONS" ]]; then
  die "maximum of $MAX_ITERATIONS implementation iterations has already been exhausted"
fi

CURRENT_ITERATION="$START_ITERATION"

while [[ "$CURRENT_ITERATION" -le "$MAX_ITERATIONS" ]]; do
  echo
  echo "============================================================"
  echo "Pipeline iteration $CURRENT_ITERATION/$MAX_ITERATIONS"
  echo "============================================================"

  prepare_iteration "$CURRENT_ITERATION"

  IMPLEMENTER_EXIT=0
  run_codex || IMPLEMENTER_EXIT=$?

  if [[ "$IMPLEMENTER_EXIT" -ne 0 ]]; then
    archive_iteration "$CURRENT_ITERATION" "IMPLEMENTER_ERROR"
    echo
    echo "Pipeline stopped: Implementer/Codex execution failed." >&2
    print_summary
    exit "$IMPLEMENTER_EXIT"
  fi

  if [[ "$SKIP_VERIFICATION" == true ]]; then
    archive_iteration "$CURRENT_ITERATION" "IMPLEMENTED_VERIFICATION_SKIPPED"
    echo
    echo "Deterministic verification skipped by --skip-verification."
    echo "Automatic fix loop stops here because there is no verification gate."
    print_summary
    exit 0
  fi

  VERIFY_EXIT=0
  run_verification || VERIFY_EXIT=$?

  if [[ "$VERIFY_EXIT" -ne 0 ]]; then
    archive_iteration "$CURRENT_ITERATION" "VERIFICATION_FAIL"

    if iteration_limit_reached; then
      echo
      echo "Pipeline exhausted all $MAX_ITERATIONS iterations." >&2
      echo "Last outcome: deterministic verification FAIL." >&2
      print_summary
      exit 5
    fi

    NEXT_ITERATION=$((CURRENT_ITERATION + 1))
    echo
    echo "Verification failed. Starting fix iteration $NEXT_ITERATION/$MAX_ITERATIONS."
    CURRENT_ITERATION="$NEXT_ITERATION"
    continue
  fi

  if [[ "$SKIP_REVIEW" == true ]]; then
    archive_iteration "$CURRENT_ITERATION" "VERIFICATION_PASS_REVIEW_SKIPPED"
    echo
    echo "Reviewer skipped by --skip-review."
    print_summary
    exit 0
  fi

  REVIEW_EXIT=0
  run_reviewer || REVIEW_EXIT=$?

  case "$REVIEW_EXIT" in
    0)
      archive_iteration "$CURRENT_ITERATION" "PASS"
      echo
      echo "Pipeline complete: Implementer + Verification + Reviewer all passed."
      print_summary
      exit 0
      ;;
    3)
      archive_iteration "$CURRENT_ITERATION" "NEEDS_CHANGES"

      if iteration_limit_reached; then
        echo
        echo "Pipeline exhausted all $MAX_ITERATIONS iterations." >&2
        echo "Last Reviewer verdict: NEEDS_CHANGES." >&2
        print_summary
        exit 5
      fi

      NEXT_ITERATION=$((CURRENT_ITERATION + 1))
      echo
      echo "Reviewer requested changes. Starting fix iteration $NEXT_ITERATION/$MAX_ITERATIONS."
      CURRENT_ITERATION="$NEXT_ITERATION"
      ;;
    *)
      archive_iteration "$CURRENT_ITERATION" "REVIEWER_ERROR"
      echo
      echo "Pipeline stopped: Reviewer execution/output was invalid." >&2
      print_summary
      exit "$REVIEW_EXIT"
      ;;
  esac
done

echo "Pipeline reached an unexpected terminal state." >&2
print_summary
exit 6
