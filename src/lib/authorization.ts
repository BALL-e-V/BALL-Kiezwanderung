import { getRequestEvent } from '$app/server';
import type { UserWithRolesAndClaims } from './auth.d';

export type Feature = 'trailMaking';

/**
 * Get the authenticated user from the request event locals.
 * Throws an error if the user is not authenticated.
 */
export function getAuthenticatedUser(): UserWithRolesAndClaims {
    const event = getRequestEvent();
    if (!event.locals.user) {
        throw new Error('Unauthorized');
    }
    return event.locals.user as UserWithRolesAndClaims;
}

/**
 * Get the user from the request event locals if authenticated.
 * Returns null if not authenticated (does not throw).
 */
export function getOptionalUser(): UserWithRolesAndClaims | null {
    const event = getRequestEvent();
    return event.locals.user as UserWithRolesAndClaims | null;
}

export function parseRoles(user: UserWithRolesAndClaims): string[] {
    const raw = user?.roles;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as string[];
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function parseClaims(
    user: UserWithRolesAndClaims
): Set<Feature>| null {
    const raw = user?.claims;
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Set<Feature>;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw) as Set<Feature>;
        } catch {
            return null;
        }
    }
    return null;
}

export function hasAccess(user: UserWithRolesAndClaims, feature?: Feature): boolean {
    const roles = parseRoles(user);
    if (roles.includes('admin')) return true;

    if(feature){
        const claims = parseClaims(user);
    // Check for the current claim key
        if (claims?.has(feature)) return true;
    }

    return false;
}

export function ensureAccess(user: UserWithRolesAndClaims, feature?: Feature) {
    if (hasAccess(user, feature)) return;
    throw new Error('Forbidden');
}
