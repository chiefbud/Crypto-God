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

var cryptocurrencyChannel;

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

  function update(updateList, channel) {
    if (tickerData.length !== 0 && updateList.length !== 0) {
      for (coin in updateList) {
        theCoin = updateList[coin];
        selectCoinInfo(theCoin.toLowerCase).then(function(coinData){
          //send the coin data
          console.log("Selecting...");
          var updateMessage;
          ((coinData && coinData.symbol) ? updateMessage = "The current price of " + coinData.symbol.toUpperCase() + ": " + coinData.price_usd + " (" + coinData.price_usd + ")" : updateMessage = "Uh oh! Something went wrong with retrieving the data.");
          bot.sendMessage(tickerData, channel);
        });
      }
    } else {
      //no data to send
      bot.sendMessage("Uh oh! Looks like there's no data for me to send...", channel);
    }
  }

  function selectCoinInfo(coin) {
    console.log(tickerData);
    return new Promise(function(resolve, reject){
      //check tickerData for that coin's symbol
      for (var index in tickerData) {
        if (tickerData[index].symbol && tickerData[index].symbol !== "undefined" && typeof tickerData[index].symbol === 'string' && tickerData[index].symbol.toLowerCase() === coin.toLowerCase){
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
    update(interestList, cryptocurrencyChannel);
  }, slackUpdateInterval * 1000);

  //////////// MANUAL INTERACTION ///////////////
  bot.on(RTM_EVENTS.MESSAGE, function(message){
    var text = message.text,
        channel = message.channel;

    var noUnderstand = "I'm sorry, I didn't understand that. Type *cryptobot help* to see a detail of my commands.";

    if (text && (text.includes(bot_name) || text.includes(bot_id))){
      //update(coins);
      if (text.includes("interest")) {
        if (text.includes("add")) {
          saySuccessMessage();
          //add the interest to interest list
          //var coin = search the to see if the message includes a symbol or name from tickerData
          //addInterest(coin, channel);

          //may need to make this a promise***
        } else if (text.includes("remove") || text.includes("delete")) {
          saySuccessMessage();
          //remove the interest from interest list
          //var coin = search the to see if the message includes a symbol or name from tickerData
          //removeInterest(coin, channel);

          //may need to make this a promise***
        } else if (text.includes("display") || text.includes("show")) {
          //display the current interest list
          displayInterest(channel);
        } else {
          bot.sendMessage(noUnderstand, channel);
        }
      } else if (text.includes("help")) {
        //display the list of functions
        displayHelp(channel);
      } else if (text.includes("update")) {
        update(interestList, channel);
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
      bot.sendMessage("You can ask me the following things:\n *display* interest list \n *add* (coin) to interest list \n *remove* (coin) from interest list", channel);
    }
  });
});
