var express = require('express');
var bodyParser = require('body-parser');

var app = express();
var port = process.env.PORT || 3030;

app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(req, res){
  res.status(200).send('CryptoBot listening service online. Bleep bloop.')
});

app.listen(port, function(){
  console.log('Listening on port %s.', port);
});

app.post('/check', function(req, res, next){
  var userName = req.body.user_name;
  var botPayload = {
    text: 'Bleep bloop.'
  }

  if (userName !== 'slackbot'){
    return res.status(200).json(botPayload);
  } else {
    return res.status(200).end();
  }
});
