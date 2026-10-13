import { test as base, expect, type Page } from "@playwright/test";
import { StackApi, login } from "./api";
import { ReadOnlyDb } from "./db";
import { ADMIN } from "./env";

export const test=base.extend<{consumerPage:Page;adminPage:Page;api:StackApi;adminApi:StackApi;db:ReadOnlyDb}>({
  consumerPage:async({page},use)=>{
    await page.addInitScript(()=>{localStorage.setItem('autoPrintThermal','false');localStorage.setItem('posLayout','standard');});
    await page.route('http://localhost:8080/**',route=>route.abort('connectionrefused'));
    await login(page);
    await use(page);
  },
  adminPage:async({browser},use)=>{
    const context=await browser.newContext();
    const page=await context.newPage();
    await login(page,true);
    await use(page);
    await context.close();
  },
  api:async({consumerPage},use)=>use(new StackApi(consumerPage.request)),
  adminApi:async({adminPage},use)=>use(new StackApi(adminPage.request,ADMIN,true)),
  db:async({},use)=>{
    const db=new ReadOnlyDb();await db.connect();await use(db);await db.close();
  },
});
export {expect};
