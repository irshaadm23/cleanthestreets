import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const incidents = sqliteTable('incidents', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), reference: text('reference').notNull(), token: text('token').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
});
export const observations = sqliteTable('observations', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), incidentId: text('incident_id').notNull(), photoKey: text('photo_key').notNull(), createdAt: text('created_at').notNull()
});
export const jobs = sqliteTable('jobs', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), incidentId: text('incident_id').notNull(), crew: text('crew').notNull(), status: text('status').notNull(), createdAt: text('created_at').notNull()
});
export const uploads = sqliteTable('uploads', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), createdAt: text('created_at').notNull()
});
export const audit = sqliteTable('audit', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), incidentId: text('incident_id').notNull(), action: text('action').notNull(), createdAt: text('created_at').notNull()
});

export const workOrders = sqliteTable('work_orders', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), incidentId: text('incident_id').notNull(), data: text('data').notNull(), updatedAt: text('updated_at').notNull()
}, table => [uniqueIndex('work_orders_owner_incident').on(table.ownerId, table.incidentId)]);
export const routePlans = sqliteTable('route_plans', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), crew: text('crew').notNull(), day: text('day').notNull(), data: text('data').notNull(), updatedAt: text('updated_at').notNull()
});
export const incidentMerges = sqliteTable('incident_merges', {
 id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), sourceId: text('source_id').notNull(), targetId: text('target_id').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull(), reversedAt: text('reversed_at')
});
