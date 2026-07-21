<?php
require_once "../config.php";
require_once "register.php";

use \Tsugi\Core\LTIX;
use \Tsugi\Core\Settings;
use \Tsugi\UI\SettingsForm;

$LAUNCH = LTIX::requireData();
if (!$USER->instructor) {
    die('Requires instructor role');
}

if (SettingsForm::handleSettingsPost()) {
    header('Location: ' . addSession('index.php'));
    return;
}

$OUTPUT->header();
?>
<style>
body { font-family: system-ui, sans-serif; margin: 2rem; background: #f5f5f5; }
#toolbar a {
    display: inline-block;
    font-size: 14px;
    padding: 8px 15px;
    border-radius: 6px;
    border: 1px solid #ccc;
    text-decoration: none;
    color: #333;
    background: #f8f9fa;
    margin: 4px;
}
#toolbar a.primary { background: #5624d0; color: #fff; border-color: #5624d0; }
</style>
<?php
$OUTPUT->bodyStart();
$OUTPUT->flashMessages();

SettingsForm::start();
SettingsForm::dueDate();
SettingsForm::done();
SettingsForm::end();
?>
<center>
    <h1><?php echo htmlentities($REGISTER_LTI2['name']); ?> — Instructor</h1>
    <div id="toolbar">
        <a class="primary" href="<?php echo addSession('index.php?mode=author'); ?>">Author Exercise</a>
        <a href="<?php echo addSession('index.php'); ?>">Learner View</a>
        <a href="<?php echo addSession('grades.php'); ?>">Student Data</a>
        <a href="#" data-toggle="modal" data-target="#tsugi_settings_dialog">Settings</a>
    </div>
</center>
<?php
$OUTPUT->footer();
