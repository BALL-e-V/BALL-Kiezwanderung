import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const mapboxRequestLog = mysqlTable("mapbox_request_log", {
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull().primaryKey(),
    requestUrl: text("request_url").notNull(),
});

export const mapboxMonthlyUsageLog = mysqlTable("mapbox_monthly_usage_log", {
    month: varchar("month", { length: 7 }).primaryKey(), // format: 'YYYY-MM'
    usageCount: int("usage_count").notNull().default(0),
});
