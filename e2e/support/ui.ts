import { expect, type Page } from "@playwright/test";
import { API, CONSUMER } from "./env";

export async function navigate(page:Page,label:string){
  await page.getByRole('menuitem',{name:new RegExp(label)}).click();
}
export async function addToPos(page:Page,name:string,quantity=1){
  if(page.url()===`${CONSUMER}/`) await page.getByRole('heading',{name:'Point of Sale'}).click();
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
  await page.locator(`#${id}`).click({force:true});
  await page.locator('.ant-select-dropdown:visible').locator('.ant-select-item-option-content').getByText(label,{exact:true}).click();
}
/** Baselines must wait for the dashboard queries; the initial render shows 0.00. */
export async function settledDashboardCents(page:Page,title:string){
  await page.waitForLoadState('networkidle');
  return dashboardCents(page,title);
}
