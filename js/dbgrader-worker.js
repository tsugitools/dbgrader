/**
 * DBGrader Web Worker — SQLite WASM, query / database-state / upload-check grading.
 * sqliteBase is supplied by the main thread from $CFG->staticroot.
 */
'use strict';

// Reuse ?v=… from this worker URL so importScripts stay cache-busted with content hashes.
var DBG_ASSET_QS = (function () {
    try {
        var q = self.location.search || '';
        return q.indexOf('v=') >= 0 ? q : '';
    } catch (e) {
        return '';
    }
})();
importScripts('dbgrader-compare.js' + DBG_ASSET_QS);
importScripts('dbgrader-meta.js' + DBG_ASSET_QS);

var SQLITE_BASE = null;
var sqlite3Promise = null;

// sqlite3.h — may not be exported on all wasm builds
var SQLITE_DESERIALIZE_FREEONCLOSE = 1;
var SQLITE_DESERIALIZE_READONLY = 4;

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

/**
 * Open an uploaded SQLite database image read-only via deserialize.
 * @param {Uint8Array|ArrayBuffer} bytes
 */
function openDbFromBytes(sqlite3, bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.byteLength < 16) {
        var shortErr = new Error('Uploaded file is too small to be a SQLite database.');
        shortErr.phase = 'submission';
        throw shortErr;
    }
    var magic = '';
    for (var i = 0; i < 15; i++) {
        magic += String.fromCharCode(u8[i]);
    }
    if (magic !== 'SQLite format 3') {
        var magicErr = new Error('Uploaded file is not SQLite3 format (missing "SQLite format 3" header).');
        magicErr.phase = 'submission';
        throw magicErr;
    }

    var db = openDb(sqlite3);
    var p = null;
    try {
        p = sqlite3.wasm.allocFromTypedArray(u8);
        var flags = SQLITE_DESERIALIZE_FREEONCLOSE | SQLITE_DESERIALIZE_READONLY;
        if (typeof sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE === 'number') {
            flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
                | sqlite3.capi.SQLITE_DESERIALIZE_READONLY;
        }
        var rc = sqlite3.capi.sqlite3_deserialize(
            db.pointer,
            'main',
            p,
            u8.byteLength,
            u8.byteLength,
            flags
        );
        // On success, ownership of p transfers to SQLite (FREEONCLOSE).
        p = null;
        sqlite3.oo1.DB.checkRc(db, rc);
        return db;
    } catch (e) {
        if (p) {
            try { sqlite3.wasm.dealloc(p); } catch (ignore) {}
        }
        try { db.close(); } catch (ignore2) {}
        var err = new Error(e.message || String(e));
        err.phase = 'submission';
        throw err;
    }
}

function exerciseMode(exercise) {
    var m = exercise && exercise.mode;
    if (m === 'database-state' || m === 'upload-check') return m;
    return 'query';
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

function runVerifications(db, verificationSql, modeLabel) {
    var list = normalizeVerificationSql(verificationSql);
    if (list.length === 0) {
        var err = new Error((modeLabel || 'This mode') + ' requires at least one verification_sql query.');
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

function buildGoldDb(sqlite3, exercise) {
    var db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);
        if (exercise.solution_sql && String(exercise.solution_sql).trim()) {
            runSql(db, exercise.solution_sql, 'solution');
        }
        return db;
    } catch (e) {
        try { db.close(); } catch (ignore) {}
        throw e;
    }
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
        // Prefer dedicated table listing with counts (upload + SQL explore).
        if (job.withRowCounts || job.label === 'tables' || meta.name === 'tables') {
            return listTablesWithRowCounts(db, meta.like || null);
        }
        var captured = execCapture(db, job.sql);
        return {
            label: job.label,
            sql: job.sql || null,
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
            : (meta.dialect === 'postgresql'
                ? 'PostgreSQL command converted to SQLite'
                : null),
        result: results[0],
        results: results
    };
}

/**
 * List user tables with COUNT(*) per table (safe for uploaded/deserialize DBs).
 */
function listTablesWithRowCounts(db, like) {
    var sql = "SELECT name FROM sqlite_schema " +
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
    if (like) {
        sql += " AND name LIKE '" + String(like).replace(/'/g, "''") + "'";
    }
    sql += ' ORDER BY name';

    var names = [];
    try {
        db.exec({
            sql: sql,
            rowMode: 'array',
            callback: function (row) {
                if (row && row[0] != null) names.push(String(row[0]));
            }
        });
    } catch (e) {
        var err = new Error(e.message || String(e));
        err.phase = 'meta';
        throw err;
    }

    var rows = names.map(function (tableName) {
        var count = null;
        try {
            var qi = '"' + tableName.replace(/"/g, '""') + '"';
            db.exec({
                sql: 'SELECT COUNT(*) FROM ' + qi,
                rowMode: 'array',
                callback: function (row) {
                    if (row && row[0] != null) {
                        // Avoid BigInt — postMessage cannot clone it.
                        count = typeof row[0] === 'bigint' ? Number(row[0]) : row[0];
                    }
                }
            });
        } catch (ignore) {
            count = null;
        }
        return [tableName, count];
    });

    return {
        label: 'tables',
        columns: ['Table', 'row_count'],
        rows: rows
    };
}
function handlePreview(sqlite3, exercise) {
    var mode = exerciseMode(exercise);
    if (mode === 'upload-check' || mode === 'database-state') {
        var gdb = buildGoldDb(sqlite3, exercise);
        try {
            var results = runVerifications(
                gdb,
                exercise.verification_sql,
                mode === 'upload-check' ? 'upload-check mode' : 'database-state mode'
            );
            return {
                execution_ok: true,
                phase: 'preview',
                mode: mode,
                result: results[0],
                results: results
            };
        } finally {
            gdb.close();
        }
    }

    var db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);
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

function handleExecute(sqlite3, exercise, submissionSql, dbBytes) {
    var mode = exerciseMode(exercise);
    var db;

    if (mode === 'upload-check') {
        if (!dbBytes) {
            var missing = new Error('Choose a SQLite database file first.');
            missing.phase = 'submission';
            throw missing;
        }
        db = openDbFromBytes(sqlite3, dbBytes);
        try {
            if (self.DBGraderMeta.isMeta(submissionSql)) {
                return runMeta(db, submissionSql);
            }
            if (!submissionSql || !String(submissionSql).trim()) {
                // Default explore: list tables
                return runMeta(db, '.tables');
            }
            var upResult = runSql(db, submissionSql, 'submission');
            return {
                execution_ok: true,
                phase: 'execute',
                mode: mode,
                result: upResult
            };
        } finally {
            db.close();
        }
    }

    db = openDb(sqlite3);
    try {
        runSetup(db, exercise.setup_sql);

        if (self.DBGraderMeta.isMeta(submissionSql)) {
            return runMeta(db, submissionSql);
        }

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

function gradeUploadCheck(sqlite3, exercise, dbBytes) {
    var started = Date.now();
    var comparison = (exercise && exercise.comparison) || {};

    if (!dbBytes) {
        var missing = new Error('Choose a SQLite database file to check.');
        missing.phase = 'submission';
        throw missing;
    }

    var expectedList;
    var actualList;

    var gold = buildGoldDb(sqlite3, exercise);
    try {
        expectedList = runVerifications(gold, exercise.verification_sql, 'upload-check mode');
    } finally {
        gold.close();
    }

    var uploaded = openDbFromBytes(sqlite3, dbBytes);
    try {
        actualList = runVerifications(uploaded, exercise.verification_sql, 'upload-check mode');
    } finally {
        uploaded.close();
    }

    var cmpState = self.DBGraderCompare.compareResultLists(expectedList, actualList, comparison);
    return {
        execution_ok: true,
        mode: 'upload-check',
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

function handleGrade(sqlite3, exercise, submissionSql, dbBytes) {
    var started = Date.now();
    var mode = exerciseMode(exercise);
    var comparison = (exercise && exercise.comparison) || {};

    if (mode === 'upload-check') {
        return gradeUploadCheck(sqlite3, exercise, dbBytes);
    }

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
            expectedList = runVerifications(db1, exercise.verification_sql, 'database-state mode');
        } finally {
            db1.close();
        }

        var db2 = openDb(sqlite3);
        try {
            runSetup(db2, exercise.setup_sql);
            runSql(db2, submissionSql, 'submission');
            actualList = runVerifications(db2, exercise.verification_sql, 'database-state mode');
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
            var dbBytes = msg.db_bytes || null;
            var out;

            if (action === 'preview') {
                out = handlePreview(sqlite3, exercise);
            } else if (action === 'execute') {
                out = handleExecute(sqlite3, exercise, sql, dbBytes);
            } else if (action === 'grade') {
                out = handleGrade(sqlite3, exercise, sql, dbBytes);
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
