import { relations } from 'drizzle-orm';
import { mysqlTable, text, varchar, double, float, index, timestamp, json, smallint, primaryKey } from 'drizzle-orm/mysql-core';

export const hikingtrails = mysqlTable("hikingtrails",
    {
        id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()).notNull(),
        title: varchar({ length: 128 }).notNull(),
        description: text().notNull(),
        trail: json(),
        author: varchar({ length: 128 }).notNull(),
        created: timestamp().defaultNow().notNull(),
        editor: varchar({ length: 128 }).notNull(),
        updated: timestamp().onUpdateNow(),
        length: float(),
    },
    (table) => [
        index('titleIdx').on(table.title)
    ]
);

export const trailRelations = relations(hikingtrails, ({ many }) => ({
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
    updated: timestamp().onUpdateNow()
})

export const poiRelations = relations(poi, ({ many }) => ({
    hikingTrail: many(hikingtrails)
}))

export const trailsToPoi = mysqlTable("trails_to_poi", {
    trailID: varchar("trailID", { length: 191 }).notNull(),
    poiID: varchar("poiID", { length: 191 }).notNull(),
    position1: smallint(),//positions of the closest point in the trail arrays
    position2: smallint(),
},
    (t) => [
        primaryKey({ columns: [t.trailID, t.poiID] })
    ],
)

export const trailsToPoiRelations = relations(trailsToPoi, ({ one }) => ({
    hikingTrails: one(hikingtrails, {
        fields: [trailsToPoi.trailID],
        references: [hikingtrails.id]

    }),
    poi: one(poi, {
        fields: [trailsToPoi.poiID],
        references: [poi.id]
    })
}))