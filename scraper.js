// get libraries
var request = require('request');
var tabletojson = require('tabletojson');
var cheerio = require('cheerio');
var fs = require('fs');

var url = "https://www.ucalgary.ca/pubs/calendar/current/academic-schedule.html";

function getRelevantColumns(table) {
	var columns = [];
	var header = table[0];
	for(var column in header) {
		if(!header.hasOwnProperty(column)) { continue; }
		var text = header[column];
		if(column != "0" && !text.includes("/")) {
			columns.push(column);
		}
	}
	return columns;
}

var semesters = null;
var currentSection = null;
var data = null;

function handleTable(table) {
	data = {};
	var relevantColumns = getRelevantColumns(table);
	for(var i = 1; i < table.length; i++) {
		handleRow(table[i], relevantColumns);
	}

	for(var column in data) {
		if(!data.hasOwnProperty(column)) { continue; }
		var columnData = data[column];
		var columnName = table[0][column];
		columnData.name = columnName.match(/(Spring|Summer|Fall|Winter)/g)[0];
		columnData.year = columnName.match(/\d+/)[0];
		semesters.push(columnData);
	}
}

function handleRow(row, relevantColumns) {
	if(Object.keys(row).length == 1) {
		currentSection = row["0"];
	} else {
		handleDataRow(row, relevantColumns);
	}
}

function handleDataRow(row, relevantColumns) {
	var name = row["0"];
	for(var i = 0; i < relevantColumns.length; i++) {
		var column = relevantColumns[i];
		if(data[column] === undefined) {
			data[column] = {};
		}
		handleItem(name, row[column], data[column]);
	}
}

// https://stackoverflow.com/questions/13566552/easiest-way-to-convert-month-name-to-month-number-in-js-jan-01
function getMonth(monthStr){
	return new Date(monthStr+'-1-01').getMonth() + 1;
}

// https://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript
function pad(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function getDateData(text) {
	var dateInfo = text.split(/\W+/);
	if(dateInfo.length === 3 && Number(dateInfo[2]) !== null) {
		return {
			"month": pad(getMonth(dateInfo[1]), 2),
			"day": pad(Number(dateInfo[2]), 2)
		};
	}
}

function addDate(dateType, columnData, date) {
	if(columnData[dateType] === undefined) {
		columnData[dateType] = [];
	}
	columnData[dateType].push(date);
}

function addEvent(columnData, event) {
	addDate("events", columnData, event);
}

function addHoliday(columnData, event) {
	addDate("holidays", columnData, event);
}

function handleItem(key, value, columnData) {
	var date = getDateData(value);
	if(date === undefined) { return; }

	var dateInfo = Object.assign({}, date);
	dateInfo.name = key;
	dateInfo.description = currentSection;

	if(currentSection == "Academic Dates") {
		if(key.includes("Classes")) {
			if(key.includes("Start")) {
				columnData.start = date;
			} else if(key.includes("End")) {
				columnData.end = date;
			}
		}
		addEvent(columnData, dateInfo);
	} else if(currentSection == "Registration Dates") {
		addEvent(columnData, dateInfo);
	} else if(currentSection == "Tuition and Refund Dates") {
		addEvent(columnData, dateInfo);
	} else if(currentSection == "Important Dates") {
		/*if(key.includes("No Classes")) {
			dateInfo.name = key.substring(0, key.indexOf(" - No Classes"));
			addHoliday(columnData, date);
		}
		addEvent(columnDate, dateInfo);*/
	} else if(currentSection == "Recognized Holidays (university closed)") {
		addHoliday(columnData, date);
		addEvent(columnData, dateInfo);
	}
}

var logging = false;
function log(text) {
	if(logging) {
		console.log(text);
	}
}

module.exports = function(outputFileName, callback, logEnabled) {
	logging = logEnabled;
	log("Starting scraper. Getting webpage.");

	request({
		uri: url,
		method: "GET"
	}, function(err, res, body) {
		if(err || res.statusCode != 200) {
			console.log("Error occured: " + err);
			return;
		}

		log("Finished getting webpage.");
		log("Parsing HTML for tables.");

		var $ = cheerio.load(body);

		var $tables = $("<div>");
		$(".tftable").each(function() {
			$tables.append($(this));
		});
		var tables = tabletojson.convert($tables.html());

		log("Handling table data.");

		semesters = [];
		for(var i = 0; i < tables.length; i++) {
			handleTable(tables[i]);
		}

		log("Saving data to " + outputFileName + ".");


		if(outputFileName !== undefined && outputFileName !== null) {
			fs.writeFile(outputFileName, JSON.stringify(semesters, null, 2), "utf8");
		}

		log("Done.");

		if(callback !== undefined && callback !== null) {
			callback(semesters);
		}
	});
};
