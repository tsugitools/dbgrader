<?php
/**
 * Built-in: A Simple Query with a WHERE clause (query mode).
 */
return array(
    'version' => 1,
    'type' => 'sqlite',
    'mode' => 'query',
    'title' => 'A Simple Query with a WHERE clause',
    'prompt' => "Write a query with a WHERE that returns the name column of the User that has the email 'ted@umich.edu'.  You can use a 'SELECT *' to see the column names and data in the table.",
    'setup_sql' => "CREATE TABLE \"Users\" (\n"
        . "    \"id\" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,\n"
        . "    \"name\" TEXT,\n"
        . "    \"email\" TEXT\n"
        . ");\n"
        . "\n"
        . "INSERT INTO Users (name, email) VALUES ('Kristen', 'kf@umich.edu');\n"
        . "INSERT INTO Users (name, email) VALUES ('Chuck', 'csev@umich.edu');\n"
        . "INSERT INTO Users (name, email) VALUES ('Colleen', 'cvl@umich.edu');\n"
        . "INSERT INTO Users (name, email) VALUES ('Ted', 'ted@umich.edu');\n"
        . "INSERT INTO Users (name, email) VALUES ('Sally', 'a1@umich.edu');",
    'solution_sql' => "SELECT name FROM Users WHERE email='ted@umich.edu'",
    'starter_sql' => "SELECT * FROM Users;\n",
    'verification_sql' => array(),
    'hints' => array(
        'Look at the Users table with SELECT * to see the columns.',
        'Use a WHERE clause on the email column.',
        "Filter where email is 'ted@umich.edu', and return only the name column.",
    ),
    'comparison' => array(
        'column_names' => true,
        'column_order' => true,
        'row_order' => true,
        'numeric_tolerance' => 0,
    ),
    'dialect' => 'sqlite',
    'compatibility' => array('dbgrader', 'udemy'),
    'builtin' => 'SimpleWhereExercise',
);
