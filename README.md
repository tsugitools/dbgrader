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
3. **Run query** to preview expected results
4. **Save** to the placement JSON

## Learner

1. Read the prompt
2. **Run** exploratory queries (not graded)
3. **Check Answer** to compare against the instructor solution and send a grade on success

## Install

Place this folder under your Tsugi `mod/` (or tools) tree so `../config.php` resolves to the Tsugi config, then add the tool from the Tsugi store / admin UI.
