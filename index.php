<?php
/**
 * DBGrader — thin PHP shell. Almost all behavior lives in js/.
 * Pattern inspired by ca4e/tools/cmos: keep PHP minimal, build in JavaScript.
 */
require_once "../config.php";
require_once "assignments.php";
require_once "exercise.php";

use \Tsugi\Core\LTIX;
use \Tsugi\Core\Settings;
use \Tsugi\Util\U;
use \Tsugi\UI\SettingsForm;

// Initialize LTI session (allows launch); grade APIs still need a real user/link.
$LTI = LTIX::session_start();

// If the instructor picks a built-in assignment in Settings, copy it into
// lti_link.json so Edit is populated. Save from Edit overwrites that JSON.
// Re-saving Settings with the same built-in also refreshes from the catalog file.
$oldExerciseSetting = Settings::linkGet('exercise');
if (SettingsForm::handleSettingsPost()) {
    $newExerciseSetting = Settings::linkGet('exercise');
    $assignmentChanged = $newExerciseSetting && $newExerciseSetting !== '0'
        && (string) $newExerciseSetting !== (string) $oldExerciseSetting;
    $builtin = ($newExerciseSetting && $newExerciseSetting !== '0')
        ? dbgrader_builtin_exercise($newExerciseSetting)
        : null;
    if ($builtin && isset($LINK) && $LINK && method_exists($LINK, 'setJson')) {
        $LINK->setJson(json_encode($builtin));
    }
    $redirectMode = $assignmentChanged || $builtin || U::get($_GET, 'mode') === 'author'
        ? '?mode=author'
        : '';
    header('Location: ' . addSession('index.php' . $redirectMode));
    return;
}

// Budget for Tsugi shared grade / attempt APIs (same pattern as CMOS).
$_SESSION['GSRF'] = 10;
$_SESSION['RECORD_ATTEMPT_GSRF'] = 50;

$isInstructor = $USER && $USER->instructor;
$mode = U::get($_GET, 'mode', '');
if ($mode !== 'author') {
    $mode = 'learner';
}
if ($mode === 'author' && !$isInstructor) {
    $mode = 'learner';
}

$loaded = dbgrader_load_exercise(isset($LINK) ? $LINK : null);
$exercise = $loaded['exercise'];
$assignmentKey = $loaded['assignmentKey'];
$hasLink = isset($LINK) && $LINK && !empty($LINK->id);

$gradeSubmitUrl = addSession($CFG->wwwroot . '/api/grade-submit.php');
$recordAttemptUrl = addSession($CFG->wwwroot . '/api/record-attempt.php');
$saveUrl = addSession('save.php');
$sqliteBase = rtrim($CFG->staticroot, '/') . '/js/sqlite/sqlite-wasm-3530300/jswasm/';
$assetBust = dbgrader_asset_bust();
$workerUrl = 'js/dbgrader-worker.js?v=' . $assetBust;

$OUTPUT->suppressSiteNav();
$OUTPUT->header();
?>
<link rel="stylesheet" href="css/dbgrader.css">
<?php
$OUTPUT->bodyStart();
$OUTPUT->flashMessages();

if ($isInstructor) {
    SettingsForm::start();
    SettingsForm::select('exercise', __('Please select an assignment'), $assignments);
    SettingsForm::dueDate();
    // Non-AJAX so index.php can copy the built-in into lti_link.json on change.
    SettingsForm::end(/* ajax */ false);
}
?>
<header class="topbar">
    <div class="topbar-left">
        <span class="brand">DBGrader</span>
        <span id="exerciseTitle" class="exercise-title"></span>
    </div>
    <div class="topbar-right">
<?php if ($isInstructor) : ?>
        <a class="btn btn-ghost<?php echo $mode === 'learner' ? ' dbg-nav-current' : ''; ?>" href="<?php echo addSession('index.php'); ?>">Learner</a>
        <a class="btn btn-ghost<?php echo $mode === 'author' ? ' dbg-nav-current' : ''; ?>" href="<?php echo addSession('index.php?mode=author'); ?>">Edit</a>
<?php endif; ?>
        <a class="btn btn-ghost" href="documentation.html" target="_blank" rel="noopener noreferrer" title="Help">Help</a>
<?php if ($isInstructor) : ?>
        <a class="btn btn-ghost" href="documentation_instructor.html" target="_blank" rel="noopener noreferrer" title="Instructor documentation">Instructor Help</a>
        <a class="btn btn-ghost" href="<?php echo addSession('grades.php'); ?>">Student Data</a>
        <a class="btn btn-ghost" href="#" <?php echo SettingsForm::attr(); ?>>Settings</a>
<?php endif; ?>
    </div>
</header>

<main id="app"></main>

<script>
window.DBGRADER = {
    mode: <?php echo json_encode($mode); ?>,
    isInstructor: <?php echo $isInstructor ? 'true' : 'false'; ?>,
    hasLink: <?php echo $hasLink ? 'true' : 'false'; ?>,
    assignmentKey: <?php echo json_encode($assignmentKey); ?>,
    assignments: <?php echo json_encode($assignments); ?>,
    exercise: <?php echo json_encode($exercise, JSON_UNESCAPED_UNICODE); ?>,
    urls: {
        save: <?php echo json_encode($saveUrl); ?>,
        gradeSubmit: <?php echo json_encode($gradeSubmitUrl); ?>,
        recordAttempt: <?php echo json_encode($recordAttemptUrl); ?>,
        sqliteBase: <?php echo json_encode($sqliteBase); ?>,
        worker: <?php echo json_encode($workerUrl); ?>
    }
};
</script>
<script src="js/dbgrader-compare.js"></script>
<script src="js/dbgrader.js"></script>
<?php
$OUTPUT->footer();
