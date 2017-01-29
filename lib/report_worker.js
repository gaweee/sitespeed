var sleep = require('sleep');
var settings = require(__dirname + '/../settings.js');
var logger = require(__dirname + '/../logger.js');
var report = require(__dirname + '/report.js');

// Setup Queue
var kue = require('kue');
var queue = kue.createQueue();
queue.watchStuckJobs(5000);


// Setup worker to process fetch analysis reports
queue.process('sitespeed-report-' + process.env.key, (job, done) => {
	report(job.data.id, (data) => {
		//progress.tick();

		if (data.status == 403) {
		//	progress.tick(-1);
			done(new Error('Concurrency issue'));
			return;
		}

		// Do something with the data
		// if (progress.complete) {
		// 	console.log('Testing complete, generating report...')
		// 	// Start report generation and finally console.log(
		// 	logger.debug('All reports accounted for.');
		// 	console.log(colors.magenta('Done!'));
		// 	terminate(false);
		// }
		done && done();
	});
});