import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query } from "./database";

type Queryable = Pick<PoolClient, "query">;

export async function enqueueUserSheetSync(userId: string, client?: Queryable) {
  const run = client?.query.bind(client) ?? query;
  await run(`
    INSERT INTO integration_outbox (id, event_type, entity_id)
    VALUES ($1, 'user.sheet.upsert', $2)
    ON CONFLICT (event_type, entity_id) DO UPDATE
    SET status = 'pending', attempts = 0, available_at = NOW(), last_error = NULL,
        processed_at = NULL
  `, [randomUUID(), userId]);
}
