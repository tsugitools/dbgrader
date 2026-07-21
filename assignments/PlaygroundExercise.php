<?php
/**
 * Built-in: SQL Playground — persistent in-browser SQLite admin (no grading).
 */
return array(
    'version' => 1,
    'type' => 'sqlite',
    'mode' => 'playground',
    'title' => 'SQL Playground',
    'prompt' => 'A simple sqlite3-style shell in the browser. Type SQL ending with a semicolon, or meta-commands like .tables and .help. Upload or download a .sqlite3 file from the Database panel; your database is stored locally in this browser until you reset or import another file.',
    'instructions_url' => '',
    'setup_sql' => '',
    'solution_sql' => '',
    'starter_sql' => '',
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
