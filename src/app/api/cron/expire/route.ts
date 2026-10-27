/**
 * Do not delete media merely because its upload is old. Some project references
 * exist only in a user's browser and are absent from the account database.
 * Until the reference registry covers both, retain all originals conservatively.
 * Storage quotas bound new use; user-requested deletion remains available.
 */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Not found',{status:404});
 return Response.json({ok:true,removed:0,deferred:true,reason:'Saved-project media protection: automatic expiry is paused.'});
}
