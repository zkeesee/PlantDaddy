/*
 * Lab Three 
 * Zakary Keesee and Matt Compton
 * Code was built on top of the lab 3
 * example provided to us, we do not take
 * credit for anything we did not produce
 */

/*********************************************************************
 This is an example for our nRF51822 based Bluefruit LE modules

 Pick one up today in the adafruit shop!

 Adafruit invests time and resources providing this open source code,
 please support Adafruit and open-source hardware by purchasing
 products from Adafruit!

 MIT license, check LICENSE for more information
 All text above, and the splash screen below must be included in
 any redistribution
*********************************************************************/
#include <Arduino.h>
#include <SPI.h>
#if not defined (_VARIANT_ARDUINO_DUE_X_) && not defined (_VARIANT_ARDUINO_ZERO_)
#include <SoftwareSerial.h>
#endif

#include "Adafruit_BluefruitLE_SPI.h"
#include "Adafruit_BLEGatt.h"


#include "BluefruitConfig.h"

/* ...hardware SPI, using SCK/MOSI/MISO hardware SPI pins and then user selected CS/IRQ/RST */
Adafruit_BluefruitLE_SPI ble(BLUEFRUIT_SPI_CS, BLUEFRUIT_SPI_IRQ, BLUEFRUIT_SPI_RST);

Adafruit_BLEGatt gatt(ble);

// A small helper
void error(const __FlashStringHelper*err) {
  Serial.println(err);
  while (1);
}

/* The service information */

int32_t etsServiceId;
int32_t etsMeasureCharId;

//TMP36 Pin Variables
//int sensorPin = 0; //Vout (sense) pin

/**************************************************************************/
/*!
    @brief  Sets up the HW an the BLE module (this function is called
            automatically on startup)
*/
/**************************************************************************/
void setup(void)
{
  while (!Serial); // required for Flora & Micro
  delay(500);

  boolean success;

  Serial.begin(115200);
  Serial.println(F("Adafruit Bluefruit Thermometer Example"));
  Serial.println(F("--------------------------------------------"));

  randomSeed(micros());

  /* Initialise the module */
  Serial.print(F("Initialising the Bluefruit LE module: "));

  if ( !ble.begin(VERBOSE_MODE) )
  {
    error(F("Couldn't find Bluefruit, make sure it's in CoMmanD mode & check wiring?"));
  }
  Serial.println( F("OK!") );

  /* Perform a factory reset to make sure everything is in a known state */
  Serial.println(F("Performing a factory reset: "));
  if (! ble.factoryReset() ){
       error(F("Couldn't factory reset"));
  }

  /* Disable command echo from Bluefruit */
  ble.echo(false);

  Serial.println("Requesting Bluefruit info:");
  /* Print Bluefruit information */
  ble.info();

    /* Change the device name to make it easier to find */
  Serial.println(F("Setting device name to 'Bluefruit HRM': "));

  if (! ble.sendCommandCheckOK(F("AT+GAPDEVNAME=Bluefruit HRM")) ) {
    error(F("Could not set device name?"));
  }

  /* Add the Environmental Sensing Service definition */
  /* Service ID should be 1 */
  Serial.println(F("Adding the Environmental Sensing service definition (UUID = 0x181A): "));
  etsServiceId = gatt.addService(0x181A);
  if (etsServiceId == 0) {
    error(F("Could not add Environmental Sensing service"));
  }

  /* Add the Temperature Measurement characteristic */
  /* Chars ID for Measurement should be 1 */
  Serial.println(F("Adding the Temperature Measurement characteristic (UUID = 0x2A6E): "));
  success = ble.sendCommandWithIntReply( F("AT+GATTADDCHAR=UUID=0x2A6E, PROPERTIES=0x20, MIN_LEN=2, MAX_LEN=2"), &etsMeasureCharId);
  if (! success) {
    error(F("Could not add HRM characteristic"));
  }

  /* Add the Environmental Sensing Service to the advertising data (needed for Nordic apps to detect the service) */
  Serial.print(F("Adding Environmental Sensing Service UUID to the advertising payload: "));
  uint8_t advdata[] { 0x02, 0x01, 0x06, 0x05, 0x02, 0x1a, 0x18, 0x0a, 0x18 };
  ble.setAdvData( advdata, sizeof(advdata) );

  /* Reset the device for the new service setting changes to take effect */
  Serial.print(F("Performing a SW reset (service changes require a reset): "));
  ble.reset();

  Serial.println();
}

int interval = 1;
int counter = 0; 
void loop(void)
{
  byte bytes[2];
  //int reading = analogRead(sensorPin);
  int lightReading = analogRead(A5);
  int moistureReading = analogRead(A4);
  int tempReading = analogRead(A3);
   
  //converting reading to a voltage
  //float light = lightReading * (5.0/1023.0);
  //float moisture = moistureReading * (5.0/1023.0);

  //lsb is light number and msb is moisture number
  bytes[0] = lightReading/4;
  bytes[1] = moistureReading/4;
  //bytes[2] = tempReading;
  //ble.print("AT+BLEUARTTX");
  //ble.print(lightBytes[0]);
    
  delay(10000);
  //if(counter >= interval*10){
    //Serial.println(lightReading);
    gatt.setChar(etsMeasureCharId, bytes, 2); //Send the temperature over Bluetooth
    //counter = 0;
  //}
  //counter++;
  //delay(1000*interval);
}
