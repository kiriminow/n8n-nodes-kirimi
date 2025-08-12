const { src, dest } = require('gulp');

function copyIcons() {
	return src('icons/**/*').pipe(dest('dist/icons'));
}

exports.copyIcons = copyIcons;
exports['build:icons'] = copyIcons;