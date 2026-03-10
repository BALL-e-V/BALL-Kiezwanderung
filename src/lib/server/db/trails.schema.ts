import { relations, sql } from 'drizzle-orm';
import { mysqlTable, serial, int, text, varchar, double, float, time } from 'drizzle-orm/mysql-core';

export const hikingTrails = mysqlTable("hikingTails", {
    id: varchar('logID', { length: 48 }).default(sql`('UUID()')`).primaryKey(),
    title: varchar({ length: 128 }),
    description: varchar({ length: 1024 }),
    zoom: float(),
    mapLat: double(),
    mapLong: double(),
    trail: varchar({ length: 10000 }),
    length: float(),
    duration: time(),
    startAdress: varchar({ length: 128 }),
    endAdress: varchar({ length: 128 })
});

export const trailRelations = relations(hikingTrails, ({ many }) => ({
    pictures: many(pictures),
}));

export const pictures = mysqlTable("pictures", {
    id: serial('id').primaryKey(),
    trailID: varchar('trailID', { length: 48 }),
    imageUrl: varchar({ length: 128 }),
    caption: varchar({ length: 128 })
})

export const pictureRelations = relations(pictures, ({ one }) => ({
    hikingTrail: one(hikingTrails, ({
        fields: [pictures.trailID],
        references: [hikingTrails.id]
    }))
}))