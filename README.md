# UofC Date Scraper

This is just a simple scraper for [this UofC schedule site](https://www.ucalgary.ca/pubs/calendar/current/academic-schedule.html), which I use to populate calendars with my [UofC Schedule to Google Calendar](http://schedule.chimerical.ca) app.

## Format

This scraper can be simply run to produce a .json file with the format:

	[
		{
			"name": "Spring",
			"year": "2016",
			"start": 0,
			"end": 1,
			"events": [
				{
					"name": "Start of Classes",
					"description": "Academic Dates",
					"month": "07",
					"day": "05"
				},
				{
					"name": "End of Classes",
					"description": "Academic Dates",
					"month": "12",
					"day": "08"
				}
				{
					"name": "Victoria Day",
					"description": "Recognized Holidays (university closed)",
					"month": "05",
					"day": "23"
				},
				...
			],
			"holidays": [
				2, ...
			]
		},
		...
	]

## Usage

Or, you can install and require this package with npm.

	npm install --save uc-date-scraper

Then in your code:

	var scraper = require('uc-date-scraper');
	scraper(null, function(semesters) {
		// do stuff with semesters
	});

## Run

If you have nodejs/npm installed, download the project and cd into it. Then run the following commands:

	npm install
	npm start

A `semesters.json` file should be generated in the project directory.
