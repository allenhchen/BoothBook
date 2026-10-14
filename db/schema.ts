import { integer, sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const workspace=sqliteTable('workspace',{id:text('id').primaryKey(),version:integer('version').notNull(),data:text('data').notNull()});
export const artists=sqliteTable('artists',{id:text('id').primaryKey(),email:text('email').notNull(),displayName:text('display_name').notNull()});
export const artistWorkspaces=sqliteTable('artist_workspaces',{artistId:text('artist_id').primaryKey().references(()=>artists.id),version:integer('version').notNull().default(0),data:text('data').notNull(),salesMigrated:integer('sales_migrated').notNull().default(0),mutation:text('mutation')});
export const legacyClaims=sqliteTable('legacy_claims',{legacyId:text('legacy_id').primaryKey(),artistId:text('artist_id').notNull().references(()=>artists.id)});

export const artistSales=sqliteTable('artist_sales',{artistId:text('artist_id').notNull().references(()=>artists.id),id:text('id').notNull(),eventId:text('event_id').notNull(),date:text('date').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.artistId,t.id]}),index('artist_sales_event_date').on(t.artistId,t.eventId,t.date)]);
export const artistFinance=sqliteTable('artist_finance',{artistId:text('artist_id').notNull().references(()=>artists.id),id:text('id').notNull(),date:text('date').notNull(),type:text('type').notNull(),eventId:text('event_id'),data:text('data').notNull()},t=>[primaryKey({columns:[t.artistId,t.id]}),index('artist_finance_date').on(t.artistId,t.date),index('artist_finance_event').on(t.artistId,t.eventId,t.type)]);
