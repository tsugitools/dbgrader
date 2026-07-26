<?php
/**
 * Built-in DBGrader assignments (CA4E-style keys).
 *
 * Select via Settings → Exercise, or on first launch with LTI custom:
 *
 *   "custom": [ { "key": "exercise", "value": "PantryExercise" } ]
 *
 * Settings::linkGetCustom('exercise') copies that into the link settings row
 * only when the setting is not already set. Tools may also honor ?exercise=
 * when nothing is configured yet (see exercise.php).
 */

/**
 * Catalog of built-in exercises: key => label.
 * Prefer this over $assignments from register.php — register is loaded inside
 * a function, so a require_once of this file may not define $assignments there.
 */
function dbgrader_assignment_catalog() {
    return array(
        'PlaygroundExercise' => 'SQL Playground',
        'PantryExercise' => 'Pantry Items Over 30 Ounces',
        'SimpleWhereExercise' => 'A Simple Query with a WHERE clause',
        'PollsExercise' => 'Polls Loading One-to-Many Data',
        'ModelsExercise' => 'Django Models — Local Library Catalog',
        'UnescoExercise' => 'Unesco Batch Loading One-to-Many Data',
    );
}

$assignments = dbgrader_assignment_catalog();

/**
 * Load a built-in exercise by key, or null if unknown / missing file.
 */
function dbgrader_builtin_exercise($key) {
    $assignments = dbgrader_assignment_catalog();
    if (!$key || !is_string($key) || !isset($assignments[$key])) {
        return null;
    }
    // Reject path tricks; keys are CamelCase identifiers only.
    if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $key)) {
        return null;
    }
    $path = __DIR__ . '/assignments/' . $key . '.php';
    if (!is_file($path)) {
        return null;
    }
    $exercise = include $path;
    if (!is_array($exercise)) {
        return null;
    }
    if (!isset($exercise['builtin'])) {
        $exercise['builtin'] = $key;
    }
    $exercise['builtin_rev'] = md5_file($path);
    return $exercise;
}

/**
 * Fingerprint of a built-in assignment source file.
 */
function dbgrader_builtin_rev($key) {
    if (!$key || !preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $key)) {
        return null;
    }
    $path = __DIR__ . '/assignments/' . $key . '.php';
    return is_readable($path) ? md5_file($path) : null;
}
