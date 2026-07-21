# DBGrader Design

## Overview

DBGrader is a Tsugi-based interactive SQL autograder.

It runs SQLite in the learner's browser using SQLite compiled to WebAssembly. Each exercise is stored in the existing JSON field associated with a gradable Tsugi placement. Tsugi already provides placement configuration, attempt history, grading, LTI context, grade passback, and premium-user status.

The core grading pattern is intentionally borrowed from Udemy's SQLite coding exercises:

1. Load an instructor-provided database setup.
2. Run the instructor solution.
3. Run the learner submission against an equivalent fresh database.
4. Compare the resulting output.
5. Record the attempt and grade using existing Tsugi infrastructure.

DBGrader extends this model with richer feedback, hints, meta-commands, compatibility shims, schema-state grading, and optional premium solution reveal.

## Goals

DBGrader should:

- provide immediate browser-based SQL practice;
- require no database server for normal learner execution;
- use real SQLite behavior rather than a JavaScript SQL imitation;
- support alternate correct SQL by grading results rather than source text;
- integrate with existing Tsugi placement, attempt, grade, and LTI machinery;
- make simple exercises portable between DBGrader and Udemy;
- support richer Tsugi-only exercises such as DDL, DML, schema inspection, and multiple statements;
- reduce unnecessary beginner friction through friendly commands and limited dialect compatibility;
- remain small enough to understand and maintain.

## Non-Goals

The initial implementation will not:

- provide a secure execution boundary against a determined learner;
- prevent learners from inspecting browser-delivered setup or solution data;
- emulate PostgreSQL or MySQL completely;
- reproduce every command supported by the SQLite, PostgreSQL, or MySQL command-line clients;
- provide database concurrency, roles, permissions, extensions, query planning, or server administration;
- replace real PostgreSQL exercises where PostgreSQL-specific behavior matters;
- require Docker, a grading queue, or a server-side database process.

The browser is treated as a trusted educational execution environment. Base64 encoding may be used to discourage casual inspection, but it is not considered a security mechanism.

## High-Level Architecture

```text
Tsugi gradable placement
        |
        | existing placement JSON
        v
DBGrader authoring and learner interface
        |
        | base64url-encoded exercise definition
        v
Browser Web Worker
        |
        | SQLite WASM
        v
Fresh in-memory SQLite databases
        |
        +--> instructor solution output
        |
        +--> learner submission output
        |
        v
JavaScript comparator
        |
        v
Existing Tsugi attempt and grading APIs
        |
        v
LTI grade passback when applicable
```

## Main Components

### 1. Authoring Interface

The authoring interface edits the exercise definition stored in the placement JSON field.

It should support:

- exercise title;
- learner prompt;
- setup SQL;
- instructor solution SQL;
- optional verification SQL;
- exercise mode;
- comparison options;
- ordered hints;
- solution-reveal policy;
- dialect compatibility mode;
- platform compatibility metadata;
- author preview and test execution.

The first version should favor plain text areas over a complex authoring environment. A richer SQL editor can be added later.

### 2. Learner Interface

The learner interface should provide:

- exercise prompt;
- SQL editor;
- Run button;
- Reset button;
- result table;
- syntax and runtime error display;
- grading feedback;
- progressive hints;
- premium solution reveal;
- optional schema and table browser;
- indication of the active SQL compatibility mode.

A learner should be able to run exploratory queries without recording every run as a graded attempt. The final "Check Answer" or equivalent action should use the existing Tsugi attempt and grading path.

### 3. SQLite WASM Runtime

SQLite will be hosted on the Tsugi static CDN using the official `sqlite-wasm-*` bundle layout:

```text
https://static.tsugi.org/js/sqlite/sqlite-wasm-<NNNNNNN>/
```

Current pin (SQLite 3.53.3 / release `3530300`):

```text
https://static.tsugi.org/js/sqlite/sqlite-wasm-3530300/jswasm/sqlite3.js
https://static.tsugi.org/js/sqlite/sqlite-wasm-3530300/jswasm/sqlite3.wasm
```

Bundle index / demos: https://static.tsugi.org/js/sqlite/sqlite-wasm-3530300/

The JavaScript and WASM files must come from the same SQLite release bundle.

The version should be pinned globally by the DBGrader deployment rather than duplicated in every exercise definition.

Recommended properties:

- versioned URL paths;
- long-lived immutable caching;
- correct `application/wasm` content type;
- permissive CORS headers for Tsugi installations on other origins;
- intentional upgrades after regression testing.

### 4. Web Worker

SQLite execution should occur in a Web Worker.

The worker is primarily for responsiveness rather than security. It prevents a slow query, recursive CTE, or large cross join from freezing the main browser interface.

The main page should be able to terminate and recreate the worker after a timeout.

The worker receives jobs such as:

```json
{
  "action": "grade",
  "exercise": {},
  "submission_sql": "SELECT ..."
}
```

It returns structured JSON containing execution status, query results, comparison details, and feedback.

## Exercise Modes

### Query Mode

Query mode is the portable core and should work for most Udemy-compatible exercises.

The grader:

1. creates a fresh in-memory database;
2. runs `setup_sql`;
3. runs `solution_sql`;
4. captures the expected result;
5. creates a second fresh database;
6. runs `setup_sql`;
7. runs the learner submission;
8. captures the actual result;
9. compares expected and actual output.

Typical uses:

- `SELECT`;
- `WHERE`;
- `ORDER BY`;
- aggregates;
- `GROUP BY`;
- `HAVING`;
- joins;
- subqueries;
- CTEs;
- window functions;
- aliases;
- calculated columns.

### Database-State Mode

Database-state mode supports DBGrader-only exercises involving schema or data modification.

The grader:

1. creates a fresh solution database;
2. runs `setup_sql`;
3. runs `solution_sql`;
4. runs one or more verification queries;
5. captures the expected verification results;
6. creates a fresh learner database;
7. runs `setup_sql`;
8. runs the learner submission, including multiple statements;
9. runs the same verification queries;
10. compares the resulting database state.

Typical uses:

- `CREATE TABLE`;
- `INSERT`;
- `UPDATE`;
- `DELETE`;
- `CREATE INDEX`;
- `CREATE VIEW`;
- primary and foreign keys;
- default values;
- unique constraints;
- schema inspection.

The grader must not compare raw `CREATE TABLE` strings. Equivalent formatting and syntax should not cause failure.

Useful verification mechanisms include:

```sql
PRAGMA table_info(table_name);
PRAGMA foreign_key_list(table_name);
PRAGMA index_list(table_name);
SELECT name, type, sql
FROM sqlite_schema
WHERE name = 'table_name';
```

## Exercise JSON Format

Initial format:

```json
{
  "version": 1,
  "type": "sqlite",
  "mode": "query",
  "title": "Pantry Items Over 30 Ounces",
  "prompt": "Write a query that returns...",
  "setup_sql": "CREATE TABLE ...; INSERT INTO ...;",
  "solution_sql": "SELECT ...;",
  "starter_sql": "SELECT ",
  "verification_sql": [],
  "hints": [
    "Start with the pantry_items table.",
    "Use a WHERE clause.",
    "Compare weight_oz with 30."
  ],
  "comparison": {
    "column_names": true,
    "column_order": true,
    "row_order": true,
    "numeric_tolerance": 0
  },
  "dialect": "sqlite",
  "compatibility": [
    "dbgrader",
    "udemy"
  ],
  "solution_policy": {
    "premium_required": true,
    "minimum_attempts": 1
  }
}
```

### Required Fields

- `version`
- `mode`
- `prompt`
- `setup_sql`
- `solution_sql`

### Optional Fields

- `title`
- `starter_sql`
- `verification_sql`
- `hints`
- `comparison`
- `dialect`
- `compatibility`
- `solution_policy`

The placement JSON should describe pedagogy and exercise behavior. Deployment details such as the active SQLite WASM version should remain global.

## Result Representation

Query output should be normalized into a structure such as:

```json
{
  "columns": [
    "item_name",
    "weight_oz"
  ],
  "rows": [
    [
      "flour",
      64
    ],
    [
      "sugar",
      32
    ]
  ]
}
```

The representation should preserve:

- column names;
- column order;
- row order;
- duplicate rows;
- `NULL`;
- integer values;
- floating-point values;
- text;
- blobs, if supported.

## Comparison Rules

The comparator should support:

- column names matter;
- column order matters;
- row order matters;
- duplicate rows matter;
- numeric tolerance;
- exact `NULL` handling.

### Ordered Results

When `row_order` is true, rows must match in returned order.

This is appropriate when the exercise explicitly tests `ORDER BY`, `LIMIT`, ranking, or presentation order.

### Unordered Results

When `row_order` is false, rows should be compared as multisets rather than sets.

Duplicate rows must still be preserved. Sorting canonical row representations before comparison is one possible implementation.

### Column Names

Column-name comparison should be configurable because some exercises explicitly require aliases while others only care about values.

## Feedback and Hinting

Hinting is a primary DBGrader differentiator.

### Automatic Structural Feedback

The comparator can generate feedback without understanding the learner's SQL:

- correct or incorrect column count;
- incorrect column names;
- correct values in the wrong order;
- too many or too few rows;
- duplicate-row mismatch;
- first mismatched value;
- expected empty result versus non-empty result;
- syntax or runtime error.

Examples:

```text
Your query returned the correct columns but the rows are in the wrong order.
```

```text
Expected 5 rows; your query returned 3.
```

```text
The result values match, but the first column should be named item_name.
```

### Heuristic SQL Hints

DBGrader may optionally inspect the submission for likely missing constructs:

- no `WHERE` where filtering appears necessary;
- no join construct where values come from multiple tables;
- no `GROUP BY` when aggregates and non-aggregate columns are mixed;
- no `ORDER BY` when output order is incorrect;
- missing requested aliases.

These hints must be phrased cautiously because alternate correct SQL may not use the expected syntax.

For example:

```text
The requested result probably requires combining information from both tables.
```

is better than:

```text
You forgot INNER JOIN.
```

### Instructor-Authored Progressive Hints

Hints should be revealed in order:

```json
{
  "hints": [
    "The result uses two tables.",
    "Match pantry_items.store_id to stores.id.",
    "Order the result using closing_hour."
  ]
}
```

The free experience should provide useful hints. The full solution may remain a premium feature.

## Premium Solution Reveal

Tsugi already has a premium-user concept at approximately $15 per year.

DBGrader can use solution reveal as a contextual premium feature:

```text
Still stuck? Reveal the worked solution.
Available with Tsugi Premium.
```

This is intentionally subtle negative feedback presented at the moment the learner perceives value.

Recommended behavior:

- free learners can make unlimited attempts;
- free learners receive basic diagnostics and some hints;
- premium learners can reveal the full instructor solution;
- solution reveal may require at least one failed attempt;
- revealing the solution should not automatically complete the exercise;
- after reveal, the learner should be encouraged to reset and solve it independently.

Tsugi may record whether an exercise was:

- solved independently;
- solved after hints;
- solved after solution reveal.

This should support learning analytics rather than punitive grading.

## Base64 Packaging

Exercise data delivered to the browser may be encoded as base64url JSON.

Purpose:

- discourage casual "View Source" reading;
- keep embedded SQL visually compact;
- avoid pretending that browser-delivered data is secret.

PHP flow:

```text
exercise array
    -> JSON
    -> base64url
    -> page
```

JavaScript flow:

```text
base64url
    -> bytes
    -> UTF-8 JSON
    -> exercise object
```

No encryption is required. Any learner capable of defeating base64 could also inspect the runtime objects or browser execution.

## Meta-Commands

SQLite WASM executes SQLite SQL, not SQLite command-line shell commands.

DBGrader should intercept selected meta-commands before sending SQL to SQLite.

Initial SQLite-style commands:

```text
.tables
.schema
.schema table_name
.indexes
.databases
.help
```

Potential DBGrader-specific commands:

```text
.columns table_name
.foreignkeys table_name
.describe table_name
```

The `.describe` command can provide a more educational combined view of columns, keys, indexes, and foreign keys.

Meta-commands are a learner interface feature. They are not part of the graded SQL unless explicitly allowed by the exercise.

## Dialect Compatibility Modes

All modes execute on SQLite, but DBGrader may accept a small, clearly documented subset of other dialects.

```text
sqlite
postgresql-lite
mysql-lite
```

### PostgreSQL-Lite

Reasonable introductory shims include:

```text
SERIAL PRIMARY KEY
    -> INTEGER PRIMARY KEY AUTOINCREMENT

BIGSERIAL PRIMARY KEY
    -> INTEGER PRIMARY KEY AUTOINCREMENT

NOW()
    -> CURRENT_TIMESTAMP

value::INTEGER
    -> CAST(value AS INTEGER)
```

SQLite already tolerates many PostgreSQL-looking type declarations, including `VARCHAR(n)` and `BOOLEAN`.

Potential `psql`-style meta-commands:

```text
\dt
\d
\d table_name
\di
\dv
```

Potential custom functions:

- `split_part()`
- `concat()`
- `greatest()`
- `least()`
- selected date helpers

DBGrader must not claim full PostgreSQL compatibility.

Unsupported or misleading areas include:

- schemas and `search_path`;
- roles and permissions;
- arrays;
- ranges;
- JSONB operators and indexes;
- stored procedures;
- PostgreSQL trigger syntax;
- extensions;
- `COPY`;
- server concurrency and transaction isolation;
- PostgreSQL query planning.

### MySQL-Lite

Reasonable introductory shims include:

```text
SHOW TABLES
DESCRIBE table_name
DESC table_name
SHOW CREATE TABLE table_name
AUTO_INCREMENT
TRUE
FALSE
```

DBGrader should avoid silently translating syntax where semantics differ substantially.

### Translation Strategy

Simple, safe token replacements are acceptable.

Regular expressions must not blindly rewrite text inside:

- string literals;
- quoted identifiers;
- line comments;
- block comments.

A lightweight SQL tokenizer is preferable once compatibility rules grow beyond a few trivial substitutions.

When a translation occurs, DBGrader may display a non-blocking notice:

```text
Accepted PostgreSQL-compatible syntax: SERIAL PRIMARY KEY.
```

Strict SQLite mode should remain available.

## Udemy Compatibility

A subset of exercises should be intentionally portable between Udemy and DBGrader.

### Portable Exercises

Likely portable:

- single result-producing `SELECT`;
- filtering;
- sorting;
- aggregates;
- grouping;
- joins;
- subqueries;
- aliases;
- CTEs where supported by Udemy's runtime.

Portable exercise definitions should use:

```json
{
  "compatibility": [
    "dbgrader",
    "udemy"
  ]
}
```

### DBGrader-Only Exercises

Likely DBGrader-only:

- multiple learner statements;
- `CREATE TABLE`;
- `INSERT`, `UPDATE`, and `DELETE` state grading;
- schema and constraint grading;
- indexes and views;
- meta-commands;
- PostgreSQL-lite and MySQL-lite shims;
- advanced hints;
- premium solution reveal.

These should use:

```json
{
  "compatibility": [
    "dbgrader"
  ]
}
```

The authoring interface may display badges such as:

```text
Udemy compatible
DBGrader enhanced
```

A future export feature may generate Udemy-style `setup.sql` and `query.sql` files for portable exercises.

## Execution API Sketch

### Main Thread to Worker

```json
{
  "action": "execute",
  "exercise": {},
  "submission_sql": "SELECT ..."
}
```

### Worker Response

```json
{
  "execution_ok": true,
  "passed": false,
  "expected": {
    "columns": [
      "item_name",
      "weight_oz"
    ],
    "row_count": 2
  },
  "actual": {
    "columns": [
      "item_name",
      "weight_oz"
    ],
    "row_count": 1
  },
  "feedback": [
    "Your column names are correct.",
    "Expected 2 rows but received 1."
  ],
  "duration_ms": 4
}
```

## Error Handling

Errors should be separated into:

- SQLite initialization errors;
- setup SQL errors;
- instructor solution errors;
- learner syntax errors;
- learner runtime errors;
- verification SQL errors;
- timeout errors;
- internal comparator errors.

Authoring preview should clearly identify instructor-side failures so they are not shown as learner mistakes.

Example learner error:

```text
SQLite reported a syntax error near "FROM".
```

Example instructor error:

```text
This exercise is currently unavailable because its setup SQL could not run.
```

## Timeouts and Limits

Even without treating the browser as a security boundary, usability limits are useful.

Initial limits may include:

- maximum submission length;
- maximum result rows;
- maximum cell length;
- worker timeout;
- maximum number of statements in database-state mode.

On timeout, the worker should be terminated and recreated.

## Author Preview and Regression Testing

The authoring interface should provide a Preview/Test button that:

- initializes the selected dialect mode;
- runs setup and solution;
- displays the expected output;
- validates verification SQL;
- shows the normalized comparison representation;
- identifies Udemy portability risks;
- reports the active SQLite version.

A small regression suite should run before upgrading SQLite WASM.

Regression coverage should include:

- simple selects;
- joins;
- aliases;
- ordered and unordered comparisons;
- duplicate rows;
- `NULL`;
- floating-point tolerance;
- DDL and verification;
- meta-commands;
- compatibility rewrites;
- malformed SQL;
- long-running query timeout;
- Unicode strings;
- multiple statements.

## Suggested File Structure

PHP stays thin (CMOS / ca4e pattern). Almost all behavior is JavaScript.

```text
mod/dbgrader/
├── documentation.html              # Learner help (tabbed)
├── documentation_instructor.html   # Instructor docs (tabbed)
├── index.php              # LTI session + HTML shell + inject window.DBGRADER
├── save.php               # Instructor: POST exercise JSON → lti_link.json
├── exercise.php           # Default sample + load helper
├── grades.php
├── grade-detail.php
├── register.php
├── tsugi.php
├── js/
│   ├── dbgrader.js            # Author + learner UI
│   ├── dbgrader-worker.js     # SQLite WASM worker
│   ├── dbgrader-compare.js
│   ├── dbgrader-meta.js       # .tables / .schema / .describe / …
│   ├── dbgrader-dialects.js   # (later)
│   └── dbgrader-base64.js     # (later)
├── css/
│   └── dbgrader.css
└── DESIGN.md
```

Grading uses shared Tsugi APIs (`/api/grade-submit.php`, `/api/record-attempt.php`), not a tool-local grade endpoint.

## Initial Implementation Plan

### Phase 1: Minimal Query Grader

Implement:

- exercise JSON authoring;
- setup SQL;
- solution SQL;
- learner SQL editor;
- SQLite WASM loading;
- two fresh in-memory databases;
- exact result comparison;
- basic feedback;
- existing Tsugi attempt and grade integration.

This phase should intentionally mirror Udemy's simplest model.

### Phase 2: Teaching Improvements

Add:

- ordered versus unordered row comparison;
- column-name options;
- progressive hints;
- solution reveal;
- author preview;
- result table;
- query history;
- Web Worker timeout;
- base64url packaging.

### Phase 3: DBGrader-Only Exercises

Add:

- database-state mode;
- multiple learner statements;
- verification SQL;
- schema grading;
- DDL and DML exercises;
- `.tables`, `.schema`, and `.describe`.

### Phase 4: Compatibility Modes

Add:

- PostgreSQL-lite;
- `psql`-style commands;
- selected custom functions;
- MySQL-lite;
- compatibility notices;
- lightweight tokenizer.

### Phase 5: Portability and Export

Add:

- Udemy compatibility validation;
- compatibility badges;
- export of portable setup and solution files;
- reusable exercise libraries;
- optional import/export of exercise JSON.

## Design Principle

DBGrader should remain centered on one simple idea:

> Run the instructor's intended database work and the learner's database work in equivalent fresh SQLite databases, then compare what they produce.

Everything else—hints, premium reveal, meta-commands, dialect shims, and Tsugi integration—should support that core rather than obscure it.
