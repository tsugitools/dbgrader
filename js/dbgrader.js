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
        worker = new Worker((cfg.urls && cfg.urls.worker) || 'js/dbgrader-worker.js');
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
            var msg = Object.assign({
                id: id,
                action: action,
                sqliteBase: (cfg.urls && cfg.urls.sqliteBase) || null
            }, payload || {});
            var transfer = [];
            if (msg.db_bytes && msg.db_bytes instanceof ArrayBuffer) {
                transfer.push(msg.db_bytes);
            } else if (msg.db_bytes && msg.db_bytes.buffer instanceof ArrayBuffer
                && msg.db_bytes.byteOffset === 0
                && msg.db_bytes.byteLength === msg.db_bytes.buffer.byteLength) {
                transfer.push(msg.db_bytes.buffer);
            }
            if (transfer.length) {
                worker.postMessage(msg, transfer);
            } else {
                worker.postMessage(msg);
            }
        });
    }

    function normalizeMode(m) {
        if (m === 'database-state' || m === 'upload-check') return m;
        return 'query';
    }

    var MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

    function looksLikeSqliteName(name) {
        return /\.(sqlite3|sqlite|db)$/i.test(name || '');
    }

    function readFileAsArrayBuffer(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('Could not read file')); };
            reader.readAsArrayBuffer(file);
        });
    }

    function validateUploadFile(file) {
        if (!file) {
            return 'Choose a SQLite database file first.';
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            return 'Uploaded file must be < 3M.';
        }
        if (!looksLikeSqliteName(file.name)) {
            return 'Uploaded file must have a .sqlite3, .sqlite, or .db suffix.';
        }
        return null;
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
        var html = '';
        if (result.label || result.sql) {
            html += '<div class="result-heading">';
            if (result.label) {
                html += '<h3 class="result-label">' + escapeHtml(result.label) + '</h3>';
            }
            if (result.sql) {
                html += '<pre class="result-sql">' + escapeHtml(result.sql) + '</pre>';
            }
            html += '</div>';
        }
        html += '<div class="result-table-wrap"><table class="result-table"><thead><tr>';
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

    function renderResults(result, results) {
        if (results && results.length) {
            return results.map(renderTable).join('');
        }
        return renderTable(result);
    }

    function setStatus(el, kind, text) {
        el.className = 'status status-' + kind;
        el.textContent = text;
    }

    function showResult(panel, statusEl, kind, label, result, feedback, results, notice) {
        setStatus(statusEl, kind, label);
        var fb = '';
        if (feedback && feedback.length) {
            fb += '<ul class="feedback">' + feedback.map(function (f) {
                return '<li>' + escapeHtml(f) + '</li>';
            }).join('') + '</ul>';
        }
        var html = fb + renderResults(result, results);
        if (notice) {
            html += '<p class="compat-notice">' + escapeHtml(notice) + '</p>';
        }
        panel.innerHTML = html;
    }

    function showError(panel, statusEl, err) {
        var phase = err && err.phase;
        var prefix = 'Error';
        if (phase === 'setup') prefix = 'Setup SQL error';
        else if (phase === 'solution') prefix = 'Solution SQL error';
        else if (phase === 'submission') prefix = 'Your SQL error';
        else if (phase === 'verification') prefix = 'Verification SQL error';
        else if (phase === 'meta') prefix = 'Meta-command error';
        setStatus(statusEl, 'error', prefix);
        panel.innerHTML = '<pre class="error-detail">' + escapeHtml(err.message || String(err)) + '</pre>';
    }

    function verificationToText(v) {
        if (Array.isArray(v)) return v.join(';\n');
        return v || '';
    }

    function textToVerification(text) {
        return String(text || '')
            .split(';')
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
    }

    function syncAuthorModeUi() {
        var modeEl = document.getElementById('exMode');
        var verifyBlock = document.getElementById('verifyBlock');
        var starterBlock = document.getElementById('starterBlock');
        var solutionHint = document.getElementById('solutionHint');
        var setupHint = document.getElementById('setupHint');
        if (!modeEl || !verifyBlock) return;
        var mode = normalizeMode(modeEl.value);
        var needsVerify = mode === 'database-state' || mode === 'upload-check';
        verifyBlock.hidden = !needsVerify;
        if (starterBlock) {
            starterBlock.hidden = mode === 'upload-check';
        }
        if (solutionHint) {
            solutionHint.textContent = mode === 'upload-check'
                ? 'optional SQL after setup to build expected reference DB'
                : 'learner goal SQL';
        }
        if (setupHint) {
            if (mode === 'upload-check') {
                setupHint.textContent = 'expected reference DB (CREATE/INSERT)';
            } else if (mode === 'database-state') {
                setupHint.textContent = 'setup.sql (optional in database-state)';
            } else {
                setupHint.textContent = 'setup.sql';
            }
        }
        var verifyHint = document.getElementById('verifyHint');
        if (verifyHint) {
            verifyHint.textContent = mode === 'upload-check'
                ? 'run on gold DB and on the uploaded file; results must match'
                : 'one or more queries, separated by semicolons — used in database-state mode';
        }
        var runBtn = document.getElementById('btnRun');
        if (runBtn) {
            runBtn.textContent = needsVerify ? 'Run verification preview' : 'Run query';
        }
    }

    // ---- Author view ----
    function renderAuthor() {
        document.getElementById('exerciseTitle').textContent = exercise.title || 'Edit exercise';
        var mode = normalizeMode(exercise.mode);
        app.innerHTML =
            '<section class="author-meta">' +
            '<label>Title <input id="exTitle" type="text" value="' + escapeHtml(exercise.title || '') + '"></label>' +
            '<label>Prompt <textarea id="exPrompt" rows="3">' + escapeHtml(exercise.prompt || '') + '</textarea></label>' +
            '<label>Assignment instructions URL <span class="hint">(optional link shown to learners)</span>' +
            '<input id="exInstructionsUrl" type="url" placeholder="https://www.dj4e.com/assn/…" value="' +
            escapeHtml(exercise.instructions_url || '') + '"></label>' +
            '<label>Mode' +
            '<select id="exMode">' +
            '<option value="query"' + (mode === 'query' ? ' selected' : '') + '>query — compare SELECT results</option>' +
            '<option value="database-state"' + (mode === 'database-state' ? ' selected' : '') +
            '>database-state — compare verification queries after DDL/DML</option>' +
            '<option value="upload-check"' + (mode === 'upload-check' ? ' selected' : '') +
            '>upload-check — upload SQLite file; compare verification queries</option>' +
            '</select></label>' +
            '<label id="starterBlock">Starter SQL for learners <span class="hint">(shown in their editor; leave blank for empty)</span>' +
            '<textarea id="exStarter" class="code" rows="4" spellcheck="false">' +
            escapeHtml(exercise.starter_sql || '') + '</textarea></label>' +
            '</section>' +
            '<section class="split">' +
            '<div class="pane">' +
            '<h2>Solution <span class="hint" id="solutionHint">learner goal SQL</span></h2>' +
            '<textarea id="exSolution" class="code" spellcheck="false">' +
            escapeHtml(exercise.solution_sql || '') + '</textarea>' +
            '<button type="button" id="btnRun" class="btn btn-primary">Run query</button>' +
            '</div>' +
            '<div class="pane">' +
            '<h2>Setup <span class="hint" id="setupHint">setup.sql</span></h2>' +
            '<textarea id="exSetup" class="code" spellcheck="false">' +
            escapeHtml(exercise.setup_sql || '') + '</textarea>' +
            '</div>' +
            '</section>' +
            '<section id="verifyBlock" class="verify-block">' +
            '<h2>Verification SQL <span class="hint" id="verifyHint">one or more queries, separated by semicolons</span></h2>' +
            '<textarea id="exVerify" class="code" rows="5" spellcheck="false">' +
            escapeHtml(verificationToText(exercise.verification_sql)) + '</textarea>' +
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
            '<div class="dbg-modal-tabs" role="tablist">' +
            '<button type="button" class="dbg-tab active" data-json-tab="assignment" role="tab" aria-selected="true">Assignment JSON</button>' +
            '<button type="button" class="dbg-tab" data-json-tab="custom" role="tab" aria-selected="false">lessons.json custom</button>' +
            '</div>' +
            '<pre id="jsonModalBody" class="dbg-json-body"></pre>' +
            '<div class="dbg-modal-footer">' +
            '<button type="button" id="btnCopyJson" class="btn btn-secondary">Copy</button>' +
            '<button type="button" class="btn btn-ghost" data-close-json>Close</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        document.getElementById('exMode').addEventListener('change', syncAuthorModeUi);
        syncAuthorModeUi();
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
        jsonModal.querySelectorAll('[data-json-tab]').forEach(function (el) {
            el.addEventListener('click', function () {
                setJsonModalTab(el.getAttribute('data-json-tab'));
            });
        });
    }

    var jsonModalTab = 'assignment';

    function buildLessonsCustomSnippet(ex) {
        // Prefer built-in key (CA4E-style) when this placement uses a catalog assignment.
        var key = cfg.assignmentKey || (ex && ex.builtin) || null;
        if (key) {
            return {
                custom: [
                    {
                        key: 'exercise',
                        value: key
                    }
                ]
            };
        }
        return {
            custom: [
                {
                    key: 'config',
                    json: ex
                }
            ]
        };
    }

    function jsonModalText() {
        var ex = collectExerciseFromForm();
        if (jsonModalTab === 'custom') {
            return JSON.stringify(buildLessonsCustomSnippet(ex), null, 2);
        }
        return JSON.stringify(ex, null, 2);
    }

    function refreshJsonModalBody() {
        var body = document.getElementById('jsonModalBody');
        if (body) body.textContent = jsonModalText();
    }

    function setJsonModalTab(tab) {
        jsonModalTab = tab === 'custom' ? 'custom' : 'assignment';
        var modal = document.getElementById('jsonModal');
        if (!modal) return;
        modal.querySelectorAll('[data-json-tab]').forEach(function (el) {
            var on = el.getAttribute('data-json-tab') === jsonModalTab;
            el.classList.toggle('active', on);
            el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        var title = document.getElementById('jsonModalTitle');
        if (title) {
            title.textContent = jsonModalTab === 'custom'
                ? 'lessons.json custom snippet'
                : 'Assignment JSON';
        }
        refreshJsonModalBody();
    }

    function openJsonModal() {
        var modal = document.getElementById('jsonModal');
        setJsonModalTab(jsonModalTab || 'assignment');
        modal.hidden = false;
    }

    function closeJsonModal() {
        var modal = document.getElementById('jsonModal');
        if (modal) modal.hidden = true;
    }

    function copyJsonModal() {
        var text = jsonModalText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                document.getElementById('btnCopyJson').textContent = 'Copied';
                setTimeout(function () {
                    document.getElementById('btnCopyJson').textContent = 'Copy';
                }, 1200);
            });
        }
    }

    function safeHttpUrl(url) {
        var s = String(url || '').trim();
        if (!s) return '';
        if (!/^https?:\/\//i.test(s)) return '';
        return s;
    }

    function instructionsLinkHtml(ex) {
        var url = safeHttpUrl(ex && ex.instructions_url);
        if (!url) return '';
        return '<p class="instructions-link">' +
            '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
            'Assignment instructions</a></p>';
    }

    function collectExerciseFromForm() {
        var mode = normalizeMode(document.getElementById('exMode').value);
        var verification = textToVerification(document.getElementById('exVerify').value);
        var compatibility = (mode === 'database-state' || mode === 'upload-check')
            ? ['dbgrader']
            : (exercise.compatibility || ['dbgrader', 'udemy']);
        var starterEl = document.getElementById('exStarter');
        var instructionsUrl = '';
        var instructionsEl = document.getElementById('exInstructionsUrl');
        if (instructionsEl) {
            instructionsUrl = instructionsEl.value.trim();
        }
        var out = {
            version: exercise.version || 1,
            type: 'sqlite',
            mode: mode,
            title: document.getElementById('exTitle').value.trim(),
            prompt: document.getElementById('exPrompt').value,
            instructions_url: instructionsUrl,
            setup_sql: document.getElementById('exSetup').value,
            solution_sql: document.getElementById('exSolution').value,
            starter_sql: starterEl ? starterEl.value : (exercise.starter_sql || ''),
            verification_sql: verification,
            hints: exercise.hints || [],
            comparison: exercise.comparison || {
                column_names: true,
                column_order: true,
                row_order: true,
                numeric_tolerance: 0
            },
            dialect: exercise.dialect || 'sqlite',
            compatibility: compatibility
        };
        // Keep built-in identity so Settings can tell when to reload a different assignment.
        var builtinKey = cfg.assignmentKey || exercise.builtin || null;
        if (builtinKey) {
            out.builtin = builtinKey;
        }
        return out;
    }

    function authorRun() {
        var ex = collectExerciseFromForm();
        var status = document.getElementById('runStatus');
        var panel = document.getElementById('runPanel');
        if ((ex.mode === 'database-state' || ex.mode === 'upload-check')
            && (!ex.verification_sql || !ex.verification_sql.length)) {
            setStatus(status, 'error', 'Add at least one verification query for ' + ex.mode + ' mode.');
            return;
        }
        if (ex.mode === 'upload-check'
            && !String(ex.setup_sql || '').trim()
            && !String(ex.solution_sql || '').trim()) {
            setStatus(status, 'error', 'Provide setup and/or solution SQL to build the expected reference database.');
            return;
        }
        setStatus(status, 'pending', 'Running…');
        panel.innerHTML = '';
        callWorker('preview', { exercise: ex })
            .then(function (data) {
                showResult(panel, status, 'success', 'Success', data.result, null, data.results);
            })
            .catch(function (err) {
                showError(panel, status, err);
            });
    }

    function authorSave() {
        var ex = collectExerciseFromForm();
        var msg = document.getElementById('saveMsg');
        if (!ex.prompt.trim()) {
            msg.textContent = 'Prompt is required.';
            return;
        }
        if (ex.mode === 'query') {
            if (!ex.solution_sql.trim()) {
                msg.textContent = 'Solution SQL is required for query mode.';
                return;
            }
            if (!ex.setup_sql.trim()) {
                msg.textContent = 'Setup SQL is required for query mode.';
                return;
            }
        }
        if (ex.mode === 'database-state') {
            if (!ex.solution_sql.trim()) {
                msg.textContent = 'Solution SQL is required for database-state mode.';
                return;
            }
            if (!ex.verification_sql || !ex.verification_sql.length) {
                msg.textContent = 'Verification SQL is required for database-state mode.';
                return;
            }
        }
        if (ex.mode === 'upload-check') {
            if (!ex.verification_sql || !ex.verification_sql.length) {
                msg.textContent = 'Verification SQL is required for upload-check mode.';
                return;
            }
            if (!ex.setup_sql.trim() && !ex.solution_sql.trim()) {
                msg.textContent = 'Setup and/or solution SQL is required to build the expected reference database.';
                return;
            }
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
                    document.getElementById('exerciseTitle').textContent = ex.title || 'Edit exercise';
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
        if (normalizeMode(exercise.mode) === 'upload-check') {
            renderLearnerUpload();
            return;
        }
        app.innerHTML =
            '<section class="prompt-block">' +
            '<h1>' + escapeHtml(exercise.title || 'SQL exercise') + '</h1>' +
            '<p class="prompt">' + escapeHtml(exercise.prompt || '') + '</p>' +
            instructionsLinkHtml(exercise) +
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

    function renderLearnerUpload() {
        app.innerHTML =
            '<section class="prompt-block">' +
            '<h1>' + escapeHtml(exercise.title || 'Upload and check') + '</h1>' +
            '<p class="prompt">' + escapeHtml(exercise.prompt || '') + '</p>' +
            instructionsLinkHtml(exercise) +
            '</section>' +
            '<section class="upload-block">' +
            '<h2>Your SQLite database</h2>' +
            '<p class="muted">Upload a <code>.sqlite3</code> file (also accepts <code>.sqlite</code> / <code>.db</code>), max 3M.</p>' +
            '<label class="upload-label">Database file' +
            '<input id="learnerDbFile" type="file" accept=".sqlite3,.sqlite,.db,application/x-sqlite3">' +
            '</label>' +
            '<div class="btn-row">' +
            '<button type="button" id="btnExplore" class="btn btn-secondary">Explore (.tables)</button>' +
            '<button type="button" id="btnCheck" class="btn btn-primary">Check database</button>' +
            '</div>' +
            '</section>' +
            '<section class="result-section">' +
            '<div class="result-header"><h2>Result</h2><span id="runStatus" class="status"></span></div>' +
            '<div id="runPanel"></div>' +
            '</section>';

        document.getElementById('btnExplore').addEventListener('click', learnerExploreUpload);
        document.getElementById('btnCheck').addEventListener('click', learnerCheckUpload);
    }

    function getSelectedUploadFile() {
        var input = document.getElementById('learnerDbFile');
        return input && input.files && input.files[0] ? input.files[0] : null;
    }

    function learnerExploreUpload() {
        var file = getSelectedUploadFile();
        var status = document.getElementById('runStatus');
        var panel = document.getElementById('runPanel');
        var err = validateUploadFile(file);
        if (err) {
            setStatus(status, 'error', err);
            return;
        }
        setStatus(status, 'pending', 'Opening database…');
        panel.innerHTML = '';
        readFileAsArrayBuffer(file)
            .then(function (buf) {
                return callWorker('execute', {
                    exercise: exercise,
                    submission_sql: '.tables',
                    db_bytes: buf
                });
            })
            .then(function (data) {
                var label = data.phase === 'meta' ? 'Meta: ' + (data.meta || 'ok') : 'Success';
                showResult(panel, status, 'success', label, data.result, null, data.results, data.notice);
            })
            .catch(function (e) {
                showError(panel, status, e);
            });
    }

    function learnerCheckUpload() {
        var file = getSelectedUploadFile();
        var status = document.getElementById('runStatus');
        var panel = document.getElementById('runPanel');
        var err = validateUploadFile(file);
        if (err) {
            setStatus(status, 'error', err);
            return;
        }
        setStatus(status, 'pending', 'Checking database…');
        panel.innerHTML = '';
        recordAttempt();
        readFileAsArrayBuffer(file)
            .then(function (buf) {
                return callWorker('grade', { exercise: exercise, db_bytes: buf });
            })
            .then(function (data) {
                var kind = data.passed ? 'success' : 'fail';
                var label = data.passed ? 'Correct' : 'Not yet';
                var display = data.actual;
                var results = data.results || (data.actual && data.actual.results);
                showResult(panel, status, kind, label, display, data.feedback, results);
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
            .catch(function (e) {
                showError(panel, status, e);
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
                var label = data.phase === 'meta' ? 'Meta: ' + (data.meta || 'ok') : 'Success';
                showResult(panel, status, 'success', label, data.result, null, data.results, data.notice);
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
                var display = data.actual;
                var results = data.results || (data.actual && data.actual.results);
                showResult(panel, status, kind, label, display, data.feedback, results);
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
