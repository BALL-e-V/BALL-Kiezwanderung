import { query,command } from "$app/server";
import { user } from "$lib/server/db/auth.schema";
import {db}from "$lib/server/db";
import * as v from "valibot";
import { success } from "better-auth";
import{eq}from "drizzle-orm"
import {hikingTrails, poi} from "$lib/server/db/trails.schema"
export const allUsers = query (async()=>{
    try{ 
        const users = await db.select({name:user.name,email:user.email,userID:user.id}).from(user)
        return users
    }catch(error){
        throw(error)
    }
})



export const makeAdmin = command(v.string(), async (userId) => {

    try {
        const response = await db
            .select({ roles: user.roles})
            .from(user)
            .where(eq(user.id, userId));

        const raw = response[0];
        if (!raw) {
            throw new Error('User not found');
        }

        const currentRoles = (() => {
            const rawRoles = raw.roles;
            if (!rawRoles) return [] as string[];
            if (Array.isArray(rawRoles)) return rawRoles as string[]
            if (typeof rawRoles === 'string') {
                try {
                    const parsed = JSON.parse(rawRoles);
                    if (Array.isArray(parsed)) {
                        return parsed as string[]
                    }
                } catch {
                    throw new Error("could not parse roles data")
                }
            }
            return [] as string[];
        })();

        const updatedRoles = [...new Set([...currentRoles, 'admin'])];
        await db.update(user).set({ roles: updatedRoles }).where(eq(user.id, userId));
    } catch (error) {
        throw error;
    }

    return success;
 });