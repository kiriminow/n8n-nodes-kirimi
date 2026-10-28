// Structure checks run in CI after `npm run build`. Exits non-zero on any failure.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const failures = [];
const ok = (message) => console.log(`ok    ${message}`);
const fail = (message) => {
	failures.push(message);
	console.log(`FAIL  ${message}`);
};
const check = (condition, message) => (condition ? ok(message) : fail(message));
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

console.log('Validating n8n-nodes-kirimi...\n');

// ── Source layout ───────────────────────────────────────────────────────────
console.log('Required files');
[
	'package.json',
	'package-lock.json',
	'tsconfig.json',
	'eslint.config.mjs',
	'.prettierrc.js',
	'LICENSE.md',
	'README.md',
	'CHANGELOG.md',
	'.github/workflows/publish.yml',
	'credentials/KirimiApi.credentials.ts',
	'icons/kirimi.svg',
	'icons/kirimi.dark.svg',
	'nodes/Kirimi/Kirimi.node.ts',
	'nodes/Kirimi/GenericFunctions.ts',
	'nodes/Kirimi/events.ts',
	'nodes/KirimiTrigger/KirimiTrigger.node.ts',
	'nodes/KirimiTrigger/verify.ts',
	'nodes/KirimiPollTrigger/KirimiPollTrigger.node.ts',
].forEach((file) => check(exists(file), file));

// ── package.json ────────────────────────────────────────────────────────────
console.log('\npackage.json');
const pkg = JSON.parse(read('package.json'));
check(pkg.name === 'n8n-nodes-kirimi', 'name is n8n-nodes-kirimi');
check(pkg.license === 'MIT', 'license is MIT');
check(
	(pkg.keywords || []).includes('n8n-community-node-package'),
	'keyword n8n-community-node-package',
);
check(
	pkg.repository && pkg.repository.url === 'https://github.com/kiriminow/n8n-nodes-kirimi.git',
	'repository url',
);
check(pkg.author && pkg.author.name && pkg.author.email, 'author name and email');
check(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'zero runtime dependencies');
check(
	pkg.peerDependencies && pkg.peerDependencies['n8n-workflow'],
	'n8n-workflow is a peer dependency',
);
check(
	pkg.devDependencies && pkg.devDependencies['@n8n/node-cli'],
	'@n8n/node-cli is a devDependency',
);
['build', 'dev', 'lint', 'lint:fix', 'release', 'test'].forEach((script) =>
	check(pkg.scripts && pkg.scripts[script], `script "${script}"`),
);
check(pkg.scripts && pkg.scripts.build === 'n8n-node build', 'build uses n8n-node build');
check(pkg.n8n && pkg.n8n.n8nNodesApiVersion === 1, 'n8n.n8nNodesApiVersion is 1');
check(pkg.n8n && pkg.n8n.strict === true, 'n8n.strict is true');

// ── n8n entries point at built files that have a source ─────────────────────
console.log('\nCredentials and nodes');
const entries = [...((pkg.n8n && pkg.n8n.credentials) || []), ...((pkg.n8n && pkg.n8n.nodes) || [])];
check(
	(pkg.n8n.credentials || []).length > 0 && (pkg.n8n.nodes || []).length > 0,
	'credentials and nodes are declared',
);
entries.forEach((entry) => {
	const source = entry.replace(/^dist\//, '').replace(/\.js$/, '.ts');
	check(exists(source), `source for ${entry}`);
	check(exists(entry), `built file ${entry} (run npm run build first)`);
});

// ── Node features that other tooling and docs rely on ───────────────────────
console.log('\nNode features');
if (exists('nodes/Kirimi/Kirimi.node.ts')) {
	const source = read('nodes/Kirimi/Kirimi.node.ts');
	[
		["resource 'webhook'", "value: 'webhook'"],
		["operation 'messageStatus'", "value: 'messageStatus'"],
		["operation 'subscribe'", "value: 'subscribe'"],
		["operation 'unsubscribe'", "value: 'unsubscribe'"],
		["operation 'listEvents'", "value: 'listEvents'"],
		['usableAsTool', 'usableAsTool: true'],
		['node versions [1, 2]', 'version: [1, LOCATOR_VERSION]'],
		['auto client message id', "name: 'autoClientMsgId'"],
	].forEach(([label, needle]) => check(source.includes(needle), label));
}
if (exists('nodes/KirimiPollTrigger/KirimiPollTrigger.node.ts')) {
	const source = read('nodes/KirimiPollTrigger/KirimiPollTrigger.node.ts');
	check(source.includes('polling: true'), 'polling trigger declares polling: true');
}

// ── Icons referenced by nodes exist next to them ────────────────────────────
console.log('\nIcons');
['nodes/Kirimi', 'nodes/KirimiTrigger', 'nodes/KirimiPollTrigger'].forEach((dir) => {
	check(exists(`${dir}/kirimi.svg`), `${dir}/kirimi.svg`);
	check(exists(`${dir}/kirimi.dark.svg`), `${dir}/kirimi.dark.svg`);
});

// ── Docs are English and versioned ──────────────────────────────────────────
console.log('\nDocs');
if (exists('CHANGELOG.md')) {
	check(read('CHANGELOG.md').includes(`## ${pkg.version}`), `CHANGELOG has an entry for ${pkg.version}`);
}

console.log('\nSummary');
if (failures.length === 0) {
	console.log('All validations passed.');
} else {
	console.log(`${failures.length} validation(s) failed:`);
	failures.forEach((message) => console.log(`  - ${message}`));
	process.exit(1);
}
