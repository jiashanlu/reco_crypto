import fetch from "node-fetch";
import { keys, walletTypeList, typeList } from "./config.js";
import {
  toNumber,
  listWeeksEpoch,
  listMonthsEpoch,
  coinFormat,
  fiatFormat,
} from "./Helper.js";
import { coins } from "@bitgo/statics";
import util from "util";
import _ from "lodash";

const apiPath = "https://app.bitgo.com/api/"; // Example path

async function fetchApi(path, prevId) {
  console.log(`${apiPath}${path}${prevId ? "&prevID=" + prevId : ""}`);
  try {
    const res = await fetch(
      `${apiPath}${path}${prevId ? "&prevID=" + prevId : ""}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${keys.BITGO.key}`,
        },
      }
    );
    const json = await res.json();
    return json;
  } catch (err) {
    console.log(err);
  }
}
const listWallets = async (coin) => {
  let walletList = await fetchApi(
    `v2/wallets?coin=${coin}&limit=500&expandCustodialWallet=true&expandBalance=true`
  );
  try {
    walletList = walletList.wallets.map((x) => [
      x.label,
      x.id,
      x.coin,
      x.type,
      x.balanceString,
    ]);
  } catch (e) {
    console.log(e);
  }
  console.log(walletList)
  return walletList;
};
let listTransfersETH = [[], []];
const transfer = async (coin, from) => {
  let coin2 = coin;
  coins.get(coin).family == "eth" ? (coin = "eth") : "";
  console.log(coin2);
  let list = [];
  if (coin == "eth" && listTransfersETH[1].length > 0) {
    list = listTransfersETH[1];
  } else {
    list = await listWallets(coin);
  }
  list = list.map((x) => [x[1], x[0], x[3]]);
  let listTransfers = [];
  if (coin == "eth" && listTransfersETH[0].length > 0) {
    listTransfers = listTransfersETH[0];
  } else {
    for (let i = 0; i < list.length; i++) {
      let wallet = await fetchApi(
        `v2/${coin}/wallet/${list[i][0]}/transfer?${
          from ? `dateGte=${from}&` : ""
        }limit=500&allTokens=true&state=confirmed&state=unconfirmed`
      );
      while (wallet.nextBatchPrevId) {
        listTransfers = [...listTransfers, ...wallet.transfers];
        wallet = await fetchApi(
          `v2/${coin}/wallet/${list[i][0]}/transfer?${
            from ? `dateGte=${from}&` : ""
          }limit=500&allTokens=true&state=confirmed&state=unconfirmed&prevID=${
            wallet.nextBatchPrevId
          }`
        );
      }
      listTransfers = [...listTransfers, ...wallet.transfers];
    }
  }
  if (coin == "eth") {
    listTransfersETH[0] = listTransfers;
    listTransfersETH[1] = list;
  }

  let weekList = listWeeksEpoch(from);
  let monthList = listMonthsEpoch(from);
  monthList = [...monthList, from];
  let actual_date = new Date();
  weekList = [actual_date, ...monthList, from];
  weekList = weekList.sort(function (a, b) {
    return b - a;
  });
  weekList = [...new Set(weekList)];
  listTransfers = listTransfers.filter((x) => x.coin == coin2);
  console.log(listTransfers.length);
  let transfersObj = {};

  let cumul = [0, 0, 0];
  for (let w = 1; w < weekList.length; w++) {
    let dataw = listTransfers.filter(
      (x) =>
        new Date(x.date).getTime() >= weekList[w] &&
        new Date(x.date).getTime() < weekList[w - 1]
    );
    let date = new Date(weekList[w]).toDateString();

    for (let i = 0; i < walletTypeList.length; i++) {
      let datai = dataw.filter((x) => x.walletType == walletTypeList[i]);
      let total_type = 0;
      let total_type_usd = 0;
      for (let j = 0; j < typeList.length; j++) {
        let dataj = datai.filter((x) => x.type == typeList[j]);
        let value = dataj
          .map((x) => toNumber(coin2, x.value))
          .reduce((x, y) => x + y, 0);
        let value_usd = dataj.map((x) => x.usd).reduce((x, y) => x + y, 0);
        let Objtemp = {
          [date]: {
            [walletTypeList[i]]: {
              [typeList[j]]: {
                value: value,
                value_usd: value_usd,
              },
            },
          },
        };
        total_type += value;
        total_type_usd += value_usd;
        cumul[i] = cumul[i] + value;
        _.merge(transfersObj, Objtemp);
      }
      let Objtemp = {
        [date]: {
          [walletTypeList[i]]: {
            total: {
              value: total_type,
              value_usd: total_type_usd,
            },
            cumul: {
              value: cumul[i] || 0,
            },
          },
        },
      };
      _.merge(transfersObj, Objtemp);
    }
  }
  return transfersObj;
};

const listCoin = async () => {
  let bal = await fetchApi(`v2/wallet/balances`);
  bal = bal.balances.filter((x) => x.balanceString != "0").map((x) => x.coin);

  return bal;
};

const balances = async () => {
  let list_coin = await listCoin();
  let balances = {};
  for (let i = 0; i < walletTypeList.length; i++) {
    let bal = await fetchApi(
      `v2/wallet/balances?type=${walletTypeList[i]}`
    );
    for (let y = 0; y < list_coin.length; y++) {
      let balx = await bal.balances.filter((x) => x.coin == list_coin[y]);
      if (balx.length > 0) {
        balances[list_coin[y]] = {
          ...balances[list_coin[y]],
          [walletTypeList[i]]: toNumber(list_coin[y], balx[0].balanceString),
        };
      } else {
        balances[list_coin[y]] = {
          ...balances[list_coin[y]],
          [walletTypeList[i]]: 0,
        };
      }
    }
  }
  return [list_coin, balances];
};

export const report = async (coin, epoch) => {
  const balAll = await balances(); // get all balances > 0 +a list of the coins name
  let coins = [];
  coin ? coins.push(coin) : (coins = balAll[0]); // if no coin take them all
  let object = {};
  let result = {};
  for (let z = 0; z < coins.length; z++) {
    // iterate through coins list
    let objectX = { [coins[z]]: {} };
    let tot_bal = 0;
    for (let i = 0; i < walletTypeList.length; i++) {
      let bal = balAll[1][coins[z]][walletTypeList[i]];
      objectX[coins[z]][walletTypeList[i]] = {
        ...objectX[coins[z]][walletTypeList[i]],
        current_balance: bal,
      };
      tot_bal += bal;
      objectX[coins[z]].total = { current_balance: tot_bal };
    }
    await transfer(coins[z], epoch).then((trans) => {
      objectX[coins[z]].transactions = trans;
    });
    object = { ...object, ...objectX };
  }
  result = {
    list: object,
    epoch: epoch,
    from_date: new Date(epoch).toUTCString(),
  };
  listTransfersETH = [[], []];
  return result;
};

// const test =async (x) => {
//   let test = await listWallets(x)
//   test =test.filter(x => x[0].includes("hot") && x[0].includes("deposit") )
//   console.log(test)
// }
// test("btc")
// transfer("usdt", 1648166401000);
