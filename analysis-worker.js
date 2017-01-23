var settings = require(__dirname + '/settings.js');
var pageTest = require(__dirname + '/analysis.js');
var kue = require('kue');
var queue = kue.createQueue();
const throng = require('throng');

throng({
  workers: 2,
  start: startProcessing
});

function startProcessing(id) {
	queue.process('sitespeed-startanalysis', function(job, done) {
		pageTest(job.data.url, job.data.browser, function(data) {
			queue.create('sitespeed-fetchreport', data).removeOnComplete(true).save(err => {
				!err ? resolve() : reject(err);
			});
			done();
		})
	});	

	process.on('SIGTERM', () => {
		console.log('Worker #' + id + ' exiting...');
		process.exit();
	});
}
