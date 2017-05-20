//import our dependencies
var RtmClient = require('@slack/client').RtmClient,
    http = require('http'),
    CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS,
    RTM_EVENTS = require('@slack/client').RTM_EVENTS;

//declare some variables
var server_url = process.env.SLACK_BOT_TOKEN || 'http://luminoco.slack.com',
    bot_token = process.env.SLACK_BOT_TOKEN || 'xoxb-186234090695-RoK5KbvTNqnWYXpEsFwqTos5',
    bot_name,
    bot_id;

//make a new bot
var bot = new RtmClient(bot_token);
//initialize the bot's connection
bot.connect(server_url);

//the client will emit an RTM.AUTHENTICATED event on successful connection
bot.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
  bot_name = rtmStartData.self.name;
  bot_id = rtmStartData.self.id;
  console.log('Successfully logged in as %s of team %s.', rtmStartData.self.name, rtmStartData.team.name);
});

//you need to wait for the client to fully connect before you can send messages,
//so let's include everything in this callback
bot.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function() {
  var tickerDataOptions = {
    "method": "GET",
    "hostname": "api.coinmarketcap.com",
    "port": null,
    "path": "/v1/ticker/",
    "headers": {
      "cache-control": "no-cache"
    }
  };

  var interestList = require('./interestlist'),
      tickerData = [];

  function update(updateList) {
    if (tickerData.length !== 0 && updateList.length !== 0) {
      for (coin in list) {
        theCoin = list[coin];
        console.log('Sending an update for %s...', theCoin);
        selectCoinInfo(theCoin).then(function(coinData){
          //send the coin data
          //postMessage("Current price of %s: %s", coinData.symbol, coinData.price);
        });
      }
    } else {
      //reply 'unable to find data'
    }
  }

  function selectCoinInfo(coin) {
    return new Promise(function(resolve, reject){
      //check tickerData for that coin's symbol
      for (var index in tickerData) {
        if (tickerData[index].symbol && tickerData[index].symbol !== "undefined" && typeof tickerData[index].symbol === 'string' && tickerData[index].symbol.toLowerCase() === coin){
          //if/when that coin's symbol is found, return all of that coin's information and stop searching
          resolve(tickerData[index]);
          break;
        }
      }
    });
  }

  function getTickerData() {
    let cmcGET = new Promise(function(resolve, reject) {
      var request = http.request(tickerDataOptions, function(response) {
        var chunks = [];

        response.on("data", function(chunk) {
          chunks.push(chunk);
        });

        response.on("end", function() {
          var data = Buffer.concat(chunks);
          resolve(data.toString());
        });
      });

      request.on('error', (err) => {
        console.log('ERROR CONTACTING THE API! %s', err);
        reject(Error(err));
      });

      request.end();
    });

    cmcGET.then(function(data){
      if(data && data != 'undefined'){
        tickerData = data;
        return data;
      }
    }).catch(function(err){
      console.log(err);
      return 'There was an error! ' + err;
    });
  }

  getTickerData();

  var tickerUpdateInterval = 30,
      slackUpdateInterval = 6 * 60 * 60;

  setInterval(getTickerData, tickerUpdateInterval * 1000);

  //////////// AUTOMATIC INTERACTION ///////////////
  setInterval(function(){
    update(interestList);
  }, slackUpdateInterval * 1000);
  //////////// MANUAL INTERACTION ///////////////
  bot.on(RTM_EVENTS.MESSAGE, function(message){
    var text = message.text,
        channel = message.channel;

    var noUnderstand = "I'm sorry, I didn't understand that. Type *cryptobot help* to see a detail of my commands.";

    if (text.includes(bot_name) || text.includes(bot_id)){
      //update(coins);
      if (text.includes("interest")) {
        if (text.includes("add")) {

        } else if (text.includes("remove") || (text.includes("delete")) {

        } else if (text.includes("display") || text.includes("show")) {

        } else {
          bot.sendMessage(noUnderstand, channel);
        }
      } else if (text.includes) {

      } else if (text.includes) {

      } else if (text.includes) {

      } else {
        bot.sendMessage(noUnderstand, channel);
      }
    }

    function saySuccessMessage(channel) {
      var successMessageList = require('./successmessages'),
          rand = Math.floor((Math.random() * successMessageList.length) + 1)
          successMessage = successMessageList[rand];
      bot.sendMessage(successMessage, channel);
    }

    function addInterest(string, channel) {
      string = string.toUpperCase();
      if (! interestList.includes(string)) {
        interestList.push(string);
        saySuccessMessage(channel);
      } else {
        bot.sendMessage("That coin is already a part of the interest list.", channel);
      }
    }

    function removeInterest(string, channel) {
      string = string.toUpperCase();
      if (! interestList.includes(string)) {
        bot.sendMessage("That coin isn't on the interest list.", channel);
      } else {
        var index = array.indexOf(string);
        ((index > -1) ? interestList.splice(index, 1) : index);
        saySuccessMessage(channel);
      }
    }

    function displayInterest(channel) {
      if (interestList && interestList.length > 0) {
        var concatInterests = interestList.join(", ");
        bot.sendMessage("The current interest list includes: " + concatInterests, channel);
      } else {
        bot.sendMessage("The interest list is empty! :frowning:", channel);
      }
    }

    function displayHelp(channel) {
      bot.sendMessage("You can ask me the following things:\n *display* interest list \n *add* (coin) to interest list \n *remove* (coin) from interest list" + , channel);
    }
  });
});
