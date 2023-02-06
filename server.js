import express from "express";
import { report} from "./Bitgo.js";
import { toEpochUTC } from "./Helper.js";
import util from "util";
import flatten from "flat"
let result = {}
var app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", function (req, res) {
  res.render("index",{ title : "api-reco"});
});

app.get("/get", async (req, res) => {
  // Prepare output in JSON format
  let result = {};
  let response = {
    date: req.query.date,
    coin: req.query.coin,
  };
  console.log(response.date, response.coin);
  result = await report(response.coin, toEpochUTC(response.date));
  let fla = JSON.stringify(flatten(result))
  console.log(util.inspect(result, false, null, true));
  res.render("result",{result:result,title : "result", fla:fla});
});

var server = app.listen(8087,'0.0.0.0', function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening at http://%s:%s", host, port);
});
