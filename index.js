var validator = require('validator');
var _ = require('underscore');
var validUrl = require('valid-url');
var settings = require(__dirname + '/settings.js');

/*------------------- CLI Definitions -------------------*/
var argv = require("yargs")
	.usage(`Usage: $0 <url|url.txt> [options]

If the options are not provided the test browsers from settings.js file are used instead`)
	.demand(1)
	.options({
		location: {
			alias: 'l',
			description: 'Location',
		},
		browser: {
			alias: 'b',
			description: 'Browser',
		},
		mobile: {
			alias: 'm',
			description: 'Mobile',
		}
	})
	.help('help')
	.argv;

if (argv._.length >= 1) {
	var useFile = false;
	var config = { location: 'Hong Kong', name: 'Chrome', isMobile: false };

	if (argv.location)
		config.location = argv.location;

	if (argv.browser)
		config.name = argv.browser

	if (argv.mobile)
		config.isMobile = argv.mobile

	if (argv.location || argv.browser || argv.mobile)
		useFile = true;

	var urls = [argv._[0]];
	if (!validUrl.isUri(argv._[0])) {
		var fs = require('fs');
		if (fs.existsSync(argv._[0])) {
    		urls = _.map(fs.readFileSync(argv._[0]).toString().split('\n'), function(url) { return url.trim(); });
		} else {
			console.log('Error: Neither a file nor a valid url provided');
			process.exit()
		}
	}

	console.log('Starting test on ' + urls.length + ' urls');
}