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
		},
		rounds: {
			alias: 'n',
			description: 'Number of tests',
		}
	})
	.help('help')
	.argv;

if (argv._.length >= 1) {
	var config = [{ location: 'Hong Kong', name: 'Chrome', isMobile: false }];

	if (argv.location)
		config[0].location = argv.location;

	if (argv.browser)
		config[0].name = argv.browser;

	if (argv.mobile)
		config[0].isMobile = validator.toBoolean(argv.mobile.toString());

	if (argv.rounds)
		settings.rounds = argv.rounds;

	if (argv.location || argv.browser || argv.mobile) 
		settings.browsers = config;

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



var kue = require('kue');
var queue = kue.createQueue();
queue.watchStuckJobs(5000)

var promises = [];
for (let i=0; i<settings.rounds; i++) {
	for (let url of urls) {
		for (let browser of settings.browsers) {
			promises.push(new Promise((resolve, reject) => {
				job = queue.create('sitespeed-startanalysis', {
					url: url,
					browser: browser
				}).removeOnComplete(true).save(err => {
					!err ? resolve() : reject(err);
				});
			}));
		}
	}
}

Promise.all(promises).then(values => {
	process.exit(0);
})




// queue.on('job enqueue', function(id, type) {
// 	kue.Job.get( id, function( err, job ) {
// 		console.log('Queued task #' + id + ' for ' + job.data.url + ' with ' + JSON.stringify(job.data.browser));
// 	});
// }).on('job complete', function(id, result) {
// 	queue.inactiveCount(function( err, total) {
// 		console.log('Task #' + id + ' completed, ' + total + ' task remaining'); // others are activeCount, completeCount, failedCount, delayedCount
// 		if (total == 0)
// 			process.exit(0);
// 	});
// });

//  process.on('SIGTERM', () => {
//  	queue.shutdown(5000, err => {
//  		console.log('Queue shutdown', err || '');
// 		process.exit(0);
//  	})
// });