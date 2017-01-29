var sleep = require('sleep');
var settings = require(__dirname + '/../settings.js');
var logger = require(__dirname + '/../logger.js');
var analyze = require(__dirname + '/analyze.js');

// Setup Queue
var kue = require('kue');
var queue = kue.createQueue();
queue.watchStuckJobs(5000);

// Setup worker to process start analysis of pages
queue.process('sitespeed-analyze-' + process.env.key, (job, done) => {
	analyze(job.data.url, job.data.browser, (data) => {
		var response;
		if (data.status == 200) {
			logger.debug('Request successful, adding request #' + data.reportId + ' to reporting queue');
			var job = queue.create('sitespeed-report-' + process.env.key, { id: data.reportId })
				.attempts(settings.attempts)
				.save(error => {
					if (error) {
						logger.error(error);
						var response = error
					}
				});
			job.on('failed', function(errorMessage){
				logger.error('Job exceeded retries limit (' + settings.attempts + ')', job.data);
			})
		} else if (data.status == 403) {
			response = new Error('Concurrency issue');
		}

		sleep.msleep(settings.delay)
		done(response)
	})
});