var _ = require('underscore');
var request = require('request');
var sleep = require('sleep');
var settings = require(__dirname + '/../settings.js');
var logger = require(__dirname + '/../logger.js');

// Setup Queue
var kue = require('kue');
var queue = kue.createQueue();
queue.watchStuckJobs(5000);

var start = false;

// Setup worker to process start analysis of pages
queue.process('sitespeed-analyze-' + process.env.key, (job, done) => {
	// Throttle this thread after the first instance
	if (start) {
		sleep.msleep(process.env.pretend == "true" ? 1000 : settings.delay);
	} else {
		start = true;
	}
	
	logger.debug('Making request to ' + job.data.url + ' with ' + JSON.stringify(job.data.browser));

	// Initiate the site analysis
	new Promise((resolve, reject) => { 
		if (process.env.pretend == "true") {
			resolve();
		} else { 
			request.post(
				{
					url: settings.domain + 'analysis/launch',
					headers: { 'accept': 'application/json' },
					timeout: settings.requestTimeout,
					json: {
						token: settings.token,
						url: job.data.url,
						location: job.data.browser.location,
						browser: {
							name: job.data.browser.name
						},
						mobileAnalysis: job.data.browser.isMobile,
						visualMetrics: settings.visualMetrics
					}
				}, (error, response, body) => {
					error ? reject(error) : resolve(_.extend(body, job.data));
				}
			);
		}
	})
	.then((response) => {
		return new Promise((resolve, reject) => { 
			// 200: OK
			// 202: The analysis is currently processing
			// 204: No data available or added (e.g. you request is correct but there is no data corresponding)
			// 206: The request is ok but the result is not complete : the analysis report is not complete (missing some rules or some timings) or all creation / edition have not be done (e.g. for the events)
			// 400: Missing parameters or bad value
			// 401: Authentication required (no token or invalid token)
			// 403: Action forbidden (quotas reached, unauthorized url)
			// 404: Page is unreachable (unknown url / check server response failed)
			// 406: Not a valid json format
			// 408: The analysis has timeout
			// 417: The last analysis of the monitoring results in error
			// 500: Internal server error (unknown error, contact us)
			// 503: The API is temporarily unavailable, try again in a few minutes

			switch(response.status) {
				case 200:
					logger.info('[Analyze] Successful request to ' + response.url + ', Adding #' + response.reportId + ' to reporting queue', response);
					let job = queue.create('sitespeed-report-' + process.env.key, { id: response.reportId })
						.attempts(settings.attempts)
						.save((error) => {
							if (error) {
								logger.error(error);
								reject(error);
							} else {
								resolve();
							}
						});
					job.on('failed', (err) => {
						logger.error('Job exceeded retries limit (' + settings.attempts + ')', response);
					});


					break;

				case 404:
					logger.error('[Analyze] Failed request to ' + response.url + '. Error message: ' + response.message, response);
					job.attempts(1).failed().error(response.message);
					reject(response.message);
					break;

				case 400:
				case 401:
				case 406:
				case 500:
				case 503:
					process.kill(process.pid, process.env.parentPid);
					logger.crit('[Analyze] Critical failure on request to ' + response.url + '. Error message: ' + response.message, response);
					reject(response.message);

				default: 
					logger.warn('[Analyze] Incomplete request to ' + response.url + '. Message: ' + response.message, response);
					reject(response.message);
			}
		});
	})
	
	// Consider the job completed
	.then(() => {
		done();
	})

	// Otherwise send the job for reattempt
	.catch((error) => {
		done(new Error(error));
	})
});
