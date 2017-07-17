'use strict';

//import our dependencies
var Discord = require('discord.js'),
    http = require('http'),
    fs = require('fs');

//declare some variables that help the bot function
var bot_token = process.env.BOT_TOKEN || 'MzM0NTM3Mzk0MTY0NDY1Njc1.DEwW_g.XURQs1izMN4JdZlBpNL_hjWE9vw',
    bot_name,
    bot_id;

//declare the config file path
var dir = __dirname,
    config = dir + '/config.json',
    interest_list = dir + '/interestlist.json',
    sayings = require('./sayings.json');

//make a new bot object
const bot = new Discord.Client();

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
var dataInterval = setInterval(getTickerData, tickerUpdateInterval * 1000);

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
      if ((parseInt(ticker) + 1) == tickerData.length) {
        resolve(coinList);
      }
    }
  });
}

//the client will emit an RTM.AUTHENTICATED event on successful connection
bot.on('ready', () => {
  bot_name = bot.user.username;
  bot_id = bot.user.id;
  console.log('Successfully logged in as %s. Bot online. Bleep bloop.', bot_name);

  var interestList = require(interest_list);

  function update(updateList, channel) {
    if (tickerData.length !== 0 && updateList.length !== 0) {
      for (var coin in updateList) {
        var updateMessage,
            target = updateList[coin];

        selectCoinInfo(target).then(function(coinInfo){
          ((coinInfo && coinInfo.symbol) ? updateMessage = "*" + coinInfo.symbol.toUpperCase() + "*: " + coinInfo.price_btc + " BTC ($" + coinInfo.price_usd + ") | *" + coinInfo.percent_change_24h + "%* in 24 hours (" + coinInfo.percent_change_1h + "% last hour)." : updateMessage = "Uh oh! Something went wrong with retrieving the data.");
          channel.send(updateMessage);
        }).catch(function(err){
          ((channel) ? channel.send(err) : console.log(err));
        });
      }
    } else {
      //no data to send
      bot.reply("Uh oh! Looks like there's no data for me to send you... coinmarketcap.com might be down or I might be disconnected from their server." );
    }
  }

  function alert(alertList) {
    if (tickerData.length !== 0 && updateList.length !== 0) {
      for (var coin in alertList) {
        var alertMessage,
            target = alertList[coin];

        selectCoinInfo(target).then(function(coinInfo){
          ((coinInfo && coinInfo.symbol) ? alertMessage = "*ALERT*: It looks like " + coinInfo.symbol.toUpperCase() + " is making a large shift in price (" + coinInfo.percent_change_1h + "% last hour)." : updateMessage = "Uh oh! Something went wrong with retrieving the data.");
          channel.send(alertMessage );
        }).catch(function(err){
          ((channel) ? channel.send(err) : console.log(err));
        });
      }
    } else {
      //no data to send
      channel.send("Uh oh! Looks like there's no data for me to send you... coinmarketcap.com might be down or I might be disconnected from their server.");
    }
  }

  //////////// AUTOMATIC INTERACTION ///////////////

  //This commented function call is not functioning yet as each user has a specific channel ID and you can't simply send messages to a user.id
  /*
  bot.on(RTM_EVENTS.TEAM_JOIN, function(user){
    bot.sendMessage("Welcome to the team! My name is " + bot_name + " and I'm here to keep you updated on cryptocurrency prices. Allow me to send you a list of my commands.", user.id);
    displayHelp(user.id);
  });
  */

  var botConfig = require(config);

  var automaticUpdatesEnabled = botConfig.updates.enabled,
      updateInterval = botConfig.updates.interval,
      updateChannel = botConfig.updates.channel,
      alertsEnabled = botConfig.alerts.enabled,
      alertThreshold = botConfig.alerts.threshold,
      automaticUpdates,
      automaticAlerts;

  function enableAutomaticUpdates(bool){
    ((bool === true) ? automaticUpdatesEnabled = true : automaticUpdatesEnabled = false);
    saveConfig();
  }

  function setUpdateInterval(interval) {
    return new Promise(function(resolve, reject){
      if (typeof interval === 'number') {
        updateInterval = interval * 60 * 60; //convert to hours
        saveConfig();

        clearInterval(automaticUpdates);
        automaticUpdates = null;
        automaticUpdates = setInterval(function(){
          ((interestList && updateChannel) ? update(interestList, updateChannel) : interestList);
        }, updateInterval * 1000);
        resolve(true);
      } else {
        reject("Sorry, I didn't see a number.");
      }
    });
  }

  function setUpdateChannel(channel){
    updateChannel = channel;
    saveConfig();
  }

  function enableAlerts(bool){
    ((bool) ? alertsEnabled = true : alertsEnabled = false);
    saveConfig();
  }

  function setAlertThreshold(threshold) {
    return new Promise(function(resolve, reject){
      if (typeof threshold === 'number') {
        alertThreshold = threshold;
        saveConfig();

        resolve(true);
      } else {
        reject("Sorry, I didn't see a number.");
      }
    });
  }

  function saveConfig(){
    var config_object = {
      bot: {
        id: bot_id,
        name: bot_name
      },
      updates: {
        enabled: automaticUpdatesEnabled,
        interval: updateInterval,
        channel: updateChannel
      },
      alerts: {
        enabled: alertsEnabled,
        threshold: alertThreshold,
      }
    };

    fs.writeFile(config, JSON.stringify(config_object), 'utf8', function(){});
  }

  function saveInterestList() {
    fs.writeFile(interest_list, JSON.stringify(interestList), function(){});
  }

  //////////// MANUAL INTERACTION ///////////////
  bot.on('message', function(payload){
    var noUnderstand = "I'm sorry, I didn't understand what you asked. Type *cryptobot help* to see a detail of my commands.";

    var message = payload.content,
        author = payload.author,
        channel = payload.channel;

    if (message && (message.includes(bot_name.toLowerCase()) || message.includes(bot_id))) {
      //ENABLE/DISABLE
      if ((message.includes("enable") || message.includes("disable")) && ! (message.includes("are") || message.includes("is"))) {
        if (message.includes("up")) {
          ((message.includes("enable")) ? enableAutomaticUpdates(true) : enableAutomaticUpdates(false));
          payload.reply(saySuccessMessage());
        } else if (message.includes("alerts")) {
          ((message.includes("enable")) ? enableAlerts(true) : enableAlerts(false));
          payload.reply(saySuccessMessage());
        }
      //CREATE
      } else if (message.includes("add")) {
        if (message.includes("interest")) {
          addInterest(message, channel);
        } else {
          payload.reply(noUnderstand);
        }
      //READ
    } else if (message.includes("display") || message.includes("show") || message.includes("what") || message.includes("is") || message.includes("are")) {
        if (message.includes("price") || message.includes("prices")) {
          if (message.includes("interest")) {
            ((interestList.length > 0) ? update(interestList, channel) : payload.reply("It looks like your interest list is currently empty! *Add* to it by typing '@cryptobot add BTC to the interest list.'"));
          } else {
            //parse text for all coin references
            parseCoins(message).then(function(parsedCoins){
              ((parsedCoins.length > 0) ? update(parsedCoins, channel) : payload.reply("Sorry, I didn't recognize any of those coin symbols. I encourage you to try again."));
            }).catch(function(err){
              payload.reply(err);
            });
          }
        } else if (message.includes("interest")) {
          ((interestList.length > 0) ? payload.reply(displayInterests(channel)) : payload.reply("It looks like your interest list is currently empty! *Add* to it by typing '@cryptobot add BTC to the interest list.'"));
        } else if (message.includes("update")) {
          if (message.includes("interval") || message.includes("period")) {
            payload.reply("The current automatic update interval is set to " + (updateInterval / 60 / 60) + " hours." );
          } else if (message.includes("channel")) {
            payload.reply("The current channel receiving the automatic updates and rapid price increase alerts is " + updateChannel + "." );
          } else if (message.includes("enabled")) {
            ((automaticUpdatesEnabled) ? payload.reply("Automatic updates are indeed enabled! You'll be updated every " + (updateInterval / 60 / 60) + " hours." ) : payload.reply("It seems as though automatic updates are disabled." ));
          } else {
            payload.reply(noUnderstand);
          }
        } else if (message.includes("alerts")) {
          if (message.includes("threshold") || message.includes("amount")) {
            payload.reply("The current pump and dump threshold is set to " + alertThreshold + "% in one hour.");
          } else if (message.includes("channel")) {
            payload.reply("The current channel receiving the rapid price increase alerts and automatic updates is " + updateChannel + "." );
          } else if (message.includes("enabled")) {
            ((alertsEnabled) ? payload.reply("Pump and dump alerts are indeed enabled! You'll be updated when a coin reaches " + alertThreshold + "% increase/decrease in over one hour." ) : payload.reply("It seems as though automatic updates are disabled." ));
          } else {
            payload.reply(noUnderstand);
          }
        } else {
          payload.reply(noUnderstand);
        }
      //UPDATE
      } else if (message.includes("update") || message.includes("set")) {
        if (message.includes("alert")) {
          if (alertsEnabled === false) {
            payload.reply("Uh oh! It looks like pump/dump alerts are disabled. To enable them, type '@cryptobot enable alerts'." );
          } else if (message.includes("channel") || message.includes("location"))  {
            setUpdateChannel(channel);
            saySuccessMessage(channel, "I set the update and alerts channel to " + channel + ". That's where you'll get updated automatically from now on.");
          } else if (message.includes("threshold"))  {
            parseFloatComplex(message).then(function(num){
              setAlertThreshold(num).then(function(resolved){
                saySuccessMessage(channel, "You'll be automagically updated on coins that reach " + num + "% increase/decrease in one hour from now on.");
              }).catch(function(err){
                payload.reply(err);
              });
            }).catch(function(err){
              payload.reply(err);
            });
          } else {
            payload.reply(noUnderstand);
          }
        } else if (message.includes("update")) {
          if (automaticUpdatesEnabled === false) {
            payload.reply("Uh oh! It looks like automatic updates on your favorite coins are disabled. To enable them, type '@cryptobot enable updates'." );
          } else if (message.includes("channel") || message.includes("location"))  {
            setUpdateChannel(channel);
            saySuccessMessage(channel, "I set the update channel to " + channel + ". That's where you'll get updated automatically from now on.");
          } else if (message.includes("interval"))  {
            parseFloatComplex(message).then(function(num){
              setUpdateInterval(num).then(function(resolved){
                saySuccessMessage(channel, "You'll be automagically updated on your coins interests every " + num + " hours from now on.");
              }).catch(function(err){
                payload.reply(err);
              });
            }).catch(function(err){
              payload.reply(err);
            });
          } else {
            payload.reply(noUnderstand);
          }
        } else {
          payload.reply(noUnderstand);
        }
      //DELETE
      } else if (message.includes("remove") || message.includes("delete")) {
        if (message.includes("interest")) {
          removeInterest(message, channel);
        }
      //HELP
      } else if (message.includes("help")) {
        //display the list of functions
        payload.reply(displayHelp());
      //GREETINGS
      } else if (message.includes("hello") || message.includes("greetings") || message.includes("yo")){
        payload.reply(sayGreeting());
      } else {
        payload.reply(noUnderstand);
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

    function parseFloatComplex(message) {
      return new Promise(function(resolve, reject){
        if (/\d+/.test(message)) {
          minusBotReference(message).then(function(clean){
            var num;
            ((/.\d+/.test(clean)) ? num = clean.match(/.\d+/) : num = clean.match(/\d+/)); //check for decimals representing hours, too
            resolve(parseFloat(num[0]));
          }).catch(function(err){
            reject(err);
          });
        } else {
          reject("It looks like I was not supplied with a real number.");
        }
      });
    }

    function minusBotReference(str){
      return new Promise(function(resolve, reject){
        if (str && typeof str === 'string' && text !== "") {
          var re_id = new RegExp(bot_id.toString(), "g"),
              re_name = new RegExp(bot_name.toString(), "g");
          str = str.replace(re_id, "");
          str = str.replace(re_name, "");
          resolve(str);
        } else {
          reject("Hmm... there seems to be no readable text here. Strange.");
        }
      });
    }

    function sayGreeting(channel, addition) {
      var greetingList = sayings.greeting,
          rand = Math.floor((Math.random() * greetingList.length)),
          greeting = greetingList[rand];
      ((addition) ? greeting = greeting + " " + addition : greeting);
      return greeting;
    }

    function saySuccessMessage(addition) {
      var successMessageList = sayings.success,
          rand = Math.floor((Math.random() * successMessageList.length)),
          successMessage = successMessageList[rand];
      ((addition) ? successMessage = successMessage + " " + addition : successMessage);
      return successMessage;
    }

    function sayErrorMessage(addition) {
      var errorMessageList = sayings.error,
          rand = Math.floor((Math.random() * successMessageList.length)),
          errorMessage = errorMessageList[rand];
      ((addition) ? errorMessage = errorMessage + " " + addition : errorMessage);
      return errorMessage;
    }

    function addInterest(string, channel) {
      //parse text for all coin references
      parseCoins(string).then(function(parsedCoins){
        for (var coin in parsedCoins) {
          //add the parsed coins to the list (if it's not already there)
          ((interestList.indexOf(parsedCoins[coin]) > -1) ? payload.reply(parsedCoins[coin] + " is already on the interest list." ) : interestList.push(parsedCoins[coin]));
          if ((parseInt(coin) + 1) == parsedCoins.length) {
            //update the user on the last cycle of the loop
            channel.send(saySuccessMessage("I made sure that the coins you mentioned are now the interest list. You can type '@cryptobot show me the interest list' to confirm."));
            //... and save the new interest list as 'interestlist.json'
            saveInterestList();
          }
        }
      }).catch(function(err){
        channel.send(err);
      });
    }

    function removeInterest(string) {
      //parse text for all coin references
      parseCoins(string).then(function(parsedCoins){
        for (var coin in parsedCoins) {
          //remove the parsed coins from the list
          var index = interestList.indexOf(parsedCoins[coin]);
          ((interestList.indexOf(parsedCoins[coin]) > -1) ? interestList.splice(index, 1) : payload.reply("Hmm, I don't see " + parsedCoins[coin] + " on the list." ));
          if ((parseInt(coin) + 1) == parsedCoins.length) {
            //update the user on the last cycle of the loop
            channel.send(saySuccessMessage("I can assure you that the coins you mentioned are not on the interest list anymore. You can type '@cryptobot show me the interest list' to confirm."));
            //... and save the new interest list as 'interestlist.json'
            saveInterestList();
          }
        }
      }).catch(function(err){
        channel.send(err);
      });
    }

    function displayInterests(channel) {
      if (interestList && interestList.length > 0) {
        var concatInterests = interestList.join(", ");
        return "The current interest list includes: " + concatInterests + ".";
      } else {
        return "It looks like the interest list is empty! *Add* to it by typing '@cryptobot add BTC to the interest list'.";
      }
    }

    function displayHelp() {
      return "You can ask me the following things:\n *enable* or *disable* updates, alerts\n *add* (coin) to interest list\n *display/show/what/is/are* interest list, updates enabled, update interval, update channel, alerts enabled, alert threshold, alert channel, (coin) price, interest list prices\n *update/set* (hours) update interval, update channel, (percent) alert threshold, alert channel\n *remove/delete* (coin) from interest list\n *enable* automatic updates, price alerts\n *help* show this information panel";
    }
  });
});

//log the bot into the server
bot.login(bot_token);
