/**
 * Compare normalized SQLite result sets for DBGrader.
 * Expected/actual shape: { columns: string[], rows: any[][] }
 */
(function (global) {
    'use strict';

    function cellEqual(a, b, tolerance) {
        if (a === b) return true;
        if (a === null || b === null) return a === b;
        if (typeof a === 'number' && typeof b === 'number') {
            if (tolerance > 0) return Math.abs(a - b) <= tolerance;
            return a === b;
        }
        // SQLite may return numeric-looking strings; compare loosely when both numeric
        if (a == b && (typeof a === 'number' || typeof b === 'number')) {
            if (tolerance > 0) return Math.abs(Number(a) - Number(b)) <= tolerance;
            return Number(a) === Number(b);
        }
        return String(a) === String(b);
    }

    function rowKey(row) {
        return JSON.stringify(row);
    }

    function compareResults(expected, actual, options) {
        options = options || {};
        var columnNames = options.column_names !== false;
        var columnOrder = options.column_order !== false;
        var rowOrder = options.row_order !== false;
        var tolerance = Number(options.numeric_tolerance) || 0;

        var feedback = [];
        var expectedCols = (expected && expected.columns) || [];
        var actualCols = (actual && actual.columns) || [];
        var expectedRows = (expected && expected.rows) || [];
        var actualRows = (actual && actual.rows) || [];

        if (expectedCols.length !== actualCols.length) {
            feedback.push(
                'Expected ' + expectedCols.length + ' columns but received ' + actualCols.length + '.'
            );
        }

        if (columnNames) {
            var nameMismatch = false;
            var n = Math.min(expectedCols.length, actualCols.length);
            for (var i = 0; i < n; i++) {
                if (String(expectedCols[i]) !== String(actualCols[i])) {
                    nameMismatch = true;
                    feedback.push(
                        'Column ' + (i + 1) + ' should be named ' + expectedCols[i] +
                        ' but was ' + actualCols[i] + '.'
                    );
                    break;
                }
            }
            if (!nameMismatch && expectedCols.length === actualCols.length &&
                expectedCols.length > 0) {
                // names ok
            } else if (!columnOrder && expectedCols.length === actualCols.length) {
                // If order doesn't matter, check as sets — Phase 1 keeps order check when column_names true
            }
        }

        if (expectedRows.length !== actualRows.length) {
            feedback.push(
                'Expected ' + expectedRows.length + ' rows but received ' + actualRows.length + '.'
            );
        }

        var rowsMatch = true;
        if (rowOrder) {
            var limit = Math.min(expectedRows.length, actualRows.length);
            for (var r = 0; r < limit; r++) {
                var er = expectedRows[r] || [];
                var ar = actualRows[r] || [];
                if (er.length !== ar.length) {
                    rowsMatch = false;
                    feedback.push('Row ' + (r + 1) + ' has the wrong number of values.');
                    break;
                }
                for (var c = 0; c < er.length; c++) {
                    if (!cellEqual(er[c], ar[c], tolerance)) {
                        rowsMatch = false;
                        feedback.push(
                            'First mismatch at row ' + (r + 1) + ', column ' + (c + 1) +
                            ': expected ' + JSON.stringify(er[c]) +
                            ', got ' + JSON.stringify(ar[c]) + '.'
                        );
                        break;
                    }
                }
                if (!rowsMatch) break;
            }
        } else {
            // Multiset compare
            var counts = {};
            expectedRows.forEach(function (row) {
                var k = rowKey(row);
                counts[k] = (counts[k] || 0) + 1;
            });
            actualRows.forEach(function (row) {
                var k = rowKey(row);
                counts[k] = (counts[k] || 0) - 1;
            });
            Object.keys(counts).forEach(function (k) {
                if (counts[k] !== 0) rowsMatch = false;
            });
            if (!rowsMatch) {
                feedback.push('Row values do not match (order ignored).');
            }
        }

        var colsOk = expectedCols.length === actualCols.length;
        if (columnNames && colsOk) {
            for (var ci = 0; ci < expectedCols.length; ci++) {
                if (String(expectedCols[ci]) !== String(actualCols[ci])) {
                    colsOk = false;
                    break;
                }
            }
        }

        var passed =
            colsOk &&
            expectedRows.length === actualRows.length &&
            rowsMatch &&
            feedback.length === 0;

        if (passed) {
            feedback = ['Correct — your result matches the expected output.'];
        } else if (feedback.length === 0) {
            feedback = ['Results do not match.'];
        }

        return {
            passed: passed,
            feedback: feedback
        };
    }

    global.DBGraderCompare = {
        compareResults: compareResults
    };
})(typeof window !== 'undefined' ? window : self);
