# discord-hider — repo conventions

Project-specific rules that apply to any Claude session working in this repo. User-level conventions live in `~/.claude/CLAUDE.md`; auto-memory is at `~/.claude/projects/.../memory/MEMORY.md`.

## Completed plans

After a plan in `docs/superpowers/plans/` has all its tasks completed and the work is integrated, move the plan file into `docs/superpowers/completed/` (preserving the dated filename). Use `git mv` so history follows.

Why: keeps `plans/` as the live work-queue. Anyone scanning `plans/` should see only plans that are in flight or not yet started. Completed plans stay discoverable in `completed/` for history without cluttering the queue.

When to apply: at the moment a plan's last task is verified complete and committed — not as a planned step inside the plan itself, but as a follow-up move performed by whoever finishes the work.
