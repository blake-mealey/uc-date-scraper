# UofC Date Scraper

This is just a simple scraper for [this UofC schedule site](https://www.ucalgary.ca/pubs/calendar/current/academic-schedule.html), which I use to populate calendars with my [UofC Schedule to Google Calendar](http://schedule.blakemealey.ca) app.

## Format

The scraper outputs a .json file with the format:

	[
		{
			"name": "Spring",
			"year": "2016",
			"start": {
				"month": "07",
				"day": "05"
			},
			"end": {
				"month": "08",
				"day": "18"
			},
			"events": [
				{
					"name": "Start of Classes",
					"description": "The first day of classes for the Spring 2016 semester",
					"month": "07",
					"day": "05"
				},
				...
			],
			"holidays": [
				{
					"name": "Victoria Day",
					"description": "Recognized holiday (university closed)",
					"month": "05",
					"day": "23"
				},
				...
			]
		},
		...
	]

## Run

If you have nodejs/npm installed, download the project and cd into it. Then run the following commands:

	npm install
	node --use_strict scraper.js

A `semesters.json` file should be generated in the project directory.