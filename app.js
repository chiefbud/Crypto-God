'use strict';

//import our dependencies
var RtmClient = require('@slack/client').RtmClient,
    CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS,
    RTM_EVENTS = require('@slack/client').RTM_EVENTS,
    http = require('http'),
    fs = require('fs');

//declare some variables that help the bot function
var server_url = process.env.SLACK_BOT_TOKEN || 'http://luminoco.slack.com',
    bot_token = process.env.SLACK_BOT_TOKEN || 'xoxb-186234090695-RoK5KbvTNqnWYXpEsFwqTos5',
    bot_name,
    bot_id;

//make a new bot object
var bot = new RtmClient(bot_token);
//initialize the bot's connection to the server
bot.connect(server_url);

//let's get the coin data from coinmarketcap.com
var tickerUpdateInterval = 30,
    tickerData = [],
    tickerDataOptions = {
      "method": "GET",
      "hostname": "api.coinmarketcap.com",
      "port": null,
      "path": "/v1/ticker/",
      "headers": {
        "cache-control": "no-cache"
      }
    };

//get the data initially and continue to refresh it every 'tickerUpdateInterval' seconds
getTickerData();
setInterval(getTickerData, tickerUpdateInterval * 1000);

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
    if (data && data != 'undefined') {
      tickerData = data;
      tickerData = JSON.parse(tickerData);
      return data;
    }
  }).catch(function(err){
    console.log(err);
    return 'There was an error! ' + err;
  });
}

function selectCoinInfo(coin) {
  return new Promise(function(resolve, reject) {
    //check tickerData for that coin's symbol
    for (var ticker in tickerData) {
      if (tickerData[ticker].symbol && tickerData[ticker].symbol !== "undefined" && typeof tickerData[ticker].symbol === 'string' && tickerData[ticker].symbol.toLowerCase() === coin.toLowerCase()){
        //if/when that coin's symbol is found, return all of that coin's information and stop searching
        resolve(tickerData[ticker]);
        break;
      }
    }
  });
}

function getCoinList() {
  return new Promise(function(resolve, reject) {
    ((!tickerData) ? reject("There is no data for me to work with!") : tickerData);

    var coinList = [];
    for (var ticker in tickerData) {
      coinList.push(tickerData[ticker].symbol);
      if ((ticker+1) == tickerData.length) {
        resolve(coinList);
      }
    }
  });
}

//the client will emit an RTM.AUTHENTICATED event on successful connection
bot.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function(rtmStartData) {
  bot_name = rtmStartData.self.name;
  bot_id = rtmStartData.self.id;
  console.log('Successfully logged in as %s of team %s. Bot online. Bleep bloop.', rtmStartData.self.name, rtmStartData.team.name);
});

//you need to wait for the client to fully connect before you can send messages,
//so let's include everything in this callback's scope
bot.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function() {
  var interestList = require('./interestlist'),
      updateChannel;

  function update(updateList, channel) {
    if (tickerData.length !== 0 && updateList.length !== 0) {
      for (var coin in updateList) {
        var updateMessage,
            target = updateList[coin];

        selectCoinInfo(target).then(function(coinInfo){
          ((coinInfo && coinInfo.symbol) ? updateMessage = "The current price of " + coinInfo.symbol.toUpperCase() + " is " + coinInfo.price_btc + " BTC ($" + coinInfo.price_usd + ")" : updateMessage = "Uh oh! Something went wrong with retrieving the data.");
          bot.sendMessage(updateMessage, channel);
        }).catch(function(err){
          ((channel) ? bot.sendMessage(err, channel) : console.log(err));
        });
      }
    } else {
      //no data to send
      bot.sendMessage("Uh oh! Looks like there's no data for me to send...", channel);
    }
  }

  //////////// AUTOMATIC INTERACTION ///////////////
  var slackUpdateInterval,
      slackAlertThreshold,
      automaticUpdates = setInterval(function(){
        ((interestList && updateChannel) ? update(interestList, updateChannel) : interestList);
      }, slackUpdateInterval * 1000);

  setUpdateInterval(6); //default update interval is 6 hours
  setAlertThreshold(2);

  bot.on(RTM_EVENTS.TEAM_JOIN, function(user){
    bot.sendMessage("Welcome to the team! My name is " + bot_name + " and I'm here to keep you updated on cryptocurrency prices. Allow me to send you a list of my commands.");
    displayHelp(user.id);
  });

  function setUpdateInterval(interval) {
    return new Promise(function(resolve, reject){
      if (typeof interval === 'number') {
        slackUpdateInterval = interval * 60 * 60;
        clearInterval(automaticUpdates);
        automaticUpdates = null;
        automaticUpdates = setInterval(function(){
          ((interestList && updateChannel) ? update(interestList, updateChannel) : interestList);
        }, slackUpdateInterval * 1000);
        resolve(true);
      } else {
        reject("Sorry, I didn't see a number.");
      }
    });
  }

  function setAlertThreshold(threshold) {
    return new Promise(function(resolve, reject){
      if (typeof threshold === 'number') {
        slackAlertThreshold = threshold;
        resolve(true);
      } else {
        reject("Sorry, I didn't see a number.");
      }
    });
  }

  //////////// MANUAL INTERACTION ///////////////
  bot.on(RTM_EVENTS.MESSAGE, function(message){
    var text = message.text,
        author = message.user,
        channel = message.channel;

    var noUnderstand = "I'm sorry, I didn't understand what you asked " + author + ". Type *cryptobot help* to see a detail of my commands.";

    function notValidYet(channel){
      bot.sendMessage("That functionality hasn't been added yet, but I understand what you're saying. Let's remember to walk before we run, dude. Bleep bloop.", channel);
    }

    if (text && (text.includes("!" + bot_name) || text.includes(bot_id)) && author !== bot_name) {
      //CREATE
      if (text.includes("add")) {
        if (text.includes("interest")) {
          addInterest(text, channel);
        } else {
          bot.sendMessage(noUnderstand, channel);
        }
      //READ
      } else if (text.includes("display") || text.includes("show") || text.includes("what")) {
        if (text.includes("price") || text.includes("prices")) {
          if (text.includes("interest")) {
            update(interestList, channel);
          } else {
            //parse text for all coin references
            parseCoins(text).then(function(parsedCoins){
              console.log(parsedCoins);
              update(parsedCoins, channel);
            }).catch(function(err){
              bot.sendMessage(err, channel);
            });
          }
        } else if (text.includes("interest")) {
          bot.sendMessage("The current coins of interest are: " + interestList.join(", ") + ".", channel);
        } else if (text.includes("update")) {
          if (text.includes("interval")) {
            bot.sendMessage("The current automatic update interval is set to " + (slackUpdateInterval / 60 / 60) + " hours.", channel);
          } else if (text.includes("channel")) {
            bot.sendMessage("The current channel receiving the automatic updates is " + updateChannel + ".", channel);
          } else {
            bot.sendMessage(noUnderstand, channel);
          }
        } else {
          bot.sendMessage(noUnderstand, channel);
        }
      //UPDATE
      } else if (text.includes("update") || text.includes("set")) {
        if (text.includes("interval")) {
          parseIntComplex(text).then(function(int){
            setUpdateInterval(int).then(function(resolved){
              saySuccessMessage(channel, "You'll be automagically updated on your coins interests every " + int + " hours from now on.");
            }).catch(function(err){
              bot.sendMessage(err, channel);
            });
          }).catch(function(err){
            bot.sendMessage(err, channel);
          });

        } else if (text.includes("channel")) {
          setUpdateChannel(channel);
          bot.sendMessage("This channel will be the channel that gets automatic interest updates every " + slackUpdateInterval + " hours.", channel);
        } else {
          bot.sendMessage(noUnderstand, channel);
        }
      //DELETE
      } else if (text.includes("remove") || text.includes("delete")) {
        if (text.includes("interest")) {
          removeInterest(text, channel);
        }
      //HELP
      } else if (text.includes("help")) {
        //display the list of functions
        displayHelp(channel);
      } else {
        bot.sendMessage(noUnderstand, channel);
      }
    }

    function parseCoins(message) {
      return new Promise(function(resolve, reject){
        getCoinList().then(function(coinList){
          var words = message.split(" "),
              coinsMentioned = [];
          for (var word in words) {
            var useable = words[word].toUpperCase();
            if (coinList.indexOf(useable) > -1) {
              coinsMentioned.push(useable);
            }
            if ((parseInt(word) + 1) == words.length) {
              resolve(coinsMentioned);
            }
          }
        }).catch(function(err){
          reject(err);
        });
      });
    }

    function parseIntComplex(message) {
      return new Promise(function(resolve, reject){
        if (/\d+/.test(message)) {
          minusBotReference(message).then(function(clean){
            var num = clean.match(/\d+/);
            resolve(parseInt(num[0]));
          }).catch(function(err){
            reject(err);
          });
        } else {
          reject("It looks like I was not supplied with a real number.");
        }
      });
    }

    function minusBotReference(text){
      return new Promise(function(resolve, reject){
        if (text && typeof text === 'string' && text !== "") {
          var re_id = new RegExp(bot_id.toString(), "g"),
              re_name = new RegExp(bot_name.toString(), "g");
          text = text.replace(re_id, "");
          text = text.replace(re_name, "");
          resolve(text);
        } else {
          reject("Hmm... there seems to be no readable text here. Strange.");
        }
      });
    }

    function saySuccessMessage(channel, addition) {
      var successMessageList = require('./successmessages'),
          rand = Math.floor((Math.random() * successMessageList.length)),
          successMessage = successMessageList[rand];
      ((addition) ? successMessage = successMessage + " " + addition : successMessage);
      bot.sendMessage(successMessage, channel);
    }

    function addInterest(string, channel) {
      //parse text for all coin references
      parseCoins(string).then(function(parsedCoins){
        for (var coin in parsedCoins) {
          //add the parsed coins to the list (if it's not already there)
          ((interestList.indexOf(parsedCoins[coin]) > -1) ? bot.sendMessage(parsedCoins[coin] + " is already on the interest list.", channel) : interestList.push(parsedCoins[coin]));
          if ((parseInt(coin) + 1) == parsedCoins.length) {
            //update the user on the last cycle of the loop
            saySuccessMessage(channel, "I made sure that " + parsedCoins.join(", ") + " are the interest list.");
            //... and save the new interest list as 'interestlist.json'
            fs.writeFile('./interestlist.json', JSON.stringify(interestList), function(){});
          }
        }
      }).catch(function(err){
        bot.sendMessage(err, channel);
      });
    }

    function removeInterest(string, channel) {
      //parse text for all coin references
      parseCoins(string).then(function(parsedCoins){
        for (var coin in parsedCoins) {
          //remove the parsed coins from the list
          var index = interestList.indexOf(parsedCoins[coin]);
          ((interestList.indexOf(parsedCoins[coin]) > -1) ? interestList.splice(index, 1) : bot.sendMessage("Hmm, I don't see " + parsedCoins[coin] + " on the list.", channel));
          if ((parseInt(coin) + 1) == parsedCoins.length) {
            //update the user on the last cycle of the loop
            saySuccessMessage(channel, "I can assure you that the coins you mentioned are not on the interest list anymore.");
            //... and save the new interest list as 'interestlist.json'
            fs.writeFile('./interestlist.json', JSON.stringify(interestList), function(){});
          }
        }
      }).catch(function(err){
        bot.sendMessage(err, channel);
      });
    }

    function displayInterest(channel) {
      if (interestList && interestList.length > 0) {
        var concatInterests = interestList.join(", ");
        bot.sendMessage("The current interest list includes: " + concatInterests, channel);
      } else {
        bot.sendMessage("The interest list is empty! :frowning:", channel);
      }
    }

    function setUpdateChannel(channel){
      updateChannel = channel;
      saySuccessMessage(channel);
    }


    function displayHelp(channel) {
      bot.sendMessage("You can ask me the following things:\n *add* (coin) to interest list \n *display/show* interest list, update interval, update channel, (coin) price \n *update/set* (time) update interval, (channel) update channel \n *remove/delete* (coin) from interest list \n *help* show this information panel", channel);
    }
  });
});
