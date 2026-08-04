import { httpServerHandler } from 'cloudflare:node';
import './index';

export default httpServerHandler({ port: 3001 });
