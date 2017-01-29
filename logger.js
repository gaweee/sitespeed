var winston = require('winston');
var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.File)({
			name: 'request',
			filename: 'logs/request.log',
			level: 'info'
		}),
		new (winston.transports.File)({
			name: 'error',
			filename: 'logs/error.log',
			level: 'error'
		})
	]
});

logger.winston = winston;
module.exports = logger;