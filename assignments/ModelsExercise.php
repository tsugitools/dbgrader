<?php
/**
 * Built-in: Django Local Library models (upload-check mode).
 * Modeled on tools/sqlite/04models.php — learner uploads db.sqlite3.
 *
 * Old grader only checks that required columns exist via SELECT.
 * We use LIMIT 0 so row data does not affect the grade.
 */
return array(
    'version' => 1,
    'type' => 'sqlite',
    'mode' => 'upload-check',
    'title' => 'Django Models — Local Library Catalog',
    'prompt' => 'Complete the Django models assignment for the local library catalog, then upload your Django db.sqlite3 file here. The file must have a .sqlite3 suffix (or .sqlite / .db) and be under 3M. This checker verifies the schemas of catalog_author, catalog_book, catalog_book_genre, catalog_bookinstance, and catalog_genre.',
    'instructions_url' => 'https://www.dj4e.com/assn/paw_models.md',
    'setup_sql' =>
        "CREATE TABLE catalog_genre (\n"
        . "    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,\n"
        . "    name TEXT\n"
        . ");\n"
        . "CREATE TABLE catalog_author (\n"
        . "    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,\n"
        . "    first_name TEXT,\n"
        . "    last_name TEXT,\n"
        . "    date_of_birth TEXT,\n"
        . "    date_of_death TEXT\n"
        . ");\n"
        . "CREATE TABLE catalog_book (\n"
        . "    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,\n"
        . "    title TEXT,\n"
        . "    summary TEXT,\n"
        . "    isbn TEXT,\n"
        . "    author_id INTEGER\n"
        . ");\n"
        . "CREATE TABLE catalog_bookinstance (\n"
        . "    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,\n"
        . "    imprint TEXT,\n"
        . "    due_back TEXT,\n"
        . "    status TEXT,\n"
        . "    book_id INTEGER\n"
        . ");\n"
        . "CREATE TABLE catalog_book_genre (\n"
        . "    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,\n"
        . "    book_id INTEGER,\n"
        . "    genre_id INTEGER\n"
        . ");",
    'solution_sql' => '',
    'starter_sql' => '',
    'verification_sql' => array(
        'SELECT id, name FROM catalog_genre LIMIT 0',
        'SELECT id, first_name, last_name, date_of_birth, date_of_death FROM catalog_author LIMIT 0',
        'SELECT id, title, summary, isbn, author_id FROM catalog_book LIMIT 0',
        'SELECT id, imprint, due_back, status, book_id FROM catalog_bookinstance LIMIT 0',
        'SELECT id, book_id, genre_id FROM catalog_book_genre LIMIT 0',
    ),
    'hints' => array(
        'Build the Local Library models (Author, Book, BookInstance, Genre) as in the assignment.',
        'Run migrations so the catalog_* tables exist in db.sqlite3.',
        'Upload db.sqlite3 from your Django project (download from PythonAnywhere if needed).',
    ),
    'comparison' => array(
        'column_names' => true,
        'column_order' => true,
        'row_order' => true,
        'numeric_tolerance' => 0,
    ),
    'dialect' => 'sqlite',
    'compatibility' => array('dbgrader'),
    'builtin' => 'ModelsExercise',
);
