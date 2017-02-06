var validator = require('validator');
var validUrl = require('valid-url');
var sleep = require('sleep');
var fs = require('fs');
var colors = require('colors');
var tmp = require('tmp');
var argv = require("yargs");

var ProgressBar = require('progress');
var settings = require(__dirname + '/settings.js');
var logger = require(__dirname + '/logger.js');
var cfork = require('cfork');

var key = tmp.tmpNameSync({ template: 'XXXXXXXX' });
var queuePromises = [];

/*------------------- Setup Queue -------------------*/
var kue = require('kue');
var queue = kue.createQueue();
var progress;
//kue.app.listen(3000);
queue.watchStuckJobs(8000);

// Start cleanup
cfork({ exec: __dirname + '/workers/cleanup.js', count: 1 });

/*------------------- CLI Definitions -------------------*/
// @Todo: Generate Command
argv.command('test', 'Test a url or a set of urls',
		(yargs) => {
			yargs.usage(`usage: $0 test <url|url.txt> [options]
Simple example: $0 test url.txt
Complex example: $0 test http://sampleurl.com -l "Hong Kong" -b "Chrome" -m false -r 4 -v

The options defaults to the settings.js file configuration if ommitted.`)
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
					description: 'Number of tests made to each url-browser configuration, defaults to ' + settings.rounds,
				},
				attempts: {
					alias: 'a',
					description: 'Number of HTTP attempts before marking as failed, defaults to ' + settings. attempts
				},
				concurrency: {
					alias: 'c',
					description: 'Number of workers, defaults to ' + settings.concurrency + ' workers'
				},
				delay: {
					alias: 'd',
					description: 'Delay between requests (throttling), defaults to ' + settings.delay + 'ms'
				},
				timeout: {
					alias: 't',
					description: 'HTTP request timeout, defaults to ' + settings.timeout + 'ms'
				}
			})
			.describe('p', 'Pretend, only simluates the test')
			.describe('v', 'Verbose')
			.help('help');
		},
		(argv) => {
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

			logger.debug(argv);

			var urls = [argv._[1]];
			if (!validUrl.isUri(argv._[1])) {
				var fs = require('fs');
				if (fs.existsSync(argv._[1])) {
		    		urls = fs.readFileSync(argv._[1]).toString().split('\n');
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
								.save((error) => {
									if (error) {
										logger.error(error);
										reject(error);
									} else {
										resolve();
									}
								});

							job.on('failed', (errorMessage) => {
								logger.error('Job exceeded retries limit (' + settings.attempts + ')', job.data);
							});
						}));
					}
				}
			}

			startWorkers();
		}
	)
	.command('resume', 'Resumes a started test',
		(yargs) => {
			yargs.usage('usage: $0 resume <key>')
			.demand(1)
			.describe('v', 'Verbose')
			.help('help');
		},
		(argv) => {
			key = argv._[1];
			console.log("Attempting to resume test " + colors.magenta(key));

			startWorkers();
		}
	)
	.command('generate', 'Generates a report',
		(yargs) => {
			yargs.usage('usage: $0 generate <key>')
			.demand(1)
			.describe('v', 'Verbose')
			.help('help');
		},
		(argv) => {
			key = argv._[1];
			generateCSV(key)
			.catch((error) => {
				logger.error(error);
			})
			.then(() => {
				terminate();
			});
		}
	)
	.wrap(100)
	.help('help')
	.argv;


// Counts all the various states in the global queue
function queueStat() {
	var counts = { };
	var countPromises = [];

	for (let report of ['analyze', 'report']) {
		var queueName = 'sitespeed-' + report + '-' + key;
		counts[report] = {};
		countPromises.push(new Promise((resolve, reject) => { queue.inactiveCount(queueName,(err, total) => { counts[report].inactive = total;	resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.activeCount(queueName, 	(err, total) => { counts[report].active = total; 	resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.completeCount(queueName,(err, total) => { counts[report].completed = total;	resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.failedCount(queueName, 	(err, total) => { counts[report].failed = total;	resolve(total); }); }));
		countPromises.push(new Promise((resolve, reject) => { queue.delayedCount(queueName,	(err, total) => { counts[report].delayed = total;	resolve(total); }); }));
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
		queue.shutdown((settings.delay + settings.timeout), (error) => {
			terminate(false);
	 	});
	} else {
		logger.debug('Immediate Shutdown, process terminating.');
		process.exit(0);
	}
}

// Runs the consumer worker tasks
function startWorkers() {
	var timerProgress, timerShutdown;
	Promise.all(queuePromises)
		.then(queueStat)
		.then((counts)=> {
			if (counts.remaining === 0) {
				console.log(colors.red('Nothing to do'));
				terminate(false);
			}

			progress = new ProgressBar('╢:bar╟ :current/:total :percent :elapsed \t[Completed :completed |Failed: :failed]', {
				incomplete: '░',
				complete: '█',
				width: 80,
				total: counts.total,
				completed: counts.completed,
				failed: counts.failed
			});	

			timerProgress = setInterval(() => {
				queueStat().then((counts) => {
					logger.debug(JSON.stringify(counts));

					progress.total = counts.total;
					progress.update((counts.completed + counts.failed)/counts.total, {
						completed: counts.completed,
						failed: counts.failed
					});

					if (progress.completed && !timerShutdown) {
						timerShutdown = setTimeout(() => {
							generateCSV(key);
							terminate();
						}, 10000)
					} else if (!progress.completed && timerShutdown)
						clearTimeout(timerShutdown);

				}).catch((error) => {
					logger.error(error);
				});
			}, 500);
		})
		.then(() => {
			cfork({
				exec: __dirname + '/workers/analyze_worker.js',
				args: ['analysis'],
				count: settings.concurrency,
				env: { key: key, pretend: argv.p, verbose: argv.v, parentPid: process.pid }
			});
			
			cfork({
				exec: __dirname + '/workers/report_worker.js',
				args: ['reporting'],
				count: settings.concurrency,
				env: { key: key, pretend: argv.p, verbose: argv.v, parentPid: process.pid }
			}).on('fork', (worker) => {
				logger.debug('Setting up worker #' + worker.process.pid + ' for ' + worker.process.spawnargs[2]);
			});
		})	
		.catch((error) => {
			logger.error(error);
			terminate();
		});

	process.on('SIGTERM', () => {
		terminate();
	});
}


// Generates the CSV based on the report key
function generateCSV(key) {
	return new Promise((resolve, reject) => {
		var dir = __dirname + '/data/' + key;
		var files = fs.readdirSync(dir);
		var re = new RegExp(".json$");
		
		var jsonfile = require('jsonfile')
		var xl = require('excel4node');
		var xlswkbk = new xl.Workbook();
	  	var xlssheet = xlswkbk.addWorksheet('Report ' + key);
	  	var headerStyle = xlswkbk.createStyle({
    		font: { color: '#FFFFFF' },
    		fill: { type: 'pattern', patternType:'solid', fgColor: '#2495CF' }
    	});

		xlssheet.cell(1, 1).string('ID').style(headerStyle);
		xlssheet.cell(1, 2).string('Url').style(headerStyle);
		xlssheet.cell(1, 3).string('Location').style(headerStyle);
		xlssheet.cell(1, 4).string('Browser').style(headerStyle);
		xlssheet.cell(1, 5).string('Mobile').style(headerStyle);

		xlssheet.cell(1, 6).style(headerStyle);
		xlssheet.column(6).setWidth(5);
		
		xlssheet.cell(1, 7).string('Full Load').style(headerStyle);
		xlssheet.cell(1, 8).string('Request Count').style(headerStyle);
		xlssheet.cell(1, 9).string('Weight').style(headerStyle);
		
		xlssheet.cell(1, 10).style(headerStyle);
		xlssheet.column(10).setWidth(5);
		
		xlssheet.cell(1, 11).string('TTFB').style(headerStyle);
		xlssheet.cell(1, 12).string('DOM loaded').style(headerStyle);
		xlssheet.cell(1, 13).string('Page Load').style(headerStyle);

		xlssheet.cell(1, 14).style(headerStyle);
		xlssheet.column(14).setWidth(5);
		
		xlssheet.cell(1, 15).string('HTML Weight').style(headerStyle);
		xlssheet.cell(1, 16).string('HTML Count').style(headerStyle);
		xlssheet.cell(1, 17).string('Images Weight').style(headerStyle);
		xlssheet.cell(1, 18).string('Images Count').style(headerStyle);
		xlssheet.cell(1, 19).string('JS Weight').style(headerStyle);
		xlssheet.cell(1, 20).string('JS Count').style(headerStyle);
		xlssheet.cell(1, 21).string('CSS Weight').style(headerStyle);
		xlssheet.cell(1, 22).string('CSS Count').style(headerStyle);
		xlssheet.cell(1, 23).string('Others Weight').style(headerStyle);
		xlssheet.cell(1, 24).string('Others Count').style(headerStyle);

		var row = 1;
		for (let file of files) {
			if (re.test(file)) {
				row++;
				var report = jsonfile.readFileSync(dir + '/' + file);
				xlssheet.cell(row, 1).string(report.id);
				xlssheet.cell(row, 2).string(report.report.url);
				xlssheet.cell(row, 3).string(report.report.config.location);
				xlssheet.cell(row, 4).string(report.report.config.browser.name);
				xlssheet.cell(row, 5).string("" + report.report.config.isMobile);

				xlssheet.cell(row, 7).number(report.report.summary.loadTime);
				xlssheet.cell(row, 8).number(report.report.summary.requestsCount);
				xlssheet.cell(row, 9).number(report.report.summary.weight);

				xlssheet.cell(row, 11).number(report.report.timings.firstByte);
				xlssheet.cell(row, 12).number(report.report.timings.domInteractive);
				xlssheet.cell(row, 13).number(report.report.timings.loadEvent);

				for (let resource of report.report.resourceByType) {
					var pos;
					switch(resource.type) {
						case 'html':
							pos = 15;
							break;

						case 'image':
							pos = 17;
							break;

						case 'javascript':
							pos = 19;
							break;

						case 'css':
							pos = 21;
							break;

						case 'other':
							pos = 23;
							break;
					}
					xlssheet.cell(row, pos).number(resource.bodyWeight + resource.headerWeight);
					xlssheet.cell(row, pos+1).number(resource.requestCount);
				}
			}
		}

		xlssheet.row(1).filter({
		    firstRow: 1,
		    firstColumn: 1,
		    lastRow: row,
		    lastColumn: 24
		});

		var filename = 'Report-' + key + '.xlsx';
		xlswkbk.write(filename, function (err, stats) {
		    if (err)
		        reject();
		    console.log('Generated Report file ' + colors.magenta(filename));
		    resolve();
		});
	});
}