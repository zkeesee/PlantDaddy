var gpio = require('rpi-gpio');
var firebase = require('firebase');
var noble = require('noble');

// Initialize Firebase
var config = {
  apiKey: "AIzaSyAWZzBW9p4q1NVDvbGio8ww4Tvn3Yd3M00",
  authDomain: "plantdaddy-38dc7.firebaseapp.com",
  databaseURL: "https://plantdaddy-38dc7.firebaseio.com",
  projectId: "plantdaddy-38dc7",
  storageBucket: "plantdaddy-38dc7.appspot.com",
  messagingSenderId: "467720105587"
};
firebase.initializeApp(config);



var valve_pin = 15;
var plantLightThreshold = 0;
var plantWaterThreshold = 0;
var plantWaterHistory = ['0','0','0','0','0'];
var historyCounter = 0;

gpio.setup(valve_pin, gpio.DIR_OUT, openValve);


//writes output -> opens valve, closes valve 1 second later
//waits for ten seconds then may open again
function openValve() {
    gpio.write(valve_pin, true, function(err) {
        if(err) throw err;
        updateValveState('Open');
        console.log('open valve');

        var d = new Date();
        var t = d.toLocaleTimeString();
        plantWaterHistory[historyCounter] = t;
        historyCounter ++;
        if(historyCounter == 5){
            historyCounter = 0;
        }
        setValveHistory();

        setTimeout(function(){
            gpio.write(valve_pin, false, function(err){
                if(err) throw err;
                updateValveState('Closed');
                console.log('close valve');
            });
        }, 1000);
     });
}


// Setup Bluetooth connection
// Check if BLE adapter is powered on
noble.on('stateChange', function(state) {
    if(state === 'poweredOn') {
        console.log('BLE adapter powered on!');
        noble.startScanning();
    }
});


function setValveHistory(){
    firebase.database().ref().update({
        "PlantDaddy/ValveHistory/History1": plantWaterHistory[0],
        "PlantDaddy/ValveHistory/History2": plantWaterHistory[1],
        "PlantDaddy/ValveHistory/History3": plantWaterHistory[2],
        "PlantDaddy/ValveHistory/History4": plantWaterHistory[3],
        "PlantDaddy/ValveHistory/History5": plantWaterHistory[4]
    });
}


//pushes that status of the plant's light exposure to the firebase
function updateLightState(lightState){
    //write to firebase
    firebase.database().ref().update({
        "PlantDaddy/LightState": lightState
    });

    //console.log(Updated firebase valve state to " + valveState + " at " + t);
}


//pushes the open/close state of the valve to the firebase
function updateValveState(valveState){
    //write to firebase
    firebase.database().ref().update({
        "PlantDaddy/ValveState": valveState
    });

    //console.log(Updated firebase valve state to " + valveState + " at " + t);
}


//pushes new light and moisture data to firebase
function updateData(moistureDataFromArduino, lightDataFromArduino) {
    // Timestamp data
    var d = new Date();
    var t = d.toLocaleTimeString();

    // Write data to firebase
    firebase.database().ref().update({
        "PlantDaddy/Moisture": moistureDataFromArduino,
        "PlantDaddy/Light": lightDataFromArduino
    });

    //console.log("Updated firebase moisture data to " + moisture + " at " + t);
    //console.log("Updated firebase light data to " + light + " at " + t);
}


//updates lightthreshold value from database
firebase.database().ref().child("Daisy/LightThreshold").on("value", function(snapshot) {
    plantLightThreshold = snapshot.val();
}, function (errorObject) {
    //nothing
});


//updates waterthreshold value from database
firebase.database().ref().child("Daisy/WaterThreshold").on("value", function(snapshot) {
    plantWaterThreshold = snapshot.val();
}, function (errorObject) {
    //nothing
});


//compares current moisture value to threshold
function checkForWater(moistureData){
    if(moistureData < plantWaterThreshold){
        openValve();
    }
}


//compares current light exposure to threshold
function checkLightIntensity(lightData){
    if(lightData < plantLightThreshold - 10){
        updateLightState('Too Little Light');
    }
    else if(lightData > plantLightThreshold +10 ){
        updateLightState('Too Much Light');
    }
    else{
        updateLightState('Enough Light');
    }
}


//Register function to receive newly discovered devices
noble.on('discover', function(device) {
    if(device.address === 'f4:d9:23:8e:84:c1') {
        console.log('Found device: ' + device.address);
        //found our device, now connect to it
        //Be sure to turn off scanning before connecting
        noble.stopScanning();
        device.connect(function(error) {
            // Once connected, we need to kick off service discovery
            device.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
                //Discovery done! Find characteristics we care about
                var uartTx = null;
                var uartRx = null;
                var gattRx = null;
                //look for UART service characteristic
                characteristics.forEach(function(ch, chID) {
                    if (ch.uuid === '6e400002b5a3f393e0a9e50e24dcca9e') {
                        uartTx = ch;
                        console.log("Found UART Tx characteristic");
                    }
                    if (ch.uuid === '6e400003b5a3f393e0a9e50e24dcca9e') {
                        uartRx = ch;
                        console.log("Found UART Rx characteristic");
                    }
                    if (ch.uuid === '2a6e') { // Gatt uuid for temperature reading
                        gattRx = ch;
                        console.log("Found Gatt Rx characteristic");
                    }
                });
                //Check if we found UART Tx characteristic
                if (!uartTx) {
                    console.log('Failed to find UART Tx Characteristic! ');
                    process.exit();
                }
                //Check if we found UART Rx characteristic
                if (!uartRx) {
                    console.log('Failed to find UART Rx Characteristic! ');
                    process.exit();
                }
                //set up listener for console input
                //when console input is received, send it to uartTx
                var stdin = process.openStdin();
                stdin.addListener("data", function (d) {
                    // d will have a linefeed at the end.  Get rid of it with trim
                    var inStr = d.toString().trim();
                    //Can only send 20 bytes in a Bluetooth LE packet
                    //so truncate string if it is too long
                    if (inStr.length > 20) {
                        inStr = inStr.slice(0, 19);
                    }
                    console.log("Sent: " + inStr);
                    uartTx.write(new Buffer(inStr));
                });
		// Now set up listener to receive data from uartRx
                //and display on console
                uartRx.notify(true);
                uartRx.on('read', function(data, isNotification) {
                    //console.log ("Received (from UART): " + data.toString());
                    //updateData(parseFloat(data.toString()).toFixed(2));
                });

                // Listener to receive data from Gatt
                gattRx.notify(true);
                gattRx.on('read', function(data, isNotification) {
                    var lightFromArduino = data[0];
                    var moistureFromArduino = data[1];
                    checkForWater(moistureFromArduino);
                    checkLightIntensity(lightFromArduino);
                    console.log ("Received Light (from Gatt): " + "LSB = " + data[0]);
                    console.log ("                      Actual Light = " + lightFromArduino);
                    console.log ("Received Moisture (from Gatt): " + "LSB = " + data[1]);
                    console.log ("                      Actual Moisture = " + moistureFromArduino);
                    updateData(moistureFromArduino, lightFromArduino);
                });
/*
                // ~~~~~~~~~~~~~~~ Interval Data Listener ~~~~~~~~~~~~~~~
                firebase.database().ref().child("Interval").on("value", function(snapshot) {
                    console.log("Interval value changed to " + snapshot.val());

                    // Push new interval rate to arduino
                    var firebaseStr = snapshot.val().toFixed(0);
                    //Can only send 20 bytes in a Bluetooth LE packet
                    //so truncate string if it is too long
                    if (firebaseStr.length > 20) {
                        firebaseStr = firebaseStr.slice(0, 19);
                    }
                    console.log("Sent: " + firebaseStr);
                    uartTx.write(new Buffer(firebaseStr));
                }, function (errorObject) {
                    console.log("The read failed: " + errorObject.code);
                });
*/
            });  //end of device.discover
        });   //end of device.connect
    }      //end of if (device.address...
});     //end of noble.on

