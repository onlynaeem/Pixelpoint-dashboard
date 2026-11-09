// Native/production bootstrap using the existing environment; never pass passwords on the command line.
import {start} from '../cloud/server.mjs';
if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)throw Error('Set ADMIN_EMAIL, ADMIN_PASSWORD and BOOTSTRAP_TENANT_ID in the process environment.');
const app=await start(0);await app.close();console.log('Administrator bootstrap completed. Existing brand users were not overwritten.');

