<?php
/**
 * Built-in: Polls Loading One-to-Many Data (upload-check mode).
 * Modeled on tools/sqlite/03polls.php — learner uploads db.sqlite3.
 */
return array(
    'version' => 1,
    'type' => 'sqlite',
    'mode' => 'upload-check',
    'title' => 'Polls Loading One-to-Many Data',
    'prompt' => 'Complete the Polls batch-loading assignment, then upload your Django db.sqlite3 file here. The file must have a .sqlite3 suffix (or .sqlite / .db) and be under 3M. This checker looks at the polls_question and polls_choice tables.',
    'instructions_url' => 'https://www.dj4e.com/assn/dj4e_batch.md',
    'setup_sql' => 'CREATE TABLE polls_question (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    question_text TEXT,
    pub_date TEXT
);
CREATE TABLE polls_choice (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    choice_text TEXT,
    votes INTEGER,
    question_id INTEGER
);

INSERT INTO polls_question (id, question_text, pub_date) VALUES (1, \'Answer to the Ultimate Question\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'123\', 0, 1);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'42\', 0, 1);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'86\', 0, 1);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (2, \'What is your favourite social media\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Instagram\', 0, 2);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Facebook\', 0, 2);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'X\', 0, 2);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'TikTok\', 0, 2);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'LinkedIn\', 0, 2);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'None\', 0, 2);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (3, \'What is your favourite season\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Summer\', 0, 3);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Fall\', 0, 3);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Winter\', 0, 3);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Spring\', 0, 3);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (4, \'How to you like your food\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Spicy\', 0, 4);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Medium\', 0, 4);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Mild\', 0, 4);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (5, \'What is your favorite programming language\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Python\', 0, 5);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'C\', 0, 5);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Rust\', 0, 5);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'C++\', 0, 5);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Java\', 0, 5);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'PHP\', 0, 5);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (6, \'What is the most complex feature of Django\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Models\', 0, 6);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Views\', 0, 6);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Templates\', 0, 6);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Url routing\', 0, 6);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (7, \'Which of the following files is consulted first when Django receives a request\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'urls.py\', 0, 7);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'views.py\', 0, 7);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'models.py\', 0, 7);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'admin.py\', 0, 7);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (8, \'Which of the following Django files configures which models are shown in the admin interface\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'urls.py\', 0, 8);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'views.py\', 0, 8);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'models.py\', 0, 8);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'admin.py\', 0, 8);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (9, \'What port do web browsers use for non-secure http requests\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'80\', 0, 9);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'442\', 0, 9);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'42\', 0, 9);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'180\', 0, 9);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'8000\', 0, 9);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (10, \'What is your name\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'lancelot\', 0, 10);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'arthur\', 0, 10);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (11, \'What is your quest\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Seek the grail\', 0, 11);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Learn Django\', 0, 11);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Understand Python OO\', 0, 11);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (12, \'What is your favourite color\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'blue\', 0, 12);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'yellow\', 0, 12);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'red\', 0, 12);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (13, \'What is the airspeed of an unladen swallow\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'20\', 0, 13);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'12\', 0, 13);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'33\', 0, 13);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (14, \'Which keyword is used to add conditions to your query\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'WHERE\', 0, 14);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'IF\', 0, 14);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'ONLYIF\', 0, 14);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'SELECT\', 0, 14);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (15, \'What kind of key is used to reference a primary key in another table\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'logical\', 0, 15);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'master\', 0, 15);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'id\', 0, 15);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'foreign\', 0, 15);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (16, \'Which of the following is NOT a good synonym for "class" in Python\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'direction\', 0, 16);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'template\', 0, 16);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'blueprint\', 0, 16);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'pattern\', 0, 16);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (17, \'Which of the following is rarely used in Object Oriented Programming\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Destructor\', 0, 17);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Constructor\', 0, 17);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Inheritance\', 0, 17);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Method\', 0, 17);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Attribute\', 0, 17);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (18, \'Which of the following Python types it most like the request.POST data in Django\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'dictionary\', 0, 18);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'list\', 0, 18);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'string\', 0, 18);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (19, \'Which of the following HTTP methods add form data to the URL after a question mark\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'GET\', 0, 19);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'POST\', 0, 19);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (20, \'Which protocol determines how cookies are sent back and forth\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'HTTP\', 0, 20);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'HTML\', 0, 20);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'CSS\', 0, 20);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'ORM\', 0, 20);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'SQL\', 0, 20);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (21, \'What does the second "T" of HTTP stand for\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Transfer\', 0, 21);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Transport\', 0, 21);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Transpose\', 0, 21);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'movemenT\', 0, 21);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (22, \'What operating system are you using in PythonAnywhere when you open a Bash shell\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Linux\', 0, 22);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Windows\', 0, 22);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'MacOS\', 0, 22);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'DEC VMS\', 0, 22);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'MS/DOS\', 0, 22);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (23, \'Which command do you use to exit the SQLite comand line tool\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'.quit\', 0, 23);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'quit()\', 0, 23);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'return\', 0, 23);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'grep\', 0, 23);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (24, \'What does the "b" in "bash shell" stand for\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Bourne\', 0, 24);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Bond (James Bond)\', 0, 24);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Best\', 0, 24);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Bivalve\', 0, 24);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'Conch\', 0, 24);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (25, \'What is the preferred tag in modern HTML to indicate that text is to be shown in bold format\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'strong\', 0, 25);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'b\', 0, 25);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'bold\', 0, 25);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'span\', 0, 25);
INSERT INTO polls_question (id, question_text, pub_date) VALUES (26, \'What is the HTML tag for an item in a bulletted list\', \'2020-01-01 00:00:00+00:00\');
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'li\', 0, 26);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'list:item\', 0, 26);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'bullet\', 0, 26);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'item\', 0, 26);
INSERT INTO polls_choice (choice_text, votes, question_id) VALUES (\'tag\', 0, 26);',
    'solution_sql' => '',
    'starter_sql' => '',
    'verification_sql' => array(
        'SELECT COUNT(*) FROM polls_question',
        'SELECT COUNT(*) FROM polls_choice',
        'SELECT COUNT(*) FROM polls_question WHERE question_text=\'What is your favourite season\'',
        'SELECT COUNT(*) FROM polls_question WHERE question_text=\'What is your name\'',
        'SELECT COUNT(*) FROM polls_question WHERE question_text=\'Which command do you use to exit the SQLite comand line tool\'',
        'SELECT COUNT(*) FROM polls_question WHERE question_text LIKE \'%what%\'',
        'SELECT COUNT(*) FROM polls_choice WHERE choice_text=\'42\'',
        'SELECT COUNT(*) FROM polls_choice WHERE choice_text=\'PHP\'',
        'SELECT COUNT(*) FROM polls_choice WHERE choice_text=\'Spicy\'',
        'SELECT COUNT(*) FROM polls_choice WHERE choice_text=\'None\'',
        'SELECT COUNT(*) FROM polls_question JOIN polls_choice ON polls_question.id = polls_choice.question_id WHERE polls_question.question_text = \'What is your quest\''
    ),
    'hints' => array(
        'Load the CSV into polls_question and polls_choice as described in the assignment.',
        'Upload the db.sqlite3 file from your Django project (download it from PythonAnywhere if needed).',
        'Table names should be polls_question and polls_choice with the usual Django column names.',
    ),
    'comparison' => array(
        'column_names' => true,
        'column_order' => true,
        'row_order' => true,
        'numeric_tolerance' => 0,
    ),
    'dialect' => 'sqlite',
    'compatibility' => array('dbgrader'),
    'builtin' => 'PollsExercise',
);
