# DBGrader

Interactive SQL autograder for Tsugi. Runs SQLite in the browser via WebAssembly, stores each exercise as JSON on the LTI link, and grades by comparing query results.

## Documentation

- [documentation.html](documentation.html) — learner help (linked as **Help** for everyone)
- [documentation_instructor.html](documentation_instructor.html) — authoring / JSON / grading (**Instructor Help**, instructors only)
- Shared styles: `css/documentation.css`

PHP is intentionally thin (same idea as [ca4e CMOS](https://github.com/csev/ca4e)):

- `index.php` — LTI session, inject `window.DBGRADER`, HTML shell (Edit / Learner / Student Data / Settings)
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

As instructor, open **Edit** (or `index.php?mode=author`):

1. Edit title and prompt
2. Write **setup.sql** (left as Evaluation) and **solution.sql**
3. Optionally set **Starter SQL** for the learner editor
4. **Run query** to preview expected results
6. **Save** to the placement JSON
7. **View Assignment JSON** — copy the exercise object, or the `lessons.json` `custom` snippet (`exercise` key for built-ins, or full `config` JSON)

### Preload from lessons.json

**Preferred (built-in catalog):** on first launch, LTI custom `exercise` is copied into the link settings row when that setting is empty (same as CA4E):

```json
"custom": [
  {
    "key": "exercise",
    "value": "PantryExercise"
  }
]
```

Instructors can also pick the assignment under **Settings**. Built-ins live in `assignments/` (catalog in `assignments.php`).

**Alternate (inline exercise):** full JSON via `custom_config` still works when link JSON is empty:

```json
"custom": [
  {
    "key": "config",
    "json": { "...": "exercise object" }
  }
]
```

If the LMS dropped customs, `?inherit=<resource_link_id>` reloads the `config` block from `$CFG->lessons`.

## Learner

1. Read the prompt
2. For SQL modes: **Run** exploratory queries (not graded) — including `.tables`, `SHOW TABLES`, `\dt`, `\d table`, `\di`, `\dv`, `\l`, `DESCRIBE table` / `DESC table`, `SHOW CREATE TABLE`, `.help` / `\?`
3. **Check Answer** / **Check database** to grade:
   - **query** mode: compare SELECT result to the solution
   - **database-state** mode: run your (possibly multi-statement) SQL, then compare verification queries
   - **upload-check** mode: upload a `.sqlite3` file; verification queries run on a gold DB and on your file

## Modes

| Mode | Graded by |
|------|-----------|
| `query` | Result of learner SELECT vs solution SELECT |
| `database-state` | Results of `verification_sql` after solution vs after learner SQL |
| `upload-check` | Same `verification_sql` on expected reference DB vs uploaded SQLite file |

Built-in upload example: **PollsExercise** (`Polls Loading One-to-Many Data`).

## Install

Place this folder under your Tsugi `mod/` (or tools) tree so `../config.php` resolves to the Tsugi config, then add the tool from the Tsugi store / admin UI.
