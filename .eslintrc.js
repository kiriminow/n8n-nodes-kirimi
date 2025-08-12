module.exports = {
	root: true,

	env: {
		browser: true,
		es6: true,
		node: true,
	},

	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: 'tsconfig.json',
		sourceType: 'module',
	},

	extends: ['plugin:n8n-nodes-base/nodes'],

	rules: {
		'n8n-nodes-base/node-param-default-missing': 'warn',
		'n8n-nodes-base/node-param-display-name-miscased': 'warn',
	},
};