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

if (!isset($exercise['solution_sql'], $exercise['prompt'])) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'Missing required fields: prompt, solution_sql'));
    return;
}

if (!isset($exercise['setup_sql'])) {
    $exercise['setup_sql'] = '';
}

$mode = isset($exercise['mode']) ? $exercise['mode'] : 'query';
if ($mode === 'database-state') {
    $verify = isset($exercise['verification_sql']) ? $exercise['verification_sql'] : null;
    $hasVerify = is_array($verify) ? count($verify) > 0 : (is_string($verify) && strlen(trim($verify)) > 0);
    if (!$hasVerify) {
        http_response_code(400);
        echo json_encode(array('status' => 'failure', 'detail' => 'database-state mode requires verification_sql'));
        return;
    }
} else if (!strlen(trim($exercise['setup_sql']))) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'query mode requires setup_sql'));
    return;
}

// Normalize required defaults
if (!isset($exercise['version'])) $exercise['version'] = 1;
if (!isset($exercise['type'])) $exercise['type'] = 'sqlite';
if (!isset($exercise['mode'])) $exercise['mode'] = 'query';

$LINK->setJson(json_encode($exercise));
echo json_encode(array('status' => 'success'));
