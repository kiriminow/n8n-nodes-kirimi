const { src, dest } = require('gulp');
const { parallel } = require('gulp');

function copyIcons() {
	return src('icons/**/*').pipe(dest('dist/icons'));
}

function copyNodeIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

exports.copyIcons = copyIcons;
exports.copyNodeIcons = copyNodeIcons;
exports['build:icons'] = parallel(copyIcons, copyNodeIcons);