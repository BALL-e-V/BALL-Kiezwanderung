import { auth } from "$lib/auth";
import type { RequestHandler } from '@sveltejs/kit';


//handler for interations with betterAuth, register login etc

const handler: RequestHandler = async ({ request }) => {
	return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;