
// Fetch Json Data
export function fetchJsonFile(urlToFetch, sucessFunction, errorFunction){
    fetch(urlToFetch)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        sucessFunction(data);
    })    
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        errorFunction(error);
    })
}

// Get name list
export function getNames(data) {
    // Empty list to hold the new objects
    let objArray = []

    // Loop through all the basins
    data.forEach(element => {

        // Temporary hold list to get the datman names from each basin
        let tempList = [];

        // Loop through all the gages in the current basin and add the datman name to the temp list
        element['assigned-locations'].forEach(item => {
            tempList.push(item['location-id']);
        });

        let gagesList = tempList.filter(n => n != null);

        // Add a new object with the basin name and gages list to the object array
        if (gagesList.length > 0) {
            objArray.push({
                basin: element['id'],
                datman: gagesList,
            })
        };
    });

    return objArray;
}

// Add Values to combobox
export function addBasinNames(combobox, objectList) {
    objectList.forEach(element => {
        let option = document.createElement('option');
        option.value = element['basin'];
        option.textContent = element['basin']; 
        combobox.appendChild(option);
    });
}

// Create URL to fetch the stage data
export function createUrl(domain, timeSeries, nameValue, officeValue, beginValue, endValue, timeZone){
    return domain + timeSeries + "name=" + nameValue + "&office=" + officeValue + "&begin=" + beginValue + "&end=" + endValue + "&timezone=" + timeZone
}

// Function to format string
export function formatString(textField, stringText) {
    if (textField == "name") {
        let output = stringText.replace(/ /g, '%20');
        return output
    } else if (textField === "start date" || textField === "end date") {
        let timeHour = (textField == "start date") ? "00%3A00%3A00.00Z" : "23%3A59%3A59.99Z";
        let output = stringText + "T" + timeHour;
        return output;
    }
}

// Function to get the mean list for the period
export function getList(dataList) {
    let yearsList = [],
        objectList = [];

    // Create Date Element
    let date = new Date();
        
    // Loop through the data list to get years of the period
    dataList.forEach(element => {
        
        date = new Date(parseInt(element[0]));
        let currentYear = date.getFullYear();
        if (!yearsList.includes(currentYear)) {
            yearsList.push(currentYear);
        }
    });

    // Loop to get the dates and event for each year separated
    yearsList.forEach(year => {
        let tempList = [];
        dataList.forEach(element => {

            date = new Date(parseInt(element[0]));
            let currentYear = date.getFullYear();

            if ( currentYear === year) {
                // Obtener día, mes y año
                let day = date.getDate().toString().padStart(2, '0'); // Two-digits day
                let month = (date.getMonth() + 1).toString().padStart(2, '0'); // Two-digit month
                let year = date.getFullYear();
                let formattedDate = `${year}-${month}-${day}`
                tempList.push({
                    date: formattedDate,
                    stage: parseFloat(element[1].toFixed(2)),
                });
            }
        });
        objectList.push({
            year: year,
            data: tempList,
        })
    });

    return objectList;
}

// Function to get the mean values
export function getMeanMinMaxList(dataList) {

    let dateStageList = [];

    let month = 1;
    let day = 1;
    for (let i = 1; i <= 372; i++) {

        let dayStr = day > 9 ? `${day}` : `0${day}`;
        let monthStr = month > 9 ? `${month}` : `0${month}`;

        if (i % 31 === 0){

            dateStageList.push({
                date: `${monthStr}-${dayStr}`,
                stage: 0
            });
            month++;
            day = 1;
        } else {
            dateStageList.push({
                date: `${monthStr}-${dayStr}`,
                stage: 0
            });
            day++;
        }

    }

    // Create copy of the list for the average, min and max values
    let averageList = [];
    let minList = [];
    let maxList = [];

    dateStageList.forEach(element => {

        averageList.push({
            date:element.date,
            stage:element.stage
        });
        minList.push({
            date:element.date,
            stage:element.stage
        });
        maxList.push({
            date:element.date,
            stage:element.stage
        });

    });

    dateStageList.forEach((item, index) => {
        let count = 0;
        let tempList = [];

        dataList.forEach(element => {
            element.data.forEach(x => {
                let year = x.date.split('-')[0];
                let splittedDate = x.date.split('-').slice(-2);
                let refDate = splittedDate.join('-');

                // Get Average
                if (refDate === item.date) {
                    averageList[index].stage += x.stage; 
                    tempList.push({
                        year:year,
                        stage:x.stage
                    }); 
                    count ++;
                };
            });
        });

        if (count > 0) {
            averageList[index].stage = averageList[index].stage / count;
        };

        if (tempList.length > 0) {
            // Get stage list            
            let stageList = tempList.map(item => item.stage);

            // Max Stage
            let maxStage = Math.max(...stageList);
            let maxYear = tempList.filter(item => item.stage === maxStage)[0].year;
            maxList[index].stage = [maxStage, maxYear];

            // Min Stage
            let minStage = Math.min(...stageList);
            let minYear = tempList.filter(item => item.stage === minStage)[0].year;
            minList[index].stage = [minStage, minYear];
        };
    });

    return [averageList, minList, maxList];

}

// Function to extract the mean, min and max data in a better format for the table
export function extractDataForTable(data) {
    let newTable = [];
    for (let i = 1; i < 32; i++) {
        let dayString = (i < 10) ? `0${i}` : `${i}`;
        let newList = data.filter(x => x.date.split('-')[1] === dayString).map(x => x.stage);
        newTable.push(newList);
    };
    return newTable;
}

// Function to create a table and add it to the page
export function createTable(data, tableElement, tableDataType) {

    let lastPart = ["Mean", "Min", "Max"];

    let dataArray = function() {
        let holdList = []; // 12 empty list
        for (let i = 0; i < 12; i++) {
            let emptyList = [];
            data.forEach(element => {
                emptyList.push(element[i]);
            });
            holdList.push(emptyList);
        }
        return holdList;
    }();

    console.log("Month Array: ", dataArray);

    for (let i = 0; i < 34; i++) {

        let row = document.createElement('tr');

        if ((i + 1) % 5 === 0) {
            row.style.background = "var(--color-active)";
            row.style.color = "var(--font-color-1)";
        }

        for (let j = 0; j < 12; j++) {

            if (i > 30) {

                if (j === 0) {
                    row.innerHTML += `<td>${lastPart[i - 31]}</td>`;
                }

                if (lastPart[i - 31] === "Min") {
                    let newArray = [];
                    dataArray[j].forEach(element => {
                        if (element.length > 0) {
                            newArray.push(element[0]);
                        } else {
                            newArray.push(element)
                        }
                    });
                    let filterMin = newArray.filter(x => x !== 0);
                    let minValue = Math.min(...filterMin);

                    if (["Infinity", "0", "0.0", "0.00"].includes(`${minValue}`)){
                        row.innerHTML += `<td>  ----  </td>`;
                    } else {
                        row.innerHTML += `<td>${minValue.toFixed(2)}</td>`;
                    }

                } else if (lastPart[i - 31] === "Max") {
                    let newArray = [];
                    dataArray[j].forEach(element => {
                        if (element.length > 0) {
                            newArray.push(element[0]);
                        } else {
                            newArray.push(element)
                        }
                    });
                    let maxValue = Math.max(...newArray);

                    if (["Infinity", "0", "0.0", "0.00"].includes(`${maxValue}`)){
                        row.innerHTML += `<td>  ----  </td>`;
                    } else {
                        row.innerHTML += `<td>${maxValue.toFixed(2)}</td>`;
                    }

                } else {
                    let newArray = [];
                    dataArray[j].forEach(element => {
                        if (element.length > 0) {
                            newArray.push(element[0]);
                        } else {
                            newArray.push(element)
                        }
                    });
                    let filteredMeanValue = newArray.filter(num => num !== 0);
                    let meanValue = filteredMeanValue.reduce((p,c) => p + c) / filteredMeanValue.length;

                    if (["Infinity", "0", "0.0", "0.00"].includes(`${meanValue}`)){
                        row.innerHTML += `<td>  ----  </td>`;
                    } else {
                        row.innerHTML += `<td>${meanValue.toFixed(2)}</td>`;
                    }

                }

            } else {
                if (j === 0) {
                    row.innerHTML += `<td>${i+1}</td>`;
                }
    
                if (tableDataType === "mean") {
                    if (data[i][j] === 0){
                        if (i > 28){
                            row.innerHTML += `<td>----</td>`;
                        } else {
                            row.innerHTML += `<td>--</td>`;
                        }
                    } else {
                        row.innerHTML += `<td>${(data[i][j]).toFixed(2)}</td>`;
                    }
                } else {
                    let dateStageArray = data[i][j];
                    if (dateStageArray.length > 0) {
                        row.innerHTML += `<td>${(data[i][j][0]).toFixed(2)}<br>${data[i][j][1]}</td>`;
                    } else {
                        row.innerHTML += "<td>----</td>";
                    }
                };
            }

        };

        tableElement.appendChild(row);
    };
}

// Function to clear table
export function clearTable(table) {
    table.innerHTML = `<thead>
                            <tr>
                                <th colspan="13">Month</th>
                            </tr>
                            <tr>
                                <th>Day</th>
                                <th>Jan</th>
                                <th>Feb</th>
                                <th>Mar</th>
                                <th>Apr</th>
                                <th>May</th>
                                <th>Jun</th>
                                <th>Jul</th>
                                <th>Aug</th>
                                <th>Sep</th>
                                <th>Oct</th>
                                <th>Nov</th>
                                <th>Dec</th>
                            </tr>
                        </thead>
                        <tbody>
                            
                        </tbody>`;
}

// Check is the dates have at least one year data
export function haveOneYearOfData(startDate, endDate) {
    let startYear = startDate.split('-')[0];
    let startMonth = startDate.split('-')[1];
    let startDay = startDate.split('-')[2];

    let endYear = endDate.split('-')[0];
    let endMonth = endDate.split('-')[1];
    let endDay = endDate.split('-')[2];
    
    if (parseInt(endYear) - parseInt(startYear) === 0) {
        if (parseInt(endMonth) - parseInt(startMonth) === 11 && parseInt(endDay) - parseInt(startDay) === 30) {
            return true;
        } else {
            return false;
        };
    } else if (parseInt(endYear) - parseInt(startYear) === 1) {
        if (parseInt(endMonth) >= parseInt(startMonth) && parseInt(endDay) >= parseInt(startDay)) {
            return true;
        } else {
            return false;
        };
    } else {
        return true;
    };

}

export function blurBackground() {
    let blur = document.querySelector('#page-container .page-wrap');
    blur.classList.toggle('active');
    let popupWindow = document.getElementById('popup-window');
    popupWindow.classList.toggle('active');
}

export function popupMessage(msgType, message) {
    let popupTitle = document.getElementById('popup-title');
    let popupMessage = document.getElementById('popup-message');
    if (msgType === "warning") {
        popupTitle.innerHTML = "Warning";
    } else if (msgType === "error") {
        popupTitle.innerHTML = "Error";
    } else {
        popupTitle.innerHTML = "Message";
    }
    popupMessage.innerHTML = message;
}

// Show loading animation
export function showLoading() {
    let blur = document.querySelector('#page-container .page-content');
    blur.classList.toggle('blur');
    let loading = document.getElementById('loading-image');
    loading.classList.toggle('show');
}

// Loading data
export function loadingPageData() {
    let loadingDiv = document.getElementById('loading-image');
    loadingDiv.classList.toggle('show');
}
