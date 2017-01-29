var validator = require('validator');
var validUrl = require('valid-url');
var sleep = require('sleep');
var colors = require('colors');
var tmp = require('tmp');
var key = tmp.tmpNameSync({ template: 'XXXXXXXX' });

var ProgressBar = require('progress');
var settings = require(__dirname + '/settings.js');
var logger = require(__dirname + '/logger.js');
var cfork = require('cfork');

/*------------------- Setup Queue -------------------*/
var kue = require('kue');
var queue = kue.createQueue();
var progress;
// queue.watchStuckJobs(8000);

// Start cleanup
cfork({ exec: __dirname + '/lib/cleanup.js', count: 1 });

/*------------------- CLI Definitions -------------------*/
// @Todo setup commands test with url or path, resume with key, dry-run
var argv = require("yargs")
	.usage(`Usage: $0 <url|url.txt> [options]

If the options are not provided the test browsers from settings.js file are used instead`)
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


var queuePromises = [];
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
			terminate(false);
		}
	}

	console.log("This is your key: " + colors.magenta(key) + ". Keep it, it's used for resuming the test");
	console.log('Loading the following test configurations');
	for (let browser of settings.browsers)
		console.log('\t- ' + browser.name + ' from ' + browser.location);
	console.log('%s URLs x %s location-browser combinations x %s rounds = %s tests', colors.magenta(urls.length), colors.magenta(settings.browsers.length), colors.magenta(settings.rounds), colors.magenta(urls.length * settings.browsers.length * settings.rounds));

	// Setup queue from new URLs provided
	for (let i=0; i<settings.rounds; i++) {
		for (let url of urls) {
			for (let browser of settings.browsers) {
				queuePromises.push(new Promise((resolve, reject) => {
					var job = queue.create('sitespeed-analyze-' + key, { url: url.trim(), browser: browser })
						.attempts(settings.attempts)
						.save(error => {
							if (error) {
								logger.error(error);
								reject(error);
							} else {
								resolve();
							}
						});

					job.on('failed', function(errorMessage){
						logger.error('Job exceeded retries limit (' + settings.attempts + ')', job.data);
					})
				}));
			}
		}
	}
}

if (argv.v)
	logger.add(logger.winston.transports.Console, {
		name: 'debug',
		level: 'debug'
	});

var status = argv.r ? 'Resuming' : 'Testing';
Promise.all(queuePromises).then(queueStat)
	.then((counts)=> {
		if (counts.remaining === 0) {
			console.log(colors.red('Nothing to do'));
			terminate(false);
		}

		progress = new ProgressBar(':status ╢:bar╟ :current/:total :percent :elapsed\t[Completed :completed | Failed: :failed]', {
			incomplete: '░',
			complete: '█',
			width: 80,
			status: status,
			total: counts.remaining,
			completed: counts.completed,
			failed: counts.failed
		});	

		setInterval(() => {
			queueStat().then((counts) => {
				console.log(counts);

				progress.total = counts.total;
				progress.update(counts.completed + counts.failed, {
					status: status,
					completed: counts.completed,
					failed: counts.failed
				});
			}).catch(error => {
				logger.error(error);
			});
		}, 500);
	})
	.then(() => {
		/*
		cfork({
			exec: __dirname + '/lib/analyze_worker.js',
			count: settings.concurrency,
			env: { key: key	}
		}).on('fork', function (worker) {
			logger.debug('Setting up worker #' + worker.process.pid + ' for analysis tasks');
		});


		cfork({
			exec: __dirname + '/lib/report_worker.js',
			count: settings.concurrency,
			env: { key: key	}
		}).on('fork', function (worker) {
			logger.debug('Setting up worker #' + worker.process.pid + ' for reporting tasks');
		});
		*/
	})
	.catch(error => {
		logger.error(error);
		terminate();
	});

process.on('SIGTERM', () => {
	terminate();
});


// Counts all the various states in the global queue
function queueStat() {
	var counts = { };
	var countPromises = []

	// Get Analysis Tasks
	for (let report of ['analyze', 'report']) {
		var queueName = 'sitespeed-' + report + '-' + key;
		counts[report] = {};
		countPromises.push(new Promise((resolve, reject) => { queue.inactiveCount(queueName, function( err, total ) { counts[report].inactive = total;	resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.activeCount(queueName, function( err, total ) 	{ counts[report].active = total; 		resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.completeCount(queueName, function( err, total ) { counts[report].completed = total;	resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.failedCount(queueName, function( err, total ) 	{ counts[report].failed = total;		resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.delayedCount(queueName, function( err, total ) 	{ counts[report].delayed = total;		resolve(total); }); }));
	}

	return Promise.all(countPromises).then(() => {
		for (let report of ['analyze', 'report']) {
			let subcount = counts[report];
			subcount.remaining = subcount.active + subcount.inactive + subcount.delayed;
			subcount.total = subcount.completed + subcount.active + subcount.inactive + subcount.failed + subcount.delayed;

			for (let type of ['inactive', 'active', 'completed', 'failed', 'delayed', 'remaining', 'total']) 
				counts[type] = (counts[type] || 0) + subcount[type];
		}

		return counts;
	});
}


// Graceful shutdown
function terminate(wait=true) {
	if (wait) {
		logger.debug('Shutdown max time calculated at ' + (settings.delay + settings.timeout)/1000 + 's');
		queue.shutdown((settings.delay + settings.timeout), error => {
			terminate(false);
	 	})
	} else {
		logger.debug('Immediate Shutdown, process terminating.');
		process.exit(0);
	}
}