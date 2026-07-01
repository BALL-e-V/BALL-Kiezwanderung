import { relations } from 'drizzle-orm';
import { mysqlTable, text, varchar, double, float, index, timestamp, json, smallint, primaryKey } from 'drizzle-orm/mysql-core';

export const hikingTrails = mysqlTable("hikingtrails",
    {
        id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()).notNull(),
        title: varchar({ length: 128 }).notNull(),
        description: text().notNull(),
        trail: json(),
        author: varchar({ length: 128 }).notNull(),
        created: timestamp().defaultNow().notNull(),
        editor: varchar({ length: 128 }).notNull(),
        updated: timestamp().defaultNow().onUpdateNow(),
        length: float(),
    },
    (table) => [
        index('titleIdx').on(table.title)
    ]
);

export const trailRelations = relations(hikingTrails, ({ many }) => ({
    poiSchema: many(poi),
}));

export const poi = mysqlTable("poi", {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()).notNull(),
    imageUrl: varchar({ length: 128 }),
    caption: varchar({ length: 128 }),
    latitude: double(),
    longitude: double(),
    description: text(),
    imageAlt:text(),
    author: varchar({ length: 128 }).notNull(),
    created: timestamp().defaultNow().notNull(),
    editor: varchar({ length: 128 }),
    updated: timestamp().defaultNow().onUpdateNow()
})

export const poiRelations = relations(poi, ({ many }) => ({
    hikingTrail: many(hikingTrails)
}))

export const trailsToPoi = mysqlTable("trails_to_poi", {
    trailId: varchar("trailId", { length: 191 }).notNull(),
    poiId: varchar("poiId", { length: 191 }).notNull(),
    position1: smallint(),//positions of the closest point in the trail arrays
    position2: smallint(),
},
    (t) => [
        primaryKey({ columns: [t.trailId, t.poiId] })
    ],
)

export const trailsToPoiRelations = relations(trailsToPoi, ({ one }) => ({
    hikingTrails: one(hikingTrails, {
        fields: [trailsToPoi.trailId],
        references: [hikingTrails.id]

    }),
    poi: one(poi, {
        fields: [trailsToPoi.poiId],
        references: [poi.id]
    })
}))