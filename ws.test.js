const WebSocket = require('ws');

let WSport = 8080;
const functions = require("./wsFunctions");
const startServer = functions.startServer;
const createSocketClient = functions.createSocketClient;
const waitForSocketState = functions.waitForSocketState;
const fs = require('fs')
const path2conf = '../.././trackConfigs.json'
let alltrackConfig = {};
let trackConfigDefault = {};
let trackConfig = {};

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
describe("WebSocket Server", () => {
    let server;
    beforeAll(async () => {
      server = await startServer(WSport);
    });
    afterAll(() => server.close());

    test("Server answer on not JSON message", async () => {
        const [client, messages] = await createSocketClient(WSport, 1);
        const notJSONtext = "This is NOT a JSON message";
        client.send(notJSONtext);
        await waitForSocketState(client, client.CLOSED);
        const [responseMessage] = messages;
        expect(responseMessage).toBe(JSON.stringify({"notJSON":notJSONtext}));
    });

    test("Server answer on JSON but undefined message", async () => {
        const [client, messages] = await createSocketClient(WSport, 1);
        const notDefinedJSONtext = {"not defined":"json message"};
        client.send(JSON.stringify(notDefinedJSONtext));
        await waitForSocketState(client, client.CLOSED);
        const [responseMessage] = messages;
        expect(JSON.parse(responseMessage)).toEqual({"UnknownMessage":notDefinedJSONtext});
    });

    test("Test getConfig action", async () => {
        const [client, messages] = await createSocketClient(WSport, 1);
        const actionGetConfigtext = {"action":"getConfig"};
        client.send(JSON.stringify(actionGetConfigtext));
        await waitForSocketState(client, client.CLOSED);
        const [responseMessage] = messages;
        console.log(trackConfig)
        expect(JSON.parse(responseMessage)).toEqual({
            "Status":"TrackConfig:",
            "Message": trackConfig
        });
    });

    test("Test switch track", async () => {
        const [client, messages] = await createSocketClient(WSport, 2);
        const actionSwitchMotor = {"action":"swtichMotor","message":{"motor":1,"pulse":240,"printed":false}};
        client.send(JSON.stringify(actionSwitchMotor));
        const motorSwitched = {"motor":1,"pulse":240,"printed":false};
        client.send(JSON.stringify(motorSwitched));
        await waitForSocketState(client, client.CLOSED);
        const [ASW,SMS] = messages;
        expect(JSON.parse(ASW)).toEqual(actionSwitchMotor);
        expect(JSON.parse(SMS)).toEqual({"Status":"swtiched","Message":motorSwitched});
    });

    test("Card test, switch track, stop train", async () => {
        const [client, messages] = await createSocketClient(WSport, 9);
        const connectedHubs = {"Status":"Connected Hubs:","Message":[{"NAME":"Yellow","TRAIN_MOTOR":0,"traincolor":6,"LIGHT":1},{"NAME":"Green","TRAIN_MOTOR":0,"traincolor":1}]};
        client.send(JSON.stringify(connectedHubs));
        const cardmap = {"action":"CardMap","message":{"A1":0,"A2":1,"A3":2,"A4":3,"A5":4,"A6":5,"A7":6,"A8":7,"A9":8,"A10":9,"A11":10,"A12":11,"A13":12,"A14":13,"A15":14,"A16":15,"A17":16,"A18":17,"A19":18,"A20":19,"A21":20,"A22":21,"A23":22,"A24":23}};
        client.send(JSON.stringify(cardmap));
        const cardcheck1 = {"action":"cardChecked","message":{"train":"Yellow","cardIndex":0}};
        client.send(JSON.stringify(cardcheck1));
        const cardcheck1b = {"action":"cardChecked","message":{"train":"Green","cardIndex":11}};
        client.send(JSON.stringify(cardcheck1b));
        const cardcheck1c = {"action":"cardChecked","message":{"train":"Yellow","cardIndex":0}};
        client.send(JSON.stringify(cardcheck1c));
        const cardcheck2 = {"action":"cardChecked","message":{"train":"Green","cardIndex":11}};
        client.send(JSON.stringify(cardcheck2));
        const cardcheck3 = {"action":"cardChecked","message":{"train":"Yellow","cardIndex":17}};
        client.send(JSON.stringify(cardcheck3));
        await waitForSocketState(client, client.CLOSED);
        const [CH,CM,SM1,TOC1,ST1,ST2,SM2,TOC2,TOC3,TOC4,SM3,SM4,SM5,TOC5] = messages;
        // set up hubs and cardmap
        expect(JSON.parse(CH)).toEqual(connectedHubs);
        expect(JSON.parse(CM)).toEqual({"Status":"CardMap:","Message":{"A1":0,"A2":1,"A3":2,"A4":3,"A5":4,"A6":5,"A7":6,"A8":7,"A9":8,"A10":9,"A11":10,"A12":11,"A13":12,"A14":13,"A15":14,"A16":15,"A17":16,"A18":17,"A19":18,"A20":19,"A21":20,"A22":21,"A23":22,"A24":23}});
        // train yellow on card and switch track
        expect(JSON.parse(SM1)).toEqual({"action":"swtichMotor","message":{"motor":1,"pulse":240,"printed":false}});
        expect(JSON.parse(TOC1)).toEqual({"action":"trainOnCard","message":{"train":"Yellow","cardIndex":0}});
        // train green on card and switch track and stop trains
        expect(JSON.parse(ST1)).toEqual({"message":{"speed":0,"train":"Green","MotorPort":0,"distanceSlow":0,"colorSlow":255,"distance":0,"color":255,"lastCard":-1},"action":"setPower"});
        expect(JSON.parse(ST2)).toEqual({"message":{"speed":0,"train":"Yellow","MotorPort":0,"distanceSlow":0,"colorSlow":255,"distance":0,"color":255,"lastCard":0},"action":"setPower"});
        expect(JSON.parse(SM2)).toEqual({"action":"swtichMotor","message":{"motor":2,"pulse":420,"printed":false}});
        expect(JSON.parse(TOC2)).toEqual({"action":"trainOnCard","message":{"train":"Green","cardIndex":11}});
        // train yellow go back and do nothing
        expect(JSON.parse(TOC3)).toEqual({"action":"trainOnCard","message":{"train":"Yellow","cardIndex":0}});
        // train green on card do nothing
        expect(JSON.parse(TOC4)).toEqual({"action":"trainOnCard","message":{"train":"Green","cardIndex":11}});
        // train yelllow on card and switch 3 tracks
        expect(JSON.parse(SM3)).toEqual({"action":"swtichMotor","message":{"motor":5,"pulse":380,"printed":true}});
        expect(JSON.parse(SM4)).toEqual({"action":"swtichMotor","message":{"motor":7,"pulse":280,"printed":true}});
        expect(JSON.parse(SM5)).toEqual({"action":"swtichMotor","message":{"motor":4,"pulse":280,"printed":true}});
        expect(JSON.parse(TOC5)).toEqual({"action":"trainOnCard","message":{"train":"Yellow","cardIndex":17}});
    });
  });