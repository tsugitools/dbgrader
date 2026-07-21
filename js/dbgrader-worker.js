/**
 * DBGrader Web Worker — loads SQLite WASM and runs setup / query / grade jobs.
 * sqliteBase is supplied by the main thread from $CFG->staticroot.
 */
'use strict';

importScripts('dbgrader-compare.js');

var SQLITE_BASE = null;
var sqlite3Promise = null;

function loadSqlite3(sqliteBase) {
    if (sqlite3Promise) return sqlite3Promise;
    if (!sqliteBase) {
        return Promise.reject(new Error('sqliteBase URL was not provided'));
    }
    SQLITE_BASE = sqliteBase.replace(/\/?$/, '/');
    importScripts(SQLITE_BASE + 'sqlite3.js');
    // Worker has no document.currentScript; force WASM to load from staticroot.
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

/**
 * Run SQL; for result-producing statements capture the last result set.
 */
function execCapture(db, sql) {
    var columns = [];
    var rows = [];
    var sawResult = false;

    try {
        db.exec({
            sql: sql,
            rowMode: 'array',
            columnNames: columns,
            resultRows: rows
        });
        // columnNames / resultRows are filled for the last SELECT-like statement
        if (columns.length > 0 || rows.length > 0) {
            sawResult = true;
        }
    } catch (e) {
        var err = new Error(e.message || String(e));
        err.sqlite = true;
        throw err;
    }

    return {
        columns: columns.slice(),
        rows: rows.map(function (r) { return r.slice(); }),
        sawResult: sawResult
    };
}

function runSetup(db, setupSql) {
    if (!setupSql || !String(setupSql).trim()) {
        throw new Error('Setup SQL is empty.');
    }
    try {
        db.exec(setupSql);
    } catch (e) {
        var err = new Error(e.message || String(e));
        err.phase = 'setup';
        throw err;
    }
}

function handlePreview(sqlite3, exercise) {
    var db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);
        var result;
        try {
            result = execCapture(db, exercise.solution_sql);
        } catch (e) {
            e.phase = e.phase || 'solution';
            throw e;
        }
        return {
            execution_ok: true,
            phase: 'preview',
            result: {
                columns: result.columns,
                rows: result.rows
            }
        };
    } finally {
        db.close();
    }
}

function handleExecute(sqlite3, exercise, submissionSql) {
    var db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);
        var result = execCapture(db, submissionSql);
        return {
            execution_ok: true,
            phase: 'execute',
            result: {
                columns: result.columns,
                rows: result.rows
            }
        };
    } finally {
        db.close();
    }
}

function handleGrade(sqlite3, exercise, submissionSql) {
    var started = Date.now();
    var expected;
    var actual;

    var db1 = openDb(sqlite3);
    try {
        runSetup(db1, exercise.setup_sql);
        try {
            expected = execCapture(db1, exercise.solution_sql);
        } catch (e) {
            e.phase = 'solution';
            throw e;
        }
    } finally {
        db1.close();
    }

    var db2 = openDb(sqlite3);
    try {
        runSetup(db2, exercise.setup_sql);
        try {
            actual = execCapture(db2, submissionSql);
        } catch (e) {
            e.phase = 'submission';
            throw e;
        }
    } finally {
        db2.close();
    }

    var comparison = (exercise && exercise.comparison) || {};
    var cmp = self.DBGraderCompare.compareResults(
        { columns: expected.columns, rows: expected.rows },
        { columns: actual.columns, rows: actual.rows },
        comparison
    );

    return {
        execution_ok: true,
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
