const events = require('events');
const fs = require('fs');
const readline = require('readline');

class Stock {
  constructor() {
    this.name = null;
    this.date = null;
    this.notes = null;
    this.value = null;
    this.change = null;
  }

  toString() {
    return JSON.stringify(this);
  }

  static createByLine(line) {
    let arr = line.split(',');
    let stock = new Stock();
    stock.name = arr[0];
    stock.date = arr[1];
    stock.notes = arr[2];
    stock.value = parseFloat(arr[3]);
    stock.change = arr[4];
    return stock;
  }
}

class StockBatchReader extends events.EventEmitter {
  constructor() {
    super();
    this.file = 'values.csv';
    this.batchSize = 100;
    this.batchIndex = 0;
    this.batchCount = 0;
    this.stocks = [];
  }

  async process() {
    const rl = readline.createInterface({
      input: fs.createReadStream(this.file),
      crlfDelay: Infinity
    });
    rl.on('line', (line) => {
      this.batchIndex++;

      // Skip the 1st line
      if(this.batchIndex === 1) {
        return;
      }

      this.stocks.push(Stock.createByLine(line));

      // It's time to emit a batch event and free up memory
      if(this.batchIndex % this.batchSize === 0) {
        this.batchCount++;
        this.emit('batch', this.stocks);
        this.stocks = [];
      }
    });

    await events.once(rl, 'close');

    // A last bunch of stocks should be handled
    if (this.stocks.length > 0) {
      this.batchCount++;
      this.emit('batch', this.stocks);
      this.stocks = [];
    }

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`Done. Memory usage approximately is: ${Math.round(used * 100) / 100} MB`);
  }
}

class MaxValueOperator {
  constructor() {
    this.max = null;
    this.reader = new StockBatchReader();
    this.reader.on('batch', (stocks) => this.onBatch(stocks));
  }

  onBatch(stocks) {
    for (let i = 0; i < stocks.length; i++) {
      if(!this.isValid(stocks[i])) {
        continue;
      }
      if(this.max) {
        if(this.max.value < stocks[i].value) {
          this.max = stocks[i];
        }
      } else {
        this.max = stocks[i];
      }
    }
  }

  isValid(stock) {
    if(isNaN(stock.value)) {
      return false;
    }
    if(stock.change !== 'INCREASED') {
      return false;
    }
    return true;
  }

  async get() {
    await this.reader.process();
    return this.max;
  }
}

const operator = new MaxValueOperator();
operator.get().then(max => {
  if (max) {
    console.log(`Print: 公司: ${max.name}, 股价增值: ${max.value}`);
  } else {
    console.log('Print: nil');
  }
}).catch(err => console.log(err));

