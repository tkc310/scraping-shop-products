import puppeteer, { Page } from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await settingHeader(page);

  console.log('開始');
  await page.goto('https://www.cman.jp/network/support/go_access.cgi', {
    waitUntil: 'domcontentloaded',
  });

  const result = await page.$eval('.outIp', (el) => {
    return el.textContent;
  });
  console.log({ result });
}

async function settingHeader(page: Page) {
  await page.setExtraHTTPHeaders({
    'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'X-Forwarded-For': '66.249.69.0',
  });
}

main().catch(console.error);
