import { command } from "$app/server";
import { user } from "$lib/server/db/auth.schema";
import { db } from "$lib/server/db";
import * as v from "valibot";
import { getAuthenticatedUser } from "$lib/authorization";
import { getStorageProvider } from "$lib/server/blob-storage";
import { eq } from "drizzle-orm";


export const saveImage = command(
  v.object({
    fileName: v.string(),
    content: v.string(),
    oldImageUrl: v.optional(v.string()),
  }),
  async (imageData) => {
    const authUser = getAuthenticatedUser();
    const base64Data = imageData.content.includes("base64,")
      ? imageData.content.split("base64,")[1]
      : imageData.content;
    const buffer = Buffer.from(base64Data, "base64");

    const imagePath = `cms/userImages/${authUser.id}-${imageData.fileName}`;
    const provider = getStorageProvider();

    if (imageData.oldImageUrl && imageData.oldImageUrl !== "") {
      await provider.delete(imageData.oldImageUrl);
    }

    const url = await provider.put(imagePath, buffer);
    await db.update(user).set({ image: url }).where(eq(user.id, authUser.id));

    return url;
  },
);
