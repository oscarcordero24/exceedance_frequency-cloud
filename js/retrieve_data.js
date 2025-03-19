document.addEventListener('DOMContentLoaded', async function () {
    // Display the loading indicator for water quality alarm
    //const loadingIndicator = document.getElementById('loading_alarm_datman');
    //loadingIndicator.style.display = 'block'; // Show the loading indicator

    // Set the category and base URL for API calls
    let setCategory = "Datman";

    let cda = "internal";
    let office = "MVS";
    let type = "no idea";

    // Get the current date and time, and compute a "look-back" time for historical data
    const currentDateTime = new Date();
    const lookBackHours = subtractDaysFromDate(new Date(), 90);

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://coe-${office.toLowerCase()}uwa04${office.toLowerCase()}.${office.toLowerCase()}.usace.army.mil:8243/${office.toLowerCase()}-data/`;
        console.log("setBaseUrl: ", setBaseUrl);
    } else if (cda === "public") {
        setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
        console.log("setBaseUrl: ", setBaseUrl);
    }

    // Define the URL to fetch location groups based on category
    const categoryApiUrl = setBaseUrl + `location/group?office=${office}&include-assigned=false&location-category-like=${setCategory}`;
    console.log("categoryApiUrl: ", categoryApiUrl);

    // Initialize maps to store metadata and time-series ID (TSID) data for various parameters
    const metadataMap = new Map();
    const ownerMap = new Map();
    const tsidDatmanMap = new Map();

    // Initialize arrays for storing promises
    const metadataPromises = [];
    const ownerPromises = [];
    const datmanTsidPromises = [];

    // Fetch location group data from the API
    fetch(categoryApiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                console.warn('No data available from the initial fetch.');
                return;
            }

            // Filter and map the returned data to basins belonging to the target category
            const targetCategory = { "office-id": office, "id": setCategory };
            const filteredArray = filterByLocationCategory(data, targetCategory);
            const basins = filteredArray.map(item => item.id);

            if (basins.length === 0) {
                console.warn('No basins found for the given category.');
                return;
            }

            // Initialize an array to store promises for fetching basin data
            const apiPromises = [];
            const combinedData = [];

            // Loop through each basin and fetch data for its assigned locations
            basins.forEach(basin => {
                const basinApiUrl = setBaseUrl + `location/group/${basin}?office=${office}&category-id=${setCategory}`;
                console.log("basinApiUrl: ", basinApiUrl);

                apiPromises.push(
                    fetch(basinApiUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Network response was not ok for basin ${basin}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(getBasin => {
                            // console.log('getBasin:', getBasin);

                            if (!getBasin) {
                                console.log(`No data for basin: ${basin}`);
                                return;
                            }

                            // Filter and sort assigned locations based on 'attribute' field
                            getBasin[`assigned-locations`] = getBasin[`assigned-locations`].filter(location => location.attribute <= 900);
                            getBasin[`assigned-locations`].sort((a, b) => a.attribute - b.attribute);
                            combinedData.push(getBasin);

                            // If assigned locations exist, fetch metadata and time-series data
                            if (getBasin['assigned-locations']) {
                                getBasin['assigned-locations'].forEach(loc => {
                                    // console.log(loc['location-id']);

                                    // Fetch metadata for each location
                                    const locApiUrl = setBaseUrl + `locations/${loc['location-id']}?office=${office}`;
                                    // console.log("locApiUrl: ", locApiUrl);
                                    metadataPromises.push(
                                        fetch(locApiUrl)
                                            .then(response => {
                                                if (response.status === 404) {
                                                    console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                                    return null; // Skip if not found
                                                }
                                                if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                return response.json();
                                            })
                                            .then(locData => {
                                                if (locData) {
                                                    metadataMap.set(loc['location-id'], locData);
                                                }
                                            })
                                            .catch(error => {
                                                console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                            })
                                    );

                                    // Fetch owner for each location
                                    let ownerApiUrl = setBaseUrl + `location/group/${office}?office=${office}&category-id=${office}`;
                                    if (ownerApiUrl) {
                                        ownerPromises.push(
                                            fetch(ownerApiUrl)
                                                .then(response => {
                                                    if (response.status === 404) {
                                                        console.warn(`Temp-Water TSID data not found for location: ${loc['location-id']}`);
                                                        return null;
                                                    }
                                                    if (!response.ok) {
                                                        throw new Error(`Network response was not ok: ${response.statusText}`);
                                                    }
                                                    return response.json();
                                                })
                                                .then(ownerData => {
                                                    if (ownerData) {
                                                        console.log("ownerData", ownerData);
                                                        ownerMap.set(loc['location-id'], ownerData);
                                                    }
                                                })
                                                .catch(error => {
                                                    console.error(`Problem with the fetch operation for stage TSID data at ${ownerApiUrl}:`, error);
                                                })
                                        );
                                    }


                                    // Fetch datman TSID data
                                    const tsidDatmanApiUrl = setBaseUrl + `timeseries/group/Datman?office=${office}&category-id=${loc['location-id']}`;
                                    // console.log('tsidDatmanApiUrl:', tsidDatmanApiUrl);
                                    datmanTsidPromises.push(
                                        fetch(tsidDatmanApiUrl)
                                            .then(response => {
                                                if (response.status === 404) return null; // Skip if not found
                                                if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                return response.json();
                                            })
                                            .then(tsidDatmanData => {
                                                // console.log('tsidDatmanData:', tsidDatmanData);
                                                if (tsidDatmanData) {
                                                    tsidDatmanMap.set(loc['location-id'], tsidDatmanData);
                                                }
                                            })
                                            .catch(error => {
                                                console.error(`Problem with the fetch operation for stage TSID data at ${tsidDatmanApiUrl}:`, error);
                                            })
                                    );
                                });
                            }
                        })
                        .catch(error => {
                            console.error(`Problem with the fetch operation for basin ${basin}:`, error);
                        })
                );
            });

            // Process all the API calls and store the fetched data
            Promise.all(apiPromises)
                .then(() => Promise.all(metadataPromises))
                .then(() => Promise.all(ownerPromises))
                .then(() => Promise.all(datmanTsidPromises))
                .then(() => {
                    combinedData.forEach(basinData => {
                        if (basinData['assigned-locations']) {
                            basinData['assigned-locations'].forEach(loc => {
                                // Add metadata, TSID, and last-value data to the location object

                                // Add metadata to json
                                const metadataMapData = metadataMap.get(loc['location-id']);
                                if (metadataMapData) {
                                    loc['metadata'] = metadataMapData;
                                }

                                // Add owner to json
                                const ownerMapData = ownerMap.get(loc['location-id']);
                                if (ownerMapData) {
                                    loc['owner'] = ownerMapData;
                                };


                                // Add datman to json
                                const tsidDatmanMapData = tsidDatmanMap.get(loc['location-id']);
                                if (tsidDatmanMapData) {
                                    reorderByAttribute(tsidDatmanMapData);
                                    loc['tsid-datman'] = tsidDatmanMapData;
                                } else {
                                    loc['tsid-datman'] = null;  // Append null if missing
                                }

                                // Initialize empty arrays to hold API and last-value data for various parameters
                                loc['datman-api-data'] = [];
                                loc['datman-last-value'] = [];
                            });
                        }
                    });

                    console.log('combinedData:', combinedData);

                    const timeSeriesDataPromises = [];

                    // Iterate over all arrays in combinedData
                    for (const dataArray of combinedData) {
                        for (const locData of dataArray['assigned-locations'] || []) {
                            // Handle temperature, depth, and DO time series
                            const datmanTimeSeries = locData['tsid-datman']?.['assigned-time-series'] || [];

                            // Function to create fetch promises for time series data
                            const timeSeriesDataFetchPromises = (timeSeries, type) => {
                                return timeSeries.map((series, index) => {
                                    const tsid = series['timeseries-id'];
                                    const timeSeriesDataApiUrl = setBaseUrl + `timeseries?name=${tsid}&begin=${lookBackHours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;
                                    console.log('timeSeriesDataApiUrl:', timeSeriesDataApiUrl);

                                    return fetch(timeSeriesDataApiUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json;version=2'
                                        }
                                    })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.values) {
                                                data.values.forEach(entry => {
                                                    entry[0] = formatISODate2ReadableDate(entry[0]);
                                                });
                                            }

                                            let apiDataKey;
                                            if (type === 'datman') {
                                                apiDataKey = 'datman-api-data'; // Assuming 'do-api-data' is the key for dissolved oxygen data
                                            } else {
                                                console.error('Unknown type:', type);
                                                return; // Early return to avoid pushing data if type is unknown
                                            }

                                            locData[apiDataKey].push(data);


                                            let lastValueKey;
                                            if (type === 'datman') {
                                                lastValueKey = 'datman-last-value';  // Assuming 'do-last-value' is the key for dissolved oxygen last value
                                            } else {
                                                console.error('Unknown type:', type);
                                                return; // Early return if the type is unknown
                                            }

                                            let maxValueKey;
                                            if (type === 'datman') {
                                                maxValueKey = 'datman-max-value';
                                            } else {
                                                console.error('Unknown type:', type);
                                                return; // Early return if the type is unknown
                                            }

                                            let minValueKey;
                                            if (type === 'datman') {
                                                minValueKey = 'datman-min-value';
                                            } else {
                                                console.error('Unknown type:', type);
                                                return; // Early return if the type is unknown
                                            }

                                            if (!locData[lastValueKey]) {
                                                locData[lastValueKey] = [];  // Initialize as an array if it doesn't exist
                                            }

                                            if (!locData[maxValueKey]) {
                                                locData[maxValueKey] = [];  // Initialize as an array if it doesn't exist
                                            }

                                            if (!locData[minValueKey]) {
                                                locData[minValueKey] = [];  // Initialize as an array if it doesn't exist
                                            }


                                            // Get and store the last non-null value for the specific tsid
                                            const lastValue = getLastNonNullValue(data, tsid);

                                            // Get and store the last max value for the specific tsid
                                            const maxValue = getMaxValue(data, tsid);
                                            // console.log("maxValue: ", maxValue);

                                            // Get and store the last min value for the specific tsid
                                            const minValue = getMinValue(data, tsid);
                                            // console.log("minValue: ", minValue);

                                            // Push the last non-null value to the corresponding last-value array
                                            locData[lastValueKey].push(lastValue);

                                            // Push the last non-null value to the corresponding last-value array
                                            locData[maxValueKey].push(maxValue);

                                            // Push the last non-null value to the corresponding last-value array
                                            locData[minValueKey].push(minValue);

                                        })

                                        .catch(error => {
                                            console.error(`Error fetching additional data for location ${locData['location-id']} with TSID ${tsid}:`, error);
                                        });
                                });
                            };


                            // Create promises for temperature, depth, and DO time series
                            const datmanPromises = timeSeriesDataFetchPromises(datmanTimeSeries, 'datman');

                            // Additional API call for extents data
                            const timeSeriesDataExtentsApiCall = (type) => {
                                const extentsApiUrl = setBaseUrl + `catalog/TIMESERIES?page-size=5000&office=${office}`;
                                console.log('extentsApiUrl:', extentsApiUrl);

                                return fetch(extentsApiUrl, {
                                    method: 'GET',
                                    headers: {
                                        'Accept': 'application/json;version=2'
                                    }
                                })
                                    .then(res => res.json())
                                    .then(data => {
                                        locData['extents-api-data'] = data;
                                        locData[`extents-data`] = {}

                                        // Collect TSIDs from temp, depth, and DO time series
                                        const datmanTids = datmanTimeSeries.map(series => series['timeseries-id']);
                                        const allTids = [...datmanTids]; // Combine both arrays

                                        // Iterate over all TSIDs and create extents data entries
                                        allTids.forEach((tsid, index) => {
                                            // console.log("tsid:", tsid);
                                            const matchingEntry = data.entries.find(entry => entry['name'] === tsid);
                                            if (matchingEntry) {
                                                // Construct dynamic key
                                                let _data = {
                                                    office: matchingEntry.office,
                                                    name: matchingEntry.name,
                                                    earliestTime: matchingEntry.extents[0]?.['earliest-time'],
                                                    lastUpdate: matchingEntry.extents[0]?.['last-update'],
                                                    latestTime: matchingEntry.extents[0]?.['latest-time'],
                                                    tsid: matchingEntry['timeseries-id'], // Include TSID for clarity
                                                };
                                                // console.log({ locData })
                                                // Determine extent key based on tsid
                                                let extent_key;
                                                if (tsid.includes('Stage') || tsid.includes('Elev') || tsid.includes('Flow')) { // Example for another condition
                                                    extent_key = 'datman';
                                                } else {
                                                    return; // Ignore if it doesn't match either condition
                                                }
                                                // locData['tsid-extens-data']['temp-water'][0]
                                                if (!locData[`extents-data`][extent_key])
                                                    locData[`extents-data`][extent_key] = [_data]
                                                else
                                                    locData[`extents-data`][extent_key].push(_data)

                                            } else {
                                                console.warn(`No matching entry found for TSID: ${tsid}`);
                                            }
                                        });
                                    })
                                    .catch(error => {
                                        console.error(`Error fetching additional data for location ${locData['location-id']}:`, error);
                                    });
                            };

                            // Combine all promises for this location
                            timeSeriesDataPromises.push(Promise.all([...datmanPromises, timeSeriesDataExtentsApiCall()]));
                        }
                    }

                    // Wait for all additional data fetches to complete
                    return Promise.all(timeSeriesDataPromises);

                })
                .then(() => {
                    console.log('All combinedData data fetched successfully:', combinedData);

                    // Check and remove all attribute ending in 0.1
                    combinedData.forEach((dataObj, index) => {
                        // console.log(`Processing dataObj at index ${index}:`, dataObj[`assigned-locations`]);

                        // Filter out locations where the 'attribute' ends with '.1'
                        dataObj[`assigned-locations`] = dataObj[`assigned-locations`].filter(location => {
                            const attribute = location[`attribute`].toString();
                            // console.log(`Checking attribute: ${attribute}`);
                            return !attribute.endsWith('.1');
                        });

                        // console.log(`Updated assigned-locations for index ${index}:`, dataObj[`assigned-locations`]);
                    });

                    console.log('All combinedData data filtered successfully:', combinedData);

                    if (type === "status") {
                        // Only call createTable if no valid data exists
                        const table = createTable(combinedData);

                        // Append the table to the specified container
                        const container = document.getElementById('table_container_alarm_datman');
                        container.appendChild(table);
                    } else {
                        // Check if there are valid lastDatmanValues in the data
                        if (hasLastValue(combinedData)) {
                            if (hasDataSpike(combinedData)) {
                                console.log("Data spike detected.");
                                // call createTable if data spike exists
                                const table = createTableDataSpike(combinedData);

                                // Append the table to the specified container
                                const container = document.getElementById('table_container_alarm_datman');
                                container.appendChild(table);
                            } else {
                                console.log("No data spikes detected.");
                                console.log('Valid lastDatmanValue found. Displaying image instead.');

                                // Create an img element
                                const img = document.createElement('img');
                                img.src = '/apps/alarms/images/passed.png'; // Set the image source
                                img.alt = 'Process Completed'; // Optional alt text for accessibility
                                img.style.width = '50px'; // Optional: set the image width
                                img.style.height = '50px'; // Optional: set the image height

                                // Get the container and append the image
                                //const container = document.getElementById('table_container_alarm_datman');
                                //container.appendChild(img);
                            }

                        } else {
                            // Only call createTable if no valid data exists
                            const table = createTable(combinedData);

                            // Append the table to the specified container
                            //const container = document.getElementById('table_container_alarm_datman');
                            //container.appendChild(table);
                        }
                    }

                    //loadingIndicator.style.display = 'none';
                })
                .catch(error => {
                    console.error('There was a problem with one or more fetch operations:', error);
                    //loadingIndicator.style.display = 'none';
                });

        })
        .catch(error => {
            console.error('There was a problem with the initial fetch operation:', error);
            //loadingIndicator.style.display = 'none';
        });

    function filterByLocationCategory(array, setCategory) {
        return array.filter(item =>
            item['location-category'] &&
            item['location-category']['office-id'] === setCategory['office-id'] &&
            item['location-category']['id'] === setCategory['id']
        );
    }

    function subtractHoursFromDate(date, hoursToSubtract) {
        return new Date(date.getTime() - (hoursToSubtract * 60 * 60 * 1000));
    }

    function subtractDaysFromDate(date, daysToSubtract) {
        return new Date(date.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    }

    function formatISODate2ReadableDate(timestamp) {
        const date = new Date(timestamp);
        const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month
        const dd = String(date.getDate()).padStart(2, '0'); // Day
        const yyyy = date.getFullYear(); // Year
        const hh = String(date.getHours()).padStart(2, '0'); // Hours
        const min = String(date.getMinutes()).padStart(2, '0'); // Minutes
        return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
    }

    const reorderByAttribute = (data) => {
        data['assigned-time-series'].sort((a, b) => a.attribute - b.attribute);
    };

    const formatTime = (date) => {
        const pad = (num) => (num < 10 ? '0' + num : num);
        return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const findValuesAtTimes = (data) => {
        const result = [];
        const currentDate = new Date();

        // Create time options for 5 AM, 6 AM, and 7 AM today in Central Standard Time
        const timesToCheck = [
            new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 6, 0), // 6 AM CST
            new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 5, 0), // 5 AM CST
            new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 7, 0)  // 7 AM CST
        ];

        const foundValues = [];

        // Iterate over the values in the provided data
        const values = data.values;

        // Check for each time in the order of preference
        timesToCheck.forEach((time) => {
            // Format the date-time to match the format in the data
            const formattedTime = formatTime(time);
            // console.log(formattedTime);

            const entry = values.find(v => v[0] === formattedTime);
            if (entry) {
                foundValues.push({ time: formattedTime, value: entry[1] }); // Store both time and value if found
            } else {
                foundValues.push({ time: formattedTime, value: null }); // Store null if not found
            }
        });

        // Push the result for this data entry
        result.push({
            name: data.name,
            values: foundValues // This will contain the array of { time, value } objects
        });

        return result;
    };

    function getLastNonNullValue(data, tsid) {
        // Iterate over the values array in reverse
        for (let i = data.values.length - 1; i >= 0; i--) {
            // Check if the value at index i is not null
            if (data.values[i][1] !== null) {
                // Return the non-null value as separate variables
                return {
                    tsid: tsid,
                    timestamp: data.values[i][0],
                    value: data.values[i][1],
                    qualityCode: data.values[i][2]
                };
            }
        }
        // If no non-null value is found, return null
        return null;
    }

    function getMaxValue(data, tsid) {
        let maxValue = -Infinity; // Start with the smallest possible value
        let maxEntry = null; // Store the corresponding max entry (timestamp, value, quality code)

        // Loop through the values array
        for (let i = 0; i < data.values.length; i++) {
            // Check if the value at index i is not null
            if (data.values[i][1] !== null) {
                // Update maxValue and maxEntry if the current value is greater
                if (data.values[i][1] > maxValue) {
                    maxValue = data.values[i][1];
                    maxEntry = {
                        tsid: tsid,
                        timestamp: data.values[i][0],
                        value: data.values[i][1],
                        qualityCode: data.values[i][2]
                    };
                }
            }
        }

        // Return the max entry (or null if no valid values were found)
        return maxEntry;
    }

    function getMinValue(data, tsid) {
        let minValue = Infinity; // Start with the largest possible value
        let minEntry = null; // Store the corresponding min entry (timestamp, value, quality code)

        // Loop through the values array
        for (let i = 0; i < data.values.length; i++) {
            // Check if the value at index i is not null
            if (data.values[i][1] !== null) {
                // Update minValue and minEntry if the current value is smaller
                if (data.values[i][1] < minValue) {
                    minValue = data.values[i][1];
                    minEntry = {
                        tsid: tsid,
                        timestamp: data.values[i][0],
                        value: data.values[i][1],
                        qualityCode: data.values[i][2]
                    };
                }
            }
        }

        // Return the min entry (or null if no valid values were found)
        return minEntry;
    }

    function hasLastValue(data) {
        let allLocationsValid = true; // Flag to track if all locations are valid

        // Iterate through each key in the data object
        for (const locationIndex in data) {
            if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                const item = data[locationIndex];
                // console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked

                const assignedLocations = item['assigned-locations'];
                // Check if assigned-locations is an object
                if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                    console.log('No assigned-locations found in basin:', item);
                    allLocationsValid = false; // Mark as invalid since no assigned locations are found
                    continue; // Skip to the next basin
                }

                // Iterate through each location in assigned-locations
                for (const locationName in assignedLocations) {
                    const location = assignedLocations[locationName];
                    // console.log(`Checking location: ${locationName}`, location); // Log the current location being checked

                    // Check if location['tsid-temp-water'] exists, if not, set tempWaterTsidArray to an empty array
                    const datmanTsidArray = (location['tsid-datman'] && location['tsid-datman']['assigned-time-series']) || [];
                    const datmanLastValueArray = location['datman-last-value'];
                    // console.log("datmanTsidArray: ", datmanTsidArray);
                    // console.log("datmanLastValueArray: ", datmanLastValueArray);

                    // Check if 'datman-last-value' exists and is an array
                    let hasValidValue = false;

                    if (Array.isArray(datmanTsidArray) && datmanTsidArray.length > 0) {
                        // console.log('datmanTsidArray has data.');

                        // Loop through the datmanLastValueArray and check for null or invalid entries
                        for (let i = 0; i < datmanLastValueArray.length; i++) {
                            const entry = datmanLastValueArray[i];
                            // console.log("Checking entry: ", entry);

                            // Step 1: If the entry is null, set hasValidValue to false
                            if (entry === null) {
                                // console.log(`Entry at index ${i} is null and not valid.`);
                                hasValidValue = false;
                                continue; // Skip to the next iteration, this is not valid
                            }

                            // Step 2: If the entry exists, check if the value is valid
                            if (entry.value !== null && entry.value !== 'N/A' && entry.value !== undefined) {
                                // console.log(`Valid entry found at index ${i}:`, entry);
                                hasValidValue = true; // Set to true only if we have a valid entry
                            } else {
                                console.log(`Entry at index ${i} has an invalid value:`, entry.value);
                                hasValidValue = false; // Invalid value, so set it to false
                            }
                        }

                        // Log whether a valid entry was found
                        if (hasValidValue) {
                            // console.log("There are valid entries in the array.");
                        } else {
                            // console.log("No valid entries found in the array.");
                        }
                    } else {
                        console.log(`datmanTsidArray is either empty or not an array for location ${locationName}.`);
                    }

                    // If no valid values found in the current location, mark as invalid
                    if (!hasValidValue) {
                        allLocationsValid = false; // Set flag to false if any location is invalid
                    }
                }
            }
        }

        // Return true only if all locations are valid
        if (allLocationsValid) {
            console.log('All locations have valid entries.');
            return true;
        } else {
            // console.log('Some locations are missing valid entries.');
            return false;
        }
    }

    function hasDataSpikeInApiDataArray(data) {
        // Iterate through each key in the data object
        for (const locationIndex in data) {
            if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                const item = data[locationIndex];
                // console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked

                const assignedLocations = item['assigned-locations'];
                // Check if assigned-locations is an object
                if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                    console.log('No assigned-locations found in basin:', item);
                    continue; // Skip to the next basin
                }

                // Iterate through each location in assigned-locations
                for (const locationName in assignedLocations) {
                    const location = assignedLocations[locationName];
                    // console.log(`Checking location: ${locationName}`, location); // Log the current location being checked

                    const datmanApiData = location['datman-api-data'];

                    // Check if 'datman-api-data' exists and has a 'values' array
                    if (Array.isArray(datmanApiData) && datmanApiData.length > 0) {
                        let maxValue = -Infinity; // Initialize to a very low value
                        let minValue = Infinity; // Initialize to a very high value

                        // Iterate through the 'values' array and find the max and min values
                        datmanApiData[0]['values'].forEach(valueEntry => {
                            const currentValue = parseFloat(valueEntry[1]);
                            if (!isNaN(currentValue)) {
                                maxValue = Math.max(maxValue, currentValue);
                                minValue = Math.min(minValue, currentValue);
                            }
                        });

                        // Log the max and min values for the location
                        // console.log(`Max value for location ${locationName}:`, maxValue);
                        // console.log(`Min value for location ${locationName}:`, minValue);

                        // Check if the max value exceeds 999 or the min value is less than -999
                        if (maxValue > 999 || minValue < -999) {
                            // console.log(`Data spike detected in location ${locationName}: max = ${maxValue}, min = ${minValue}`);
                            return true; // Return true if any spike is found
                        }
                    } else {
                        console.log(`No valid 'datman-api-data' found in location ${locationName}.`);
                    }
                }
            }
        }

        // Return false if no data spikes were found
        console.log('No data spikes detected in any location.');
        return false;
    }

    function hasDataSpike(data) {
        // Iterate through each key in the data object
        for (const locationIndex in data) {
            if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                const item = data[locationIndex];
                console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked

                const assignedLocations = item['assigned-locations'];
                // Check if assigned-locations is an object
                if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                    console.log('No assigned-locations found in basin:', item);
                    continue; // Skip to the next basin
                }

                // Iterate through each location in assigned-locations
                for (const locationName in assignedLocations) {
                    const location = assignedLocations[locationName];
                    console.log(`Checking location: ${locationName}`, location); // Log the current location being checked
                    const datmanMaxValue = location['datman-max-value'][0][`value`];
                    const datmanMinValue = location['datman-min-value'][0][`value`];

                    // Check if datmanMaxValue or datmanMinValue exists
                    if (datmanMaxValue || datmanMinValue) {
                        // Check if the max value exceeds 999 or the min value is less than -999
                        if (datmanMaxValue > 999) {
                            console.log(`Data spike detected in location ${locationName}: max = ${datmanMaxValue}`);
                            return true; // Return true if any spike is found
                        }
                        if (datmanMinValue < -999) {
                            console.log(`Data spike detected in location ${locationName}: min = ${datmanMinValue}`);
                            return true; // Return true if any spike is found
                        }
                    } else {
                        console.log(`No valid 'datman-max-value' or 'datman-min-value' found in location ${locationName}.`);
                    }
                }
            }
        }

        // Return false if no data spikes were found
        console.log('No data spikes detected in any location.');
        return false;
    }

    function createTable(data) {
        const table = document.createElement('table');
        table.id = 'customers'; // Assigning the ID of "customers"

        data.forEach(item => {
            // Create header row for the item's ID
            const headerRow = document.createElement('tr');
            const idHeader = document.createElement('th');
            idHeader.colSpan = 4;
            // Apply styles
            idHeader.style.backgroundColor = 'darkblue';
            idHeader.style.color = 'white';
            idHeader.textContent = item.id; // Display the item's ID
            headerRow.appendChild(idHeader);
            table.appendChild(headerRow);

            // Create subheader row for "Time Series", "Value", "Date Time"
            const subHeaderRow = document.createElement('tr');
            ['Time Series', 'Value', 'Earliest Time', 'Latest Time'].forEach(headerText => {
                const td = document.createElement('td');
                td.textContent = headerText;
                subHeaderRow.appendChild(td);
            });
            table.appendChild(subHeaderRow);

            // Process each assigned location
            item['assigned-locations'].forEach(location => {
                const datmanData = location['extents-data']?.['datman'] || [];

                // Function to create data row
                const createDataRow = (tsid, value, timestamp, earliestTime) => {
                    const dataRow = document.createElement('tr');

                    const nameCell = document.createElement('td');
                    nameCell.textContent = tsid;

                    const lastValueCell = document.createElement('td');

                    // Create the span for the value
                    const valueSpan = document.createElement('span');

                    // Check if the value is null or not
                    if (value === null || isNaN(value)){
                        valueSpan.classList.add('blinking-text');
                        valueSpan.textContent = 'N/A'; // Or any placeholder you want for null values
                    } else {
                        valueSpan.textContent = parseFloat(value).toFixed(2);
                    }

                    lastValueCell.appendChild(valueSpan);

                    const earliestTimeCell = document.createElement('td');
                    earliestTimeCell.textContent = earliestTime;

                    const latestTimeCell = document.createElement('td');
                    latestTimeCell.textContent = timestamp;

                    dataRow.appendChild(nameCell);
                    dataRow.appendChild(lastValueCell);
                    dataRow.appendChild(earliestTimeCell);
                    dataRow.appendChild(latestTimeCell);

                    table.appendChild(dataRow);
                };

                // Process Datman data
                datmanData.forEach(datmanEntry => {
                    const tsid = datmanEntry.name; // Time-series ID from extents-data
                    const earliestTime = datmanEntry.earliestTime;
                    const latestTime = datmanEntry.latestTime;

                    // Safely access 'do-last-value'
                    const lastDatmanValue = (Array.isArray(location['datman-last-value'])
                        ? location['datman-last-value'].find(entry => entry && entry.tsid === tsid)
                        : null) || { value: 'N/A', timestamp: 'N/A' };

                    let dateTimeDatman = null;
                    dateTimeDatman = datmanEntry.latestTime;
                    createDataRow(tsid, lastDatmanValue.value, dateTimeDatman, earliestTime);
                });

                // If no data available for temp-water, depth, and do
                if (datmanData.length === 0) {
                    const dataRow = document.createElement('tr');

                    const nameCell = document.createElement('td');
                    nameCell.textContent = 'No Data Available';
                    nameCell.colSpan = 3; // Span across all three columns

                    dataRow.appendChild(nameCell);
                    table.appendChild(dataRow);
                }
            });
        });

        return table;
    }

    function createTableDataSpike(data) {
        const table = document.createElement('table');
        table.id = 'customers'; // Assigning the ID of "customers"

        data.forEach(item => {
            const assignedLocations = item['assigned-locations'];

            // Proceed only if there are assigned locations
            if (Array.isArray(assignedLocations) && assignedLocations.length > 0) {

                // Process each assigned location
                assignedLocations.forEach(location => {
                    let hasDataRows = false; // Reset flag for each location

                    const datmanMaxData = location['datman-max-value'] || [];
                    const datmanMinData = location['datman-min-value'] || [];
                    const ownerData = location['owner'][`assigned-locations`] || [];
                    const locationIdData = location['location-id'] || [];

                    // console.log("ownerData: ", ownerData);
                    // console.log("locationIdData: ", locationIdData);

                    // Temporary storage for data entries to check for spikes
                    const spikeData = [];

                    // Check each data type for spikes, with both min and max values
                    const checkForSpikes = (minDataArray, maxDataArray) => {
                        minDataArray.forEach((minEntry, index) => {
                            const tsid = minEntry.tsid;
                            const minValue = parseFloat(minEntry.value); // Get min value
                            const maxEntry = maxDataArray[index];
                            const maxValue = parseFloat(maxEntry?.value || 0); // Get max value (ensure no undefined)
                            const latestTime = minEntry.timestamp; // Use timestamp from minDataArray

                            // Check for spike condition (both min and max)
                            if (maxValue > 999 || minValue < -999) {
                                spikeData.push({
                                    tsid,
                                    maxValue: maxValue.toFixed(2),
                                    minValue: minValue.toFixed(2),
                                    timestamp: latestTime
                                });
                                hasDataRows = true; // Mark that we have valid data rows
                            }
                        });
                    };

                    // Check for spikes in each type of data
                    checkForSpikes(datmanMinData, datmanMaxData);

                    // Log the collected spike data for debugging
                    // console.log("datmanMaxData: ", datmanMaxData);
                    // console.log("datmanMinData: ", datmanMinData);
                    // console.log(`Spike data for location ${location[`location-id`]}:`, spikeData);
                    // console.log("hasDataRows: ", hasDataRows);

                    // Create header and subheader if we have spike data
                    if (hasDataRows) {
                        // Create header row for the item's ID
                        const headerRow = document.createElement('tr');
                        const idHeader = document.createElement('th');
                        idHeader.colSpan = 4; // Adjusting colspan for an additional column
                        idHeader.style.backgroundColor = 'darkblue';
                        idHeader.style.color = 'white';
                        idHeader.textContent = item.id; // Display the item's ID
                        headerRow.appendChild(idHeader);
                        table.appendChild(headerRow);

                        // Create subheader row for "Time Series", "Max Value", "Min Value", "Latest Time"
                        const subHeaderRow = document.createElement('tr');
                        ['Time Series', 'Max Value', 'Min Value', 'Latest Time'].forEach((headerText, index) => {
                            const td = document.createElement('td');
                            td.textContent = headerText;

                            // Set width for each column
                            if (index === 0) {
                                td.style.width = '50%';
                            } else if (index === 1 || index === 2) {
                                td.style.width = '15%';
                            } else {
                                td.style.width = '20%';
                            }

                            subHeaderRow.appendChild(td);
                        });
                        table.appendChild(subHeaderRow);

                        // Append data rows for spikes
                        spikeData.forEach(({ tsid, maxValue, minValue, timestamp }) => {
                            createDataRow(tsid, maxValue, minValue, timestamp, ownerData, locationIdData);
                        });
                    }
                });
            }
        });


        return table;

        // Helper function to create data rows
        function createDataRow(tsid, maxValue, minValue, timestamp, ownerData, locationIdData) {
            const dataRow = document.createElement('tr');

            // First column (tsid) as a link
            const nameCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = `https://wm.mvs.ds.usace.army.mil/district_templates/chart/index.html?office=MVS&cwms_ts_id=${tsid}&cda=${cda}&lookback=90`; // Set the link's destination (you can modify the URL)
            link.target = '_blank'; // Open link in a new tab
            link.textContent = tsid;
            nameCell.appendChild(link);

            // Check if locationIdData matches any entry in ownerData
            const isMatch = ownerData.some(owner => owner['location-id'] === locationIdData);
            if (!isMatch) {
                nameCell.style.color = 'darkblue'; // Apply dark blue color if there's a match
            }

            const maxValueCell = document.createElement('td');
            // Wrap the max value in a span with the blinking-text class
            const maxValueSpan = document.createElement('span');
            maxValueSpan.classList.add('blinking-text');
            maxValueSpan.textContent = maxValue;
            maxValueCell.appendChild(maxValueSpan);

            const minValueCell = document.createElement('td');
            // Wrap the min value in a span with the blinking-text class
            const minValueSpan = document.createElement('span');
            minValueSpan.classList.add('blinking-text');
            minValueSpan.textContent = minValue;
            minValueCell.appendChild(minValueSpan);

            const latestTimeCell = document.createElement('td');
            latestTimeCell.textContent = timestamp;

            dataRow.appendChild(nameCell);
            dataRow.appendChild(maxValueCell);
            dataRow.appendChild(minValueCell);
            dataRow.appendChild(latestTimeCell);

            table.appendChild(dataRow);
        }
    }
});