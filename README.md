## About
Sitespeed is a utility used to analyse the performance of different sites and urls.
It utilizes [DareBoost API](https://www.dareboost.com/en/documentation-api) to retrieve from different locations
* Time to First Byte (TTFB)
* Download Time
* Dom Ready Time 
* Page Load Time
* Full Page size
* Asset Count, Sizes
* CSS/JS Count and Sizes
* External Script speeds (WIP)

![alt tag](https://raw.githubusercontent.com/gaweee/sitespeed/master/thumbnail.png)

## Setup
Install a [Redis Server](https://redis.io/topics/quickstart), used for queues

Run index.js either with a url.txt file or a list of options
	Usage: index.js test <url|url.txt> [options]
	Simple example: index.js test url.txt
	Complex example: index.js test http://sampleurl.com -l "Hong Kong" -b "Chrome" -m false -r 4 -v

	The options defaults to the settings.js file configuration if ommitted.

	Options:
	  --help             Show help                                                             [boolean]
	  --location, -l     Location
	  --browser, -b      Browser
	  --mobile, -m       Mobile
	  --rounds, -n       Number of tests made to each url-browser configuration, defaults to 1
	  --attempts, -a     Number of HTTP attempts before marking as failed, defaults to 20
	  --concurrency, -c  Number of workers, defaults to 2 workers
	  --delay, -d        Delay between requests (throttling), defaults to 60000ms
	  --timeout, -t      HTTP request timeout, defaults to 60000ms
	  -p                 Pretend, only simluates the test
	  -v                 Verbose
		Usage: node index.js test <url|url.txt> [options]
		Usage: node index.js resume <key> [options]


## How it works
index.js starts by generating a unique key (used to resume testing or report generation).  
The key is the identifier for all the queues, tasks and reports to come.  
index.js also studiest the testc onfiguration and loads the urls into a redis server queue  
Worker threads are then started that send the urls (based on a constrained concurrency) to the Dareboost API for analysis.  
Successful analyses are added back into another queue for another round of processing  
A separate set of worker threads will then fetch the reports from [DareBoost API](https://www.dareboost.com/en/documentation-api) and aggregate the information  
All JSON data and the HAR files are downloaded in the reporting folder  
A progress bar tracks the jobs progress, failed and completed tasks.  
Once completed, the information both raw and summarized are put into a CSV file for easier processing  


## Todo
* Refactor worker threads to use sockets for stats and critical errors
* Remove progress bar once completed
* Command 'retry' to retry errors (only those that have failed max attempts, not those with Critical errors)