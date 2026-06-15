import { command, query } from "$app/server";
import * as v from "valibot";
import { poi, trailsToPoi } from '$lib/server/db/trails.schema';
import { db } from "$lib/server/db";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";
import { sql } from "drizzle-orm/sql/sql";
import { getStorageProvider } from "$lib/server/blob-storage";

type createPOI = typeof poi.$inferInsert;

export const savePOI = command(v.object({
  caption: v.string(),
  imageUrl: v.string(),
  description: v.string(),
lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  id: v.string(),
  author:v.string(),
  imageAlt: v.string(),
  poiPositionUpdate: v.boolean(),
  trailId: v.string(),
  position1: v.number(),
  position2: v.number()
}), async (data) => {

    if(data.id === "") {
        //create new POI when it has no id and therefore isnt in the db
        const newpoi: createPOI ={
            caption:data.caption,
            imageUrl:data.imageUrl,
            description:data.description,
            latitude:data.lat,
            longitude:data.lng,
            author:data.author,
            editor:data.author,
            imageAlt:data.imageAlt
        }
        try {
            const result = await db.insert(poi).values(newpoi).$returningId();
            data.id = result[0].id;
        } catch (error) {
            throw error
        }
    } else {
        //update existing POI with the given id
        try { 
            await db.update(poi).set({     
                caption:data.caption,
                imageUrl:data.imageUrl,
                description:data.description,
                latitude:data.lat,
                longitude:data.lng,
                editor:data.author
        }).where(eq(poi.id, data.id))
        }catch (error) {
            throw error
        }
    }
    if (data.poiPositionUpdate) {
        //if the position of the poi was updated we need to update the relation in the database so the poi is still connected to the trail
        try {
          await saveTrailPOIRelation([{
            poiId:data.id,
            trailId:data.trailId,
            position1:data.position1,
            position2:data.position2
          }]);
        } catch (err) {
          console.log(err);
        }
    }
return data.id;
})
//i need the capability to upsert an aray of relations if a trail gets updated 
export const saveTrailPOIRelation = command(v.array(v.object({
    trailId: v.string(),
    poiId: v.string(), 
    position1: v.number(),
    position2: v.number()
})), async (data) => {

    const values = data.map((item) => {
        return {
            trailId: item.trailId,
            poiId: item.poiId,
            position1: item.position1,
            position2: item.position2
        }
    })

    try {        
        await db.insert(trailsToPoi).values(values).onDuplicateKeyUpdate({
            set: {
                position1: sql`values(position1)`,
                position2: sql`values(position2)`
            }
        })
    }catch (error) {
        throw error
        };
})
//delete the relation and if no relatiosn remain the poi
export const deleteTrailPOIRelation = command(v.object({
    trailId: v.string(),
    poiId: v.string(),
}), async (data) => {
    try {
        await db.delete(trailsToPoi).where(and(eq(trailsToPoi.trailId, data.trailId), eq(trailsToPoi.poiId, data.poiId)));
        const remainingRelations = await db.query.trailsToPoi.findFirst({
            where: eq(trailsToPoi.poiId, data.poiId)
        });
        if (!remainingRelations) {
            deletePOI(data.poiId )            
        }
    } catch (error) {
        throw error;
    }
});




export const saveImage = command( v.object({
    fileName: v.string(),
    poiId: v.string(),
    oldImageUrl: v.string(),
    content: v.string(), // Base64 string
}), async (imageData) => {

    try {
        const base64Data = imageData.content.includes('base64,') ? imageData.content.split('base64,')[1] : imageData.content;
        const buffer = Buffer.from(base64Data, 'base64');

        const imagePath = `cms/poiImages/${imageData.poiId}-${imageData.fileName}`;

        const provider = getStorageProvider();

        if(imageData.oldImageUrl && imageData.oldImageUrl !== "") {
            await provider.delete(imageData.oldImageUrl);
        }

        const url = await provider.put(imagePath, buffer);
        try{
        await db.update(poi).set({ imageUrl: url }).where(eq(poi.id, imageData.poiId));
        } catch (error) {
            throw error
        }

        return url
    } catch (error) {
        throw error
    }

})


export const deletePOI = command(v.string(), async (id) => {
    try {
        const poiImage = await db.select({ imageUrl: poi.imageUrl }).from(poi).where(eq(poi.id, id))
        if (poiImage[0].imageUrl && poiImage[0].imageUrl !== "") {
            const provider = getStorageProvider();
                await provider.delete(poiImage[0].imageUrl);
        }

            await db.delete(poi).where(eq(poi.id, id));
        } catch (error) {
            throw error;
        }
        
});

export const allPOIs = query(async () => {
    try {
        const pois = await db.query.poi.findMany();
        return pois;
    } catch (error) {
        throw error
    }
})

export const allRelations =query(async () => {
    try {
        const relations = await db.query.trailsToPoi.findMany();
        return relations;
    } catch (error) {
        throw error
    }
})