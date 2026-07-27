<?php
/**
 * Exercise defaults, built-in catalog resolution, and first-launch preload.
 *
 * Priority when loading a placement:
 *   1. Built-in key via Settings::linkDefaultConfigurationFromLaunch (Settings / LTI custom / ?exercise=)
 *      (then catalog file / existing link JSON for that built-in)
 *   2. Valid exercise already in lti_link.json (instructor Edit / Save)
 *   3. Full exercise in LTI custom_config / ?inherit= / ?exercise= as rlid (lessons.json)
 *   4. Empty stub (instructor must pick Settings → Exercise or author one)
 *
 * Built-in selection (same as cdc6504):
 *
 *   "custom": [ { "key": "exercise", "value": "PantryExercise" } ]
 *
 * On first launch, Settings::linkDefaultConfigurationFromLaunch('exercise', catalog keys) seeds the
 * link settings row from LTI custom or ?exercise= when the value is valid.
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
 * Pull full exercise JSON from LTI custom_config, then lessons.json.
 *
 * Lessons lookup uses ?inherit=<resource_link_id>, or if that is absent,
 * ?exercise=<resource_link_id> (same config JSON shape). Built-in catalog
 * keys are handled earlier via Settings::linkDefaultConfigurationFromLaunch().
 */
function dbgrader_load_custom_exercise() {
    global $CFG;

    $custom = LTIX::ltiCustomGet('config');
    $exercise = dbgrader_decode_exercise_json($custom);
    if ($exercise) {
        return $exercise;
    }

    $rlid = null;
    if (isset($_GET['inherit']) && is_string($_GET['inherit']) && strlen($_GET['inherit'])) {
        $rlid = $_GET['inherit'];
    } else if (isset($_GET['exercise']) && is_string($_GET['exercise']) && strlen($_GET['exercise'])) {
        $rlid = $_GET['exercise'];
    }

    if ($rlid && isset($CFG->lessons)) {
        $lessons = new Lessons($CFG->lessons);
        if ($lessons) {
            $lti = $lessons->getLtiByRlid($rlid);
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
 * When Settings has a built-in exercise key, reload from the PHP catalog when:
 *   - link JSON is empty / missing,
 *   - JSON builtin key does not match, or
 *   - JSON builtin_rev is stale (catalog file changed) and not marked custom.
 *
 * @return array{exercise: array, assignmentKey: ?string}
 */
function dbgrader_load_exercise($LINK) {
    $assignmentKey = Settings::linkDefaultConfigurationFromLaunch(
        'exercise',
        array_keys(dbgrader_assignment_catalog())
    );

    $raw = null;
    if ($LINK && method_exists($LINK, 'getJson')) {
        $raw = $LINK->getJson();
    }
    $existing = dbgrader_decode_exercise_json($raw);

    if ($assignmentKey) {
        $builtin = dbgrader_builtin_exercise($assignmentKey);
        if ($builtin) {
            $jsonBuiltin = (is_array($existing) && isset($existing['builtin']))
                ? $existing['builtin']
                : null;
            $jsonRev = (is_array($existing) && isset($existing['builtin_rev']))
                ? $existing['builtin_rev']
                : null;
            $fileRev = isset($builtin['builtin_rev']) ? $builtin['builtin_rev'] : null;
            $isCustom = ($jsonRev === 'custom');
            $stale = !$isCustom && $fileRev && $jsonRev !== $fileRev;
            if (!$existing || $jsonBuiltin !== $assignmentKey || $stale) {
                if ($LINK && method_exists($LINK, 'setJson') && !empty($LINK->id)) {
                    $LINK->setJson(json_encode($builtin));
                }
                return array(
                    'exercise' => $builtin,
                    'assignmentKey' => $assignmentKey,
                );
            }
            // Same built-in (or instructor-customized copy) — keep link JSON.
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
