import puppeteer, { Page } from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { Watts } from './type';

const BASE_URL = 'https://watts-online.jp/collections/all';
// ?page=2
const PER_PAGE_COUNT = 48;

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await recursiveScrape({ page });
  } catch (error) {
    console.error('スクレイピング中にエラーが発生しました:', error);
  } finally {
    await browser.close();
  }
}

async function recursiveScrape({
  page,
  url = BASE_URL,
  count = 1,
}: {
  page: Page;
  url?: string;
  count?: number;
}) {
  console.log(`----------${count}ページ目開始----------`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const total = await getTotal(page);
  const nextUrl = await page.$eval('a.pagination__next', (btn) => btn?.href || '');
  console.log(`総件数: ${total}件 | 総ページ数${Math.ceil(total / PER_PAGE_COUNT)}ページ`);

  const products: Watts[] = await scrape(page);
  await writeToCSV(products, count);
  console.log(`${count}ページ目完了 | 完了率: ${(PER_PAGE_COUNT / total) * 100}%`);

  if (!nextUrl) return;
  await recursiveScrape({ page, url: nextUrl, count: count + 1 });
}

async function scrape(page: Page) {
  const products: Watts[] = [];
  const productLinks = await page.$$eval(
    '.collection__dynamic-part a.product-item__title',
    (links) => links.map((link) => link.href)
  );

  for (const [idx, link] of productLinks.entries()) {
    await page.goto(link, { waitUntil: 'domcontentloaded' });

    const product = await page.evaluate(() => {
      const jsonLD = JSON.parse(
        document.querySelector('[type="application/ld+json"]')?.textContent?.replaceAll('\n', '') ||
          ''
      );
      console.log(jsonLD);

      const name = jsonLD['name'];
      const price = jsonLD['offers']?.[0]?.price;
      const code = jsonLD['offers']?.[0]?.gtin13;
      const size = jsonLD['description']?.match(/【サイズ】\n(.+)/)?.[1];
      const tableItemEls = document.querySelectorAll('.c-product-description__table td');
      const packageSize = Array.from(tableItemEls).filter((item) =>
        item.textContent?.match(/パッケージサイズ/)
      )[0]?.nextElementSibling?.textContent;

      const normalize = (value: string | null | undefined) => {
        return (
          String(value || '')
            .trim()
            .replace(/\r?\n/g, '') || '-'
        );
      };

      const product: Watts = {
        name: normalize(name),
        price: normalize(price),
        code: normalize(code),
        size: normalize(size),
        packageSize: normalize(packageSize),
        url: normalize(location.href),
      };

      return product;
    });

    products.push(product);
    console.log(`${idx + 1}件目終了`);
  }

  return products;
}

async function getTotal(page: Page) {
  return await page.$eval('.collection__products-count', (el) => {
    console.log(el);
    return Number(el.textContent?.match(/\d+/) || 0);
  });
}

async function writeToCSV(products: Watts[], pageNum: number) {
  const outputDir = path.join(__dirname, '../output/watts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, `${pageNum}.csv`),
    header: [
      { id: 'name', title: '商品名' },
      { id: 'price', title: '価格' },
      { id: 'code', title: 'JANコード' },
      { id: 'size', title: '本体サイズ' },
      { id: 'package_size', title: 'パッケージサイズ' },
      { id: 'url', title: 'URL' },
    ],
    encoding: 'utf8',
  });

  await csvWriter.writeRecords(products);
  console.log(`${pageNum}ページ目のCSVファイルを出力`);
}

main().catch(console.error);
