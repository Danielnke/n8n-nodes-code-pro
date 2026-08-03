const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const python = require(path.join(root, 'dist', 'src', 'python'));
const { validateRunCodeEachItem } = require(path.join(root, 'dist', 'src', 'validation'));

const items = [
	{ json: { name: '?ngstr?m', nested: { value: null }, number: 1 }, binary: { source: { id: 'one' } } },
	{ json: { name: '??', nested: { value: null }, number: 2 } },
];

function run(code, overrides = {}) {
	return python.runPythonCode({
		code,
		mode: 'runOnceForAllItems',
		items,
		timeoutSec: 10,
		continueOnFail: false,
		maxProtocolBytes: 1024 * 1024,
		maxLogBytes: 64 * 1024,
		...overrides,
	});
}

function normalize(raw) {
	const list = Array.isArray(raw) ? raw : [raw];
	return list.map((item) => (item && typeof item === 'object' && ('json' in item || 'binary' in item) ? item : { json: item }));
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test('package ships bootstrap and defaults saved nodes to JavaScript', () => {
	assert.equal(fs.existsSync(path.join(root, 'dist', 'src', 'python', 'bootstrap.py')), true);
	const { CodePro } = require(path.join(root, 'dist', 'nodes', 'CodePro', 'CodePro.node.js'));
	const node = new CodePro();
	const language = node.description.properties.find((property) => property.name === 'language');
	const jsCode = node.description.properties.find((property) => property.name === 'jsCode');
	const pythonCode = node.description.properties.find((property) => property.name === 'pythonCode');
	assert.equal(language.default, 'javaScript');
	assert.equal(jsCode.name, 'jsCode');
	assert.equal(pythonCode.typeOptions.editor, 'jsEditor');
	assert.equal(pythonCode.typeOptions.editorLanguage, 'python');
});

test('interpreter candidates honor deterministic Windows and Linux ordering', () => {
	const windows = python.getPythonCandidates({
		explicitExecutable: 'C:/Python/python.exe',
		environment: { CODE_PRO_PYTHON_PATH: 'D:/Python/python.exe' },
		platform: 'win32',
	});
	assert.deepEqual(windows.map((entry) => entry.display), [
		'Options > Python Executable',
		'CODE_PRO_PYTHON_PATH',
		'python3',
		'python',
		'py -3',
	]);
	const linux = python.getPythonCandidates({ environment: {}, platform: 'linux' });
	assert.deepEqual(linux.map((entry) => entry.display), ['python3', 'python']);
});

test('interpreter version rejection and missing-runtime message are actionable', async () => {
	await assert.rejects(
		() =>
			python.resolvePythonInterpreter({
				environment: {},
				platform: 'linux',
				probe: async (candidate) => ({ ...candidate, version: '3.10.14', major: 3, minor: 10 }),
			}),
		(error) => error instanceof python.PythonRuntimeUnavailableError && /requires 3\.11\+/.test(error.message),
	);
	const error = new python.PythonRuntimeUnavailableError(['python3', 'python']);
	assert.match(error.message, /Executables checked: python3, python/);
	assert.match(error.message, /CODE_PRO_PYTHON_PATH/);
	assert.match(error.message, /queue mode/);
});

test('all-items Python preserves helpers, nested None, Unicode, binary, and pairedItem', async () => {
	const execution = await run(`
first = _input.first()
return [{
    "json": {
        "count": len(_input.all()),
        "first": first.json.name,
        "nested_none": items[1].json.nested.value,
        "binary_id": first.binary.source.id,
    },
    "pairedItem": {"item": 0},
}]
`);
	assert.deepEqual(execution.result, [{
		json: { count: 2, first: '?ngstr?m', nested_none: null, binary_id: 'one' },
		pairedItem: { item: 0 },
	}]);
});

test('each-item Python sees full input plus item-specific helper names', async () => {
	const execution = await run(`
return {
    "json": {
        "all_count": len(_input.all()),
        "name": _json.name,
        "item_name": item.json.name,
        "index": _item_index,
        "same": _input.item.json.name == _item.json.name,
    }
}
`, { mode: 'runOnceForEachItem' });
	assert.equal(execution.results.length, 2);
	assert.deepEqual(execution.results.map((entry) => entry.value.json), [
		{ all_count: 2, name: '?ngstr?m', item_name: '?ngstr?m', index: 0, same: true },
		{ all_count: 2, name: '??', item_name: '??', index: 1, same: true },
	]);
});

test('each-item skip and multi-output contracts cross into the existing validator', async () => {
	const skipped = await run(`
if _item_index == 0:
    return None
return []
`, { mode: 'runOnceForEachItem' });
	assert.equal(skipped.results[0].value, null);
	assert.deepEqual(skipped.results[1].value, []);

	const multi = await run('return [{"json": {"a": 1}}, {"json": {"b": 2}}]', { mode: 'runOnceForEachItem' });
	assert.throws(
		() => validateRunCodeEachItem(multi.results[0].value, 0, normalize),
		/doesn't return a single object/,
	);
	const plain = await run('return {"plain": True}', { mode: 'runOnceForEachItem' });
	assert.deepEqual(validateRunCodeEachItem(plain.results[0].value, 0, normalize), {
		json: { plain: true },
		pairedItem: { item: 0 },
	});
});

test('Python error types map user lines and per-item failures without aborting a continue-on-fail batch', async () => {
	await assert.rejects(
		() => run('return [', { mode: 'runOnceForAllItems' }),
		(error) => error instanceof python.PythonRunnerError && error.errorType === 'syntax' && error.details.userLine === 1,
	);
	await assert.rejects(
		() => run('import definitely_missing_code_pro_package'),
		(error) => error instanceof python.PythonRunnerError && error.errorType === 'import',
	);
	const continued = await run(`
if _item_index == 1:
    raise RuntimeError("per-item failure")
return {"json": {"ok": _item_index}}
`, { mode: 'runOnceForEachItem', continueOnFail: true });
	assert.equal(continued.results[0].ok, true);
	assert.equal(continued.results[1].ok, false);
	assert.equal(continued.results[1].error.errorType, 'runtime');
	assert.equal(continued.results[2], undefined);
});

test('print output is captured without corrupting the final protocol response', async () => {
	const execution = await run('print("hello from python")\nreturn [{"json": {"ok": True}}]');
	assert.deepEqual(execution.result, [{ json: { ok: true } }]);
	assert.match(execution.logs.stdout, /hello from python/);
});

test('Python deliberately inherits the n8n process environment', async () => {
	const name = 'CODE_PRO_PYTHON_TEST_MARKER';
	const previous = process.env[name];
	process.env[name] = 'code-pro-inherited-environment';
	try {
		const execution = await run(`
import os
return [{"json": {"marker": os.environ.get("${name}")}}]
`);
		assert.equal(execution.result[0].json.marker, 'code-pro-inherited-environment');
	} finally {
		if (previous === undefined) delete process.env[name];
		else process.env[name] = previous;
	}
});

test('hard timeout terminates a CPU loop', async () => {
	const started = Date.now();
	await assert.rejects(
		() => run('while True:\n    pass', { timeoutSec: 0.2 }),
		(error) => error instanceof python.PythonRunnerError && error.errorType === 'timeout',
	);
	assert.ok(Date.now() - started < 8000);
});

test('serializer supports dates, Decimal, tuples, bytes, and deterministic primitive sets', async () => {
	const execution = await run(`
from datetime import date, time
from decimal import Decimal
return [{"json": {
    "date": date(2026, 8, 2),
    "time": time(12, 30, 5),
    "decimal": Decimal("12.50"),
    "tuple": ("a", 2),
    "bytes": b"hi",
    "set": {3, 1, 2},
}}]
`);
	assert.deepEqual(execution.result[0].json, {
		date: '2026-08-02',
		time: '12:30:05',
		decimal: '12.50',
		tuple: ['a', 2],
		bytes: { __codeProType: 'bytes', base64: 'aGk=' },
		set: [1, 2, 3],
	});
	await assert.rejects(
		() => run('return [{"json": {"bad": object()}}]'),
		(error) => error instanceof python.PythonRunnerError && error.errorType === 'serialization',
	);
});

test('standard library, optional package detection, retry, and bounded HTTP helper work', async () => {
	const server = http.createServer((request, response) => {
		if (request.url === '/redirect') {
			response.writeHead(302, { location: '/json' });
			response.end();
			return;
		}
		if (request.url === '/slow') {
			setTimeout(() => response.end('late'), 250);
			return;
		}
		if (request.url === '/large') {
			response.end('x'.repeat(2048));
			return;
		}
		response.setHeader('content-type', 'application/json');
		response.end(JSON.stringify({ ok: true, agent: request.headers['user-agent'] }));
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	const url = `http://127.0.0.1:${port}`;
	try {
		const execution = await run(`
import csv, datetime, re, math, statistics, decimal, collections, itertools, functools, hashlib, hmac, base64, urllib, html, xml.etree.ElementTree as ET
response = await python_utils.http_get(${JSON.stringify(`${url}/redirect`)}, response_type="json")
attempts = {"count": 0}
async def once():
    attempts["count"] += 1
    if attempts["count"] < 2:
        raise ValueError("again")
    return "done"
retry_value = await python_utils.retry(once, attempts=2, delay=0)
return [{"json": {"status": response.status, "body": response.body.ok, "retry": retry_value, "stdlib": math.ceil(1.1), "optional": python_utils.is_package_available("definitely_missing_code_pro_package")}}]
`);
		assert.deepEqual(execution.result[0].json, { status: 200, body: true, retry: 'done', stdlib: 2, optional: false });
		await assert.rejects(
			() => run(`response = await python_utils.http_get(${JSON.stringify(`${url}/slow`)}, timeout=0.05)\nreturn []`),
			(error) => error instanceof python.PythonRunnerError && error.errorType === 'runtime',
		);
		await assert.rejects(
			() => run(`response = await python_utils.http_get(${JSON.stringify(`${url}/large`)}, max_bytes=128)\nreturn []`),
			(error) => error instanceof python.PythonRunnerError && error.errorType === 'runtime',
		);
		await assert.rejects(
			() => run('response = await python_utils.http_get("not-a-url")\nreturn []'),
			(error) => error instanceof python.PythonRunnerError && error.errorType === 'runtime',
		);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});

test('protocol and log limits reject oversized input, output, and captured print data', async () => {
	await assert.rejects(
		() => run('return []', { items: [{ json: { payload: 'x'.repeat(2048) } }], maxProtocolBytes: 128 }),
		/error.*exceeding the configured limit/i,
	);
	await assert.rejects(
		() => run('return [{"json": {"payload": "x" * 4096}}]', { maxProtocolBytes: 1024 }),
		(error) => error instanceof python.PythonRunnerError && error.errorType === 'serialization',
	);
	const execution = await run('print("x" * 4096)\nreturn []', { maxLogBytes: 128 });
	assert.equal(execution.logs.truncated, true);
	assert.ok(Buffer.byteLength(execution.logs.stdout) <= 128);
});

test('hard timeout cleans up a spawned descendant process tree', async () => {
	const pidFile = path.join(os.tmpdir(), `code-pro-python-child-${process.pid}-${Date.now()}.txt`);
	const childProgram = `import os,time;open(${JSON.stringify(pidFile)},'w').write(str(os.getpid()));time.sleep(60)`;
	try {
		await assert.rejects(
			() => run(`import subprocess, sys\nsubprocess.Popen([sys.executable, "-c", ${JSON.stringify(childProgram)}])\nwhile True:\n    pass`, { timeoutSec: 0.5 }),
			(error) => error instanceof python.PythonRunnerError && error.errorType === 'timeout',
		);
		for (let attempt = 0; attempt < 10 && !fs.existsSync(pidFile); attempt++) await delay(50);
		assert.equal(fs.existsSync(pidFile), true, 'child process wrote its PID before timeout');
		const childPid = Number(fs.readFileSync(pidFile, 'utf8'));
		await delay(250);
		assert.throws(() => process.kill(childPid, 0), /ESRCH|not found|no such process/i);
	} finally {
		fs.rmSync(pidFile, { force: true });
	}
});
