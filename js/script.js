import {
    fetchJsonFile,
    getNames,
    addBasinNames,
    createUrl,
    formatString,
    haveOneYearOfData,
    blurBackground,
    popupMessage,
    loadingPageData
} from './functions.js'


// Web site app information
const appMetadata = {
    name: "Frequency Duration",
    description: "PAGE DESCRIPTION",
    author: "U.S. Army Corps of Engineers, St. Louis District",
    version: "1.0",
    contact: {
        email: "dll-cemvs-water-managers@usace.army.mil",
        website: "https://www.mvs-wc.usace.army.mil/"
    }
}


// General Const Elements
const basinName = document.getElementById('basinCombobox'),
      gageName = document.getElementById('gageCombobox'),
      beginDate = document.getElementById('begin-input'),
      endDate = document.getElementById('end-input'),
      PORBeginDate = document.querySelector('#info-table .por-start'),
      POREndDate = document.querySelector('#info-table .por-end'),
      instructionsBtn = document.getElementById('instruction-btn'),
      darkModeCheckbox = document.querySelector('.header label input'),
      popupWindowBtn = document.getElementById('popup-button'),
      isProjectLabel = document.getElementById('is-project'),
      separatorDiv = document.getElementById('separator-div'),
      instructionsDiv = document.getElementById('instructions-div'),
      resultsDiv = document.getElementById('results'),
      errorMessageDiv = document.getElementById('error-message'),
      errorMessageText = document.querySelector('#error-message h2');

// Specific Const Elements
const computeHTMLBtn = document.getElementById('compute-html-btn'),
      singleMonthDayTextbox = document.getElementById('single-month-day-txbox'),
      specificTWFromTextbox = document.getElementById('time-window-from-checkbox'),
      specificTWToTextbox = document.getElementById('time-window-to-checkbox'),
      exclusionCheckbox = document.getElementById('exclusion-checkbox'),
      noExclusionCheckbox = document.getElementById('no-exclusion-checkbox'),
      exclusionSettingsDiv = document.querySelector('.exclusion-settings'),
      singleMonthCheckbox = document.getElementById('single-month-checkbox'),
      singleDayCheckbox = document.getElementById('single-day-checkbox'),
      specificTimeWindowCheckbox = document.getElementById('specific-time-window-checkbox'),
      singleMonthDayInputDiv = document.querySelector('.exclusion-settings .single-month-day-input'),
      specificTimeWindowDiv = document.querySelector('.exclusion-settings .specific-time-window-input'),
      settingDiv = document.querySelector('.input-checkbox'),
      byYearTableBody = document.getElementById('by-year-table-body'),
      magnitudeTableBody = document.getElementById('magnitude-table-body'),
      resultDiv = document.getElementById('results'),
      statsNumbers = document.querySelectorAll('#results .statistics .number'),
      exceedanceDiv = document.querySelector('.input-checkbox .exceedance-settings'),
      exceedanceLeveltextBox = document.getElementById('exceedance-level-txtbox'),
      exceedanceTypeDropBox = document.getElementById('exceedance-type-dropbox'),
      resultsInfoTop = document.querySelector('.results-info .top'),
      resultsInfoBottom = document.querySelector('.results-info .bottom');


let params = new URLSearchParams(window.location.search);
const officeName = params.get("office") ? params.get("office").toUpperCase() : "MVS";
const cda = params.get("cda") ? params.get("cda") : "internal";
const conlog = params.get("log") ? params.get("log") : "false";
let isDeveloper = params.get("developer") ? params.get("developer").toLowerCase() : null;

// Manually set up Maintenance
let isMaintenance = false;

if (isDeveloper === "true"){
    isMaintenance = false;
}

const consoleLog = conlog === "true" ? true : false;

// Global Variable
let globalDatman = null;

if (isMaintenance){

    window.location.href = "../../html/maintenance.html";

} else {

    // if (userData == null || userData.length < 1) {

    //     userData = {
    //         darkMode: darkModeCheckbox.checked,
    //     };
    // } else {
    //     applyDarkMode();
    //     darkModeCheckbox.checked = userData.darkMode;
    // }

    try{
        document.addEventListener('DOMContentLoaded', async function () {
        
            let setCategory = "Basins"; 
        
            //let office = "MVS";
            //let type = "no idea";
        
            // Get the current date and time, and compute a "look-back" time for historical data
            const currentDateTime = new Date();
            const lookBackHours = subtractDaysFromDate(new Date(), 90);
        
            let setBaseUrl = null;
            if (cda === "internal") {
                setBaseUrl = `https://coe-${officeName.toLowerCase()}uwa04${officeName.toLowerCase()}.${officeName.toLowerCase()}.usace.army.mil:8243/${officeName.toLowerCase()}-data/`;
            } else if (cda === "public") {
                setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
            }
        
            // Define the URL to fetch location groups based on category
            // const categoryApiUrl = setBaseUrl + `location/group?office=${office}&include-assigned=false&location-category-like=${setCategory}`;
            const categoryApiUrl = setBaseUrl + `location/group?office=${office}&group-office-id=${office}&category-office-id=${office}&category-id=${setCategory}`;
        
            // Initialize maps to store metadata and time-series ID (TSID) data for various parameters
            const metadataMap = new Map();
            const ownerMap = new Map();
            const tsidDatmanMap = new Map();
            const tsidStageMap = new Map();
            const projectMap = new Map();
            const tsidDatmanInflowMap = new Map();
            const tsidDatmanOutflowMap = new Map();
        
            // Initialize arrays for storing promises
            const metadataPromises = [];
            const ownerPromises = [];
            const datmanTsidPromises = [];
            const stageTsidPromises = [];
            const projectPromises = [];
            const datmanInflowTsidPromises = [];
            const datmanOutflowTsidPromises = [];
        
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
                    const targetCategory = { "office-id": officeName, "id": setCategory };
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
                        const basinApiUrl = setBaseUrl + `location/group/${basin}?office=${officeName}&category-id=${setCategory}`;
        
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
                                            const locApiUrl = setBaseUrl + `locations/${loc['location-id']}?office=${officeName}`;
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
                                            let ownerApiUrl = setBaseUrl + `location/group/Datman?office=${officeName}&category-id=${officeName}`;
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
                                                                ownerMap.set(loc['location-id'], ownerData);
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.error(`Problem with the fetch operation for stage TSID data at ${ownerApiUrl}:`, error);
                                                        })
                                                );
                                            }
        
                                            // Fetch project for each location
                                            let projectApiUrl = setBaseUrl + `location/group/Project?office=${officeName}&category-id=${officeName}`;
                                            if (projectApiUrl) {
                                                projectPromises.push(
                                                    fetch(projectApiUrl)
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
                                                        .then(projectData => {
                                                            if (projectData) {
                                                                projectMap.set(loc['location-id'], projectData);
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.error(`Problem with the fetch operation for stage TSID data at ${projectApiUrl}:`, error);
                                                        })
                                                );
                                            }
        
        
                                            // Fetch datman TSID data
                                            const tsidDatmanApiUrl = setBaseUrl + `timeseries/group/Datman?office=${officeName}&category-id=${loc['location-id']}`;
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
        
                                            // Fetch Inflow TSID data
                                            const tsidDatmanInflowApiUrl = setBaseUrl + `timeseries/group/Datman-Inflow?office=${officeName}&category-id=${loc['location-id']}`;
                                            // console.log('tsidDatmanInflowApiUrl:', tsidDatmanInflowApiUrl);
                                            datmanInflowTsidPromises.push(
                                                fetch(tsidDatmanInflowApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidDatmanInflowData => {
                                                        // console.log('tsidDatmanInflowData:', tsidDatmanInflowData);
                                                        if (tsidDatmanInflowData) {
                                                            tsidDatmanInflowMap.set(loc['location-id'], tsidDatmanInflowData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidDatmanInflowApiUrl}:`, error);
                                                    })
                                            );
        
                                            // Fetch Outflow TSID data
                                            const tsidDatmanOutflowApiUrl = setBaseUrl + `timeseries/group/Datman-Outflow?office=${officeName}&category-id=${loc['location-id']}`;
                                            // console.log('tsidDatmanInflowApiUrl:', tsidDatmanInflowApiUrl);
                                            datmanOutflowTsidPromises.push(
                                                fetch(tsidDatmanOutflowApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidDatmanOutflowData => {
                                                        // console.log('tsidDatmanInflowData:', tsidDatmanInflowData);
                                                        if (tsidDatmanOutflowData) {
                                                            tsidDatmanOutflowMap.set(loc['location-id'], tsidDatmanOutflowData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidDatmanOutflowApiUrl}:`, error);
                                                    })
                                            );
        
                                            // Fetch stage TSID data
                                            const tsidStageApiUrl = setBaseUrl + `timeseries/group/Stage?office=${officeName}&category-id=${loc['location-id']}`;
                                            // console.log('tsidStageApiUrl:', tsidStageApiUrl);
                                            stageTsidPromises.push(
                                                fetch(tsidStageApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidStageData => {
                                                        // console.log('tsidStageData:', tsidStageData);
                                                        if (tsidStageData) {
                                                            tsidStageMap.set(loc['location-id'], tsidStageData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidStageApiUrl}:`, error);
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
                        .then(() => Promise.all(stageTsidPromises))
                        .then(() => Promise.all(datmanInflowTsidPromises))
                        .then(() => Promise.all(datmanOutflowTsidPromises))
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
        
                                        // Add project to json
                                        const projectMapData = projectMap.get(loc['location-id']);
                                        if (projectMapData) {
                                            loc['project'] = projectMapData;
                                        };
        
                                        // Add datman to json
                                        const tsidDatmanMapData = tsidDatmanMap.get(loc['location-id']);
                                        if (tsidDatmanMapData) {
                                            reorderByAttribute(tsidDatmanMapData);
                                            loc['tsid-datman'] = tsidDatmanMapData;
                                        } else {
                                            loc['tsid-datman'] = null;  // Append null if missing
                                        }
        
                                        // Add datman Inflow to json
                                        const tsidDatmanInflowMapData = tsidDatmanInflowMap.get(loc['location-id']);
                                        if (tsidDatmanInflowMapData) {
                                            reorderByAttribute(tsidDatmanInflowMapData);
                                            loc['tsid-datman-inflow'] = tsidDatmanInflowMapData;
                                        } else {
                                            loc['tsid-datman-inflow'] = null;  // Append null if missing
                                        }
        
                                        // Add datman Outflow to json
                                        const tsidDatmanOutflowMapData = tsidDatmanOutflowMap.get(loc['location-id']);
                                        if (tsidDatmanOutflowMapData) {
                                            reorderByAttribute(tsidDatmanOutflowMapData);
                                            loc['tsid-datman-outflow'] = tsidDatmanOutflowMapData;
                                        } else {
                                            loc['tsid-datman-outflow'] = null;  // Append null if missing
                                        }
        
                                        // Add stage to json
                                        const tsidStageMapData = tsidStageMap.get(loc['location-id']);
                                        if (tsidStageMapData) {
                                            reorderByAttribute(tsidStageMapData);
                                            loc['tsid-stage'] = tsidStageMapData;
                                        } else {
                                            loc['tsid-stage'] = null;  // Append null if missing
                                        }
        
                                        // Initialize empty arrays to hold API and last-value data for various parameters
                                        loc['datman-api-data'] = [];
                                        loc['datman-last-value'] = [];
        
                                        // Initialize empty arrays to hold API and last-value data for various parameters
                                        loc['stage-api-data'] = [];
                                        loc['stage-last-value'] = [];
                                    });
                                }
                            });
        
                            const timeSeriesDataPromises = [];
        
                            // Iterate over all arrays in combinedData
                            for (const dataArray of combinedData) {
                                for (const locData of dataArray['assigned-locations'] || []) {
                                    // Handle temperature, depth, and DO time series
                                    const datmanTimeSeries = locData['tsid-datman']?.['assigned-time-series'] || [];
                                    const datmanInflowTimeSeries = locData['tsid-datman-inflow']?.['assigned-time-series'] || [];
                                    const datmanOutflowTimeSeries = locData['tsid-datman-outflow']?.['assigned-time-series'] || [];
        
                                    // Function to create fetch promises for time series data
                                    const timeSeriesDataFetchPromises = (timeSeries, type) => {
                                        return timeSeries.map((series, index) => {
                                            const tsid = series['timeseries-id'];
                                            const timeSeriesDataApiUrl = setBaseUrl + `timeseries?name=${tsid}&begin=${lookBackHours.toISOString()}&end=${currentDateTime.toISOString()}&office=${officeName}`;
                                           
        
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
                                    const datmanInflowPromises = timeSeriesDataFetchPromises(datmanInflowTimeSeries, 'datman-inflow');
                                    const datmanOutflowPromises = timeSeriesDataFetchPromises(datmanOutflowTimeSeries, 'datman-outflow');
        
                                    // Additional API call for extents data
                                    const timeSeriesDataExtentsApiCall = (type) => {
                                        const extentsApiUrl = setBaseUrl + `catalog/TIMESERIES?page-size=5000&office=${officeName}`;
        
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
                                                const datmanInflowTids = datmanInflowTimeSeries.map(series => series['timeseries-id']);
                                                const datmanOutflowTids = datmanOutflowTimeSeries.map(series => series['timeseries-id']);
                                                const allTids = [...datmanTids, ...datmanInflowTids, ...datmanOutflowTids]; // Combine both arrays
        
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
                                                        if (tsid.includes('Stage') || tsid.includes('Elev')) { // Example for another condition
                                                            extent_key = 'datman';
                                                        } else if (tsid.includes('Flow-In')) {
                                                            extent_key = 'datman-inflow';
                                                        } else if (tsid.includes('Flow-Out')) {
                                                            extent_key = 'datman-outflow';
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
                                    timeSeriesDataPromises.push(Promise.all([...datmanPromises, ...datmanInflowPromises, ...datmanOutflowPromises, timeSeriesDataExtentsApiCall()]));
                                }
                            }
        
                            // Wait for all additional data fetches to complete
                            return Promise.all(timeSeriesDataPromises);
        
                        })
                        .then(() => {
         
                            // Step 1: Filter out locations where 'attribute' ends with '.1'
                            combinedData.forEach((dataObj, index) => {
                                // console.log(`Processing dataObj at index ${index}:`, dataObj['assigned-locations']);
         
                                // Filter out locations with 'attribute' ending in '.1'
                                dataObj['assigned-locations'] = dataObj['assigned-locations'].filter(location => {
                                    const attribute = location['attribute'].toString();
                                    if (attribute.endsWith('.1')) {
                                        // Log the location being removed
                                        return false; // Filter out this location
                                    }
                                    return true; // Keep the location
                                });
         
                                // console.log(`Updated assigned-locations for index ${index}:`, dataObj['assigned-locations']);
                            });
         
         
                            // Step 2: Filter out locations where 'location-id' doesn't match owner's 'assigned-locations'
                            combinedData.forEach(dataGroup => {
                                // Iterate over each assigned-location in the dataGroup
                                let locations = dataGroup['assigned-locations'];
         
                                // Loop through the locations array in reverse to safely remove items
                                for (let i = locations.length - 1; i >= 0; i--) {
                                    let location = locations[i];
         
                                    // Find if the current location-id exists in owner's assigned-locations
                                    let matchingOwnerLocation = location['owner']['assigned-locations'].some(ownerLoc => {
                                        return ownerLoc['location-id'] === location['location-id'];
                                    });
         
                                    // If no match, remove the location
                                    if (!matchingOwnerLocation) {
                                        locations.splice(i, 1);
                                    }
                                }
                            });
        
                            //loadingIndicator.style.display = 'none';
                            initialize(combinedData);
        
        // =======================================================================================================================================
                        })
                        .catch(error => {
                            console.error('There was a problem with one or more fetch operations:', error);
                            //loadingIndicator.style.display = 'none';
                        });
        
                })
                .catch(error => {
                    console.error('There was a problem with the initial fetch operation:', error);
                    //loadingIndicator.style.display = 'none';
                    popupMessage("error", "There was an error retrieving the data.<br>See the console log for more information.");
                    popupWindowBtn.click();
                    loadingPageData();
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
                            consoleLog(3, 'No assigned-locations found in basin:', item);
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
                                        //console.log(`Entry at index ${i} is null and not valid.`);
                                        hasValidValue = false;
                                        continue; // Skip to the next iteration, this is not valid
                                    }
        
                                    // Step 2: If the entry exists, check if the value is valid
                                    if (entry.value !== null && entry.value !== 'N/A' && entry.value !== undefined) {
                                        // console.log(`Valid entry found at index ${i}:`, entry);
                                        hasValidValue = true; // Set to true only if we have a valid entry
                                    } else {
                                        consoleLog(3, `Entry at index ${i} has an invalid value:`, entry.value);
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
                                consoleLog(3, `datmanTsidArray is either empty or not an array for location ${locationName}.`);
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
                    consoleLog(3, 'All locations have valid entries.');
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
                            consoleLog(3, 'No assigned-locations found in basin:', item);
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
                                consoleLog(3, `No valid 'datman-api-data' found in location ${locationName}.`);
                            }
                        }
                    }
                }
        
                // Return false if no data spikes were found
                consoleLog(3, 'No data spikes detected in any location.');
                return false;
            }
        
            function hasDataSpike(data) {
                // Iterate through each key in the data object
                // for (const locationIndex in data) {
                //     if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                //         const item = data[locationIndex];
                //         console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked
        
                //         const assignedLocations = item['assigned-locations'];
                //         // Check if assigned-locations is an object
                //         if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                //             console.log('No assigned-locations found in basin:', item);
                //             continue; // Skip to the next basin
                //         }
        
                //         // Iterate through each location in assigned-locations
                //         for (const locationName in assignedLocations) {
                //             const location = assignedLocations[locationName];
                //             console.log(`Checking location: ${locationName}`, location); // Log the current location being checked
                //             const datmanMaxValue = location['datman-max-value'][0][`value`];
                //             const datmanMinValue = location['datman-min-value'][0][`value`];
        
                //             // Check if datmanMaxValue or datmanMinValue exists
                //             if (datmanMaxValue || datmanMinValue) {
                //                 // Check if the max value exceeds 999 or the min value is less than -999
                //                 if (datmanMaxValue > 999) {
                //                     console.log(`Data spike detected in location ${locationName}: max = ${datmanMaxValue}`);
                //                     return true; // Return true if any spike is found
                //                 }
                //                 if (datmanMinValue < -999) {
                //                     console.log(`Data spike detected in location ${locationName}: min = ${datmanMinValue}`);
                //                     return true; // Return true if any spike is found
                //                 }
                //             } else {
                //                 console.log(`No valid 'datman-max-value' or 'datman-min-value' found in location ${locationName}.`);
                //             }
                //         }
                //     }
                // }
        
                // // Return false if no data spikes were found
                // console.log('No data spikes detected in any location.');
                // return false;
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

    } catch (error){
        console.error(error);
        errorMessageDiv.classList.add('show');
        loadingDiv.classList.remove('show');
    }

}

// Add function to popup window button
//popupWindowBtn.addEventListener('click', blurBackground);

loadingPageData();

/**============= Main functions when data is retrieved ================**/
// Initilize page
function initialize(data) {

    consoleLog ? console.log("Initialize Data: ", data) : null;

    // Add dark mode functionality
    darkModeCheckbox.addEventListener('click', function() {
        document.getElementById('content-body').classList.toggle('dark');
        document.getElementById('page-container').classList.toggle('dark');
    });

    // Add functions to checkbox
    exclusionCheckbox.addEventListener('click', exclusionBoxChecked);
    noExclusionCheckbox.addEventListener('click', noExclusionBoxChecked);
    singleDayCheckbox.addEventListener('click', singleDayBoxChecked);
    singleMonthCheckbox.addEventListener('click', singleMonthBoxChecked);
    specificTimeWindowCheckbox.addEventListener('click', specificTimeWindowBoxChecked);

    // Textbox Functions
    exceedanceLeveltextBox.addEventListener('input', () => {
        if (isValidNumber(exceedanceLeveltextBox.value)){
            computeHTMLBtn.disabled = false;
        } else {
            computeHTMLBtn.disabled = true;
        }
    });

    singleMonthDayTextbox.addEventListener('input', () => {
        if (isValidNumber(singleMonthDayTextbox.value)){
            computeHTMLBtn.disabled = false;
        } else {
            computeHTMLBtn.disabled = true;
        }
    });

    specificTWFromTextbox.addEventListener('input', () => {
        if (isValidNumber(specificTWFromTextbox.value.split('-')[0]) && isValidNumber(specificTWToTextbox.value.split('-')[0]) &&
            isValidNumber(specificTWFromTextbox.value.split('-')[1]) && isValidNumber(specificTWToTextbox.value.split('-')[1])){
            computeHTMLBtn.disabled = false;
        } else {
            computeHTMLBtn.disabled = true;
        }
    });

    specificTWToTextbox.addEventListener('input', () => {
        if (isValidNumber(specificTWFromTextbox.value.split('-')[0]) && isValidNumber(specificTWToTextbox.value.split('-')[0]) &&
            isValidNumber(specificTWFromTextbox.value.split('-')[1]) && isValidNumber(specificTWToTextbox.value.split('-')[1])){
            computeHTMLBtn.disabled = false;
        } else {
            computeHTMLBtn.disabled = true;
        }
    });

    // Extract the names of the basins with the list of gages
    let namesObject = getNames(data);

    // Add the basins names to the basin combobox
    addBasinNames(basinName, namesObject);

    instructionsBtn.addEventListener('click', function(){
        instructionsDiv.classList.toggle('hidden');
    });

    // Change the gage values each time the basin value is changed
    basinName.addEventListener('change', function() {

        if (!haveClass(resultDiv, 'hidden')){
            resultDiv.classList.add('hidden');
        }

        computeHTMLBtn.disabled = true;
        returnSettingToDefault();

        gageName.options.length = 0;
        namesObject.forEach(element => {
            if (element['basin'] === basinName.value) {
                element['datman'].forEach(item => {
                    let option = document.createElement('option');
                    option.value = item;
                    option.textContent = item.split('.')[0];
                    gageName.appendChild(option);
                });
            }
        });

        // Add empty selections to the dropdown list
        let selectGageOption = document.createElement('option');
        selectGageOption.value = "Select Gage";
        selectGageOption.text = "Select Gage";

        gageName.insertBefore(selectGageOption, gageName.firstChild);
        gageName.selectedIndex = 0;

        PORBeginDate.textContent = "MM/DD/YYYY";
        POREndDate.textContent = "MM/DD/YYYY";

        if (!haveClass(settingDiv, 'hidden')){
            settingDiv.classList.add('hidden');
        }

        if (!haveClass(separatorDiv, 'hidden')){
            separatorDiv.classList.add('hidden');
        }

        // Determine if it's project
        isGageProject(data);

        updateAvailablePORTable(data);

        beginDate.disabled = true;
        endDate.disabled = true;

        if (!haveClass(errorMessageDiv, 'hidden')){
            errorMessageDiv.classList.add('hidden');
        }

        if (gageName.value === "Select Gage"){
            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";
        }

    });

    updateAvailablePORTable(data);
    PORBeginDate.textContent = "MM/DD/YYYY";
    POREndDate.textContent = "MM/DD/YYYY";

    // Update 'Avaliable POR' table everytime the gage name is changed
    gageName.addEventListener('change', function(){

        if (!haveClass(resultDiv, 'hidden')){
            resultDiv.classList.add('hidden');
        }

        updateAvailablePORTable(data);

        // Determine if it's project
        isGageProject(data);

        if (!haveClass(errorMessageDiv, 'hidden')){
            errorMessageDiv.classList.add('hidden');
        }

        if (gageName.value === "Select Gage"){
            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";

            if (!haveClass(settingDiv, 'hidden')){
                settingDiv.classList.add('hidden');
            }

            if (!haveClass(separatorDiv, 'hidden')){
                separatorDiv.classList.add('hidden');
            }

            computeHTMLBtn.disabled = true;
            returnSettingToDefault();

        } else {
            settingDiv.classList.remove('hidden');
            separatorDiv.classList.remove('hidden');

            beginDate.disabled = false;
            endDate.disabled = false;

            if (isEntryDataValid()){
                computeHTMLBtn.disabled = false;
            }
        }

        returnSettingToDefault();

    });

    // Determine if it's project
    isGageProject(data);

    // Disable dates input at the beginning
    beginDate.disabled = true;
    endDate.disabled = true;

    // Get all data to create the url
    const domain = "https://coe-mvsuwa04mvs.mvs.usace.army.mil:8243/mvs-data";
    const timeSeries = "/timeseries?";
    const timeZone = "CST6CDT";

    //loadingElement.hidden = true;

    loadingPageData();

    // Add empty selections to the dropdown list
    let selectBasinOption = document.createElement('option');
    selectBasinOption.value = "Select Basin";
    selectBasinOption.text = "Select Basin";

    let selectGageOption = document.createElement('option');
    selectGageOption.value = "Select Gage";
    selectGageOption.text = "Select Gage";

    basinName.insertBefore(selectBasinOption, basinName.firstChild);
    basinName.selectedIndex = 0;

    gageName.append(selectGageOption);

    computeHTMLBtn.disabled = true;

    // HTML button clicked
    computeHTMLBtn.addEventListener('click', function() {

        // Verify if the selected period is more than one year.
        if (haveOneYearOfData(beginDate.value, endDate.value) && beginDate.value < endDate.value) {

            if (!haveClass(errorMessageDiv, 'hidden')){
                errorMessageDiv.classList.add('hidden');
            }

            if (!haveClass(resultDiv, 'hidden')){
                resultDiv.classList.add('hidden');
            }

            loadingPageData();

            // Get Datman name ID
            let datmanName;
            data.forEach(element => {
                if (element['id'] === basinName.value) {
                    element['assigned-locations'].forEach(item => {
                        if (item['location-id'] === gageName.value) {
                            datmanName = item['extents-data']['datman'][0]['name'];
                        };
                    });
                };
            });
            globalDatman = datmanName;

            // Initialize variables
            let beginValue = formatString("start date", beginDate.value); // YYYY-MM-DD
            let endValue = formatString('end date', endDate.value); // YYYY-MM-DD

            // Create the URL to get the data
            let stageUrl = createUrl(domain,timeSeries,datmanName,officeName,beginValue,endValue,timeZone)

            let pageSize = 500000;

            stageUrl = stageUrl + `&page-size=${pageSize}`;

            consoleLog ? console.log(stageUrl) : null;

            fetchJsonFile(stageUrl, function(newData) { 

                // Update Location Info
                let gageInformation = null;
                data.forEach(basin => {
                    if (basin['id'] === basinName.value) {
                        basin['assigned-locations'].forEach(gage => {
                            if (gage['location-id'] === gageName.value) {
                                gageInformation = gage['metadata'];
                            };
                        });
                    };
                });

                main(newData);


            }, function(){
                popupMessage("error", "There was an error getting the data.<br>Error: '" + error + "'");
                popupWindowBtn.click();
            });

        } else {

            popupMessage("error", "There was an error with the time window selected. Make sure the time window is <strong>ONE</strong> year or more, and the ending date is greater than the starting date");
            popupWindowBtn.click();
        }

        
    });   
    
}

// Main function
function main(data) {
    
    let objData = data["values"];
    let workData = [];

    objData.forEach((element) => {

        // Create Date Element
        let date = new Date(parseInt(element[0]));

        workData.push({
            date: date,
            stage: element[1],
            qualityCode: element[2]
        })
    });

    let allYearsList = []
    workData.forEach((element) => {
        let tempYear = `${element.date.getFullYear()}`;
        if (!allYearsList.includes(tempYear)){
            allYearsList.push(tempYear)
        }
    });

    consoleLog ? console.log( { workData } ) : null;

    let exceedanceLevel = parseFloat(exceedanceLeveltextBox.value);

    let filteredWorkData;

    console.log("Table data: ", filteredWorkData);

    // Filter data by month
    if (exclusionCheckbox.checked && singleMonthCheckbox.checked) {

        consoleLog ? console.log("Specific Month Checked") : null;

        let monthValue = parseInt(singleMonthDayTextbox.value);
        workData = filteredWorkData.filter(item => item.date.getMonth() === (monthValue - 1));

        //console.log("New Filtered Data: ", filteredWorkData);
    }

    // Filter data by day
    if (exclusionCheckbox.checked && singleDayCheckbox.checked) {

        consoleLog ? console.log("Single Day Checked") : null;

        let dayValue = parseInt(singleMonthDayTextbox.value);
        workData = filteredWorkData.filter(item => item.date.getDate() === dayValue);

        //console.log("New Filtered Data: ", filteredWorkData);
    }

    // Filter data by time window
    if (exclusionCheckbox.checked && specificTimeWindowCheckbox.checked) {

        consoleLog ? console.log("Specific Time Window Checked") : null;

        let fromMonth = parseInt(specificTWFromTextbox.value.split('-')[0]);
        let fromDay = parseInt(specificTWFromTextbox.value.split('-')[1]);
        let toMonth = parseInt(specificTWToTextbox.value.split('-')[0]);
        let toDay = parseInt(specificTWToTextbox.value.split('-')[1]);

        let crossToNextYear = fromMonth > toMonth ? true : false;

        console.log("Cross to next year: ", crossToNextYear);

        let tempWorkData = [];

        workData.forEach((element) => {
            let tempMonth = element.date.getMonth() + 1;
            let tempDay = element.date.getDate();

            if (tempMonth === fromMonth && tempDay > fromDay){
                tempWorkData.push(element);
            } else if (tempMonth === toMonth && tempDay < toDay){
                tempWorkData.push(element);
            } else if (!crossToNextYear && tempMonth > fromMonth && tempMonth < toMonth){
                tempWorkData.push(element);
            } else if (crossToNextYear) {
                if ((tempMonth < toMonth && tempMonth < fromMonth) || (tempMonth > toMonth && tempMonth > fromMonth)) {
                    tempWorkData.push(element);
                }
            }

        });

        filteredWorkData = tempWorkData;

        console.log("New Filtered Data: ", filteredWorkData);

    }

    if (noExclusionCheckbox) {
        filteredWorkData = workData;
    }

    let nonExceedanceLevelData = filteredWorkData.length;

    if (exceedanceTypeDropBox.value === "BELOW") {
        console.log("All BELOW Data.");
        filteredWorkData = workData.filter(value => value.stage <= exceedanceLevel);
    } else {
        console.log("All BELOW Data.");
        filteredWorkData = workData.filter(value => value.stage >= exceedanceLevel);
    }

    // Process data
    let filteredYearsList = []
    filteredWorkData.forEach((element) => {
        let tempYear = `${element.date.getFullYear()}`;
        if (!filteredYearsList.includes(tempYear)){
            filteredYearsList.push(tempYear)
        }
    });

    let arraySortedByDate = [];
    let arraySortedByStage = [];

    filteredWorkData.forEach((element) => {
        arraySortedByDate.push(element);
        arraySortedByStage.push(element);
    });

    arraySortedByDate.sort((a,b) => new Date(b.date) - new Date(a.date));
    arraySortedByStage.sort((a,b) => b.stage - a.stage);

    console.log({ arraySortedByDate , arraySortedByStage})

    let percentChance = filteredYearsList.length / allYearsList.length;
    let baseYearCount = allYearsList.length;
    let totalOccurences = filteredYearsList.length;

    let totalOccurencesDays = filteredWorkData.length;
    let totalReviewedDays = nonExceedanceLevelData;

    let infoTextTop = `
    The <strong>percent chance</strong> that the Stage gage, ${gageName.value}, is <strong>equal to or ${exceedanceTypeDropBox.value} ${exceedanceLeveltextBox.value} 
    ft</strong>, in any given year, is: <strong>${percentChance.toFixed(3)}</strong>. <br>This is based a year count of: 
    <strong>${baseYearCount}</strong> and a total number of occurences in any given year: <strong>${totalOccurences}</strong>
    `;

    let infoTextBottom = `
    The total number of exceedance occurences between <strong>${beginDate.value}</strong> and <strong>${endDate.value}</strong> is: <strong>${totalOccurencesDays}</strong> Days.
    <br>The total number of reviewed days between <strong>${beginDate.value}</strong> and <strong>${endDate.value}</strong> is: <strong>${totalReviewedDays}</strong> Days.
    `;

    resultsInfoTop.innerHTML = infoTextTop;
    resultsInfoBottom.innerHTML = infoTextBottom;

    populateTable(byYearTableBody, arraySortedByDate);
    populateTable(magnitudeTableBody, arraySortedByStage);

    if (haveClass(resultDiv, 'hidden')){
        resultDiv.classList.remove('hidden');
    }
    
    // Change button text
    loadingPageData();

}

// Populate tables
function populateTable(tableBody, tableData){

    tableBody.innerHTML = "";

    for (let i = 0; i < tableData.length; i++) {

        let newRow = document.createElement('tr');

        let day = tableData[i].date.getDate();
        let month = tableData[i].date.getMonth() + 1;
        let year = tableData[i].date.getFullYear();

        newRow.innerHTML = `<td>${tableData[i].stage.toFixed(2)}</td>
                            <td>${month}/${day}/${year}</td>`;

        tableBody.append(newRow);
    }

}

// Check if all the entry data is valid
function isEntryDataValid() {

    let checkList = [];

    if (exclusionCheckbox.checked && (singleDayCheckbox.checked || singleMonthCheckbox.checked)){
        checkList.push({
            name: "Month-Day",
            value: singleMonthDayTextbox.value
        });
    } else if (exclusionCheckbox.checked && specificTimeWindowCheckbox.checked){
        checkList.push({
            name: "STW From Month",
            value: specificTWFromTextbox.value.split('-')[0]
        });
        checkList.push({
            name: "STW From Day",
            value: specificTWFromTextbox.value.split('-')[1]
        });

        checkList.push({
            name: "STW To Month",
            value: specificTWToTextbox.value.split('-')[0]
        });
        checkList.push({
            name: "STW To Day",
            value: specificTWToTextbox.value.split('-')[1]
        });
    }
    let isDataValid = true;
    checkList.forEach((element) => {
        if (!isValidNumber(element.value) || element.value === "" || element.value === " "){
            isDataValid = false
        }
    });

    return isDataValid
        
}

// Get invalid textbox
function getInvalidTextbox() {
    let invalidInput = [];

    let checkList = [{
        element: groupIntervalTextbox,
        value: groupIntervalTextbox.value.trim()
    }];

    if (manualBoundCheckbox.checked){
        checkList.push({
            element: maxBoundTextbox,
            value: maxBoundTextbox.value.trim()
        });
        checkList.push({
            element: minBoundTextbox,
            value: minBoundTextbox.value.trim()
        });
    }

    if (exclusionCheckbox.checked && (singleDayCheckbox.checked || singleMonthCheckbox.checked)){
        checkList.push({
            element: singleMonthDayTextbox,
            value: singleMonthDayTextbox.value.trim()
        });
    } else if (exclusionCheckbox.checked && specificTimeWindowCheckbox.checked){
        // checkList.push({
        //     element: specificTWFromTextbox,
        //     value: specificTWFromTextbox.value.split('-')[0].trim()
        // });
        // checkList.push({
        //     element: specificTWFromTextbox,
        //     value: specificTWFromTextbox.value.split('-')[1].trim()
        // });

        // checkList.push({
        //     element: specificTWToTextbox,
        //     value: specificTWToTextbox.value.split('-')[0].trim()
        // });
        // checkList.push({
        //     element: specificTWToTextbox,
        //     value: specificTWToTextbox.value.split('-')[1].trim()
        // });
    }
    
    checkList.forEach((element) => {
        if (!isValidNumber(element.value) || element.value === "" || element.value === " "){
            invalidInput.push(element.element);
        }
    });

    return invalidInput
}

// Wait for the fetched data
async function awaitFetchData(url){

    try{
        let response = await fetch(url);
        if (!response.ok){
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let data = await response.json();
        let target = Math.round(data['constant-value'] * 100) / 100;

        console.log("Data received:", data);
        console.log("Target Data:", target);

        return target
    } catch (error){
        console.error("Fetch error: ", error.message);
        return null
    }

}

// Check is an element have a specific class
function haveClass(element, classString) {
    let result = false;
    element.classList.forEach(item => {
        if (item === classString){
            result = true;
        }
    });
    return result
}

// Is Project Function
function isGageProject(data) {
    // Determine if it's project
    let isProject = false;
    data.forEach(element => {
        if (element['id'] === basinName.value) {
            element['assigned-locations'].forEach(item => {
                if (item['location-id'] === gageName.value) {
                    let projectsList = item['project']['assigned-locations'] ? item['project']['assigned-locations'] : null;
                    if (projectsList) {
                        projectsList.forEach(gage => {
                            if (gage['location-id'] === gageName.value) {
                                isProject = true;
                            };
                        });
                    };
                };
            });
        };
    });

    // Change Datum type on the HTML
    if (isProject) {
        isProjectLabel.innerHTML = 'Datum: NGVD29';
    } else {
        isProjectLabel.innerHTML = 'Datum: NAVD88';
    }
}

// Update Available POR Function
function updateAvailablePORTable(data) {

    data.forEach(element => {
        if (element['id'] === basinName.value) {
            element['assigned-locations'].forEach(item => {
                if (item['location-id'] === gageName.value) {
                    let earliestDate = item['extents-data']['datman'][0]['earliestTime'];
                    let latestDate = item['extents-data']['datman'][0]['latestTime'];
                    let startPORDate = document.querySelector('#info-table .por-start');
                    let endPORDate = document.querySelector('#info-table .por-end');
                    let startDateList = earliestDate.split('T')[0].split('-');
                    let endDateList = latestDate.split('T')[0].split('-');
                    let newInputBeginYear = startDateList[0];
                    let newInputBeginMonth = startDateList[1];
                    let newInputBeginDay = startDateList[2];
                    let newInputEndYear = endDateList[0];
                    let newInputEndMonth = endDateList[1];
                    let newInputEndDay = endDateList[2];

                    startPORDate.innerText = `${newInputBeginMonth}/${newInputBeginDay}/${newInputBeginYear}`;
                    endPORDate.innerHTML = `${newInputEndMonth}/${newInputEndDay}/${newInputEndYear}`;

                    beginDate.value = `${newInputBeginYear}-${newInputBeginMonth}-${newInputBeginDay}`; // YYYY-MMM-DD
                    endDate.value = `${newInputEndYear}-${newInputEndMonth}-${newInputEndDay}`; // YYYY-MMM-DD

                }
            });
        };
    });
    
}

function returnSettingToDefault() {

    exclusionCheckbox.checked = false;
    noExclusionCheckbox.checked = true;

    singleMonthCheckbox.checked = false;
    singleDayCheckbox.checked = false;
    specificTimeWindowCheckbox.checked = false;

    if (!haveClass(singleMonthDayInputDiv, 'hidden')){
        singleMonthDayInputDiv.classList.add('hidden');
    }

    if (!haveClass(specificTimeWindowDiv, 'hidden')){
        specificTimeWindowDiv.classList.add('hidden');
    }

    if (!haveClass(exclusionSettingsDiv, 'hidden')){
        exclusionSettingsDiv.classList.add('hidden')
    }
}

function manualBoxChecked() {
    if (!manualBoundCheckbox.checked){
        manualBoundCheckbox.checked = true;
    }

    if (autoBoundCheckbox.checked){
        autoBoundCheckbox.checked = false;
    }

    if (haveClass(manualValuesDiv, 'hidden')){
        manualValuesDiv.classList.remove('hidden');
    }

    maxBoundTextbox.value = "";
    minBoundTextbox.value = "";

    if (isEntryDataValid()){
        computeHTMLBtn.disabled = false;
        computePDFBtn.disabled = false;
    } else {
        computeHTMLBtn.disabled = true;
        computePDFBtn.disabled = true;
    }
}

function autoBoxChecked() {
    if (!autoBoundCheckbox.checked){
        autoBoundCheckbox.checked = true;
    }

    if (manualBoundCheckbox.checked){
        manualBoundCheckbox.checked = false;
    }

    if (!haveClass(manualValuesDiv, 'hidden')){
        manualValuesDiv.classList.add('hidden');
    }

    if (isEntryDataValid()){
        computeHTMLBtn.disabled = false;
        computePDFBtn.disabled = false;
    } else {
        computeHTMLBtn.disabled = true;
        computePDFBtn.disabled = true;
    }
}

function exclusionBoxChecked() {
    if (!exclusionCheckbox.checked){
        exclusionCheckbox.checked = true;
    } else {
        computeHTMLBtn.disabled = true;
    }

    if (noExclusionCheckbox.checked){
        noExclusionCheckbox.checked = false;
    }

    if (haveClass(exclusionSettingsDiv, 'hidden')){
        exclusionSettingsDiv.classList.remove('hidden');
    }

}

function noExclusionBoxChecked() {
    if (!noExclusionCheckbox.checked){
        noExclusionCheckbox.checked = true;
    }

    if (exclusionCheckbox.checked){
        exclusionCheckbox.checked = false;
    }

    if (!haveClass(exclusionSettingsDiv, 'hidden')){
        exclusionSettingsDiv.classList.add('hidden');
    }

    if (!haveClass(singleMonthDayInputDiv, 'hidden')){
        singleMonthDayInputDiv.classList.add('hidden');
    }

    if (!haveClass(specificTimeWindowDiv, 'hidden')){
        specificTimeWindowDiv.classList.add('hidden');
    }

    if (isEntryDataValid()){
        computeHTMLBtn.disabled = false;
    } else {
        computeHTMLBtn.disabled = true;
    }

    singleDayCheckbox.checked = false;
    singleMonthCheckbox.checked = false;
    specificTimeWindowCheckbox.checked = false;
}

function singleMonthBoxChecked() {
    if (!singleMonthCheckbox.checked){
        singleMonthCheckbox.checked = true;
    } else {
        computeHTMLBtn.disabled = true;
    }

    if (singleDayCheckbox.checked){
        singleDayCheckbox.checked = false;
    }

    if (specificTimeWindowCheckbox.checked){
        specificTimeWindowCheckbox.checked = false;
    }

    if (haveClass(singleMonthDayInputDiv, 'hidden')){
        singleMonthDayInputDiv.classList.remove('hidden');
    }

    if (!haveClass(specificTimeWindowDiv, 'hidden')){
        specificTimeWindowDiv.classList.add('hidden');
    }

    singleMonthDayTextbox.value = "";
}

function singleDayBoxChecked() {
    if (!singleDayCheckbox.checked){
        singleDayCheckbox.checked = true;
    } else {
        computeHTMLBtn.disabled = true;
    }

    if (singleMonthCheckbox.checked){
        singleMonthCheckbox.checked = false;
    }

    if (specificTimeWindowCheckbox.checked){
        specificTimeWindowCheckbox.checked = false;
    }

    if (haveClass(singleMonthDayInputDiv, 'hidden')){
        singleMonthDayInputDiv.classList.remove('hidden');
    }

    if (!haveClass(specificTimeWindowDiv, 'hidden')){
        specificTimeWindowDiv.classList.add('hidden');
    }

    singleMonthDayTextbox.value = "";
}

function specificTimeWindowBoxChecked() {
    if (!specificTimeWindowCheckbox.checked){
        specificTimeWindowCheckbox.checked = true;
    } else {
        computeHTMLBtn.disabled = true;
    }

    if (singleMonthCheckbox.checked){
        singleMonthCheckbox.checked = false;
    }

    if (singleDayCheckbox.checked){
        singleDayCheckbox.checked = false;
    }

    if (haveClass(specificTimeWindowDiv, 'hidden')){
        specificTimeWindowDiv.classList.remove('hidden');
    }

    if (!haveClass(singleMonthDayInputDiv, 'hidden')){
        singleMonthDayInputDiv.classList.add('hidden');
    }

    specificTWFromTextbox.value = "";
    specificTWToTextbox.value = "";
}

function isValidNumber(value) {
    return Number.isFinite(Number(value));
}

