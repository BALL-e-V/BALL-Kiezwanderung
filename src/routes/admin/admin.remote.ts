import { query,command,getRequestEvent } from "$app/server";
import { user } from "$lib/server/db/auth.schema";
import {db}from "$lib/server/db";
import * as v from "valibot";
import{eq}from "drizzle-orm"
import { ensureAccess, getAuthenticatedUser} from '$lib/authorization';
import { auth } from "$lib/auth";
import { getStorageProvider } from "$lib/server/blob-storage";

export const allUsers = query (async()=>{
    ensureAccess(getAuthenticatedUser());
    try{ 
        const users = await db.select({name:user.name,email:user.email,id:user.id}).from(user)
        return users
    }catch(error){
        throw(error)
    }
})


export const loadUser = command(v.string(), async (userId) => {
    ensureAccess(getAuthenticatedUser());
    try {
        const rows = await db
            .select({ image: user.image, roles: user.roles, claims: user.claims })
            .from(user)
            .where(eq(user.id, userId));
        return rows[0] ?? null;
    } catch (error) {
        throw error;
    }
});



export const updateUser = command(v.object({
        id:v.string(),
        name:v.string(),
        eMail:v.string(),
        password:v.string(),
        changedRoles:v.boolean(),
        roles:v.set(v.pipe(v.string(),v.values(["admin"]))),
        claims:v.set(v.pipe(v.string(),v.values(["trailMaking"])))
    }),async (userData)=>{

        ensureAccess(getAuthenticatedUser());
        if(userData.changedRoles){
            try{
            await auth.api.verifyPassword({
                    body: {
                        password: userData.password // required
                    },
                headers: getRequestEvent().request.headers // headers containing the user's session token
    
            });}catch(error){
                console.log(error)
                return "falsches Passwort"
            }
            try{
                
                await db.update(user).set({
                    name:userData.name,
                    email:userData.eMail,
                    //sets don't save in the json preset in mysql, so array it is
                    roles:Array.from(userData.roles),
                    claims:Array.from(userData.claims),
                }).where(eq(user.id,userData.id))
            }catch(error){
                throw(error)
            }finally{
                return "Gespeichert"
            }
        }else{
             try{
                await db.update(user).set({
                    name:userData.name,
                    email:userData.eMail,
                    //sets don't save in the json preset in mysql, so array it is
                    claims:Array.from(userData.claims),
                }).where(eq(user.id,userData.id))
            }catch(error){
                throw(error)
            }finally{
                return "Gespeichert"
            }
        }

    })


export const saveImage = command( v.object({
    fileName: v.string(),
    userId:v.string(),
    oldImageUrl:v.string(),
    content: v.string(), // Base64 string
}), async (imageData) => {
ensureAccess(getAuthenticatedUser());
    try {
        const base64Data = imageData.content.includes('base64,') ? imageData.content.split('base64,')[1] : imageData.content;
        const buffer = Buffer.from(base64Data, 'base64');

        const imagePath = `cms/userImages/${imageData.userId}-${imageData.fileName}`;

        const provider = getStorageProvider();

        if(imageData.oldImageUrl && imageData.oldImageUrl !== "") {
            await provider.delete(imageData.oldImageUrl);
        }

        const url = await provider.put(imagePath, buffer);
        try{
        await db.update(user).set({ image: url }).where(eq(user.id, imageData.userId));
        } catch (error) {

            throw error
        }

        return url
    } catch (error) {
        throw error
    }

})