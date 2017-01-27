var validator = require('validator');
var validUrl = require('valid-url');
var colors = require('colors');
var settings = require(__dirname + '/settings.js');
var analyze = require(__dirname + '/analyze.js');
var report = require(__dirname + '/report.js');
var logger = require(__dirname + '/logger.js');

// Setup Queue
var counts = { analyze: 0, report: 0, analyzeCompleted: 0, reportCompleted: 0 };
var kue = require('kue');
var queue = kue.createQueue();
queue.watchStuckJobs(5000);


/*------------------- CLI Definitions -------------------*/
var argv = require("yargs")
	.usage(`Usage: $0 <url|url.txt> [options]

If the options are not provided the test browsers from settings.js file are used instead`)
	//.demand(1) // Consider adding a flag to resume
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

var promisesQueue = [];
// Loading of new URLS
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
    		urls = fs.readFileSync(argv._[0]).toString().split('\n');
		} else {
			console.log('Error: Neither a file nor a valid url provided');
			terminate();
		}
	}

	counts.analyze = urls.length * settings.browsers.length * settings.rounds;
	counts.report = counts.analyze;

	console.log('Loading the following test configurations');
	for (let browser of settings.browsers)
		console.log('\t-' + browser.name + ' from ' + browser.location);
	console.log('Testing %s URLs x %s location-browser combinations x %s rounds = %s tests', colors.magenta(urls.length), colors.magenta(settings.browsers.length), colors.magenta(settings.rounds), colors.magenta(counts.analyze));

	// Setup queue from new URLs provided
	for (let i=0; i<settings.rounds; i++) {
		for (let url of urls) {
			for (let browser of settings.browsers) {
				promisesQueue.push(new Promise((resolve, reject) => {
					queue.create('sitespeed-analyze', {
						url: url.trim(),
						browser: browser
					}).removeOnComplete(true).save(err => {
						if (err) {
							logger.error(err);
							reject(err);
						} else {
							resolve();
						}
					});
				}));
			}
		}
	}
}

if (!argv.v)
	logger.remove('debug');


var ProgressBar = require('ascii-progress');
var analyzeBar = new ProgressBar({
	schema: 'Launch Analysis ╢:bar╟ :current/:total :percent',
	blank: '░',
	filled: '█'
});
var reportBar = new ProgressBar({
	schema: 'Fetch Report   ╢:bar╟ :current/:total :percent',
	blank: '░',
	filled: '█'
});
var timer = new ProgressBar({
	schema: 'Time elapsed: :elapseds'
});


Promise.all(promisesQueue)
.then(() => {
	return new Promise((resolve, reject) => {
		queue.inactiveCount('sitespeed-analyze', (err, total) => {
			logger.warn('Analyze queue size is ' + total);
			counts.analyze = total;
			resolve();
		});
	})
})
.then(() => {
	return new Promise((resolve, reject) => {
		queue.inactiveCount('sitespeed-report', (err, total) => {
			logger.warn('Report queue size is ' + total);
			counts.report = total + counts.analyze;
			if (counts.report > 0) {
				resolve();
			} else {
				console.log(colors.red('Nothing more to do'));
				reject('Error: Resumed called with nothing to do.')
			}
		});
	});
})
.then(() => {
	if (argv.r) {
		console.log('Resuming testing...');
		console.log('\t %s URLs more to analyze', counts.analyze);
		console.log('\t %s URLs more to report', counts.report);
	} else {
		console.log('Test starting...');
	}

	analyzeBar.compile();
	reportBar.compile();
	timer.tick();
	setInterval(() => {
		timer.compile();	
	},100);

	analyzeBar.total = counts.analyze;
	analyzeBar.update(0, { total: counts.analyze });

	reportBar.total = counts.report;
	reportBar.update(0, { total: counts.report });

	// Setup worker to process start analysis of pages
	logger.debug('Setting up worker to send analysis requests');
	queue.process('sitespeed-analyze', settings.concurrency, (job, done) => {
		analyze(job.data.url, job.data.browser, (data) => {
			counts.analyzeCompleted++;
			analyzeBar.tick();
			if (data.status == 200) {
				logger.debug('Request successful, adding request #' + data.reportId + ' to reporting queue');
				queue.create('sitespeed-report', { id: data.reportId }).removeOnComplete(true).save(err => {
					if (err) logger.error(err);
				});
			} else {
				reportBar.tick();
			}
			done && done();
		})
	});

	// Setup worker to process fetch analysis reports
	logger.debug('Setting up worker to fetch analysis reports');
	queue.process('sitespeed-report', settings.concurrency, (job, done) => {
		report(job)
		reportBar.tick();
		if (reportBar.completed) {
			queue.shutdown(2000, err => {
				console.log('Testing complete, generating report...')
				// Start report generation and finally console.log(
				logger.debug('All reports accounted for.');
				console.log(colors.magenta('Done!'));
				terminate();
		 	})
		}
		done && done();
	});
	
})
.catch(err => {
	logger.error(err);
	terminate();
});


process.on('SIGTERM', () => {
	console.log('Forced process shutdown...', err || '');
 	terminate();
});


function terminate(time=500) {
	queue.shutdown(time || 4000, err => {
		logger.debug('Process terminating.');
		process.exit(0);
 	})
}