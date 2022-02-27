#!/usr/bin/env node

process.chdir(__dirname);
const Nodestatic = require('node-static');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const util = require('util');
/* const { create } = require('combined-stream'); */

const fs = require('fs')

const path2conf = '../.././trackConfigs.json'
let alltrackConfig = {};
let trackConfigDefault = {};
let trackConfig = {};

/* try {
  if (!fs.existsSync(path2conf)) {
    fs.copyFile('./trackConfigs.json', path2conf, (err) => {
      if (err) throw err;
      console.log('trackConfigs.json was copied to destination.txt');
    });
  }
  alltrackConfig = require(path2conf)
  trackConfigDefault = alltrackConfig.Basic;
  trackConfig = trackConfigDefault;
} catch(err) {
  console.error(err)
}
 */

function createWebsocketServer(){
  const WSserver = new WebSocket.Server({ noServer: true });
  WSserver.on('connection', function connection(ws) {
      ws.on('message', function incoming(data) {
          console.log('Received Message: ' + data);
          if (CheckInput(data,ws)){
              let payload = onMessageRecieved(JSON.parse(data),WSserver)
              broadcastMessage(payload,WSserver);
          }
      });
  });
  return WSserver;
}

function startServer(port){
  if (!fs.existsSync(path2conf)) {
    fs.copyFile('./trackConfigs.json', path2conf, (err) => {
        if (err) throw err;
        console.log('trackConfigs.json was copied to destination.txt');    
        alltrackConfig = require(path2conf)
        trackConfigDefault = alltrackConfig.Basic;
        trackConfig = trackConfigDefault;
        }
        
    );
  }
  else {
      alltrackConfig = require(path2conf)
      trackConfigDefault = alltrackConfig.Basic;
      trackConfig = trackConfigDefault;
  }
  var file = new(Nodestatic.Server)("./static");

  const server = http.createServer(function (req, res) {
      file.serve(req, res);
    })
  const WSserver = createWebsocketServer();
  server.on('upgrade', function upgrade(request, socket, head) {
      const pathname = url.parse(request.url).pathname;
    
      if (pathname === '/ws') {
          WSserver.handleUpgrade(request, socket, head, function done(ws) {
              WSserver.emit('connection', ws, request);
          });
      } else {
          socket.destroy();
      }
  });
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function createSocketClient(port, closeAfter) {
  const client = new WebSocket(`ws://localhost:${port}/ws`);
  await waitForSocketState(client, client.OPEN);
  const messages = [];
  client.on("message", (data) => {
      messages.push(data.toString());
      if (messages.length === closeAfter) {
          client.close();
      }
  });
  return [client, messages];
}

function waitForSocketState(socket, state) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (socket.readyState === state) {
        resolve();
      } else {
        waitForSocketState(socket, state).then(resolve);
      }
    }, 5);
  });
}

function broadcastMessage(data,WSserver){
    WSserver.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        };
    });
}

function CheckInput(data,ws){
    try {
        JSON.parse(data);
    } catch (e) {
        ws.send(JSON.stringify({"notJSON": data.toString()}));
        return 0;
    };
    return 1;
}

function fixConf(){
  let regex = /(http:\/\/.*\/)(.*\.png)/;
  for (var id in trackConfig.conf){
      for(let i in trackConfig.conf[id].img){
          trackConfig.conf[id].img[i].src = trackConfig.conf[id].img[i].src.replace(regex,"$2");
      }
      if ("switch" in trackConfig.conf[id]){
          trackConfig.conf[id].switch.switched=trackConfig.conf[id].switch.switched?trackConfig.conf[id].switch.switched:"Straight"
      }
  }
}

function onMessageRecieved(data,WSserver){
    let message = {};
    if(data.hasOwnProperty("action")){
        if (data.action == "getConfig"){
            message = {
                "Status":"TrackConfig:",
                "Message": trackConfig
            };
        }
        else if (data.action == "getDefaultConfig"){
            message = {
                "Status":"TrackConfig:",
                "Message": trackConfigDefault
            };
        }
        else if (data.action == "getConfigESP"){
            message = {
                "Status":"SwitchConfigESP:",
                "Message": conf4ESP()
            };
        }
        else if (data.action == "getConfsList"){
            message = {
                "Status":"ConfList:",
                "Message": Object.keys(alltrackConfig)
            };
        }
        else if (data.action == "getConfByName"){
            let name = data.name;
            message = {
                "Status":"TrackConfig:",
                "Message": alltrackConfig[name]
            };
        }
        else if (data.action == "setConfig"){
            trackConfig = data.config;
            fixConf();
            let needUpdate = true;
            for (id in alltrackConfig){
              if (util.isDeepStrictEqual(alltrackConfig[id], trackConfig)){
                needUpdate = false;
              }
            }
            if (needUpdate){
              alltrackConfig[data.name]=trackConfig;
              updateAllTrackConfig();
            }
            message = {
                "Status":"TrackConfig:",
                "Message": trackConfig
            };
            broadcastMessage(JSON.stringify({"Status":"SwitchConfigESP:","Message": conf4ESP()}),WSserver);
            broadcastMessage(JSON.stringify({"Status":"ConfList:","Message": Object.keys(alltrackConfig)}),WSserver);
        }
        else if (data.action == "delConfByName"){
          let name = data.name;
          delete alltrackConfig[name];
          updateAllTrackConfig();
          broadcastMessage(JSON.stringify({"Status":"ConfList:","Message": Object.keys(alltrackConfig)}),WSserver);
        }
        else if (data.action == "CardMap"){
            cardMap=data.message;
            message = {
                "Status":"CardMap:",
                "Message": data.message
            };
        }
        else if (data.action == "getCardMap"){
            message = {
                "Status":"CardMap:",
                "Message": cardMap
            };
        }
        else if (data.action == "resetCardMap"){
            cardMap={};
            message = {
                "Status":"CardMap:",
                "Message": cardMap
            };
        }
        else if (data.action == "cardChecked"){
            if (hubs.hasOwnProperty(data.message.train)){
                let thishub = hubs[data.message.train];
                let cardIndex = data.message.cardIndex;
                let carpairIDs = [cardIndex];
                trackConfig.cardPairs[cardIndex].forEach(cardpair => {
                  carpairIDs.push(cardpair[1]);
                });
                if (sectionInUse.includes(cardIndex)){
                    for(trainame of Object.keys(hubs)){
                        let hub = hubs[trainame];
                        if (hub != thishub){
                let cardIndex = data.message.cardIndex;
                            if (carpairIDs.includes(hub.lastCard) && cardIndex!=thishub.lastCard){
                                thishub.speed=0;
                                hub.speed=0;
                                setPower(thishub,WSserver);
                                setPower(hub,WSserver);
                            }
                        }
                    }
                }
                if (carpairIDs.includes(thishub.lastCard)){
                    thishub.lastCard=-1;
                    try{
                      modifySectionInUse(carpairIDs,false)
                    }
                    catch{
                      console.log("wrong cardpairs data")
                    }
                }
                else{
                    switchIfYouCan(cardIndex,WSserver);
                    try{
                      modifySectionInUse(thishub.lastCard,false)
                    }
                    catch{
                      console.log("wrong cardpairs data")
                    }
                    try{
                      modifySectionInUse(cardIndex,true)
                    }
                    catch{
                      console.log("wrong cardpairs data")
                    }
                    thishub.lastCard=cardIndex;
                }
                message={"action":"trainOnCard","message":{"train":data.message.train,"cardIndex":cardIndex}}
            }
            else{
                message={"error":"train not found with name " +data.message.train }
            }
        }
/*         else if (data.action == "swtichMotor"){
            message = data.message;
        } */
        else {
            message = data;
        };
    }
    else if(data.hasOwnProperty("motor")){
      try{
        updateSwitchState(data);
      }
      catch{
        console.log("WRONG SWITH DATA")
      }
      message = {
            "Status":"swtiched",
            "Message": data
        };
    }
    else if(data.hasOwnProperty("Status")){
        message = data;
        if (data.Status === 'Connected Hubs:'){
            getTrains(data.Message);
        }
    }
    else{
        message = {
            "UnknownMessage":data
        };
    }
    return JSON.stringify(message);
}

function conf4ESP(){
    var ESPswitchConfig = [];
    for (var id in trackConfig.conf){
        if ("switch" in trackConfig.conf[id]){
            sw = trackConfig.conf[id].switch;
            var swmin = {
                pulse: sw.pulse,
                switched: sw.switched,
                printed: sw.printed,
            };
            ESPswitchConfig.push(swmin)
        }
    }
    return ESPswitchConfig;
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function changeDirection(current,to){
    if (to.includes("Turn")){
      return current.replace("Straight","Turn")
    }
    else{
      return current.replace("Turn","Straight")
    }
}

function setPower(hub,WSserver) {
    const payload = {};
    payload["message"] = hub;
    payload["action"]="setPower";
    broadcastMessage(JSON.stringify(payload),WSserver);
}

function updateSwitchState(data){
    for (id in trackConfig.conf){
        if(trackConfig.conf[id].hasOwnProperty("switch")){
            if (trackConfig.conf[id].switch.index==data.motor){
                trackConfig.conf[id].switch.switched = getKeyByValue(trackConfig.conf[id].switch.pulse,data.pulse);
                trackConfig.conf[id].img[0].src=changeDirection(trackConfig.conf[id].img[0].src,trackConfig.conf[id].switch.switched);
            }
        }
    }
}

function getTrains(Message){
    hubs={};
    trains = Message;
    trains.forEach(train => {
        if ("TRAIN_MOTOR" in train){
            hubs[train.NAME]= {
                speed: 0,
                train: train.NAME,
                MotorPort: train.TRAIN_MOTOR,
                distanceSlow:0,
                colorSlow: 255,
                distance:0,
                color: 255,
                lastCard: -1};
        }
    });
}

function switchIfYouCan(cardID,WSserver){
    let neighbourSwitches = trackConfig.cardPairs[cardID];
    neighbourSwitches.forEach(neighbourSwitch => {
        let sw= trackConfig.conf[neighbourSwitch[2][1]].switch;
        let pulse=-1;
        if (neighbourSwitch[2][0]="s"){
            pulse = sw.pulse["Turn"]
        }
        else if (neighbourSwitch[2][0]="t"){
            pulse = sw.pulse["Straight"]
        }
        if(pulse!=-1){
            const printed = sw.printed=="Original"?false:true;
            const payload = JSON.stringify({"action":"swtichMotor","message":{ motor: sw.index, pulse: pulse, printed }});
            broadcastMessage(payload,WSserver);
        }
    });
}

function modifySectionInUse(card,add){
  let carpairIDs=[card]
  trackConfig.cardPairs[card].forEach(cardpair => {
    carpairIDs.push(cardpair[1]);
  });
  if (add){
    sectionInUse=sectionInUse.concat(carpairIDs)
  }
  else{
    sectionInUse = sectionInUse.filter(a => !carpairIDs.includes(a))
  }
}    

function updateAllTrackConfig(){
  fs.writeFile(path2conf, JSON.stringify(alltrackConfig), (err) => {
    if (err)
      console.log(err);
    else {
      console.log("ConfJSON updated\n");
    }
  });
}

let hubs = {};
let trains = {};
let sectionInUse = [];
let cardMap = {};
 
module.exports = {createWebsocketServer, startServer, createSocketClient, waitForSocketState, trackConfig}