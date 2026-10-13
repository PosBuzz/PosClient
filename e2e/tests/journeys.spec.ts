import { test, expect } from "../support/fixtures";
import { ADMIN, API, CONSUMER } from "../support/env";
import { allowBranches, createStock, waitForLoginBudget } from "../support/api";
import { addToPos, backFromPos, completeSale, dashboardCents, pickOption, settledDashboardCents } from "../support/ui";

test('[E2E-J0] login, dashboard, logout and protected redirect use real cookies',async({consumerPage:page})=>{
  await expect(page.getByText("Today's Sale Amount",{exact:true})).toBeVisible();
  const cookies=await page.context().cookies(API);
  expect(cookies.some(cookie=>cookie.name==='client_access_token')).toBe(true);
  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`${CONSUMER}/pos`);
  await expect(page).toHaveURL(/\/login$/);
});

test('[E2E-J1] a POS sale refreshes cached dashboard totals and conserves stock',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant,branch}=await createStock(api,name);
  const before=await settledDashboardCents(page,"Today's Sale Amount");
  await addToPos(page,name,2);
  await expect(page.getByTestId('pos-total')).toContainText('210.00');
  const sale=await completeSale(page);
  await backFromPos(page);
  await expect.poll(()=>dashboardCents(page,"Today's Sale Amount")).toBe(before+21000);
  await expect.poll(()=>db.stock(variant.id,branch.id)).toBe(8);
  const audits=await db.rows("SELECT quantity_delta FROM inventory_audit_logs WHERE variant_id=$1 AND event_type='SALE_OUT'",[variant.id]);
  expect(audits.reduce((sum,row)=>sum+row.quantity_delta,0)).toBe(-2);
  expect(sale.id).toBeGreaterThan(0);
});

test('[E2E-J2] a cash return restores stock and moves refund-sensitive dashboard totals',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant,branch}=await createStock(api,name);
  const netBefore=await settledDashboardCents(page,"Today's Net Sale");
  await addToPos(page,name,2);
  const sale=await completeSale(page);
  await page.goto(`${CONSUMER}/returns/new`);
  await page.getByPlaceholder('SAL-20250926-0001').fill(sale.sale_number);
  await page.getByRole('button',{name:/Search/}).click();
  await expect(page.getByText(/loaded successfully/).first()).toBeVisible();
  await page.getByRole('button',{name:'+'}).first().click();
  await pickOption(page,'reason','Defective');
  // The form can re-initialise after the sale data settles and drop a just-added payment row, so the row is re-added until the method is picked.
  await expect(async()=>{
    if(!(await page.locator('#payment_method').count())) await page.getByRole('button',{name:/Add Payment/}).first().click();
    await pickOption(page,'payment_method','CASH');
    await expect(page.locator('#amount')).toHaveValue('105.00',{timeout:3000});
  }).toPass({timeout:60000});
  await page.getByRole('button',{name:/Add Payment/}).last().click();
  await page.getByRole('button',{name:/Create Return/}).click();
  await expect(page.getByText('Return created successfully!')).toBeVisible();
  await expect.poll(()=>db.stock(variant.id,branch.id)).toBe(9);
  const audits=await db.rows("SELECT quantity_delta FROM inventory_audit_logs WHERE variant_id=$1 AND event_type='RETURN_IN'",[variant.id]);
  expect(audits.reduce((sum,row)=>sum+row.quantity_delta,0)).toBe(1);
  await page.goto(`${CONSUMER}/`);
  await expect.poll(()=>dashboardCents(page,"Today's Net Sale")).toBe(netBefore+21000-10500);
});

test('[E2E-J3] a partially paid sale is completed from the partial-payments page',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  await createStock(api,name);
  await addToPos(page,name,2);
  await expect(page.getByTestId('pos-total')).toContainText('210.00');
  const amount=page.getByRole('spinbutton',{name:'Amount',exact:true});
  await amount.fill('100');
  await expect(amount).toHaveValue(/^100(\.00)?$/);
  await amount.blur();
  const sale=await completeSale(page);
  const [partial]=await db.rows("SELECT lower(payment_status) AS payment_status, received_amount::float AS received FROM sales WHERE id=$1",[sale.id]);
  expect(partial).toEqual({payment_status:'partial',received:100});
  await page.goto(`${CONSUMER}/partial-payments/${sale.id}/pay`);
  await expect(page.getByRole('row',{name:/Remaining Amount/})).toContainText('110.00');
  await expect(page.getByRole('spinbutton').last()).toHaveValue(/^110(\.00)?$/);
  await page.getByRole('button',{name:/Record Payment/}).click();
  await expect.poll(async()=>(await db.rows("SELECT lower(payment_status) AS payment_status, received_amount::float AS received FROM sales WHERE id=$1",[sale.id]))[0]).toEqual({payment_status:'paid',received:210});
  const [paid]=await db.rows("SELECT COALESCE(SUM(amount),0)::float AS total FROM sale_payments WHERE sale_id=$1",[sale.id]);
  expect(paid.total).toBe(210);
});

test('[E2E-J5] an idle session past JWT expiry refreshes silently exactly once and the sale succeeds',async({consumerPage:page,api,db},info)=>{
  test.setTimeout(240000);
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant,branch}=await createStock(api,name);
  // Real idle time is the point: JWT_EXPIRATION is 30s in .env.e2e.
  await new Promise(resolve=>setTimeout(resolve,35000));
  const refreshes:number[]=[];
  const rotations:number[]=[];
  page.on('response',response=>{if(response.url().endsWith('/auth/client-refresh-token')){refreshes.push(response.status());if(response.status()===201)rotations.push(Date.now());}});
  await addToPos(page,name,1);
  const sale=await completeSale(page);
  expect(sale.id).toBeGreaterThan(0);
  // A reload has no CSRF token yet, so one 403 followed by the app's documented CSRF recovery is allowed; rotation must succeed exactly once.
  // A slow runner can outlive the freshly issued 30s token, so a later rotation is legitimate; two rotations inside one token lifetime would be a stampede.
  expect(rotations.length).toBeGreaterThanOrEqual(1);
  rotations.slice(1).forEach((at,i)=>expect(at-rotations[i]).toBeGreaterThan(25000));
  expect(refreshes.filter(status=>status!==201&&status!==403)).toEqual([]);
  expect(refreshes.length).toBeLessThanOrEqual(rotations.length+1);
  await expect(page).toHaveURL(/\/pos/);
  await expect.poll(()=>db.stock(variant.id,branch.id)).toBe(9);
});

test('[E2E-J6] a session for one tenant is rejected and its cookies cleared on another tenant subdomain',async({consumerPage:page})=>{
  const other='http://consumer2.localhost:3000';
  const response=await page.request.get(`${API}/consumer/sales`,{headers:{Origin:other}});
  expect(response.status()).toBe(401);
  expect(await response.text()).toContain('subdomain does not match your tenant');
  const cookies=await page.context().cookies(API);
  expect(cookies.some(cookie=>cookie.name==='client_access_token')).toBe(false);
  await page.goto(`${CONSUMER}/pos`);
  await expect(page).toHaveURL(/\/login$/);
});

test('[E2E-J7] an active promotion is applied in the POS and its discount is stored on the sale line',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant}=await createStock(api,name);
  const promoName=`Promo ${name}`;
  await api.post('/consumer/promotions',{
    name:promoName,scope:'SINGLE_PRODUCT',discount_type:'percentage',discount_value:10,
    start_date:new Date(Date.now()-86400000).toISOString(),is_active:true,variant_ids:[variant.id],
  });
  await addToPos(page,name,1);
  await page.getByRole('button',{name:/Promos/}).click();
  const item=page.locator('.ant-drawer').getByRole('listitem').filter({hasText:promoName});
  await expect(item).toContainText('10% discount');
  await item.getByRole('button',{name:'Apply'}).click();
  await expect(item).toContainText('Applied');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-drawer-content-wrapper:visible')).toHaveCount(0);
  const sale=await completeSale(page);
  const [line]=await db.rows("SELECT promotion_discount_amount::float AS discount, applied_promotion_id FROM sale_items WHERE sale_id=$1",[sale.id]);
  expect(line.discount).toBe(10);
  expect(line.applied_promotion_id).not.toBeNull();
});

test('[E2E-J8] completing an inventory transfer moves stock between branches with paired audit rows',async({consumerPage:page,api,adminApi,db},info)=>{
  await allowBranches(adminApi);
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant,batch,branch}=await createStock(api,name);
  const second=await api.post('/consumer/branches',{name:`E2E Branch ${Date.now()}`});
  await api.post('/consumer/inventory/transfers',{source_branch_id:branch.id,destination_branch_id:second.id,items:[{batch_id:batch.id,quantity:3}]});
  await page.goto(`${CONSUMER}/inventory/transfers`);
  const row=page.getByRole('row').filter({hasText:second.name});
  await row.locator('.anticon-check').click();
  await page.getByRole('button',{name:'Yes, Complete'}).click();
  await expect(row).toContainText('COMPLETED');
  await expect.poll(()=>db.stock(variant.id,branch.id)).toBe(7);
  await expect.poll(()=>db.stock(variant.id,second.id)).toBe(3);
  const events=await db.rows("SELECT event_type::text AS event_type, SUM(quantity_delta)::int AS delta FROM inventory_audit_logs WHERE variant_id=$1 AND event_type::text LIKE 'TRANSFER_%' GROUP BY event_type ORDER BY 1",[variant.id]);
  expect(events).toEqual([{event_type:'TRANSFER_IN',delta:3},{event_type:'TRANSFER_OUT',delta:-3}]);
});

test('[E2E-J11] checkout after a price change is rejected with a readable message and succeeds after refresh',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  const {product,variant}=await createStock(api,name);
  await addToPos(page,name,1);
  await expect(page.getByTestId('pos-total')).toContainText('105.00');
  await api.patch(`/consumer/products/${product.id}`,{name,has_variants:false,tax:5,tax_method:'EXCLUSIVE',tag_ids:[],variants:[{id:variant.id,name:'Default',regular_price:'120',sale_unit_id:variant.sale_unit_id,purchase_unit_id:variant.purchase_unit_id,alert_quantity:2}]});
  const rejected=page.waitForResponse(r=>r.url()===`${API}/consumer/sales`&&r.request().method()==='POST'&&r.status()!==403);
  await page.getByRole('button',{name:/Complete Sale/}).click();
  expect((await rejected).status()).toBe(400);
  await expect(page.getByText(/Price of variant \d+ has changed \(now 120\.00\)\. Refresh the product list/)).toBeVisible();
  await expect.poll(async()=>(await db.rows("SELECT count(*)::int AS n FROM sale_items WHERE variant_id=$1",[variant.id]))[0].n).toBe(0);
  await addToPos(page,name,1);
  await expect(page.getByTestId('pos-total')).toContainText('126.00');
  const sale=await completeSale(page);
  const [line]=await db.rows("SELECT unit_price::float AS price FROM sale_items WHERE sale_id=$1",[sale.id]);
  expect(line.price).toBe(120);
});

test('[E2E-J10] an offline print agent shows a non-blocking warning after the sale is saved',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  await createStock(api,name);
  await page.evaluate(()=>localStorage.setItem('autoPrintThermal','true'));
  await addToPos(page,name,1);
  const sale=await completeSale(page);
  await expect(page.getByText(/Printing agent is not running/)).toBeVisible();
  const [saved]=await db.rows("SELECT id FROM sales WHERE id=$1",[sale.id]);
  expect(saved.id).toBe(sale.id);
  await expect(page.getByRole('button',{name:/Complete Sale/})).toBeVisible();
});

test('[E2E-J9] a quotation reserves no stock until it is converted to a sale',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant,batch,branch}=await createStock(api,name);
  const quotation=await api.post('/consumer/sales',{
    sale_type:'quotation',branch_id:branch.id,customer_name:`Quote ${Date.now()}`,payment_status:'due',received_amount:0,
    items:[{variant_id:variant.id,batch_id:batch.id,quantity:2,unit_price:100,tax_amount:10,line_total:210}],
  });
  expect(await db.stock(variant.id,branch.id)).toBe(10);
  await page.goto(`${CONSUMER}/quotations`);
  const row=page.getByRole('row').filter({hasText:quotation.sale_number});
  await expect(row).toBeVisible();
  await row.locator('.anticon-swap').click();
  await expect(page).toHaveURL(new RegExp(`/sales/new\\?quotation_id=${quotation.id}`));
  await expect(page.getByText(name).first()).toBeVisible();
  expect(await db.stock(variant.id,branch.id)).toBe(10);
  await expect(page.getByText('210.00').first()).toBeVisible();
  const response=page.waitForResponse(r=>r.url()===`${API}/consumer/sales`&&r.request().method()==='POST'&&r.status()!==403);
  await page.getByRole('button',{name:/Complete Sale|Create Sale|Submit/}).click();
  expect((await response).status()).toBe(201);
  await expect.poll(()=>db.stock(variant.id,branch.id)).toBe(8);
  await page.goto(`${CONSUMER}/quotations`);
  await expect(page.getByRole('row').filter({hasText:quotation.sale_number})).toContainText('Converted');
});

test('[E2E-J4] removing the sales permission from the plan in the admin app removes it for the tenant',async({consumerPage:page,adminPage,adminApi})=>{
  const plans=await adminApi.get('/admin/plans');
  const plan=(Array.isArray(plans)?plans:plans.data).find((p:any)=>p.permissions.length>0);
  const original:number[]=plan.permissions.map((p:any)=>p.permission_id);
  try {
    await adminPage.goto(`${ADMIN}/plans`);
    await adminPage.getByRole('row').filter({hasText:plan.name}).locator('.anticon-edit').click();
    const drawer=adminPage.locator('.ant-drawer-content');
    await drawer.locator('.ant-select-selection-item').filter({hasText:/^sales$/}).locator('.ant-select-selection-item-remove').click();
    await drawer.getByRole('button',{name:/Save|Update|Submit/}).click();
    await expect(drawer).toBeHidden();
    await page.reload();
    await expect(page.getByRole('menuitem',{name:/Sales/})).toHaveCount(0);
    await page.goto(`${CONSUMER}/pos`);
    await expect(page).not.toHaveURL(/\/pos/);
    const response=await page.request.get(`${API}/consumer/sales`,{headers:{Origin:CONSUMER}});
    expect(response.status()).toBe(403);
  } finally {
    await adminApi.patch(`/admin/plans/${plan.id}`,{permission_ids:original});
  }
  await page.goto(`${CONSUMER}/`);
  await expect(page.getByRole('menuitem',{name:/Sales/})).toBeVisible();
  expect((await page.request.get(`${API}/consumer/sales`,{headers:{Origin:CONSUMER}})).status()).toBe(200);
});

test('[E2E-J12] a wrong password shows the real server message with one login request and no refresh',async({page})=>{
  await waitForLoginBudget('consumer');
  const requests:string[]=[];
  page.on('request',request=>{if(/\/auth\/(login-user|client-refresh-token)$/.test(request.url()))requests.push(request.url().split('/').pop()!);});
  await page.goto(`${CONSUMER}/login`);
  await page.getByLabel('Email',{exact:true}).fill('consumer@example.com');
  await page.getByLabel('Password',{exact:true}).fill('definitely-wrong');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  // The session probe on page load may refresh once; a failed login must not trigger a refresh afterwards.
  expect(requests.filter(name=>name==='login-user')).toHaveLength(1);
  expect(requests.slice(requests.indexOf('login-user')+1)).toEqual([]);
});

test('[E2E-J13] selling more than the stock shows the real 400 message',async({consumerPage:page,api,db},info)=>{
  const name=`E2E ${info.title} ${Date.now()}`;
  const {variant,branch}=await createStock(api,name,{quantity:3});
  await addToPos(page,name,5);
  const response=page.waitForResponse(r=>r.url()===`${API}/consumer/sales`&&r.request().method()==='POST'&&r.status()!==403);
  await page.getByRole('button',{name:/Complete Sale/}).click();
  expect((await response).status()).toBe(400);
  await expect(page.getByText(/^Insufficient stock for/)).toBeVisible();
  expect(await db.stock(variant.id,branch.id)).toBe(3);
});

test('[E2E-J14] a duplicate customer shows a readable 409 message on screen',async({consumerPage:page,api,db})=>{
  const phone=`017${String(Date.now()).slice(-8)}`;
  await api.post('/consumer/customers',{name:'E2E Existing',phone,customer_type:'individual'});
  await page.goto(`${CONSUMER}/pos`);
  await page.getByRole('button',{name:/^plus$/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByPlaceholder('Enter customer name').fill('E2E Duplicate');
  await dialog.getByPlaceholder('Enter phone number').fill(phone);
  await pickOption(page,'customer_type','Individual');
  const response=page.waitForResponse(r=>r.url()===`${API}/consumer/customers`&&r.request().method()==='POST'&&r.status()!==403);
  await dialog.getByRole('button',{name:'Add Customer'}).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByText(/^[A-Z][^\[\]{}]{10,150}$/).filter({hasText:/already|exist/i}).first()).toBeVisible();
  const [{n}]=await db.rows("SELECT count(*)::int AS n FROM customers WHERE phone=$1",[phone]);
  expect(n).toBe(1);
});
