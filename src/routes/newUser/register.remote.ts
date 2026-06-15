import { query,command } from "$app/server";
import { user } from "$lib/server/db/auth.schema";
import {db}from "$lib/server/db";
import * as v from "valibot";
import { success } from "better-auth";
import{eq}from "drizzle-orm"
import { parseRoles } from "$lib/authorization";

export const allUsers = query (async()=>{
    try{ 
        const users = await db.select({name:user.name,email:user.email}).from(user)
        return users
    }catch(error){
        throw(error)
    }
})

