import puppeteer, { Page } from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { Cando } from './type';

const BASE_URL = 'https://netshop.cando-web.co.jp/view/category/all_items';
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
  const nextUrl = await page.$eval(
    '.btn-prev',
    (btn) => (btn?.parentNode as HTMLAnchorElement)?.href || ''
  );
  console.log(`総件数: ${total}件 | 総ページ数${Math.ceil(total / PER_PAGE_COUNT)}ページ`);

  const products: Cando[] = await scrape(page);
  await writeToCSV(products, count);
  console.log(`${count}ページ目完了 | 完了率: ${(PER_PAGE_COUNT / total) * 100}%`);

  if (!nextUrl) return;
  await recursiveScrape({ page, url: nextUrl, count: count + 1 });
}

async function scrape(page: Page) {
  const products: Cando[] = [];
  const productLinks = await page.$$eval('.item-list-name a', (links) =>
    links.map((link) => link.href)
  );

  for (const [idx, link] of productLinks.entries()) {
    await page.goto(link, { waitUntil: 'domcontentloaded' });

    const product = await page.evaluate(() => {
      const name = document.querySelector('.item-name')?.textContent?.trim();
      const price = document
        .querySelector('[data-id="makeshop-item-price:1"]')
        ?.textContent?.trim();
      const code = document.querySelector('.original-code .value')?.textContent?.trim();
      const size = document
        .querySelector('.item-description-01')
        ?.textContent?.match(/本体サイズ\(約\)：([a-zA-Z0-9×]+)/)?.[1]
        ?.trim();

      const normalize = (value: string | null | undefined) => {
        return (
          String(value || '')
            .trim()
            .replace(/\r?\n/g, '') || '-'
        );
      };

      const product = {
        name: normalize(name),
        price: normalize(price),
        code: normalize(code),
        size: normalize(size),
        url: normalize(location.href?.replace('?category_page_id=all_items', '')),
      };

      return product;
    });

    products.push(product);
    console.log(`${idx + 1}件目終了`);
  }

  return products;
}

async function getTotal(page: Page) {
  return await page.$eval('.item-count', (el) => {
    console.log(el);
    return Number(el.textContent?.trim()?.replace('件', '') || 0);
  });
}

async function writeToCSV(products: Cando[], pageNum: number) {
  const outputDir = path.join(__dirname, '../output/cando');
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
      { id: 'url', title: 'URL' },
    ],
    encoding: 'utf8',
  });

  await csvWriter.writeRecords(products);
  console.log(`${pageNum}ページ目のCSVファイルを出力`);
}

main().catch(console.error);
