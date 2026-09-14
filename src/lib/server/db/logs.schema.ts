import { index, mysqlTable, text, timestamp } from "drizzle-orm/mysql-core";

export const mapboxRequestLog = mysqlTable(
    "mapbox_request_log",
    {
        requestUrl: text("request_url").notNull(),
        createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    },
    (table) => [index("mapbox_request_log_created_at_idx").on(table.createdAt)],
);
