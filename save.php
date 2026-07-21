<?php
/**
 * Tiny instructor endpoint: save exercise JSON into lti_link.json.
 * Body: application/json exercise object, or form field "exercise".
 */
require_once "../config.php";
require_once "exercise.php";

use \Tsugi\Core\LTIX;

header('Content-Type: application/json');

$LAUNCH = LTIX::requireData();

if (!$USER->instructor) {
    http_response_code(403);
    echo json_encode(array('status' => 'failure', 'detail' => 'Instructor role required'));
    return;
}

$raw = file_get_contents('php://input');
$exercise = null;
if ($raw && strlen($raw) > 0) {
    $exercise = json_decode($raw, true);
}
if (!$exercise && isset($_POST['exercise'])) {
    $exercise = json_decode($_POST['exercise'], true);
}

if (!is_array($exercise)) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'Expected JSON exercise object'));
    return;
}

if (!isset($exercise['prompt']) || !strlen(trim($exercise['prompt']))) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'Missing required field: prompt'));
    return;
}

if (!isset($exercise['setup_sql'])) {
    $exercise['setup_sql'] = '';
}
if (!isset($exercise['solution_sql'])) {
    $exercise['solution_sql'] = '';
}

$mode = isset($exercise['mode']) ? $exercise['mode'] : 'query';
$verify = isset($exercise['verification_sql']) ? $exercise['verification_sql'] : null;
$hasVerify = is_array($verify) ? count($verify) > 0 : (is_string($verify) && strlen(trim($verify)) > 0);

if ($mode === 'playground') {
    // Prompt required above; setup_sql optional (applied on Reset).
} else if ($mode === 'upload-check') {
    if (!$hasVerify) {
        http_response_code(400);
        echo json_encode(array('status' => 'failure', 'detail' => 'upload-check mode requires verification_sql'));
        return;
    }
    if (!strlen(trim($exercise['setup_sql'])) && !strlen(trim($exercise['solution_sql']))) {
        http_response_code(400);
        echo json_encode(array(
            'status' => 'failure',
            'detail' => 'upload-check mode requires setup_sql and/or solution_sql for the expected reference database'
        ));
        return;
    }
} else if ($mode === 'database-state') {
    if (!$hasVerify) {
        http_response_code(400);
        echo json_encode(array('status' => 'failure', 'detail' => 'database-state mode requires verification_sql'));
        return;
    }
    if (!strlen(trim($exercise['solution_sql']))) {
        http_response_code(400);
        echo json_encode(array('status' => 'failure', 'detail' => 'database-state mode requires solution_sql'));
        return;
    }
} else {
    if (!strlen(trim($exercise['solution_sql']))) {
        http_response_code(400);
        echo json_encode(array('status' => 'failure', 'detail' => 'query mode requires solution_sql'));
        return;
    }
    if (!strlen(trim($exercise['setup_sql']))) {
        http_response_code(400);
        echo json_encode(array('status' => 'failure', 'detail' => 'query mode requires setup_sql'));
        return;
    }
}

// Normalize required defaults
if (!isset($exercise['version'])) $exercise['version'] = 1;
if (!isset($exercise['type'])) $exercise['type'] = 'sqlite';
if (!isset($exercise['mode'])) $exercise['mode'] = 'query';

$LINK->setJson(json_encode($exercise));
echo json_encode(array('status' => 'success'));
