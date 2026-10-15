import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { API, CONSUMER, ADMIN } from "./env";
import { fileURLToPath } from 'node:url';
import { reserveLoginSlot } from '../scripts/login-budget.mjs';

/** Uses the browser's cookie jar; a second login would rotate its refresh token. */
export class StackApi {
  constructor(private request: APIRequestContext, private origin = CONSUMER, private admin = false) {}
  async json(method: string, path: string, data?: unknown, retry = true): Promise<any> {
    if (/^\/admin\/(backup|restore)(?:[/?#]|$)/.test(path)) throw new Error("Backup/restore are excluded from real-stack tests");
    const headers:Record<string,string>={Origin:this.origin};
    if (!['GET','HEAD'].includes(method)) {
      const csrf=await this.request.get(`${API}/auth/csrf-token`,{headers});
      expect(csrf.ok()).toBe(true);
      headers['X-CSRF-TOKEN']=(await csrf.json()).csrfToken;
    }
    const response=await this.request.fetch(`${API}${path}`,{method,data,headers});
    if (response.status()===401 && retry) {
      await this.json('POST',this.admin?'/auth/admin-refresh-token':'/auth/client-refresh-token',undefined,false);
      return this.json(method,path,data,false);
    }
    expect(response.ok(),`${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true);
    return response.json();
  }
  get(path:string){return this.json('GET',path);}
  post(path:string,data:unknown){return this.json('POST',path,data);}
  patch(path:string,data:unknown){return this.json('PATCH',path,data);}
}

const loginBudgetPath=fileURLToPath(new URL('../.cache/login-budget.json', import.meta.url));
/** Login is throttled to 5/min per IP+email (D-005); the suite paces itself instead of weakening that control. */
export async function waitForLoginBudget(key:string){
  for (;;) {
    const slot=reserveLoginSlot(loginBudgetPath,key);
    if(slot.reserved) return;
    await new Promise(resolve=>setTimeout(resolve,slot.wait));
  }
}

export async function login(page:Page, admin=false) {
  await waitForLoginBudget(admin?'admin':'consumer');
  await page.goto(`${admin?ADMIN:CONSUMER}/login`);
  await page.getByLabel('Email',{exact:true}).fill(admin?'superadmin@posbuzz.cloud':'consumer@example.com');
  await page.getByLabel('Password',{exact:true}).fill('PosBuzz!234');
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await expect(page).toHaveURL(`${admin?ADMIN:CONSUMER}/`);
}

export async function createStock(api:StackApi, name:string, options:{price?:number;quantity?:number;tax?:number}={}) {
  const branches=await api.get('/consumer/branches');
  let units=await api.get('/consumer/units');
  if(!units.length) units=[await api.post('/consumer/units',{name:'Piece'})];
  const branch=branches.find((b:any)=>b.is_main)??branches[0];
  const product=await api.post('/consumer/products',{
    name,has_variants:false,tax:options.tax??5,tax_method:'EXCLUSIVE',tag_ids:[],
    variants:[{name:'Default',regular_price:String(options.price??100),sale_unit_id:units[0].id,purchase_unit_id:units[0].id,alert_quantity:2}],
  });
  const variant=product.variants[0];
  const batch=await api.post('/consumer/inventory/batches',{
    variant_id:variant.id,branch_id:branch.id,batch_number:`B-${Date.now()}`,quantity:options.quantity??10,cost_price:'50',regular_price:String(options.price??100),payments:[],
  });
  return {product,variant,batch,branch};
}

/** Super-admin setup: the seeded tenant is limited to one branch. Idempotent. */
export async function allowBranches(adminApi:StackApi, count=20) {
  const consumers=await adminApi.get('/admin/consumers?search=consumer1');
  const list=Array.isArray(consumers)?consumers:consumers.data;
  const tenant=list.find((consumer:any)=>consumer.subdomain==='consumer1');
  expect(tenant,'seeded tenant consumer1').toBeTruthy();
  if (tenant.max_branch<count) await adminApi.patch(`/admin/consumers/${tenant.id}`,{max_branch:count});
}
