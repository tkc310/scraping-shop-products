import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline';

const rl = readline.createInterface({ input, output });

interface Product {
  name: string;
  price: string;
  code: string;
  size: string;
}

async function main() {
  await rl.question('結合対象のファイル種別 c (cando) or w (watts): ', async (answer) => {
    switch (answer) {
      case 'c': {
        console.log('処理を開始');
        await concat('cando');
        return;
      }
      case 'w': {
        console.log('処理を開始');
        await concat('watts');
        return;
      }
      default: {
        console.log('処理をキャンセル');
        rl.close();
      }
    }
  });
}

async function concat(type: 'cando' | 'watts') {
  const inputDir = path.join(__dirname, `output/${type}`);
  const outputFile = path.join(__dirname, `output/${type}`, 'all.csv');

  // 入力ディレクトリ内のCSVファイルを取得
  const files = fs
    .readdirSync(inputDir)
    .filter((file) => file.endsWith('.csv') && file !== 'all.csv')
    .sort((a, b) => {
      const numA = Number(a.replace('.csv', ''));
      const numB = Number(b.replace('.csv', ''));
      return numA - numB;
    });

  console.log(`結合対象のファイル: ${files.length}件 | ${files.join(', ')}`);

  const allProducts: Product[] = [];

  // 各CSVファイルを読み込む
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // ヘッダー行を除いてデータを読み込む
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(',');
      const product: Product = {
        name: values[0],
        price: values[1],
        code: values[2],
        size: values[3],
      };
      allProducts.push(product);
    }
  }

  // 結合したデータをCSVファイルに出力
  const csvWriter = createObjectCsvWriter({
    path: outputFile,
    header: [
      { id: 'name', title: '商品名' },
      { id: 'price', title: '価格' },
      { id: 'code', title: 'JANコード' },
      { id: 'size', title: '本体サイズ' },
    ],
    encoding: 'utf8',
  });

  await csvWriter.writeRecords(allProducts);
  console.log(`CSVファイルの結合完了 | 合計${allProducts.length}件の商品データを出力`);
}

main().catch(console.error);
