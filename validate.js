const fs = require('fs');
const path = require('path');

console.log('🔍 Validating n8n-nodes-kirimi structure...\n');

// Check required files
const requiredFiles = [
	'package.json',
	'tsconfig.json',
	'credentials/KirimiApi.credentials.ts',
	'nodes/Kirimi/Kirimi.node.ts',
	'nodes/Kirimi/GenericFunctions.ts',
	'nodes/Kirimi/events.ts',
	'nodes/KirimiTrigger/KirimiTrigger.node.ts',
	'icons/kirimi.svg',
	'README.md'
];

let allValid = true;

requiredFiles.forEach(file => {
	const filePath = path.join(__dirname, file);
	if (fs.existsSync(filePath)) {
		console.log(`✅ ${file}`);
	} else {
		console.log(`❌ Missing: ${file}`);
		allValid = false;
	}
});

// Check node source for key features
console.log('\n🧩 Checking node features...');
try {
	const nodeSource = fs.readFileSync(path.join(__dirname, 'nodes/Kirimi/Kirimi.node.ts'), 'utf8');
	const features = [
		["resource 'webhook'", "value: 'webhook'"],
		["operation 'messageStatus'", "value: 'messageStatus'"],
		["operation 'subscribe'", "value: 'subscribe'"],
		["operation 'unsubscribe'", "value: 'unsubscribe'"],
		["operation 'listEvents'", "value: 'listEvents'"],
	];
	features.forEach(([label, needle]) => {
		if (nodeSource.includes(needle)) {
			console.log(`✅ ${label}`);
		} else {
			console.log(`❌ Missing ${label}`);
			allValid = false;
		}
	});
} catch (error) {
	console.log('❌ Error reading Kirimi.node.ts:', error.message);
	allValid = false;
}

// Check package.json structure
console.log('\n📦 Checking package.json...');
try {
	const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	
	if (packageJson.n8n) {
		console.log('✅ n8n configuration found');
		if (packageJson.n8n.credentials && packageJson.n8n.credentials.length > 0) {
			console.log('✅ Credentials defined');
		} else {
			console.log('❌ No credentials defined');
			allValid = false;
		}
		if (packageJson.n8n.nodes && packageJson.n8n.nodes.length > 0) {
			console.log('✅ Nodes defined');
		} else {
			console.log('❌ No nodes defined');
			allValid = false;
		}
	} else {
		console.log('❌ No n8n configuration found');
		allValid = false;
	}
} catch (error) {
	console.log('❌ Error reading package.json:', error.message);
	allValid = false;
}

console.log('\n📋 Summary:');
if (allValid) {
	console.log('🎉 All validations passed! The n8n community node structure is correct.');
	console.log('\n📝 Next steps:');
	console.log('1. Run: npm install');
	console.log('2. Run: npm run build');
	console.log('3. Test the node in your n8n instance');
	console.log('4. Publish to npm: npm publish');
} else {
	console.log('⚠️  Some validations failed. Please fix the issues above.');
}

console.log('\n🔗 Documentation: https://docs.n8n.io/integrations/creating-nodes/');