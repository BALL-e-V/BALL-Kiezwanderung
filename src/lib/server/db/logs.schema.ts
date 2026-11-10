import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
  serial,
  json,
  double,
} from "drizzle-orm/mysql-core";

export const mapboxRequestLog = mysqlTable("mapbox_request_log", {
  index: serial().primaryKey(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  requestUrl: text("request_url").notNull(),
});

export const mapboxMonthlyUsageLog = mysqlTable("mapbox_monthly_usage_log", {
  month: varchar("month", { length: 7 }).primaryKey(), // format: 'YYYY-MM'
  usageCount: int("usage_count").notNull().default(0),
});

export const directionErrorLog = mysqlTable("direction_error_log", {
  index: serial().primaryKey(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  trailId: varchar("trail_id", { length: 191 }).notNull(),
  trailData: json("trail_data").notNull(),
  waypointData: json("waypoint_data").notNull(),
  directionData: json("direction_data").notNull(),
  locationlat: double("location_lat").notNull(),
  locationlng: double("location_lng").notNull(),
});
