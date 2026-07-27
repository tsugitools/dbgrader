<?php

require_once __DIR__ . '/assignments.php';

$REGISTER_LTI2 = array(
    "name" => "DBGrader",
    "FontAwesome" => "fa-database",
    "short_name" => "DBGrader",
    "description" => "Interactive SQL autograder using in-browser SQLite. Instructors author setup and solution SQL; learners run queries and are graded by comparing results.",
    "messages" => array("launch", "launch_grade"),
    "targets" => array("window", "iframe"),
    "privacy_level" => "name_only",
    "license" => "Apache",
    "languages" => array(
        "English",
    ),
    "source_url" => "https://github.com/tsugitools/dbgrader",
    "placements" => array(
    ),
    // Optional: mstore install shows a dropdown; selected value becomes LTI custom.
    // Use the function (not $assignments): register.php is require()'d inside a
    // function, so require_once may skip redefining the $assignments variable.
    // add_to_get also puts exercise=... on the launch URL (LMS custom fallback).
    "custom" => array(
        "exercise" => array(
            "add_to_get" => true,
            "options" => dbgrader_assignment_catalog(),
        ),
    ),
);
