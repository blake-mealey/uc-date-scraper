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

function handleTable(table, paragraphs) {
	data = {};
	var relevantColumns = getRelevantColumns(table);
	for(var i = 1; i < table.length; i++) {
		handleRow(table[i], relevantColumns, paragraphs);
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

function handleRow(row, relevantColumns, paragraphs) {
	if(Object.keys(row).length == 1) {
		currentSection = row["0"];
	} else {
		handleDataRow(row, relevantColumns, paragraphs);
	}
}

function handleDataRow(row, relevantColumns, paragraphs) {
	var name = row["0"];
	for(var i = 0; i < relevantColumns.length; i++) {
		var column = relevantColumns[i];
		if(data[column] === undefined) {
			data[column] = {};
		}
		handleItem(name, row[column], data[column], paragraphs);
	}
}

// https://stackoverflow.com/questions/13566552/easiest-way-to-convert-month-name-to-month-number-in-js-jan-01
function getMonth(monthStr){
	return new Date(monthStr+'-1-01').getMonth() + 1;
}

function pad2(num) {
	var str = ("0" + num);
	return str.substr(str.length - 2, 2);
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
	var arbitraryYear = 2017;
	var endDate = new Date(arbitraryYear, month - 1, dayEnd);
	endDate.setDate(endDate.getDate() + 1);
	var date = {
		monthStart: pad2(month),
		monthEnd: pad2(endDate.getMonth() + 1),
		yearEndOffset: endDate.getFullYear() - arbitraryYear,
		dayStart: pad2(dayStart),
		dayEnd: pad2(endDate.getDate()),
		days: []
	};
	for (var day = dayStart; day <= dayEnd; day++) {
		date.days.push(pad2(day));
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
			var day = pad2(Number(singleDayMatch[SINGLE_DAY_GROUPS.day]));
			return createDate(getMonth(singleDayMatch[SINGLE_DAY_GROUPS.month]), day, day);
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

function handleItem(key, value, columnData, paragraphs) {
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
		if (key.indexOf("Break") != -1) {
			addHoliday(columnData, index);
		}
	} else if(currentSection == "Recognized Holidays (university closed)") {
		index = addEvent(columnData, date);
		addHoliday(columnData, index);
	} else if(currentSection == "Registration Dates" || currentSection == "Tuition and Refund Dates" || currentSection == "Important Dates") {
		var asterixMatch = key.match(/([^*]+)(\*+)/);
		if (asterixMatch) {
			date.name = asterixMatch[1];
			var descriptionMatch = paragraphs.match(new RegExp("^\\*{" + asterixMatch[2].length + "}([^\n\r*]+)", "m"));
			if (descriptionMatch) {
				date.description = descriptionMatch[1].trim();
			}
		}
		addEvent(columnData, date);
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

		var paragraphs = "";
		$("p").each(function() {
			paragraphs += $("<div/>").html(($(this).html().replace(/<br\/?>/, "\n"))).text() + "\n";
		});

		var $tables = $("<div>");
		$(".tftable").each(function() {
			$tables.append($(this));
		});
		var tables = tabletojson.convert($tables.html());

		log("Handling table data.");

		semesters = [];
		for(var i = 0; i < tables.length; i++) {
			handleTable(tables[i], paragraphs);
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
