import pg from "pg";
import { stackEnv } from "./env";

/** Session-level PostgreSQL enforcement makes these assertions read-only. */
export class ReadOnlyDb {
  private client=new pg.Client({connectionString:stackEnv.DATABASE_URL,options:'-c default_transaction_read_only=on'});
  async connect(){await this.client.connect();}
  async close(){await this.client.end();}
  async rows<T=any>(sql:string,values:unknown[]=[]):Promise<T[]> {
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error('E2E assertions accept SELECT only');
    return (await this.client.query(sql,values)).rows as T[];
  }
  async stock(variant:number,branch:number){
    const [row]=await this.rows('SELECT COALESCE(SUM(quantity),0)::int AS quantity FROM inventory_batches WHERE variant_id=$1 AND branch_id=$2',[variant,branch]);
    return row.quantity as number;
  }
}
