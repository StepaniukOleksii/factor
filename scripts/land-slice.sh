#!/usr/bin/env bash
# Lands a finished slice on master: folds each run of same-tag commits into one,
# rebases onto master, fast-forwards master, and deletes the slice branch.
#
# The fold is why this is a script rather than a habit. `git rebase -i` cannot
# be driven by hand from a non-interactive shell, but GIT_SEQUENCE_EDITOR turns
# the same machinery into something scriptable: the awk below rewrites the todo
# list before git acts on it, marking every commit that repeats the tag above it
# as a `fixup`. Same-tag commits therefore collapse into the first one and keep
# its message.
#
# Only *consecutive* runs fold. A slice sent back by a later stage — an E2E run
# turning up a defect, say — lands with the extra commit standing where it
# happened, which is honest and costs nothing. Reordering to force one commit
# per tag is what conflicts, so this script never tries.
#
# Usage:
#   bash scripts/land-slice.sh --dry-run   # print the plan, change nothing
#   bash scripts/land-slice.sh             # land it
#
# Every rewrite is preceded by a backup ref under refs/slice-landing/, so the
# pre-landing branch is recoverable even after the branch itself is deleted.

set -euo pipefail

# Paths below are repo-relative, so anchor to the root rather than the caller's cwd.
cd "$(git rev-parse --show-toplevel)"

MASTER="${SLICE_LANDING_MASTER:-master}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

die() { printf '\nland-slice: %s\n' "$1" >&2; exit 1; }

# --- preconditions --------------------------------------------------------
# Each of these is a way the landing would otherwise half-succeed and leave the
# repository somewhere no single command gets it back from.

branch="$(git rev-parse --abbrev-ref HEAD)"
case "$branch" in
  feat/*) ;;
  *) die "on '$branch', which is not a slice branch. Slices run on feat/<slice-name>." ;;
esac

git rev-parse --verify --quiet "$MASTER" >/dev/null \
  || die "no '$MASTER' branch in this repository."

[ -z "$(git status --porcelain)" ] \
  || die "working tree is dirty. Commit or stash before landing — the rebase needs a clean tree."

count="$(git rev-list --count "$MASTER..$branch")"
[ "$count" -gt 0 ] \
  || die "'$branch' has no commits master does not already have."

# A spec still on disk means a stage has not run. `.sdd/specs/` is empty on
# master, so landing with one present would carry an unfinished slice over.
if [ -d .sdd/specs ] && [ -n "$(find .sdd/specs -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ]; then
  die "$(printf '.sdd/specs/ still holds a spec, so the slice is not retired.\n           feature-writing deletes it once both boxes are settled.')"
fi

# --- the plan -------------------------------------------------------------

printf 'Landing %s onto %s\n\n' "$branch" "$MASTER"
printf 'Now (%s commit(s)):\n' "$count"
git log --reverse --format='  %h %s' "$MASTER..$branch"

# Predict the fold with the same rule the sequence editor applies, so the plan
# shown here cannot disagree with what the rebase then does.
printf '\nAfter folding:\n'
git log --reverse --format='%s' "$MASTER..$branch" | awk '
  {
    tag = ($1 ~ /^\[[A-Z0-9]+\]$/) ? $1 : ("untagged" NR)
    if (tag != prev) printf "  %s\n", $0
    prev = tag
  }'

if [ "$DRY_RUN" -eq 1 ]; then
  printf '\nDry run — nothing changed.\n'
  exit 0
fi

# --- land -----------------------------------------------------------------

before="$(git rev-parse "$MASTER")"
backup="refs/slice-landing/$(basename "$branch")-$(date +%Y%m%d-%H%M%S)"
git update-ref "$backup" HEAD
printf '\nBackup ref: %s\n' "$backup"

editor="$(mktemp)"
trap 'rm -f "$editor"' EXIT
cat > "$editor" <<'EDITOR'
#!/bin/sh
todo="$1"
awk '{
  if ($1 == "pick") {
    tag = ($3 ~ /^\[[A-Z0-9]+\]$/) ? $3 : ("untagged" NR)
    if (tag == prev) sub(/^pick/, "fixup")
    prev = tag
  }
  print
}' "$todo" > "$todo.folded"
mv "$todo.folded" "$todo"
EDITOR
chmod +x "$editor"

if ! GIT_SEQUENCE_EDITOR="sh $editor" git rebase -i "$MASTER"; then
  die "$(printf 'the rebase stopped. Resolve and `git rebase --continue`, or `git rebase --abort`.\n           Nothing has reached %s yet, and %s still points at the original commits.' "$MASTER" "$backup")"
fi

git checkout -q "$MASTER"
git merge --ff-only "$branch"
git branch -d "$branch"

printf '\nLanded. %s now carries:\n' "$MASTER"
git log --reverse --format='  %h %s' "$before..$MASTER"
printf '\nTo undo: git checkout -b %s %s && git reset --hard %s\n' "$branch" "$backup" "$backup"
