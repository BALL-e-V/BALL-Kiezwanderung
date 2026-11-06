import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { auth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'
import type { UserWithRolesAndClaims } from '$lib/auth.d';

const playwrightUser: UserWithRolesAndClaims = {
	id: 'playwright-trail-editor',
	name: 'Playwright Trail Editor',
	email: 'playwright-trail-editor@example.test',
	emailVerified: true,
	image: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	roles: [],
	claims: { has: (claim: string) => claim === 'trailMaking' },
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (
		process.env.NODE_ENV === 'development' &&
		process.env.PLAYWRIGHT_TEST_AUTH === '1' &&
		(event.url.hostname === 'localhost' || event.url.hostname === '127.0.0.1') &&
		!event.url.pathname.startsWith('/api/auth')
	) {
		event.locals.user = playwrightUser;
		event.locals.session = undefined;
		return resolve(event);
	}

	const result = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = result?.session;
	event.locals.user = result?.user;
	return svelteKitHandler({ event, resolve, auth, building });
};

const handleParaglide: Handle = ({ event, resolve }) => paraglideMiddleware(event.request, ({ request, locale }) => {
	event.request = request;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
	});
});

export const handle: Handle = sequence(handleBetterAuth, handleParaglide);
