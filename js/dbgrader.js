/**
 * DBGrader main UI — author and learner views.
 * PHP only injects window.DBGRADER; all interaction lives here.
 */
(function () {
    'use strict';

    var cfg = window.DBGRADER || {};
    var exercise = cfg.exercise || {};
    var app = document.getElementById('app');
    var worker = null;
    var nextId = 1;
    var pending = {};

    function ensureWorker() {
        if (worker) return worker;
        worker = new Worker('js/dbgrader-worker.js');
        worker.onmessage = function (ev) {
            var msg = ev.data || {};
            var waiter = pending[msg.id];
            if (!waiter) return;
            delete pending[msg.id];
            if (msg.ok) waiter.resolve(msg.data);
            else waiter.reject(msg.error || { message: 'Worker error' });
        };
        worker.onerror = function (err) {
            console.error('DBGrader worker error', err);
        };
        return worker;
    }

    function callWorker(action, payload) {
        ensureWorker();
        var id = nextId++;
        return new Promise(function (resolve, reject) {
            pending[id] = { resolve: resolve, reject: reject };
            worker.postMessage(Object.assign({
                id: id,
                action: action,
                sqliteBase: (cfg.urls && cfg.urls.sqliteBase) || null
            }, payload || {}));
        });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderTable(result) {
        if (!result || !result.columns) {
            return '<p class="muted">No result set.</p>';
        }
        if (result.columns.length === 0 && (!result.rows || result.rows.length === 0)) {
            return '<p class="muted">Query succeeded with an empty result.</p>';
        }
        var html = '<div class="result-table-wrap"><table class="result-table"><thead><tr>';
        result.columns.forEach(function (c) {
            html += '<th>' + escapeHtml(c) + '</th>';
        });
        html += '</tr></thead><tbody>';
        (result.rows || []).forEach(function (row) {
            html += '<tr>';
            row.forEach(function (cell) {
                var v = cell === null ? 'NULL' : cell;
                html += '<td>' + escapeHtml(v) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    function setStatus(el, kind, text) {
        el.className = 'status status-' + kind;
        el.textContent = text;
    }

    function showResult(panel, statusEl, kind, label, result, feedback) {
        setStatus(statusEl, kind, label);
        var fb = '';
        if (feedback && feedback.length) {
            fb = '<ul class="feedback">' + feedback.map(function (f) {
                return '<li>' + escapeHtml(f) + '</li>';
            }).join('') + '</ul>';
        }
        panel.innerHTML = fb + renderTable(result);
    }

    function showError(panel, statusEl, err) {
        var phase = err && err.phase;
        var prefix = 'Error';
        if (phase === 'setup') prefix = 'Setup SQL error';
        else if (phase === 'solution') prefix = 'Solution SQL error';
        else if (phase === 'submission') prefix = 'Your SQL error';
        setStatus(statusEl, 'error', prefix);
        panel.innerHTML = '<pre class="error-detail">' + escapeHtml(err.message || String(err)) + '</pre>';
    }

    // ---- Author view ----
    function renderAuthor() {
        document.getElementById('exerciseTitle').textContent = exercise.title || 'Author exercise';
        app.innerHTML =
            '<section class="author-meta">' +
            '<label>Title <input id="exTitle" type="text" value="' + escapeHtml(exercise.title || '') + '"></label>' +
            '<label>Prompt <textarea id="exPrompt" rows="3">' + escapeHtml(exercise.prompt || '') + '</textarea></label>' +
            '<label>Starter SQL for learners <span class="hint">(shown in their editor; leave blank for empty)</span>' +
            '<textarea id="exStarter" class="code" rows="4" spellcheck="false">' +
            escapeHtml(exercise.starter_sql || '') + '</textarea></label>' +
            '</section>' +
            '<section class="split">' +
            '<div class="pane">' +
            '<h2>Solution <span class="hint">query.sql</span></h2>' +
            '<textarea id="exSolution" class="code" spellcheck="false">' +
            escapeHtml(exercise.solution_sql || '') + '</textarea>' +
            '<button type="button" id="btnRun" class="btn btn-primary">Run query</button>' +
            '</div>' +
            '<div class="pane">' +
            '<h2>Evaluation <span class="hint">setup.sql</span></h2>' +
            '<textarea id="exSetup" class="code" spellcheck="false">' +
            escapeHtml(exercise.setup_sql || '') + '</textarea>' +
            '</div>' +
            '</section>' +
            '<section class="result-section">' +
            '<div class="result-header"><h2>Result</h2><span id="runStatus" class="status"></span></div>' +
            '<div id="runPanel"></div>' +
            '</section>' +
            '<footer class="actions">' +
            '<button type="button" id="btnSave" class="btn btn-primary">Save</button>' +
            '<button type="button" id="btnViewJson" class="btn btn-ghost">View Assignment JSON</button>' +
            '<span id="saveMsg" class="muted"></span>' +
            '</footer>' +
            '<div id="jsonModal" class="dbg-modal" hidden>' +
            '<div class="dbg-modal-backdrop" data-close-json></div>' +
            '<div class="dbg-modal-panel" role="dialog" aria-modal="true" aria-labelledby="jsonModalTitle">' +
            '<div class="dbg-modal-header">' +
            '<h2 id="jsonModalTitle">Assignment JSON</h2>' +
            '<button type="button" class="btn btn-ghost" data-close-json aria-label="Close">Close</button>' +
            '</div>' +
            '<pre id="jsonModalBody" class="dbg-json-body"></pre>' +
            '<div class="dbg-modal-footer">' +
            '<button type="button" id="btnCopyJson" class="btn btn-secondary">Copy</button>' +
            '<button type="button" class="btn btn-ghost" data-close-json>Close</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.getElementById('btnRun').addEventListener('click', authorRun);
        document.getElementById('btnSave').addEventListener('click', authorSave);
        document.getElementById('btnViewJson').addEventListener('click', openJsonModal);
        document.getElementById('btnCopyJson').addEventListener('click', copyJsonModal);
        var jsonModal = document.getElementById('jsonModal');
        jsonModal.querySelector('.dbg-modal-panel').addEventListener('click', function (ev) {
            ev.stopPropagation();
        });
        jsonModal.querySelectorAll('[data-close-json]').forEach(function (el) {
            el.addEventListener('click', closeJsonModal);
        });
    }

    function openJsonModal() {
        var modal = document.getElementById('jsonModal');
        var body = document.getElementById('jsonModalBody');
        body.textContent = JSON.stringify(collectExerciseFromForm(), null, 2);
        modal.hidden = false;
    }

    function closeJsonModal() {
        var modal = document.getElementById('jsonModal');
        if (modal) modal.hidden = true;
    }

    function copyJsonModal() {
        var text = document.getElementById('jsonModalBody').textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                document.getElementById('btnCopyJson').textContent = 'Copied';
                setTimeout(function () {
                    document.getElementById('btnCopyJson').textContent = 'Copy';
                }, 1200);
            });
        }
    }

    function collectExerciseFromForm() {
        return {
            version: exercise.version || 1,
            type: 'sqlite',
            mode: 'query',
            title: document.getElementById('exTitle').value.trim(),
            prompt: document.getElementById('exPrompt').value,
            setup_sql: document.getElementById('exSetup').value,
            solution_sql: document.getElementById('exSolution').value,
            starter_sql: document.getElementById('exStarter').value,
            verification_sql: exercise.verification_sql || [],
            hints: exercise.hints || [],
            comparison: exercise.comparison || {
                column_names: true,
                column_order: true,
                row_order: true,
                numeric_tolerance: 0
            },
            dialect: exercise.dialect || 'sqlite',
            compatibility: exercise.compatibility || ['dbgrader', 'udemy']
        };
    }

    function authorRun() {
        var ex = collectExerciseFromForm();
        var status = document.getElementById('runStatus');
        var panel = document.getElementById('runPanel');
        setStatus(status, 'pending', 'Running…');
        panel.innerHTML = '';
        callWorker('preview', { exercise: ex })
            .then(function (data) {
                showResult(panel, status, 'success', 'Success', data.result);
            })
            .catch(function (err) {
                showError(panel, status, err);
            });
    }

    function authorSave() {
        var ex = collectExerciseFromForm();
        var msg = document.getElementById('saveMsg');
        if (!ex.prompt.trim() || !ex.setup_sql.trim() || !ex.solution_sql.trim()) {
            msg.textContent = 'Prompt, setup SQL, and solution SQL are required.';
            return;
        }
        if (!cfg.urls || !cfg.urls.save) {
            msg.textContent = 'Save URL missing.';
            return;
        }
        msg.textContent = 'Saving…';
        fetch(cfg.urls.save, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ex)
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (res.ok && res.j.status === 'success') {
                    exercise = ex;
                    document.getElementById('exerciseTitle').textContent = ex.title || 'Author exercise';
                    msg.textContent = 'Saved.';
                } else {
                    msg.textContent = (res.j && res.j.detail) || 'Save failed.';
                }
            })
            .catch(function (e) {
                msg.textContent = e.message || 'Save failed.';
            });
    }

    // ---- Learner view ----
    function renderLearner() {
        document.getElementById('exerciseTitle').textContent = exercise.title || 'SQL exercise';
        app.innerHTML =
            '<section class="prompt-block">' +
            '<h1>' + escapeHtml(exercise.title || 'SQL exercise') + '</h1>' +
            '<p class="prompt">' + escapeHtml(exercise.prompt || '') + '</p>' +
            '</section>' +
            '<section class="editor-block">' +
            '<h2>Your SQL</h2>' +
            '<textarea id="learnerSql" class="code" spellcheck="false" placeholder="SELECT …">' +
            escapeHtml(exercise.starter_sql || '') + '</textarea>' +
            '<div class="btn-row">' +
            '<button type="button" id="btnRun" class="btn btn-secondary">Run</button>' +
            '<button type="button" id="btnCheck" class="btn btn-primary">Check Answer</button>' +
            '<button type="button" id="btnReset" class="btn btn-ghost">Reset</button>' +
            '</div>' +
            '</section>' +
            '<section class="result-section">' +
            '<div class="result-header"><h2>Result</h2><span id="runStatus" class="status"></span></div>' +
            '<div id="runPanel"></div>' +
            '</section>';

        document.getElementById('btnRun').addEventListener('click', learnerRun);
        document.getElementById('btnCheck').addEventListener('click', learnerCheck);
        document.getElementById('btnReset').addEventListener('click', function () {
            document.getElementById('learnerSql').value = exercise.starter_sql || '';
            document.getElementById('runPanel').innerHTML = '';
            document.getElementById('runStatus').textContent = '';
            document.getElementById('runStatus').className = 'status';
        });
    }

    function learnerRun() {
        var sql = document.getElementById('learnerSql').value;
        var status = document.getElementById('runStatus');
        var panel = document.getElementById('runPanel');
        if (!sql.trim()) {
            setStatus(status, 'error', 'Enter a SQL statement first.');
            return;
        }
        setStatus(status, 'pending', 'Running…');
        panel.innerHTML = '';
        callWorker('execute', { exercise: exercise, submission_sql: sql })
            .then(function (data) {
                showResult(panel, status, 'success', 'Success', data.result);
            })
            .catch(function (err) {
                showError(panel, status, err);
            });
    }

    function recordAttempt() {
        if (!cfg.urls || !cfg.urls.recordAttempt) return;
        var fd = new FormData();
        fetch(cfg.urls.recordAttempt, { method: 'POST', body: fd, credentials: 'same-origin' })
            .catch(function () {});
    }

    function submitGrade(grade) {
        if (!cfg.urls || !cfg.urls.gradeSubmit) {
            return Promise.reject(new Error('Grade URL missing'));
        }
        var fd = new FormData();
        fd.append('grade', String(grade));
        fd.append('code', 'DBGRADER');
        return fetch(cfg.urls.gradeSubmit, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin'
        }).then(function (r) { return r.json(); });
    }

    function learnerCheck() {
        var sql = document.getElementById('learnerSql').value;
        var status = document.getElementById('runStatus');
        var panel = document.getElementById('runPanel');
        if (!sql.trim()) {
            setStatus(status, 'error', 'Enter a SQL statement first.');
            return;
        }
        setStatus(status, 'pending', 'Checking…');
        panel.innerHTML = '';
        recordAttempt();
        callWorker('grade', { exercise: exercise, submission_sql: sql })
            .then(function (data) {
                var kind = data.passed ? 'success' : 'fail';
                var label = data.passed ? 'Correct' : 'Not yet';
                showResult(panel, status, kind, label, data.actual, data.feedback);
                if (data.passed) {
                    return submitGrade(1.0).then(function (resp) {
                        if (resp && resp.status === 'success') {
                            setStatus(status, 'success', 'Correct — grade submitted');
                        } else if (resp && resp.detail) {
                            setStatus(status, 'success', 'Correct — grade note: ' + resp.detail);
                        }
                    }).catch(function (e) {
                        setStatus(status, 'success', 'Correct — grade send failed: ' + e.message);
                    });
                }
            })
            .catch(function (err) {
                showError(panel, status, err);
            });
    }

    // ---- Boot ----
    if (cfg.mode === 'author' && cfg.isInstructor) {
        renderAuthor();
    } else {
        renderLearner();
    }
})();
