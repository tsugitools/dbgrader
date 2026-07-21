<?php
/**
 * DBGrader — thin PHP shell. Almost all behavior lives in js/.
 * Pattern inspired by ca4e/tools/cmos: keep PHP minimal, build in JavaScript.
 */
require_once "../config.php";
require_once "exercise.php";

use \Tsugi\Core\LTIX;
use \Tsugi\Util\U;

// Initialize LTI session (allows launch); grade APIs still need a real user/link.
$LTI = LTIX::session_start();

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

?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DBGrader<?php echo isset($exercise['title']) ? ' — ' . htmlentities($exercise['title']) : ''; ?></title>
    <link rel="stylesheet" href="css/dbgrader.css">
</head>
<body class="mode-<?php echo htmlentities($mode); ?>">
    <header class="topbar">
        <div class="topbar-left">
            <span class="brand">DBGrader</span>
            <span id="exerciseTitle" class="exercise-title"></span>
        </div>
        <div class="topbar-right">
<?php if ($isInstructor) : ?>
            <a class="btn btn-ghost" href="<?php echo addSession('index.php?mode=author'); ?>">Author</a>
            <a class="btn btn-ghost" href="<?php echo addSession('index.php'); ?>">Learner</a>
            <a class="btn btn-ghost" href="<?php echo addSession('instructor.php'); ?>">Instructor</a>
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
            sqliteBase: 'https://static.tsugi.org/js/sqlite/sqlite-wasm-3530300/jswasm/'
        }
    };
    </script>
    <script src="js/dbgrader-compare.js"></script>
    <script src="js/dbgrader.js"></script>
</body>
</html>
