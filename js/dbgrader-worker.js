/**
 * DBGrader Web Worker — SQLite WASM, query + database-state grading, meta-commands.
 * sqliteBase is supplied by the main thread from $CFG->staticroot.
 */
'use strict';

importScripts('dbgrader-compare.js');
importScripts('dbgrader-meta.js');

var SQLITE_BASE = null;
var sqlite3Promise = null;

function loadSqlite3(sqliteBase) {
    if (sqlite3Promise) return sqlite3Promise;
    if (!sqliteBase) {
        return Promise.reject(new Error('sqliteBase URL was not provided'));
    }
    SQLITE_BASE = sqliteBase.replace(/\/?$/, '/');
    importScripts(SQLITE_BASE + 'sqlite3.js');
    sqlite3Promise = self.sqlite3InitModule({
        locateFile: function (path) {
            return SQLITE_BASE + path;
        }
    });
    return sqlite3Promise;
}

function openDb(sqlite3) {
    return new sqlite3.oo1.DB(':memory:', 'c');
}

function exerciseMode(exercise) {
    return (exercise && exercise.mode) === 'database-state' ? 'database-state' : 'query';
}

function normalizeVerificationSql(verification) {
    if (Array.isArray(verification)) {
        return verification.map(function (s) { return String(s).trim(); }).filter(Boolean);
    }
    if (typeof verification === 'string' && verification.trim()) {
        return verification.split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return [];
}

/**
 * Run SQL; capture the last result-producing statement.
 */
function execCapture(db, sql) {
    var columns = [];
    var rows = [];

    try {
        db.exec({
            sql: sql,
            rowMode: 'array',
            columnNames: columns,
            resultRows: rows
        });
    } catch (e) {
        var err = new Error(e.message || String(e));
        err.sqlite = true;
        throw err;
    }

    return {
        columns: columns.slice(),
        rows: rows.map(function (r) { return r.slice(); })
    };
}

function runSetup(db, setupSql) {
    if (!setupSql || !String(setupSql).trim()) {
        return;
    }
    try {
        db.exec(setupSql);
    } catch (e) {
        var err = new Error(e.message || String(e));
        err.phase = 'setup';
        throw err;
    }
}

function runSql(db, sql, phase) {
    if (!sql || !String(sql).trim()) {
        var empty = new Error((phase || 'SQL') + ' is empty.');
        empty.phase = phase;
        throw empty;
    }
    try {
        return execCapture(db, sql);
    } catch (e) {
        e.phase = e.phase || phase;
        throw e;
    }
}

function runVerifications(db, verificationSql) {
    var list = normalizeVerificationSql(verificationSql);
    if (list.length === 0) {
        var err = new Error('database-state mode requires at least one verification_sql query.');
        err.phase = 'verification';
        throw err;
    }
    return list.map(function (sql, i) {
        try {
            var result = execCapture(db, sql);
            return {
                label: 'verification ' + (i + 1),
                sql: sql,
                columns: result.columns,
                rows: result.rows
            };
        } catch (e) {
            e.phase = 'verification';
            throw e;
        }
    });
}

function runMeta(db, submissionSql) {
    var meta = self.DBGraderMeta.parseMeta(submissionSql);
    if (!meta) return null;
    var jobs = self.DBGraderMeta.expandMeta(meta);
    var results = jobs.map(function (job) {
        if (job.result) {
            return {
                label: job.label,
                columns: job.result.columns,
                rows: job.result.rows
            };
        }
        var captured = execCapture(db, job.sql);
        return {
            label: job.label,
            columns: captured.columns,
            rows: captured.rows
        };
    });
    return {
        execution_ok: true,
        phase: 'meta',
        meta: meta.raw,
        dialect: meta.dialect || null,
        notice: meta.dialect === 'mysql'
            ? 'MySQL command converted to SQLite'
            : null,
        result: results[0],
        results: results
    };
}

function handlePreview(sqlite3, exercise) {
    var mode = exerciseMode(exercise);
    var db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);
        if (mode === 'database-state') {
            runSql(db, exercise.solution_sql, 'solution');
            var results = runVerifications(db, exercise.verification_sql);
            return {
                execution_ok: true,
                phase: 'preview',
                mode: mode,
                result: results[0],
                results: results
            };
        }
        var result = runSql(db, exercise.solution_sql, 'solution');
        return {
            execution_ok: true,
            phase: 'preview',
            mode: mode,
            result: result
        };
    } finally {
        db.close();
    }
}

function handleExecute(sqlite3, exercise, submissionSql) {
    var db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);

        if (self.DBGraderMeta.isMeta(submissionSql)) {
            return runMeta(db, submissionSql);
        }

        var mode = exerciseMode(exercise);
        var result = runSql(db, submissionSql, 'submission');
        return {
            execution_ok: true,
            phase: 'execute',
            mode: mode,
            result: result
        };
    } finally {
        db.close();
    }
}

function handleGrade(sqlite3, exercise, submissionSql) {
    var started = Date.now();
    var mode = exerciseMode(exercise);
    var comparison = (exercise && exercise.comparison) || {};

    if (self.DBGraderMeta.isMeta(submissionSql)) {
        var metaErr = new Error(
            'Meta-commands like ' + submissionSql.trim().split(/\s/)[0] +
            ' are for exploration only. Submit SQL for grading.'
        );
        metaErr.phase = 'submission';
        throw metaErr;
    }

    if (mode === 'database-state') {
        var expectedList;
        var actualList;

        var db1 = openDb(sqlite3);
        try {
            runSetup(db1, exercise.setup_sql);
            runSql(db1, exercise.solution_sql, 'solution');
            expectedList = runVerifications(db1, exercise.verification_sql);
        } finally {
            db1.close();
        }

        var db2 = openDb(sqlite3);
        try {
            runSetup(db2, exercise.setup_sql);
            runSql(db2, submissionSql, 'submission');
            actualList = runVerifications(db2, exercise.verification_sql);
        } finally {
            db2.close();
        }

        var cmpState = self.DBGraderCompare.compareResultLists(expectedList, actualList, comparison);
        return {
            execution_ok: true,
            mode: mode,
            passed: cmpState.passed,
            expected: {
                results: expectedList,
                row_count: expectedList.reduce(function (n, r) { return n + r.rows.length; }, 0)
            },
            actual: {
                results: actualList,
                columns: actualList[0] && actualList[0].columns,
                rows: actualList[0] && actualList[0].rows,
                row_count: actualList.reduce(function (n, r) { return n + r.rows.length; }, 0)
            },
            results: actualList,
            feedback: cmpState.feedback,
            duration_ms: Date.now() - started
        };
    }

    // Query mode
    var expected;
    var actual;

    var q1 = openDb(sqlite3);
    try {
        runSetup(q1, exercise.setup_sql);
        expected = runSql(q1, exercise.solution_sql, 'solution');
    } finally {
        q1.close();
    }

    var q2 = openDb(sqlite3);
    try {
        runSetup(q2, exercise.setup_sql);
        actual = runSql(q2, submissionSql, 'submission');
    } finally {
        q2.close();
    }

    var cmp = self.DBGraderCompare.compareResults(expected, actual, comparison);

    return {
        execution_ok: true,
        mode: mode,
        passed: cmp.passed,
        expected: {
            columns: expected.columns,
            row_count: expected.rows.length,
            rows: expected.rows
        },
        actual: {
            columns: actual.columns,
            row_count: actual.rows.length,
            rows: actual.rows
        },
        feedback: cmp.feedback,
        duration_ms: Date.now() - started
    };
}

self.onmessage = function (ev) {
    var msg = ev.data || {};
    var id = msg.id;
    var action = msg.action;

    loadSqlite3(msg.sqliteBase)
        .then(function (sqlite3) {
            var exercise = msg.exercise || {};
            var sql = msg.submission_sql || '';
            var out;

            if (action === 'preview') {
                out = handlePreview(sqlite3, exercise);
            } else if (action === 'execute') {
                out = handleExecute(sqlite3, exercise, sql);
            } else if (action === 'grade') {
                out = handleGrade(sqlite3, exercise, sql);
            } else if (action === 'ping') {
                out = {
                    execution_ok: true,
                    version: sqlite3.capi.sqlite3_libversion()
                };
            } else {
                throw new Error('Unknown action: ' + action);
            }

            self.postMessage({ id: id, ok: true, data: out });
        })
        .catch(function (e) {
            self.postMessage({
                id: id,
                ok: false,
                error: {
                    message: e.message || String(e),
                    phase: e.phase || null
                }
            });
        });
};
