import { expect, type Page } from "@playwright/test";
import { API, CONSUMER } from "./env";
import { StackApi } from './api';

export async function navigate(page:Page,label:string){
  await page.getByRole('menuitem',{name:new RegExp(label)}).click();
}
export async function addToPos(page:Page,name:string,quantity=1){
  if(page.url()===`${CONSUMER}/`) await page.getByRole('heading',{name:'Express Sale'}).click();
  else await page.goto(`${CONSUMER}/pos`);
  await expect(page).toHaveURL(/\/pos/);
  await page.waitForLoadState('networkidle');
  const select=page.locator('.ant-select').filter({has:page.getByText(/Search or scan barcode/)});
  // A token refresh can re-render the POS while typing, so the search step is retried as a unit.
  await expect(async()=>{
    await select.getByRole('combobox').fill(name);
    await page.locator('.ant-select-dropdown:visible').getByText(name,{exact:true}).click({timeout:5000});
  }).toPass({timeout:45000});
  const row=page.getByRole('row').filter({hasText:name});
  await row.getByRole('spinbutton').first().fill(String(quantity));
}
export async function completeSale(page:Page){
  const response=page.waitForResponse(r=>r.url()===`${API}/consumer/sales`&&r.request().method()==='POST'&&r.status()===201);
  await page.getByRole('button',{name:/Complete Sale/}).click();
  const saved=await(await response).json();
  await expect(page.getByText('Sale created successfully!',{exact:true})).toBeVisible();
  return saved;
}
export async function dashboardCents(page:Page,title:string){
  const value=await page.locator('.ant-card').filter({has:page.getByText(title,{exact:true})}).locator('.ant-statistic-content-value').innerText();
  const number=Number(value.replace(/[^\d.-]/g,''));
  expect(Number.isFinite(number)).toBe(true);
  return Math.round(number*100);
}
export async function eodCents(page:Page,title:string){
  const value=await page.locator('.ant-statistic').filter({has:page.getByText(title,{exact:true})}).locator('.ant-statistic-content-value').innerText();
  const number=Number(value.replace(/[^\d.-]/g,''));
  expect(Number.isFinite(number)).toBe(true);
  return Math.round(number*100);
}
export async function backFromPos(page:Page){
  await page.getByRole('button',{name:/Back/}).click();
  await expect(page).toHaveURL(`${CONSUMER}/`);
}
export async function pickOption(page:Page,id:string,label:string){
  // The dropdown can toggle shut or open late while the form re-renders, so open-and-pick is retried as a unit.
  await expect(async()=>{
    const dropdown=page.locator('.ant-select-dropdown:visible');
    if(!(await dropdown.count())) await page.locator(`#${id}`).click({force:true});
    await dropdown.locator('.ant-select-item-option-content').getByText(label,{exact:true}).click({timeout:3000});
  }).toPass({timeout:30000});
}
/** Pin the rendered baseline to the live API; network idle can precede query retries. */
export async function settledDashboardCents(page:Page,title:string){
  const fields: Record<string, string> = {
    "Today's Sale Amount": 'today_total_sale',
    "Today's Net Sale": 'today_net_sale',
  };
  const field = fields[title];
  if (!field) throw new Error(`Unsupported dashboard baseline: ${title}`);
  const analytics = await new StackApi(page.request).get('/consumer/dashboard/analytics?payment_period=daily&return_payment_period=daily&top_products_period=daily');
  const expected = Math.round(Number(analytics.summary[field]) * 100);
  expect(Number.isFinite(expected)).toBe(true);
  await expect.poll(() => dashboardCents(page, title)).toBe(expected);
  return expected;
}
