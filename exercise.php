<?php
/**
 * Exercise defaults and first-launch load from LTI custom / lessons.json.
 *
 * lessons.json pattern (same shape as peer-grade CSS "config"):
 *
 *   "custom": [
 *     {
 *       "key": "config",
 *       "json": { ... exercise object ... }
 *     }
 *   ]
 *
 * On first launch with an empty lti_link.json, that custom (or ?inherit=)
 * is copied into the link JSON once.
 */

use \Tsugi\Core\LTIX;
use \Tsugi\Util\U;
use \Tsugi\UI\Lessons;

/**
 * Default pantry exercise when a placement has no JSON yet.
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
 * True if decoded array looks like a DBGrader exercise.
 */
function dbgrader_is_valid_exercise($decoded) {
    return is_array($decoded)
        && isset($decoded['setup_sql'], $decoded['solution_sql'], $decoded['prompt']);
}

/**
 * Decode a JSON string into an exercise array, or null.
 */
function dbgrader_decode_exercise_json($raw) {
    if (!$raw || !is_string($raw) || U::isEmpty($raw)) {
        return null;
    }
    $decoded = json_decode($raw, true);
    if (dbgrader_is_valid_exercise($decoded)) {
        return $decoded;
    }
    return null;
}

/**
 * Pull exercise JSON from LTI custom_config, then lessons.json via ?inherit=.
 */
function dbgrader_load_custom_exercise() {
    global $CFG;

    $custom = LTIX::ltiCustomGet('config');
    $exercise = dbgrader_decode_exercise_json($custom);
    if ($exercise) {
        return $exercise;
    }

    if (isset($_GET['inherit']) && isset($CFG->lessons)) {
        $lessons = new Lessons($CFG->lessons);
        if ($lessons) {
            $lti = $lessons->getLtiByRlid($_GET['inherit']);
            if (isset($lti->custom) && is_array($lti->custom)) {
                foreach ($lti->custom as $c) {
                    if (isset($c->key, $c->json) && $c->key === 'config') {
                        // json may already be an object/array from lessons decode
                        if (is_string($c->json)) {
                            $exercise = dbgrader_decode_exercise_json($c->json);
                        } else {
                            $asArray = json_decode(json_encode($c->json), true);
                            if (dbgrader_is_valid_exercise($asArray)) {
                                $exercise = $asArray;
                            }
                        }
                        if ($exercise) {
                            return $exercise;
                        }
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Load exercise from link JSON; on first empty launch seed from custom/lessons.
 */
function dbgrader_load_exercise($LINK) {
    $raw = null;
    if ($LINK && method_exists($LINK, 'getJson')) {
        $raw = $LINK->getJson();
    }
    $existing = dbgrader_decode_exercise_json($raw);
    if ($existing) {
        return $existing;
    }

    $fromCustom = dbgrader_load_custom_exercise();
    if ($fromCustom) {
        if ($LINK && method_exists($LINK, 'setJson') && !empty($LINK->id)) {
            $LINK->setJson(json_encode($fromCustom));
        }
        return $fromCustom;
    }

    return dbgrader_default_exercise();
}
