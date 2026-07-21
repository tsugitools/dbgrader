<?php
/**
 * Default pantry exercise when a placement has no JSON yet.
 * Matches the Udemy-style sample from DESIGN.md.
 */
function dbgrader_default_exercise() {
    return array(
        'version' => 1,
        'type' => 'sqlite',
        'mode' => 'query',
        'title' => 'Pantry Items Over 30 Ounces',
        'prompt' => 'Write a query that returns the item_name and weight_oz for all pantry items weighing more than 30 ounces.',
        'setup_sql' => "CREATE TABLE pantry_items (item_name TEXT, weight_oz REAL, date_purchased INTEGER);\n"
            . "INSERT INTO pantry_items VALUES\n"
            . "('flour', 64, 20190506),\n"
            . "('sugar', 32, 20191218),\n"
            . "('chocolate chips', 24, 20200304);",
        'solution_sql' => "SELECT item_name, weight_oz FROM pantry_items WHERE weight_oz > 30",
        'starter_sql' => "SELECT item_name, weight_oz\nFROM pantry_items\n",
        'verification_sql' => array(),
        'hints' => array(
            'Start with the pantry_items table.',
            'Use a WHERE clause.',
            'Compare weight_oz with 30.',
        ),
        'comparison' => array(
            'column_names' => true,
            'column_order' => true,
            'row_order' => true,
            'numeric_tolerance' => 0,
        ),
        'dialect' => 'sqlite',
        'compatibility' => array('dbgrader', 'udemy'),
    );
}

/**
 * Load exercise from link JSON, or return the default sample.
 */
function dbgrader_load_exercise($LINK) {
    $raw = null;
    if ($LINK && method_exists($LINK, 'getJson')) {
        $raw = $LINK->getJson();
    }
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['setup_sql'], $decoded['solution_sql'])) {
            return $decoded;
        }
    }
    return dbgrader_default_exercise();
}
