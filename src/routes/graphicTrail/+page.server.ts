import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ensureAccess, getOptionalUser} from '$lib/authorization';




export const load: PageServerLoad = async ({request}) =>{

    const user = getOptionalUser();
     if(!user){
        redirect(307, '/login?graphicTrail');
    }
ensureAccess(user,'trailMaking')

}