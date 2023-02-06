import { coins } from '@bitgo/statics';

export const toEpochUTC = (date) => {
  let dateStr = new Date(`${date} 00:00:01 GMT`);
  let timestamp = dateStr.getTime();
  return timestamp;
};

export const toNumber = (coin, amountString) => {
  let decimal = coins.get(coin).decimalPlaces
  let result = amountString / Math.pow(10, decimal);
  return result;
    }

export const listWeeksEpoch = (start) =>{
  let list = []
  let now = toEpochUTC(new Date().toDateString())+86400000
  while (now>start+7*86400000){
    let dayNumber= (new Date(now)).getUTCDay() - 1
    let Monday = new Date(now)-((dayNumber==0 ? 7 : dayNumber) *86400000)
    list.push(Monday)
    now = (new Date(Monday)).getTime()
  }
  return list
}

export const listMonthsEpoch = (start) => {
  let list = []
  let now = toEpochUTC(new Date().toDateString())
  let first = new Date(now).setDate(1)
  if (first > start) {
    list.push(first)
    while (first  > start) {
      first = new Date(first - 86400000).setDate(1)
      list.push(first)
    }
  }
  list.pop()
  return list
}

export const fiatFormat = { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
}

export const coinFormat = { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 4 
}
