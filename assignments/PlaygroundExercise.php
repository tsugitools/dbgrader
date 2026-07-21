<?php
/**
 * Built-in: SQL Playground — persistent in-browser SQLite admin (no grading).
 */
return array(
    'version' => 1,
    'type' => 'sqlite',
    'mode' => 'playground',
    'title' => 'SQL Playground',
    'prompt' => 'A simple SQLite admin for this browser. Run SQL, explore with .tables, upload or download a .sqlite3 file, and reset when you want a clean database. Your database is stored locally in this browser until you reset or import another file.',
    'instructions_url' => '',
    'setup_sql' => '',
    'solution_sql' => '',
    'starter_sql' => ".tables\n",
    'verification_sql' => array(),
    'hints' => array(),
    'comparison' => array(
        'column_names' => true,
        'column_order' => true,
        'row_order' => true,
        'numeric_tolerance' => 0,
    ),
    'dialect' => 'sqlite',
    'compatibility' => array('dbgrader'),
    'builtin' => 'PlaygroundExercise',
);
