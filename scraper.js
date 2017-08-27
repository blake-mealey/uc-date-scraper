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
		if(column != "0" && text.indexOf("/") == -1) {
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

const MULTI_DAY_MATCHER = /(\w+)-(\w+), (\w+) ([0-9]{1,2})-([0-9]{1,2})/;
const MULTI_DAY_GROUPS = {
	month: 3,
	dayStart: 4,
	dayEnd: 5
};

const SINGLE_DAY_MATCHER = /(\w+), (\w+) ([0-9]{1,2})/;
const SINGLE_DAY_GROUPS = {
	month: 2,
	day: 3
};

function createDate(month, dayStart, dayEnd) {
	var date = {
		month: pad(month, 2),
		dayStart: pad(dayStart, 2),
		dayEnd: pad(dayEnd, 2),
		days: []
	};
	for (var day = dayStart; day <= dayEnd; day++) {
		date.days.push(pad(day, 2));
	}
	return date;
}

function getDateData(text) {
	var multiDayMatch = text.match(MULTI_DAY_MATCHER);
	if (multiDayMatch) {
		return createDate(getMonth(multiDayMatch[MULTI_DAY_GROUPS.month]),
			Number(multiDayMatch[MULTI_DAY_GROUPS.dayStart]),
			Number(multiDayMatch[MULTI_DAY_GROUPS.dayEnd]));
	} else {
		var singleDayMatch = text.match(SINGLE_DAY_MATCHER);
		if (singleDayMatch) {
			var day = pad(Number(singleDayMatch[SINGLE_DAY_GROUPS.day]), 2);
			return createDate(getMonth(multiDayMatch[SINGLE_DAY_GROUPS.month]), day, day);
		}
	}
}

function addDate(dateType, columnData, date) {
	if(columnData[dateType] === undefined) {
		columnData[dateType] = [];
	}
	columnData[dateType].push(date);
	return columnData[dateType].length - 1;
}

function addEvent(columnData, event) {
	return addDate("events", columnData, event);
}

function addHoliday(columnData, event) {
	return addDate("holidays", columnData, event);
}

function handleItem(key, value, columnData) {
	var date = getDateData(value);
	if(date === undefined) { return; }

	date.name = key;
	date.description = currentSection;

	var index;
	if(currentSection == "Academic Dates") {
		index = addEvent(columnData, date);
		if(key.indexOf("Classes") != -1) {
			if(key.indexOf("Start") != -1) {
				columnData.startClasses = index;
			} else if(key.indexOf("End") != -1) {
				columnData.endClasses = index;
			}
		} else if (key.indexOf("Term") != -1) {
			if (key.indexOf("Start") != -1) {
				columnData.startTerm = index;
			} else if (key.indexOf("End") != -1) {
				columnData.endTerm = index;
			}
		}
	} else if(currentSection == "Registration Dates") {
		addEvent(columnData, date);
	} else if(currentSection == "Tuition and Refund Dates") {
		addEvent(columnData, date);
	} else if(currentSection == "Important Dates") {
		/*if(key.indexOf("No Classes") != -1) {
			date.name = key.substring(0, key.indexOf(" - No Classes"));
			addHoliday(columnData, date);
		}
		addEvent(columnDate, date);*/
	} else if(currentSection == "Recognized Holidays (university closed)") {
		index = addEvent(columnData, date);
		addHoliday(columnData, index);
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
