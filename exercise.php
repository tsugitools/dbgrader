<?php
/**
 * Exercise defaults, built-in catalog resolution, and first-launch preload.
 *
 * Priority when loading a placement:
 *   1. Valid exercise already in lti_link.json (instructor Edit / Save, or seeded config)
 *   2. Full exercise in LTI custom_config / ?inherit= (legacy lessons.json shape)
 *   3. Built-in from Settings / LTI custom "exercise" (CA4E-style)
 *   4. Empty stub (instructor must pick Settings → Exercise or author one)
 *
 * Built-in selection (same as cdc6504):
 *
 *   "custom": [ { "key": "exercise", "value": "PantryExercise" } ]
 *
 * On first launch, Settings::linkGetCustom('exercise') copies that into the
 * link settings row only when the setting is not already present.
 */

require_once __DIR__ . '/assignments.php';

use \Tsugi\Core\LTIX;
use \Tsugi\Core\Settings;
use \Tsugi\Util\U;
use \Tsugi\UI\Lessons;

/**
 * Content-hash cache-bust token for the Web Worker and its importScripts.
 * Main-thread CSS/JS can rely on a normal shift-reload.
 */
function dbgrader_asset_bust() {
    static $bust = null;
    if ($bust !== null) {
        return $bust;
    }
    $files = array(
        __DIR__ . '/js/dbgrader-worker.js',
        __DIR__ . '/js/dbgrader-meta.js',
        __DIR__ . '/js/dbgrader-compare.js',
    );
    $parts = array();
    foreach ($files as $path) {
        $parts[] = is_readable($path) ? md5_file($path) : '';
    }
    $bust = substr(md5(implode('|', $parts)), 0, 12);
    return $bust;
}

/**
 * Empty exercise when nothing is configured yet.
 */
function dbgrader_empty_exercise() {
    return array(
        'version' => 1,
        'type' => 'sqlite',
        'mode' => 'query',
        'title' => '',
        'prompt' => 'No assignment configured yet. Instructors: open Settings and choose an assignment, or use Edit to author one.',
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
 * Resolve built-in assignment key from link settings / LTI custom / ?exercise=.
 *
 * @return string|null
 */
function dbgrader_resolve_exercise_key() {
    global $assignments, $LINK;

    $assn = null;
    if ($LINK) {
        $assn = Settings::linkGetCustom('exercise');
        // SettingsForm::select uses "0" for "Please select".
        if ($assn === '0' || $assn === 0 || $assn === false || $assn === '') {
            $assn = null;
        }
    }

    if (!$LINK && isset($_GET['exercise'])) {
        $g = $_GET['exercise'];
        if (is_string($g) && isset($assignments[$g])) {
            $assn = $g;
        }
    }

    if ($assn && isset($assignments[$assn])) {
        return $assn;
    }
    return null;
}

/**
 * Pull full exercise JSON from LTI custom_config, then lessons.json via ?inherit=.
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
 * Load exercise from link JSON; else custom config; else built-in; else empty.
 *
 * When Settings has a built-in exercise key, that wins over stale link JSON whose
 * `builtin` field does not match (so switching assignments in Settings updates Edit).
 *
 * @return array{exercise: array, assignmentKey: ?string}
 */
function dbgrader_load_exercise($LINK) {
    $assignmentKey = dbgrader_resolve_exercise_key();

    $raw = null;
    if ($LINK && method_exists($LINK, 'getJson')) {
        $raw = $LINK->getJson();
    }
    $existing = dbgrader_decode_exercise_json($raw);

    // Settings selected a built-in that is not what the link JSON was loaded from.
    if ($assignmentKey) {
        $builtin = dbgrader_builtin_exercise($assignmentKey);
        if ($builtin) {
            $jsonBuiltin = (is_array($existing) && isset($existing['builtin']))
                ? $existing['builtin']
                : null;
            if (!$existing || $jsonBuiltin !== $assignmentKey) {
                if ($LINK && method_exists($LINK, 'setJson') && !empty($LINK->id)) {
                    $LINK->setJson(json_encode($builtin));
                }
                return array(
                    'exercise' => $builtin,
                    'assignmentKey' => $assignmentKey,
                );
            }
            // Same built-in as JSON — keep the (possibly edited) link copy.
            return array(
                'exercise' => $existing,
                'assignmentKey' => $assignmentKey,
            );
        }
    }

    if ($existing) {
        return array(
            'exercise' => $existing,
            'assignmentKey' => $assignmentKey,
        );
    }

    $fromCustom = dbgrader_load_custom_exercise();
    if ($fromCustom) {
        if ($LINK && method_exists($LINK, 'setJson') && !empty($LINK->id)) {
            $LINK->setJson(json_encode($fromCustom));
        }
        return array(
            'exercise' => $fromCustom,
            'assignmentKey' => $assignmentKey,
        );
    }

    return array(
        'exercise' => dbgrader_empty_exercise(),
        'assignmentKey' => $assignmentKey,
    );
}
