const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Try to login if we are on the login page
  const usernameInput = await page.$('input[placeholder="Username"]');
  if (usernameInput) {
    await page.type('input[placeholder="Username"]', 'superadmin');
    await page.type('input[placeholder="Password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
  }

  // Click through tabs
  const tabs = ['Debt Tracker', 'Bookkeeping', 'Budget Planner', 'Inventory', 'Fleet Registry'];
  for (const tab of tabs) {
    console.log('Clicking tab:', tab);
    const elements = await page.$x(`//button//span[contains(text(), '${tab}')]`);
    if (elements.length > 0) {
      const button = elements[0];
      await button.evaluate(b => b.click());
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  await browser.close();
})();
