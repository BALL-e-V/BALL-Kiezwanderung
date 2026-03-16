import { relations } from 'drizzle-orm';
import { mysqlTable, serial, text, varchar, double, float, index, timestamp, json } from 'drizzle-orm/mysql-core';

export const hikingTrails = mysqlTable("hikingTrails",
    {
        id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()).notNull(),
        title: varchar({ length: 128 }).notNull(),
        description: text().notNull(),
        zoom: float().notNull(),
        mapLat: double().notNull(),
        mapLong: double().notNull(),
        trail: json().notNull(),
        length: float(),
        author: varchar({ length: 128 }).notNull(),
        created: timestamp().defaultNow().notNull(),
        editor: varchar({ length: 128 }),
        updated: timestamp().onUpdateNow()
    },
    (table) => [
        index('titleIdx').on(table.title)
    ]
);

export const trailRelations = relations(hikingTrails, ({ many }) => ({
    pictures: many(pictures),
}));

export const pictures = mysqlTable("pictures", {
    id: serial('id').primaryKey().autoincrement(),
    trailID: varchar('trailID', { length: 48 }),
    imageUrl: varchar({ length: 128 }),
    caption: varchar({ length: 128 }),
    latitude: double(),
    longitude: double(),
    description: text()
})

export const pictureRelations = relations(pictures, ({ one }) => ({
    hikingTrail: one(hikingTrails, ({
        fields: [pictures.trailID],
        references: [hikingTrails.id]
    }))
}))