<?php
/**
 * DBGrader — thin PHP shell. Almost all behavior lives in js/.
 * Pattern inspired by ca4e/tools/cmos: keep PHP minimal, build in JavaScript.
 */
require_once "../config.php";
require_once "exercise.php";

use \Tsugi\Core\LTIX;
use \Tsugi\Util\U;
use \Tsugi\UI\SettingsForm;

// Initialize LTI session (allows launch); grade APIs still need a real user/link.
$LTI = LTIX::session_start();

if (SettingsForm::handleSettingsPost()) {
    header('Location: ' . addSession('index.php' . (U::get($_GET, 'mode') === 'author' ? '?mode=author' : '')));
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

$exercise = dbgrader_load_exercise(isset($LINK) ? $LINK : null);
$hasLink = isset($LINK) && $LINK && !empty($LINK->id);

$gradeSubmitUrl = addSession($CFG->wwwroot . '/api/grade-submit.php');
$recordAttemptUrl = addSession($CFG->wwwroot . '/api/record-attempt.php');
$saveUrl = addSession('save.php');
$sqliteBase = rtrim($CFG->staticroot, '/') . '/js/sqlite/sqlite-wasm-3530300/jswasm/';

$OUTPUT->suppressSiteNav();
$OUTPUT->header();
?>
<link rel="stylesheet" href="css/dbgrader.css">
<?php
$OUTPUT->bodyStart();
$OUTPUT->flashMessages();

if ($isInstructor) {
    SettingsForm::start();
    SettingsForm::dueDate();
    SettingsForm::end(/* ajax */ true);
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
    exercise: <?php echo json_encode($exercise, JSON_UNESCAPED_UNICODE); ?>,
    urls: {
        save: <?php echo json_encode($saveUrl); ?>,
        gradeSubmit: <?php echo json_encode($gradeSubmitUrl); ?>,
        recordAttempt: <?php echo json_encode($recordAttemptUrl); ?>,
        sqliteBase: <?php echo json_encode($sqliteBase); ?>
    }
};
</script>
<script src="js/dbgrader-compare.js"></script>
<script src="js/dbgrader.js"></script>
<?php
$OUTPUT->footer();
