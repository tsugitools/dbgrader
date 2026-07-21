# DBGrader

Interactive SQL autograder for Tsugi. Runs SQLite in the browser via WebAssembly, stores each exercise as JSON on the LTI link, and grades by comparing query results.

## Pattern

PHP is intentionally thin (same idea as [ca4e CMOS](https://github.com/csev/ca4e)):

- `index.php` — LTI session, inject `window.DBGRADER`, HTML shell (Author / Learner / Student Data / Settings)
- `save.php` — instructor saves exercise JSON to `lti_link.json`
- `grades.php` — student data (linked from the index top bar)
- `js/` — authoring UI, learner UI, SQLite worker, comparison

Grades go through Tsugi’s shared endpoints:

- `/api/grade-submit.php`
- `/api/record-attempt.php`

## SQLite WASM

Built from `$CFG->staticroot` (default `https://static.tsugi.org`):

```text
{$CFG->staticroot}/js/sqlite/sqlite-wasm-3530300/jswasm/
```

## Authoring

As instructor, open **Author** (or `index.php?mode=author`):

1. Edit title and prompt
2. Write **setup.sql** (left as Evaluation) and **solution.sql**
3. Optionally set **Starter SQL** for the learner editor
4. **Run query** to preview expected results
5. **Save** to the placement JSON
6. **View Assignment JSON** — copy the exercise object, or the `lessons.json` `custom` snippet (`key: config`)

### Preload from lessons.json

On first launch with an empty link JSON, DBGrader seeds from LTI `custom_config` (same pattern as peer-grade CSS):

```json
"custom": [
  {
    "key": "config",
    "json": { "...": "exercise object" }
  }
]
```

If the LMS dropped customs, `?inherit=<resource_link_id>` reloads that block from `$CFG->lessons`.

## Learner

1. Read the prompt
2. **Run** exploratory queries (not graded) — including `.tables`, `SHOW TABLES`, `\dt`, `\d table`, `\di`, `\dv`, `\l`, `DESCRIBE table` / `DESC table`, `SHOW CREATE TABLE`, `.help` / `\?`
3. **Check Answer** to grade:
   - **query** mode: compare SELECT result to the solution
   - **database-state** mode: run your (possibly multi-statement) SQL, then compare verification queries

## Modes

| Mode | Graded by |
|------|-----------|
| `query` | Result of learner SELECT vs solution SELECT |
| `database-state` | Results of `verification_sql` after solution vs after learner SQL |

## Install

Place this folder under your Tsugi `mod/` (or tools) tree so `../config.php` resolves to the Tsugi config, then add the tool from the Tsugi store / admin UI.
