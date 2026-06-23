import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import { env } from '$env/dynamic/private';


export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "mysql",
    }),
    secret: env.BETTER_AUTH_SECRET || "development-secret-only-for-build",
    baseURL: env.BETTER_AUTH_URL || "http://localhost:5173/api/auth",
    basePath: "/api/auth",
    trustedOrigins:["http://localhost:5173"],
    trustHost: true,
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 30 * 60, // 30 minutes
        },
    },
    
    user: {
        additionalFields: {
            roles: {
                type: "json",
                required: false,
                input: false,
            },
            claims: {
                type: "json",
                required: false,
                input: false,
            },
        },
        deleteUser: { 
            enabled: true
        },
        changeEmail: {
            enabled: true,
            updateEmailWithoutVerification: true
        }
    },
    emailAndPassword: { 
        enabled: true, 
    },
    plugins: [sveltekitCookies(getRequestEvent)],
});